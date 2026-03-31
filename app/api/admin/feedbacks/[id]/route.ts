import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getRoleLevel } from "@/lib/vacationRules";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user || getRoleLevel(user.role) < 5) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const { status } = await request.json();
    const feedbackModel = (prisma as any).feedback;
    
    await feedbackModel.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao atualizar feedback:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user || getRoleLevel(user.role) < 5) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const feedbackModel = (prisma as any).feedback;
    await feedbackModel.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir feedback:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
