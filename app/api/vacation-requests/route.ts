import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { buildManagedRequestsWhere } from "@/lib/requestVisibility";
import { type VacationStatus } from "../../../generated/prisma/enums";
import {
  validateCltPeriods,
  checkBlackoutPeriods,
  calculateVacationBalance,
} from "@/lib/vacationRules";
import { notifyNewRequest } from "@/lib/notifications";
import { checkRateLimit } from "@/lib/rateLimit";

const POST_REQUESTS_MAX_PER_MINUTE = 20;

async function hasOverlappingRequest(userId: string, startDate: Date, endDate: Date) {
  const overlapping = await prisma.vacationRequest.findFirst({
    where: {
      userId,
      status: {
        in: ["PENDENTE", "APROVADO_COORDENADOR", "APROVADO_GESTOR", "APROVADO_GERENTE", "APROVADO_RH"],
      },
      AND: [{ startDate: { lt: endDate } }, { endDate: { gt: startDate } }],
    },
  });
  return Boolean(overlapping);
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

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
      .map((p) => ({ start: new Date(p.startDate), end: new Date(p.endDate) }));
  } else if (startDateRaw && endDateRaw) {
    periods = [{ start: new Date(startDateRaw), end: new Date(endDateRaw) }];
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

  // Saldo do ciclo (dias no ciclo + direito total) para validação e limite da solicitação
  const balanceForValidation =
    userFull && userFull.vacationRequests
      ? calculateVacationBalance(userFull.hireDate, userFull.vacationRequests)
      : null;
  const existingDaysInCycle = balanceForValidation
    ? balanceForValidation.pendingDays + balanceForValidation.usedDays
    : 0;
  const entitledDays = balanceForValidation?.entitledDays ?? 30;

  // Validação CLT (total do ciclo até entitledDays, fracionamento, aviso prévio)
  const cltError = validateCltPeriods(periods, {
    checkAdvanceNotice: true,
    existingDaysInCycle,
    entitledDays,
  });
  if (cltError) return NextResponse.json({ error: cltError }, { status: 400 });

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

  // Verificação de saldo disponível
  if (userFull?.hireDate && balanceForValidation) {
    const balance = balanceForValidation;

    if (!balance.hasEntitlement) {
      const remaining = 12 - balance.monthsWorked;
      return NextResponse.json(
        {
          error: `Você ainda não completou 12 meses de empresa para ter direito a férias. Faltam aproximadamente ${remaining} meses.`,
        },
        { status: 400 },
      );
    }

    const requestingDays = periods.reduce((sum, p) => {
      return sum + Math.round((p.end.getTime() - p.start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    }, 0);

    if (requestingDays > balance.availableDays) {
      return NextResponse.json(
        {
          error: `Saldo insuficiente. Você tem ${balance.availableDays} dias disponíveis, mas solicitou ${requestingDays} dias.`,
        },
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
