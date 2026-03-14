import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRoleLevel } from "@/lib/vacationRules";

/** GET: lista usuários (apenas RH). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (getRoleLevel(user.role) < 4) {
    return NextResponse.json({ error: "Acesso restrito ao RH" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      hireDate: true,
      managerId: true,
      manager: { select: { id: true, name: true } },
      _count: { select: { reports: true } },
    },
  });

  return NextResponse.json({ users });
}
