import { NextResponse } from "next/server";
import { getSessionUser, hashNewUserPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRoleLevel } from "@/lib/vacationRules";
import { syncAcquisitionPeriodsForUser } from "@/repositories/acquisitionRepository";

const ROLES = ["FUNCIONARIO", "COLABORADOR", "COORDENADOR", "GESTOR", "GERENTE", "RH"] as const;

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (getRoleLevel(user.role) < 4) {
    return NextResponse.json({ error: "Acesso restrito ao RH" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const registration = typeof body.registration === "string" ? body.registration.trim() : "";
  const role = typeof body.role === "string" ? body.role.trim() : "";
  const department = body.department ? String(body.department) : null;
  const managerId = body.managerId ? String(body.managerId) : null;
  const hireDateRaw = typeof body.hireDate === "string" ? body.hireDate.trim() : "";
  const teamRaw = typeof body.team === "string" ? body.team.trim() : "";
  const hireDate = hireDateRaw ? new Date(hireDateRaw) : null;
  const team = teamRaw ? teamRaw : null;

  if (!name || !email || !registration || !ROLES.includes(role as any) || !hireDate) {
    return NextResponse.json(
      { error: "Nome, e-mail, matrícula, papel e data de admissão são obrigatórios." },
      { status: 400 },
    );
  }

  if (isNaN(hireDate.getTime())) {
    return NextResponse.json({ error: "Data de admissão inválida." }, { status: 400 });
  }

  try {
    const defaultPasswordHash = hashNewUserPassword("senha123");

    const created = await prisma.user.create({
      data: {
        name,
        email,
        registration,
        role,
        department,
        managerId,
        hireDate,
        team,
        passwordHash: defaultPasswordHash,
      },
      select: { id: true, name: true, email: true, role: true, department: true, registration: true, managerId: true, hireDate: true, team: true },
    });

    // Garante que AcquisitionPeriod existe para permitir "férias no ciclo" no Backoffice.
    await syncAcquisitionPeriodsForUser(created.id, created.hireDate);

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "E-mail ou matrícula já cadastrados." }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Erro ao criar usuário." }, { status: 500 });
  }
}

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
      team: true,
      managerId: true,
      manager: { select: { id: true, name: true } },
      _count: { select: { reports: true } },
    },
  });

  return NextResponse.json({ users });
}
