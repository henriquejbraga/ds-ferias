import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, shouldForcePasswordChange } from "@/lib/auth";
import {
  checkBlackoutPeriods,
  getRoleLevel,
  hasTeamVisibility,
  validateCltPeriod,
  PENDING_OR_APPROVED_VACATION_STATUSES,
} from "@/lib/vacationRules";
import { canIndirectLeaderActWhenDirectOnVacation } from "@/lib/indirectLeaderRule";
import { syncAcquisitionPeriodsForUser, findAcquisitionPeriodsForUser } from "@/repositories/acquisitionRepository";
import { validateVacationConcessiveFifo } from "@/lib/concessivePeriod";

type Params = {
  params: Promise<{ id: string }>;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function toUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysBetweenInclusive(start: Date, end: Date): number {
  const s = toUtcMidnight(start);
  const e = toUtcMidnight(end);
  return Math.round((e.getTime() - s.getTime()) / ONE_DAY_MS) + 1;
}

function businessDaysBetweenInclusive(start: Date, end: Date): number {
  const s = toUtcMidnight(start);
  const e = toUtcMidnight(end);
  let count = 0;
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    const weekday = d.getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += 1; // seg-sex
  }
  return count;
}

function overlapBusinessDaysInclusive(start: Date, end: Date, rangeStart: Date, rangeEnd: Date): number {
  const s = new Date(Math.max(toUtcMidnight(start).getTime(), toUtcMidnight(rangeStart).getTime()));
  const e = new Date(Math.min(toUtcMidnight(end).getTime(), toUtcMidnight(rangeEnd).getTime()));
  if (e < s) return 0;
  return businessDaysBetweenInclusive(s, e);
}

