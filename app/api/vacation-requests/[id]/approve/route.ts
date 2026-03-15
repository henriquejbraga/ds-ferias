import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { canApproveRequest, getNextApprovalStatus, ROLE_LEVEL } from "@/lib/vacationRules";
import { notifyApproved } from "@/lib/notifications";
import { isCuid } from "@/lib/validation";
import { logger } from "@/lib/logger";
import type { VacationStatus } from "@/generated/prisma/enums";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  if (!isCuid(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const user = await getSessionUser();

  // Apenas COORDENADOR, GESTOR, GERENTE e RH podem aprovar
  if (!user || ROLE_LEVEL[user.role] < 2) {
    return NextResponse.json({ error: "Sem permissão para aprovar solicitações." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);

  const existing = await prisma.vacationRequest.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          managerId: true,
          manager: { select: { managerId: true } },
        },
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
  }

  // Verifica se pode aprovar (lógica de hierarquia)
  const canApprove = canApproveRequest(user.role, user.id, {
    userId: existing.userId,
    status: existing.status,
    user: { role: existing.user.role },
  });

  if (!canApprove) {
    return NextResponse.json(
      { error: "Você não tem permissão para aprovar esta solicitação neste momento." },
      { status: 403 },
    );
  }

  // Para COORDENADOR/GESTOR: só pode aprovar do seu time direto
  if (ROLE_LEVEL[user.role] === 2) {
    if (existing.user.managerId !== user.id) {
      return NextResponse.json(
        { error: "Você só pode aprovar solicitações do seu time direto." },
        { status: 403 },
      );
    }
  }

  // Para GERENTE: pode aprovar reportes diretos (coordenadores) e indiretos (funcionários dos coordenadores)
  if (ROLE_LEVEL[user.role] === 3) {
    const isDirectReport = existing.user.managerId === user.id;
    const isIndirectReport = existing.user.manager?.managerId === user.id;
    const isOwnRequest = existing.userId === user.id;

    if (!isDirectReport && !isIndirectReport && !isOwnRequest) {
      return NextResponse.json(
        { error: "Você só pode aprovar solicitações da sua cadeia de equipe." },
        { status: 403 },
      );
    }
  }

  const nextStatus = getNextApprovalStatus(user.role) as VacationStatus;
  const noteField = ROLE_LEVEL[user.role] === 2 ? "managerNote" : "hrNote";

  const updated = await prisma.vacationRequest.update({
    where: { id },
    data: {
      status: nextStatus,
      [noteField]: body?.note ?? null,
      history: {
        create: {
          previousStatus: existing.status,
          newStatus: nextStatus,
          changedByUserId: user.id,
          note: body?.note ?? null,
        },
      },
    },
  });

  if (existing.user?.name && existing.user?.email && user.name) {
    notifyApproved({
      requestId: id,
      userName: existing.user.name,
      userEmail: existing.user.email,
      approverName: user.name,
      status: nextStatus,
    }).catch(() => {});
  }

  logger.info("Solicitação aprovada", {
    requestId: id,
    approverId: user.id,
    newStatus: nextStatus,
  });
  return NextResponse.json({ request: updated });
}
