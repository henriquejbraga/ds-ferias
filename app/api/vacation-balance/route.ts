import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { calculateVacationBalance } from "@/lib/vacationRules";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      hireDate: true,
      vacationRequests: {
        select: { startDate: true, endDate: true, status: true },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  const balance = calculateVacationBalance(user.hireDate, user.vacationRequests as any);

  return NextResponse.json({ balance });
}
