import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user || (user.role !== "GESTOR" && user.role !== "RH")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  if (!id) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const noteField = user.role === "GESTOR" ? "managerNote" : "hrNote";

  const existing = await prisma.vacationRequest.findUnique({
    where: { id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  if (existing.userId === user.id) {
    return NextResponse.json(
      { error: "Você não pode reprovar a própria solicitação de férias." },
      { status: 400 },
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

  return NextResponse.json({ request: updated });
}


