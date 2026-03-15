import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { ROLE_LEVEL, canApproveRequest } from "@/lib/vacationRules";
import { notifyRejected } from "@/lib/notifications";
import { isCuid } from "@/lib/validation";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  if (!isCuid(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const user = await getSessionUser();

  if (!user || ROLE_LEVEL[user.role] < 2) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
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

  const updated = await prisma.vacationRequest.update({
    where: { id },
    data: {
      status: "REPROVADO",
      [noteField]: body?.note ?? null,
      history: {
        create: {
          previousStatus: existing.status,
          newStatus: "REPROVADO",
          changedByUserId: user.id,
          note: body?.note ?? null,
        },
      },
    },
  });

  if (existing.user?.name && existing.user?.email && user.name) {
    notifyRejected({
      requestId: id,
      userName: existing.user.name,
      userEmail: existing.user.email,
      approverName: user.name,
      note: body?.note ?? null,
    }).catch(() => {});
  }

  logger.info("Solicitação reprovada", {
    requestId: id,
    rejectedById: user.id,
  });
  return NextResponse.json({ request: updated });
}
