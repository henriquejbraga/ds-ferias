import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { ROLE_LEVEL, hasTeamVisibility } from "@/lib/vacationRules";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
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

  const isOwner = existing.userId === user.id;
  const isApprover = ROLE_LEVEL[user.role] >= 2;

  // Funcionário pode excluir enquanto não tiver aprovação final do RH
  const deletableStatuses = ["PENDENTE", "APROVADO_GESTOR", "APROVADO_COORDENADOR", "APROVADO_GERENTE"];

  if (isOwner) {
    if (!deletableStatuses.includes(existing.status)) {
      return NextResponse.json(
        { error: "Você só pode excluir solicitações que ainda não foram aprovadas pelo RH." },
        { status: 400 },
      );
    }
  }

  if (!isOwner && !isApprover) {
    return NextResponse.json(
      { error: "Você não tem permissão para excluir este pedido." },
      { status: 403 },
    );
  }

  // Coordenador e Gerente só podem excluir solicitações da sua equipe; RH pode excluir qualquer
  if (isApprover && !isOwner && ROLE_LEVEL[user.role] < 4) {
    const visible = hasTeamVisibility(user.role, user.id, {
      userId: existing.userId,
      user: {
        managerId: existing.user?.managerId ?? null,
        manager: existing.user?.manager ?? null,
      },
    });
    if (!visible) {
      return NextResponse.json(
        { error: "Você não tem permissão para excluir este pedido." },
        { status: 403 },
      );
    }
  }

  await prisma.vacationRequestHistory.deleteMany({
    where: { vacationRequestId: existing.id },
  });

  await prisma.vacationRequest.delete({
    where: { id: existing.id },
  });

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.json({ ok: true });
}

