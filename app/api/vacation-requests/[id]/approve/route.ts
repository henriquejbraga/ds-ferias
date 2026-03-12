import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { type VacationStatus } from "@/../generated/prisma/enums";

type Params = {
  params: { id: string };
};

export async function POST(request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user || (user.role !== "GESTOR" && user.role !== "RH")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const noteField = user.role === "GESTOR" ? "managerNote" : "hrNote";
  const nextStatus: VacationStatus =
    user.role === "GESTOR" ? "APROVADO_GESTOR" : "APROVADO_RH";

  const existing = await prisma.vacationRequest.findUnique({
    where: { id: params.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  const updated = await prisma.vacationRequest.update({
    where: { id: params.id },
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

  return NextResponse.json({ request: updated });
}

