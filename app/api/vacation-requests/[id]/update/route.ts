import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getRoleLevel, hasTeamVisibility, validateCltPeriod } from "@/lib/vacationRules";
import { isCuid } from "@/lib/validation";

type Params = {
  params: Promise<{ id: string }>;
};

const ACTIVE_STATUSES = ["PENDENTE", "APROVADO_COORDENADOR", "APROVADO_GESTOR", "APROVADO_GERENTE", "APROVADO_RH"] as const;

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

  const overlapping = await prisma.vacationRequest.findFirst({
    where: {
      userId: user.id,
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

