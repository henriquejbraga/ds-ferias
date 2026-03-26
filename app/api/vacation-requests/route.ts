import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, shouldForcePasswordChange } from "@/lib/auth";
import { buildManagedRequestsWhere } from "@/lib/requestVisibility";
import { type VacationStatus } from "../../../generated/prisma/enums";
import {
  validateCltPeriods,
  checkBlackoutPeriods,
  calculateVacationBalance,
  PENDING_OR_APPROVED_VACATION_STATUSES,
} from "@/lib/vacationRules";
import { notifyNewRequest } from "@/lib/notifications";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  syncAcquisitionPeriodsForUser,
  findAcquisitionPeriodsForUser,
} from "@/repositories/acquisitionRepository";
import { validateVacationConcessiveFifo } from "@/lib/concessivePeriod";
import { buildInclusiveOverlapConditions } from "@/lib/validation";

const POST_REQUESTS_MAX_PER_MINUTE = 20;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function toUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysBetweenInclusive(start: Date, end: Date): number {
  const s = toUtcMidnight(start);
  const e = toUtcMidnight(end);
  return Math.round((e.getTime() - s.getTime()) / ONE_DAY_MS) + 1;
}

function getChargeableDays(start: Date, end: Date, hasAbono: boolean): number {
  const raw = daysBetweenInclusive(start, end);
  const clamped = Math.min(Math.max(1, raw), 30);
  void hasAbono;
  return clamped;
}

function overlapDaysInclusive(start: Date, end: Date, rangeStart: Date, rangeEnd: Date): number {
  const s = new Date(Math.max(toUtcMidnight(start).getTime(), toUtcMidnight(rangeStart).getTime()));
  const e = new Date(Math.min(toUtcMidnight(end).getTime(), toUtcMidnight(rangeEnd).getTime()));
  if (e < s) return 0;
  return daysBetweenInclusive(s, e);
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

function addMonthsUtc(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const tentative = new Date(Date.UTC(y, m + months, d));
  if (tentative.getUTCDate() !== d) {
    const lastDay = new Date(Date.UTC(y, m + months + 1, 0));
    return lastDay;
  }
  return tentative;
}

function getCurrentCycleRange(today: Date, hireDate: Date | null | undefined) {
  const now = toUtcMidnight(today);
  if (!hireDate) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), 11, 31));
    return { start, end };
  }

  const hire = toUtcMidnight(hireDate);
  const start = new Date(Date.UTC(now.getUTCFullYear(), hire.getUTCMonth(), hire.getUTCDate()));
  if (start > now) start.setUTCFullYear(start.getUTCFullYear() - 1);
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  end.setUTCDate(end.getUTCDate() - 1);
  return { start, end };
}

async function hasOverlappingRequest(userId: string, startDate: Date, endDate: Date) {
  const overlapConditions = buildInclusiveOverlapConditions(startDate, endDate);
  const overlapping = await prisma.vacationRequest.findFirst({
    where: {
      userId,
      status: {
        in: [...PENDING_OR_APPROVED_VACATION_STATUSES],
      },
      AND: overlapConditions,
    },
  });
  return Boolean(overlapping);
}