function getCurrentCycleRange(today: Date, hireDate: Date | null | undefined) {
  const now = toUtcMidnight(today);
  if (!hireDate) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), 11, 31));
    return { start, end };
  }

  const hire = toUtcMidnight(hireDate);
  let start = new Date(Date.UTC(now.getUTCFullYear(), hire.getUTCMonth(), hire.getUTCDate()));
  if (start > now) start.setUTCFullYear(start.getUTCFullYear() - 1);
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  end.setUTCDate(end.getUTCDate() - 1);
  return { start, end };
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  if (!id || id.trim().length < 3) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const user = await getSessionUser();
  if (!user || getRoleLevel(user.role) < 2) {
    return NextResponse.json(
      { error: "Somente coordenadores, gerentes ou RH podem alterar pedidos de férias." },
      { status: 403 },
    );
  }
  if (shouldForcePasswordChange(user)) {
    return NextResponse.json({ error: "Você precisa trocar a senha antes de continuar." }, { status: 403 });
  }

  const existing = await prisma.vacationRequest.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          createdAt: true,
          managerId: true,
          manager: { select: { managerId: true } },
        },
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  // Colaborador nunca pode editar o próprio pedido, mesmo pendente.
  if (existing.userId === user.id) {
    return NextResponse.json(
      { error: "O colaborador não pode editar as próprias férias. Peça ao gestor ou RH para ajustar o período." },
      { status: 403 },
    );
  }

  // Coordenador / Gerente só podem editar pedidos da sua cadeia de equipe; RH vê todos.
  if (getRoleLevel(user.role) < 5) {
    const visible = hasTeamVisibility(user.role, user.id, {
      userId: existing.userId,
      user: {
        managerId: existing.user?.managerId ?? null,
        manager: existing.user?.manager ?? null,
      },
    });
    if (!visible) {
      return NextResponse.json(
        { error: "Você não tem permissão para alterar este pedido." },
        { status: 403 },
      );
    }
  }

  if (getRoleLevel(user.role) < 5 && existing.user.managerId !== user.id) {
    const canIndirect = await canIndirectLeaderActWhenDirectOnVacation({
      approverId: user.id,
      directLeaderId: existing.user.managerId,
      directLeaderManagerId: existing.user.manager?.managerId ?? null,
      requestCreatedAt: existing.createdAt,
    });
    if (!canIndirect) {
      return NextResponse.json(
        {
          error:
            "Somente o líder direto pode editar. Líder indireto só pode editar quando o líder direto estava de férias no momento da solicitação.",
        },
        { status: 403 },
      );
    }
  }

  if (existing.status !== "PENDENTE") {
    return NextResponse.json(
      { error: "Somente pedidos pendentes podem ter o período alterado." },
      { status: 400 },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";

  let startDateRaw: string | null = null;
  let endDateRaw: string | null = null;

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null);
    startDateRaw = body?.startDate ?? null;
    endDateRaw = body?.endDate ?? null;
  } else {
    const form = await request.formData().catch(() => null);
    if (form) {
      startDateRaw = (form.get("startDate") as string) ?? null;
      endDateRaw = (form.get("endDate") as string) ?? null;
    }
  }

  if (!startDateRaw || !endDateRaw) {
    return NextResponse.json({ error: "Datas obrigatórias" }, { status: 400 });
  }

  const startDate = new Date(startDateRaw);
  const endDate = new Date(endDateRaw);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate) {
    return NextResponse.json({ error: "Período inválido" }, { status: 400 });
  }

  const cltError = validateCltPeriod(startDate, endDate);
  if (cltError) {
    return NextResponse.json({ error: cltError }, { status: 400 });
  }

  // Bloqueio e limite por período aquisitivo (AcquisitionPeriod.usedDays)
  const owner = await prisma.user.findUnique({
    where: { id: existing.userId },
    select: { hireDate: true, department: true, role: true },
  });

  if (owner?.hireDate) {
    if (owner.role === "GERENTE" || owner.role === "DIRETOR") {
      const WORKING_DAYS_LIMIT_PER_CYCLE = 22;
      const cycle = getCurrentCycleRange(new Date(), owner.hireDate);

      const cycleRequests = await prisma.vacationRequest.findMany({
        where: {
          userId: existing.userId,
          status: { in: [...PENDING_OR_APPROVED_VACATION_STATUSES] },
          id: { not: existing.id },
          AND: [{ startDate: { lte: cycle.end } }, { endDate: { gte: cycle.start } }],
        },
        select: { startDate: true, endDate: true },
      });

      const usedInCycle = cycleRequests.reduce(
        (sum, r) => sum + overlapBusinessDaysInclusive(r.startDate, r.endDate, cycle.start, cycle.end),
        0,
      );
      const requestedInCycle = overlapBusinessDaysInclusive(startDate, endDate, cycle.start, cycle.end);
      const totalInCycle = usedInCycle + requestedInCycle;

      if (totalInCycle > WORKING_DAYS_LIMIT_PER_CYCLE) {
        return NextResponse.json(
          {
            error: `Para ${owner.role === "GERENTE" ? "gerente" : "diretor"}, o limite é de ${WORKING_DAYS_LIMIT_PER_CYCLE} dias úteis por ciclo. Neste ciclo já há ${usedInCycle} dia(s) útil(eis) e esta alteração adiciona ${requestedInCycle}.`,
          },
          { status: 400 },
        );
      }
    }

    await syncAcquisitionPeriodsForUser(existing.userId, owner.hireDate);

    const todayUtc = toUtcMidnight(new Date());
    const hireUtc = toUtcMidnight(new Date(owner.hireDate));

    let monthsWorked =
      (todayUtc.getUTCFullYear() - hireUtc.getUTCFullYear()) * 12 + (todayUtc.getUTCMonth() - hireUtc.getUTCMonth());
    if (todayUtc.getUTCDate() < hireUtc.getUTCDate()) monthsWorked -= 1;
    monthsWorked = Math.max(0, monthsWorked);

    const yearsWorked = Math.floor(monthsWorked / 12);
    const MAX_CYCLES = 2;
    const acquiredCount = Math.min(yearsWorked, MAX_CYCLES);

    if (acquiredCount < 1) {
      const remainingMonths = Math.max(1, 12 - monthsWorked);
      return NextResponse.json(
        {
          error: `Você ainda não completou 12 meses de empresa para ter direito a férias. Faltam aproximadamente ${remainingMonths} meses.`,
        },
        { status: 400 },
      );
    }

    const allAcquisitionPeriods = await findAcquisitionPeriodsForUser(existing.userId);
    const acquiredPeriods = allAcquisitionPeriods.slice(0, acquiredCount) as Array<{
      accruedDays: number;
      usedDays: number;
    }>;

    if (acquiredPeriods.length === 0) {
      return NextResponse.json({ error: "Sem períodos aquisitivos disponíveis para este usuário." }, { status: 400 });
    }

    const totalEntitled = acquiredPeriods.reduce((sum, p) => sum + p.accruedDays, 0);
    const totalUsed = acquiredPeriods.reduce((sum, p) => sum + p.usedDays, 0);

    const pendingForBalance = await prisma.vacationRequest.findMany({
      where: {
        userId: existing.userId,
        // Somente pendentes: aprovados já entram em `usedDays` do período aquisitivo.
        status: "PENDENTE",
        id: { not: existing.id },
      },
      select: { startDate: true, endDate: true },
    });
    const totalPending = pendingForBalance.reduce(
      (sum, r) => sum + daysBetweenInclusive(r.startDate, r.endDate),
      0,
    );

    const totalAvailable = Math.max(0, totalEntitled - totalUsed - totalPending);
    const requestedDays = daysBetweenInclusive(startDate, endDate);
    if (requestedDays > totalAvailable) {
      return NextResponse.json(
        {
          error:
            totalAvailable === 0
              ? "Seu saldo de férias está zerado. Todos os dias adquiridos já foram usados ou estão pendentes de aprovação."
              : `Saldo insuficiente. Você tem ${totalAvailable} dia(s) disponível(is) nos ciclos aquisitivos adquiridos.`,
        },
        { status: 400 },
      );
    }

    const pendingPendente = await prisma.vacationRequest.findMany({
      where: { userId: existing.userId, status: "PENDENTE", id: { not: existing.id } },
      orderBy: { startDate: "asc" },
      select: { startDate: true, endDate: true },
    });
    const concessiveErr = validateVacationConcessiveFifo({
      hireDate: owner.hireDate,
      acquisitionPeriods: allAcquisitionPeriods,
      pendingVacations: pendingPendente,
      newVacationPeriods: [{ start: startDate, end: endDate }],
    });
    if (concessiveErr) {
      return NextResponse.json({ error: concessiveErr }, { status: 400 });
    }
  }

  // Blackout check também para update (evita bypass do enforcement via alteração de datas).
  const blackouts = await prisma.blackoutPeriod.findMany({
    select: { startDate: true, endDate: true, reason: true, department: true },
  });
  const blackoutError = checkBlackoutPeriods(
    startDate,
    endDate,
    blackouts.map((b) => ({
      startDate: b.startDate,
      endDate: b.endDate,
      reason: b.reason,
      department: b.department,
    })),
    owner?.department,
  );
  if (blackoutError) return NextResponse.json({ error: blackoutError }, { status: 400 });

  const overlapping = await prisma.vacationRequest.findFirst({
    where: {
      userId: existing.userId,
      id: { not: existing.id },
      status: { in: [...PENDING_OR_APPROVED_VACATION_STATUSES] },
      AND: [
        { startDate: { lt: endDate } },
        { endDate: { gt: startDate } },
      ],
    },
  });

  if (overlapping) {
    return NextResponse.json(
      {
        error:
          "Já existe outra solicitação de férias (pendente ou aprovada) que conflita com esse período.",
      },
      { status: 400 },
    );
  }

  const updated = await prisma.vacationRequest.update({
    where: { id },
    data: {
      startDate,
      endDate,
    },
  });

  if (!contentType.includes("application/json")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.json({ request: updated });
}

