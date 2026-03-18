import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { checkBlackoutPeriods, getRoleLevel, hasTeamVisibility, validateCltPeriod } from "@/lib/vacationRules";
import { isCuid } from "@/lib/validation";
import {
  syncAcquisitionPeriodsForUser,
  findAcquisitionPeriodForRange,
  findAcquisitionPeriodsForUser,
} from "@/repositories/acquisitionRepository";

type Params = {
  params: Promise<{ id: string }>;
};

const ACTIVE_STATUSES = ["PENDENTE", "APROVADO_COORDENADOR", "APROVADO_GESTOR", "APROVADO_GERENTE", "APROVADO_RH"] as const;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function toUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysBetweenInclusive(start: Date, end: Date): number {
  const s = toUtcMidnight(start);
  const e = toUtcMidnight(end);
  return Math.round((e.getTime() - s.getTime()) / ONE_DAY_MS) + 1;
}

function overlapDaysInclusive(start: Date, end: Date, rangeStart: Date, rangeEnd: Date): number {
  const s = new Date(Math.max(toUtcMidnight(start).getTime(), toUtcMidnight(rangeStart).getTime()));
  const e = new Date(Math.min(toUtcMidnight(end).getTime(), toUtcMidnight(rangeEnd).getTime()));
  if (e < s) return 0;
  return daysBetweenInclusive(s, e);
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  if (!isCuid(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const user = await getSessionUser();
  if (!user || getRoleLevel(user.role) < 2) {
    return NextResponse.json(
      { error: "Somente coordenadores, gerentes ou RH podem alterar pedidos de férias." },
      { status: 403 },
    );
  }

  const existing = await prisma.vacationRequest.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
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
  if (getRoleLevel(user.role) < 4) {
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
    select: { hireDate: true, department: true },
  });

  const statusesAwaitingRH = ["PENDENTE", "APROVADO_COORDENADOR", "APROVADO_GESTOR", "APROVADO_GERENTE"] as const;

  if (owner?.hireDate) {
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
    const periodIndexById = new Map<string, number>(
      allAcquisitionPeriods.map((p: { id: string }, i: number) => [p.id, i]),
    );

    const acquisitionPeriod = await findAcquisitionPeriodForRange(existing.userId, startDate, endDate);
    if (!acquisitionPeriod) {
      return NextResponse.json(
        {
          error:
            "Período fora dos ciclos aquisitivos adquiridos. Só é permitido solicitar/alterar férias dentro do período aquisitivo atual (12 meses).",
        },
        { status: 400 },
      );
    }

    const idx = periodIndexById.get(acquisitionPeriod.id);
    if (idx === undefined || idx >= acquiredCount) {
      return NextResponse.json(
        { error: "Você ainda não adquiriu o período aquisitivo correspondente (completou os 12 meses)." },
        { status: 400 },
      );
    }

    const usedDays = acquisitionPeriod.usedDays;
    const accruedDays = acquisitionPeriod.accruedDays;

    // Pending days no mesmo período aquisitivo (exceto a própria solicitação que está sendo atualizada).
    const pending = await prisma.vacationRequest.findMany({
      where: {
        userId: existing.userId,
        status: { in: [...statusesAwaitingRH] },
        id: { not: existing.id },
        AND: [
          { startDate: { lte: acquisitionPeriod.endDate } },
          { endDate: { gte: acquisitionPeriod.startDate } },
        ],
      },
      select: { startDate: true, endDate: true },
    });

    const pendingDays = pending.reduce(
      (sum, r) =>
        sum + overlapDaysInclusive(r.startDate, r.endDate, acquisitionPeriod.startDate, acquisitionPeriod.endDate),
      0,
    );

    if (usedDays >= accruedDays) {
      return NextResponse.json(
        {
          error:
            "Seu período aquisitivo atual já foi totalmente consumido. Você só poderá solicitar/alterar novas férias após a aquisição do próximo período (12 meses).",
        },
        { status: 400 },
      );
    }

    const requestedDays = daysBetweenInclusive(startDate, endDate);
    const available = accruedDays - usedDays - pendingDays;
    if (requestedDays > available) {
      return NextResponse.json(
        {
          error: `Saldo insuficiente no período aquisitivo ${acquisitionPeriod.startDate.toISOString().slice(0, 10)}–${acquisitionPeriod.endDate.toISOString().slice(0, 10)}. Disponível: ${available} dias.`,
        },
        { status: 400 },
      );
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
      status: { in: [...ACTIVE_STATUSES] },
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