export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (shouldForcePasswordChange(user)) {
    return NextResponse.json({ error: "Você precisa trocar a senha antes de continuar." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;
  const statusParam = searchParams.get("status") ?? undefined;

  const where: Record<string, unknown> =
    user.role === "COLABORADOR" || user.role === "FUNCIONARIO"
      ? { userId: user.id }
      : buildManagedRequestsWhere(user.id, user.role, {
          query: q,
          status: statusParam && statusParam !== "TODOS" ? statusParam : undefined,
        });

  if (statusParam && statusParam !== "TODOS") {
    where.status = statusParam as VacationStatus;
  }
  if (q && (user.role === "COLABORADOR" || user.role === "FUNCIONARIO")) {
    where.user = { name: { contains: q, mode: "insensitive" as const } };
  }

  const requests = await prisma.vacationRequest.findMany({
    where: where as Record<string, unknown>,
    include: { user: { select: { name: true, email: true } } },
    orderBy: { startDate: "desc" },
  });

  return NextResponse.json({ requests });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (shouldForcePasswordChange(user)) {
    return NextResponse.json({ error: "Você precisa trocar a senha antes de continuar." }, { status: 403 });
  }

  if (!checkRateLimit(`vacation-post:${user.id}`, POST_REQUESTS_MAX_PER_MINUTE)) {
    return NextResponse.json(
      { error: "Muitas solicitações. Aguarde um momento antes de criar outra." },
      { status: 429 },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  let startDateRaw: string | null = null;
  let endDateRaw: string | null = null;
  let periodsRaw: { startDate: string; endDate: string }[] | null = null;
  let notes: string | null = null;
  let abono: boolean = false;
  let thirteenth: boolean = false;

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null);
    periodsRaw = Array.isArray(body?.periods) ? body.periods : null;
    startDateRaw = body?.startDate ?? null;
    endDateRaw = body?.endDate ?? null;
    notes = body?.notes ?? null;
    abono = Boolean(body?.abono);
    thirteenth = Boolean(body?.thirteenth);
  } else {
    const form = await request.formData().catch(() => null);
    if (form) {
      startDateRaw = (form.get("startDate") as string) ?? null;
      endDateRaw = (form.get("endDate") as string) ?? null;
    }
  }

  let periods: { start: Date; end: Date }[] = [];

  if (periodsRaw && periodsRaw.length > 0) {
    periods = periodsRaw
      .filter((p) => p.startDate && p.endDate)
      .slice(0, 3)
      .map((p) => ({
        start: new Date(`${p.startDate}T12:00:00Z`),
        end: new Date(`${p.endDate}T12:00:00Z`),
      }));
  } else if (startDateRaw && endDateRaw) {
    periods = [{ start: new Date(`${startDateRaw}T12:00:00Z`), end: new Date(`${endDateRaw}T12:00:00Z`) }];
  }

  if (!periods.length) {
    return NextResponse.json({ error: "É necessário informar ao menos um período de férias." }, { status: 400 });
  }

  // Buscar usuário e períodos de bloqueio para validações
  const [blackouts, userFull] = await Promise.all([
    prisma.blackoutPeriod.findMany(),
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        hireDate: true,
        department: true,
        vacationRequests: {
          select: { startDate: true, endDate: true, status: true },
        },
      },
    }),
  ]);

  const statusesAwaitingRH = PENDING_OR_APPROVED_VACATION_STATUSES;

  // Períodos aquisitivos: FIFO. O gozo deve caber no período concessivo (12 meses após o fim de cada PA).
  // Sem `hireDate` não aplicamos essa validação (legado).
  if (userFull?.hireDate) {
    if (user.role === "GERENTE" || user.role === "DIRETOR") {
      const WORKING_DAYS_LIMIT_PER_CYCLE = 22;
      const cycle = getCurrentCycleRange(new Date(), userFull.hireDate);
      const cycleRequests = await prisma.vacationRequest.findMany({
        where: {
          userId: user.id,
          status: { in: [...PENDING_OR_APPROVED_VACATION_STATUSES] },
          AND: [{ startDate: { lte: cycle.end } }, { endDate: { gte: cycle.start } }],
        },
        select: { startDate: true, endDate: true },
      });

      const usedInCycle = cycleRequests.reduce(
        (sum, r) => sum + overlapBusinessDaysInclusive(r.startDate, r.endDate, cycle.start, cycle.end),
        0,
      );
      const requestedInCycle = periods.reduce(
        (sum, p) => sum + overlapBusinessDaysInclusive(p.start, p.end, cycle.start, cycle.end),
        0,
      );
      const totalInCycle = usedInCycle + requestedInCycle;

      if (totalInCycle > WORKING_DAYS_LIMIT_PER_CYCLE) {
        return NextResponse.json(
          {
            error: `Para ${user.role === "GERENTE" ? "gerente" : "diretor"}, o limite é de ${WORKING_DAYS_LIMIT_PER_CYCLE} dias úteis por ciclo. Neste ciclo você já tem ${usedInCycle} dia(s) útil(eis) e está tentando adicionar mais ${requestedInCycle}.`,
          },
          { status: 400 },
        );
      }
    }

    await syncAcquisitionPeriodsForUser(user.id, userFull.hireDate);

    const todayUtc = toUtcMidnight(new Date());
    const hireUtc = toUtcMidnight(new Date(userFull.hireDate));

    let monthsWorked =
      (todayUtc.getUTCFullYear() - hireUtc.getUTCFullYear()) * 12 + (todayUtc.getUTCMonth() - hireUtc.getUTCMonth());
    if (todayUtc.getUTCDate() < hireUtc.getUTCDate()) monthsWorked -= 1;
    monthsWorked = Math.max(0, monthsWorked);

    const yearsWorked = Math.floor(monthsWorked / 12);
    const MAX_CYCLES = 2;
    const acquiredCount = Math.min(yearsWorked, MAX_CYCLES);

    const firstEntitlementDate = addMonthsUtc(hireUtc, 12);

    if (acquiredCount < 1) {
      const invalidStart = periods.find((p) => toUtcMidnight(p.start) < firstEntitlementDate);
      if (invalidStart) {
        return NextResponse.json(
          {
            error: `Pré-agendamento permitido somente com início a partir de ${firstEntitlementDate.toLocaleDateString("pt-BR")}, quando você completa 12 meses de empresa.`,
          },
          { status: 400 },
        );
      }

      const pendingRequests = await prisma.vacationRequest.findMany({
        where: {
          userId: user.id,
          status: { in: [...statusesAwaitingRH] },
          startDate: { gte: firstEntitlementDate },
        },
        select: { startDate: true, endDate: true, abono: true },
      });
      const existingDaysInCycle = pendingRequests.reduce(
        (sum, r) => sum + getChargeableDays(r.startDate, r.endDate, !!r.abono),
        0,
      );

      const cltError = validateCltPeriods(periods, {
        checkAdvanceNotice: true,
        existingDaysInCycle,
        entitledDays: 30,
      });
      if (cltError) return NextResponse.json({ error: cltError }, { status: 400 });

      const totalRequestedDays = periods.reduce((sum, p) => sum + getChargeableDays(p.start, p.end, abono), 0);
      const isEmployee = user.role === "COLABORADOR" || user.role === "FUNCIONARIO";
      if (abono === true && isEmployee && totalRequestedDays !== 30) {
        return NextResponse.json(
          {
            error:
              `Com abono 1/3, a solicitação precisa totalizar exatamente 30 dias (você pode fracionar em até 3 períodos). Total selecionado: ${totalRequestedDays} dia(s).`,
          },
          { status: 400 },
        );
      }
      if (abono !== true && isEmployee && totalRequestedDays !== 30) {
        const missing = Math.max(0, 30 - totalRequestedDays);
        return NextResponse.json(
          {
            error: `Pela CLT, a solicitação precisa totalizar <strong>30 dias</strong> (pode fracionar em até 3 períodos). Você selecionou ${totalRequestedDays} dia(s). Faltam ${missing} dia(s) para continuar.`,
          },
          { status: 400 },
        );
      }
      const totalAvailable = Math.max(0, 30 - existingDaysInCycle);
      if (totalRequestedDays > totalAvailable) {
        return NextResponse.json(
          {
            error:
              totalAvailable === 0
                ? "Você já possui 30 dias pré-agendados para o primeiro ciclo aquisitivo."
                : `Saldo insuficiente para pré-agendamento. Você tem ${totalAvailable} dia(s) disponível(is) no primeiro ciclo.`,
          },
          { status: 400 },
        );
      }
    } else {
      // Todos os períodos adquiridos (do mais antigo para o mais novo)
      const allAcquisitionPeriods: Array<{ id: string; accruedDays: number; usedDays: number }> =
        await findAcquisitionPeriodsForUser(user.id);
      const acquiredPeriods = allAcquisitionPeriods.slice(0, acquiredCount);

      if (acquiredPeriods.length === 0) {
        return NextResponse.json({ error: "Sem períodos aquisitivos disponíveis para este usuário." }, { status: 400 });
      }

      // Saldo total adquirido e usado nos períodos efetivamente earned
      const totalEntitled = acquiredPeriods.reduce((sum, p) => sum + p.accruedDays, 0);
      const totalUsed = acquiredPeriods.reduce((sum, p) => sum + p.usedDays, 0);

      // Dias pendentes — deduzidos do saldo total.
      // Importante: NÃO incluir aprovados aqui, pois eles já estão em `usedDays`.
      const pendingRequests = await prisma.vacationRequest.findMany({
        where: {
          userId: user.id,
          status: "PENDENTE",
        },
        select: { startDate: true, endDate: true, abono: true },
      });
      const totalPending = pendingRequests.reduce(
        (sum, r) => sum + getChargeableDays(r.startDate, r.endDate, !!r.abono),
        0,
      );

      const totalAvailable = Math.max(0, totalEntitled - totalUsed - totalPending);
      const existingDaysInCycle = totalUsed + totalPending;

      // Validação CLT (fracionamento, aviso prévio, etc.)
      const cltError = validateCltPeriods(periods, {
        checkAdvanceNotice: true,
        existingDaysInCycle,
        entitledDays: totalEntitled,
      });
      if (cltError) return NextResponse.json({ error: cltError }, { status: 400 });

      // Saldo suficiente?
      const totalRequestedDays = periods.reduce((sum, p) => sum + getChargeableDays(p.start, p.end, abono), 0);
      const isEmployee = user.role === "COLABORADOR" || user.role === "FUNCIONARIO";
      if (abono === true && isEmployee && totalRequestedDays !== 30) {
        return NextResponse.json(
          {
            error:
              `Com abono 1/3, a solicitação precisa totalizar exatamente 30 dias (você pode fracionar em até 3 períodos). Total selecionado: ${totalRequestedDays} dia(s).`,
          },
          { status: 400 },
        );
      }
      if (abono !== true && isEmployee && totalRequestedDays !== 30) {
        const missing = Math.max(0, 30 - totalRequestedDays);
        return NextResponse.json(
          {
            error: `Pela CLT, a solicitação precisa totalizar <strong>30 dias</strong> (pode fracionar em até 3 períodos). Você selecionou ${totalRequestedDays} dia(s). Faltam ${missing} dia(s) para continuar.`,
          },
          { status: 400 },
        );
      }
      if (totalRequestedDays > totalAvailable) {
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
    }

    const pendingPendente = await prisma.vacationRequest.findMany({
      where: { userId: user.id, status: "PENDENTE" },
      orderBy: { startDate: "asc" },
      select: { startDate: true, endDate: true },
    });
    const periodsForConcessive = await findAcquisitionPeriodsForUser(user.id);
    const concessiveErr = validateVacationConcessiveFifo({
      hireDate: userFull.hireDate,
      acquisitionPeriods: periodsForConcessive,
      pendingVacations: pendingPendente,
      newVacationPeriods: periods,
    });
    if (concessiveErr) {
      return NextResponse.json({ error: concessiveErr }, { status: 400 });
    }
  } else {
    // Fallback: sem hireDate não conseguimos resolver períodos aquisitivos com fidelidade.
    const balanceForValidation =
      userFull && userFull.vacationRequests
        ? calculateVacationBalance(userFull.hireDate, userFull.vacationRequests)
        : null;
    const existingDaysInCycle = balanceForValidation ? balanceForValidation.pendingDays + balanceForValidation.usedDays : 0;
    const entitledDays = balanceForValidation?.entitledDays ?? 30;

    const cltError = validateCltPeriods(periods, {
      checkAdvanceNotice: true,
      existingDaysInCycle,
      entitledDays,
    });
    if (cltError) return NextResponse.json({ error: cltError }, { status: 400 });
  }

  for (const p of periods) {
    if (isNaN(p.start.getTime()) || isNaN(p.end.getTime()) || p.end < p.start) {
      return NextResponse.json({ error: "Período inválido." }, { status: 400 });
    }

    // Blackout check
    const blackoutError = checkBlackoutPeriods(
      p.start,
      p.end,
      blackouts.map((b) => ({
        startDate: b.startDate,
        endDate: b.endDate,
        reason: b.reason,
        department: b.department,
      })),
      userFull?.department,
    );
    if (blackoutError) return NextResponse.json({ error: blackoutError }, { status: 400 });

    // Overlap check
    const overlap = await hasOverlappingRequest(user.id, p.start, p.end);
    if (overlap) {
      return NextResponse.json(
        { error: "Já existe uma solicitação (pendente ou aprovada) que conflita com este período." },
        { status: 400 },
      );
    }
  }

  const created = await prisma.$transaction(
    periods.map((p) =>
      prisma.vacationRequest.create({
        data: {
          userId: user.id,
          startDate: p.start,
          endDate: p.end,
          notes,
          abono,
          thirteenth,
        },
      }),
    ),
  );

  const first = created[0];
  if (first && user.name && user.email) {
    const withManager = await prisma.user.findUnique({
      where: { id: user.id },
      select: { manager: { select: { email: true } } },
    }).catch(() => null);
    notifyNewRequest({
      requestId: first.id,
      userName: user.name,
      userEmail: user.email,
      managerEmail: withManager?.manager?.email ?? null,
      startDate: first.startDate,
      endDate: first.endDate,
    }).catch(() => {});
  }

  return NextResponse.json({ requests: created }, { status: 201 });
}
