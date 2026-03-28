import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, shouldForcePasswordChange } from "@/lib/auth";
import { ROLE_LEVEL, canApproveRequest } from "@/lib/vacationRules";
import { notifyRejected } from "@/lib/notifications";
import { logger } from "@/lib/logger";
import { sanitizeText } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  if (!id || id.trim().length < 3) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const user = await getSessionUser();

  if (!user || ROLE_LEVEL[user.role] < 2 || ROLE_LEVEL[user.role] > 4) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  if (shouldForcePasswordChange(user)) {
    return NextResponse.json({ error: "Você precisa trocar a senha antes de continuar." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const noteField = ROLE_LEVEL[user.role] === 2 ? "managerNote" : "hrNote";

  const existing = await prisma.vacationRequest.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true, role: true, managerId: true } } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
  }

  if (existing.userId === user.id) {
    return NextResponse.json({ error: "Você não pode reprovar a própria solicitação." }, { status: 400 });
  }

  // Mesmo pode reprovar quem pode aprovar
  const canAct = canApproveRequest(user.role, user.id, {
    userId: existing.userId,
    status: existing.status,
    user: { role: existing.user.role },
  });

  if (!canAct) {
    return NextResponse.json(
      { error: "Você não tem permissão para reprovar esta solicitação." },
      { status: 403 },
    );
  }

  if (existing.user.managerId !== user.id) {
    return NextResponse.json(
      { error: "Somente o líder direto pode reprovar esta solicitação." },
      { status: 403 },
    );
  }

  const updated = await prisma.vacationRequest.update({
    where: { id },
    data: {
      status: "REPROVADO",
      [noteField]: sanitizeText(body?.note),
      history: {
        create: {
          previousStatus: existing.status,
          newStatus: "REPROVADO",
          changedByUserId: user.id,
          note: sanitizeText(body?.note),
        },
      },
    },
  });

  if (existing.user?.name && existing.user?.email && user.name) {
    await notifyRejected({
      requestId: id,
      userName: existing.user.name,
      userEmail: existing.user.email,
      approverName: user.name,
      note: body?.note ?? null,
    }).catch((err) => {
      logger.error("Falha ao enviar notificação de reprovação", { error: String(err), requestId: id });
    });
  }

  logger.info("Solicitação reprovada", {
    requestId: id,
    rejectedById: user.id,
  });
  return NextResponse.json({ request: updated });
}
