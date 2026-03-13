import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { type VacationStatus } from "../../../generated/prisma/enums";
import { validateCltPeriod, validateCltPeriods } from "@/lib/vacationRules";

async function hasOverlappingRequest(userId: string, startDate: Date, endDate: Date) {
  const overlapping = await prisma.vacationRequest.findFirst({
    where: {
      userId,
      status: {
        in: ["PENDENTE", "APROVADO_GESTOR", "APROVADO_RH"],
      },
      AND: [
        { startDate: { lt: endDate } },
        { endDate: { gt: startDate } },
      ],
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

  const where: any = {};

  if (user.role === "COLABORADOR") {
    where.userId = user.id;
  }

  if (statusParam && statusParam !== "TODOS") {
    where.status = statusParam as VacationStatus;
  }

  if (q) {
    where.user = {
      name: { contains: q, mode: "insensitive" },
    };
  }

  const requests = await prisma.vacationRequest.findMany({
    where,
    include: {
      user: {
        select: { name: true, email: true },
      },
    },
    orderBy: { startDate: "desc" },
  });

  return NextResponse.json({ requests });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  let startDateRaw: string | null = null;
  let endDateRaw: string | null = null;
  let periodsRaw: { startDate: string; endDate: string }[] | null = null;

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null);
    periodsRaw = Array.isArray(body?.periods) ? body.periods : null;
    startDateRaw = body?.startDate ?? null;
    endDateRaw = body?.endDate ?? null;
  } else {
    const form = await request.formData().catch(() => null);
    if (form) {
      startDateRaw = (form.get("startDate") as string) ?? null;
      endDateRaw = (form.get("endDate") as string) ?? null;
    }
  }

  // Monta períodos a partir do payload:
  // - se veio "periods", usa até 3 itens válidos
  // - senão, cai no modo legado com startDate/endDate únicos
  let periods: { start: Date; end: Date }[] = [];

  if (periodsRaw && periodsRaw.length > 0) {
    periods = periodsRaw
      .filter((p) => p.startDate && p.endDate)
      .slice(0, 3)
      .map((p) => ({
        start: new Date(p.startDate),
        end: new Date(p.endDate),
      }));
  } else if (startDateRaw && endDateRaw) {
    periods = [
      {
        start: new Date(startDateRaw),
        end: new Date(endDateRaw),
      },
    ];
  }

  if (!periods.length) {
    return NextResponse.json({ error: "É necessário informar ao menos um período de férias." }, { status: 400 });
  }

  // Validação CLT para até 3 períodos (incluindo soma total = 30 dias)
  const cltError = validateCltPeriods(periods);

  if (cltError) {
    return NextResponse.json({ error: cltError }, { status: 400 });
  }

  // Checa sobreposição com outras solicitações do colaborador para cada período
  for (const p of periods) {
    if (isNaN(p.start.getTime()) || isNaN(p.end.getTime()) || p.end < p.start) {
      return NextResponse.json({ error: "Período inválido" }, { status: 400 });
    }

    const overlap = await hasOverlappingRequest(user.id, p.start, p.end);
    if (overlap) {
      return NextResponse.json(
        {
          error:
            "Já existe outra solicitação de férias (pendente ou aprovada) que conflita com um dos períodos informados.",
        },
        { status: 400 },
      );
    }
  }

  // Cria uma VacationRequest por período, em transação
  const created = await prisma.$transaction(
    periods.map((p) =>
      prisma.vacationRequest.create({
        data: {
          userId: user.id,
          startDate: p.start,
          endDate: p.end,
        },
      }),
    ),
  );

  return NextResponse.json({ requests: created }, { status: 201 });
}

