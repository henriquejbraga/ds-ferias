import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { isVacationApprovedStatus, ROLE_LEVEL, hasTeamVisibility } from "@/lib/vacationRules";
import { canIndirectLeaderActWhenDirectOnVacation } from "@/lib/indirectLeaderRule";

type Params = {
  params: Promise<{ id: string }>;
};

function toUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysBetweenInclusive(start: Date, end: Date): number {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const s = toUtcMidnight(start);
  const e = toUtcMidnight(end);
  return Math.round((e.getTime() - s.getTime()) / ONE_DAY_MS) + 1;
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  if (!id || id.trim().length < 3) {
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

  const isOwner = existing.userId === user.id;
  const isApprover = ROLE_LEVEL[user.role] >= 2;
  const roleLevel = ROLE_LEVEL[user.role];

  if (isOwner) {
    if (existing.status !== "PENDENTE") {
      return NextResponse.json(
        { error: "Você só pode excluir solicitações que ainda estão pendentes de aprovação." },
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

  // Pedidos já aprovados:
  // - Coordenador pode excluir apenas o que ele aprovou como líder direto (APROVADO_COORDENADOR/legado APROVADO_GESTOR)
  // - Gerente e RH podem excluir qualquer aprovado
  if (!isOwner && isVacationApprovedStatus(existing.status) && roleLevel < 3) {
    const directLeaderApprovedStatuses = ["APROVADO_COORDENADOR", "APROVADO_GESTOR"];
    const isApprovedByThisDirectLeader =
      directLeaderApprovedStatuses.includes(existing.status) &&
      existing.user.managerId === user.id;

    if (!isApprovedByThisDirectLeader) {
      return NextResponse.json(
        { error: "Somente Gerente ou RH podem cancelar pedidos já aprovados por outras lideranças." },
        { status: 403 },
      );
    }
  }

  // Coordenador e Gerente só podem excluir solicitações da sua equipe; RH pode excluir qualquer
  if (isApprover && !isOwner && ROLE_LEVEL[user.role] < 5) {
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

  if (isApprover && !isOwner && ROLE_LEVEL[user.role] < 5 && existing.user.managerId !== user.id) {
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
            "Somente o líder direto pode excluir. Líder indireto só pode excluir quando o líder direto estava de férias no momento da solicitação.",
        },
        { status: 403 },
      );
    }
  }

  if (isVacationApprovedStatus(existing.status) && !existing.acquisitionPeriodId) {
    return NextResponse.json(
      { error: "Não foi possível cancelar pois o pedido aprovado não está vinculado a um período aquisitivo." },
      { status: 409 },
    );
  }

  const acquisitionPeriodId = existing.acquisitionPeriodId;

  await prisma.$transaction(async (tx) => {
    // Se o pedido foi aprovado final, precisamos reverter o consumo no período aquisitivo
    // para manter consistência entre relatórios e saldo.
    if (isVacationApprovedStatus(existing.status)) {
      const ap = await tx.acquisitionPeriod.findUnique({
        where: { id: acquisitionPeriodId! },
        select: { usedDays: true },
      });

      if (ap) {
        const rawDays = daysBetweenInclusive(existing.startDate, existing.endDate);
        const days = Math.min(Math.max(1, rawDays), 30); // compat com regra CLT de bloco
        const nextUsed = Math.max(0, ap.usedDays - days);
        await tx.acquisitionPeriod.update({
          where: { id: acquisitionPeriodId! },
          data: { usedDays: nextUsed },
        });
      }
    }

    await tx.vacationRequestHistory.deleteMany({
      where: { vacationRequestId: existing.id },
    });

    await tx.vacationRequest.delete({
      where: { id: existing.id },
    });
  });

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.json({ ok: true });
}

