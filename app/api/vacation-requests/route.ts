import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { type VacationStatus } from "@/../generated/prisma/enums";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function validateCltPeriod(startDate: Date, endDate: Date) {
  const days = Math.round((endDate.getTime() - startDate.getTime()) / ONE_DAY_MS) + 1;

  // CLT: férias podem ser fracionadas em até 3 períodos,
  // sendo que um deles deve ter, no mínimo, 14 dias corridos
  // e os demais precisam ter pelo menos 5 dias corridos.
  // Aqui estamos validando UM bloco: não pode ser menor que 5
  // e nem maior que 30 dias corridos.
  if (days < 5) {
    return "Período mínimo de férias em um bloco é de 5 dias corridos, conforme CLT.";
  }

  if (days > 30) {
    return "Período máximo de férias em um único bloco é de 30 dias.";
  }

  // Regra de aviso: início deve ter pelo menos 30 dias de antecedência
  const today = new Date();
  const diffFromTodayDays = Math.floor(
    (startDate.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) / ONE_DAY_MS,
  );

  if (diffFromTodayDays < 30) {
    return "O início das férias deve respeitar aviso mínimo de 30 dias.";
  }

  return null;
}

async function hasOverlappingRequest(userId: string, startDate: Date, endDate: Date) {
  const overlapping = await prisma.vacationRequest.findFirst({
    where: {
      userId,
      status: {
        in: ["PENDENTE", "APROVADO_GESTOR", "APROVADO_RH"],
      },
      AND: [
        { startDate: { lte: endDate } },
        { endDate: { gte: startDate } },
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
  if (!user || user.role !== "COLABORADOR") {
    return NextResponse.json({ error: "Somente colaboradores podem criar pedidos" }, { status: 403 });
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

  const overlap = await hasOverlappingRequest(user.id, startDate, endDate);
  if (overlap) {
    return NextResponse.json(
      {
        error:
          "Já existe outra solicitação de férias (pendente ou aprovada) que conflita com esse período.",
      },
      { status: 400 },
    );
  }

  const requestCreated = await prisma.vacationRequest.create({
    data: {
      userId: user.id,
      startDate,
      endDate,
    },
  });

  return NextResponse.json({ request: requestCreated }, { status: 201 });
}

