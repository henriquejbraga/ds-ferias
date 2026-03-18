import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRoleLevel } from "@/lib/vacationRules";
import type { UserUncheckedUpdateInput } from "@/generated/prisma/models/User";

const ROLES = ["FUNCIONARIO", "COLABORADOR", "COORDENADOR", "GESTOR", "GERENTE", "RH"] as const;

/** PATCH: atualiza usuário (apenas RH). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (getRoleLevel(user.role) < 4) {
    return NextResponse.json({ error: "Acesso restrito ao RH" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const data: UserUncheckedUpdateInput = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.email === "string" && body.email.trim()) data.email = body.email.trim();
  if (typeof body.role === "string" && ROLES.includes(body.role as any)) data.role = body.role;
  if (body.department !== undefined) data.department = body.department === "" || body.department == null ? null : String(body.department);
  if (body.hireDate !== undefined) data.hireDate = body.hireDate === "" || body.hireDate == null ? null : new Date(body.hireDate);
  if (body.team !== undefined) data.team = body.team === "" || body.team == null ? null : String(body.team);
  if (body.managerId !== undefined) data.managerId = body.managerId === "" || body.managerId == null ? null : body.managerId;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nenhum campo válido para atualizar" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, department: true, hireDate: true, team: true, managerId: true },
  });

  return NextResponse.json(updated);
}
