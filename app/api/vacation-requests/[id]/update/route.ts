import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import {
  validateCltPeriod,
} from "@/app/api/vacation-requests/route";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user || user.role !== "COLABORADOR") {
    return NextResponse.json({ error: "Somente colaboradores podem alterar pedidos" }, { status: 403 });
  }

  const existing = await prisma.vacationRequest.findUnique({
    where: { id },
  });

  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  if (existing.status !== "PENDENTE") {
    return NextResponse.json(
      { error: "Somente pedidos pendentes podem ser alterados pelo colaborador" },
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

  const overlapping = await prisma.vacationRequest.findFirst({
    where: {
      userId: user.id,
      id: { not: existing.id },
      status: {
        in: ["PENDENTE", "APROVADO_GESTOR", "APROVADO_RH"],
      },
      AND: [
        { startDate: { lte: endDate } },
        { endDate: { gte: startDate } },
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

