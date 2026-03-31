import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, shouldForcePasswordChange } from "@/lib/auth";
import { getRoleLevel } from "@/lib/vacationRules";
import { findUsersWithVacationForBalance } from "@/repositories/userRepository";
import { syncAcquisitionPeriodsForUser } from "@/repositories/acquisitionRepository";
import { escapeCsvFormulas } from "@/lib/csv";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (shouldForcePasswordChange(user)) {
    return NextResponse.json({ error: "Você precisa trocar a senha antes de continuar." }, { status: 403 });
  }
  
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  // Se for consulta de um usuário específico (usado no Backoffice), nível 2+ pode acessar.
  // Se for o relatório completo (CSV), apenas nível 5 (RH).
  const requiredLevel = userId ? 2 : 5;
  if (getRoleLevel(user.role) < requiredLevel) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  // Se pediu um usuário específico, retorna JSON para o Backoffice
  if (userId) {
    const periods = await prisma.acquisitionPeriod.findMany({
      where: { userId },
      orderBy: { startDate: "asc" },
    });
    return NextResponse.json({ periods });
  }

  // Garante que os períodos aquisitivos estejam atualizados antes do CSV.
  const users = await findUsersWithVacationForBalance();
  await Promise.all(
    users
      .filter((u) => !!u.hireDate)
      .map((u) => syncAcquisitionPeriodsForUser(u.id, u.hireDate)),
  );

  const yearParam = searchParams.get("year");
  const year = yearParam ? Number.parseInt(yearParam, 10) || new Date().getFullYear() : new Date().getFullYear();

  const periods = await prisma.acquisitionPeriod.findMany({
    take: 1000, // Limite de segurança para exportação
    where: {
      OR: [
        { startDate: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
        { endDate: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
      ],
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          department: true,
        },
      },
    },
    orderBy: [{ user: { name: "asc" } }, { startDate: "asc" }],
  });

  const lines: string[] = [];
  lines.push(
    [
      "Nome",
      "Email",
      "Departamento",
      "InicioPeriodo",
      "FimPeriodo",
      "DiasDireito",
      "DiasUsados",
      "StatusPeriodo",
    ].join(";"),
  );

  for (const p of periods) {
    const status =
      p.usedDays >= p.accruedDays
        ? "COMPLETO"
        : p.usedDays > 0
          ? "PARCIAL"
          : "NAO_UTILIZADO";
    lines.push(
      [
        escapeCsvFormulas(p.user.name),
        escapeCsvFormulas(p.user.email),
        escapeCsvFormulas(p.user.department),
        p.startDate.toISOString().slice(0, 10),
        p.endDate.toISOString().slice(0, 10),
        String(p.accruedDays),
        String(p.usedDays),
        status,
      ].join(";"),
    );
  }

  const csv = `\uFEFF${lines.join("\n")}`;
  const filename = `relatorio-periodos-aquisitivos-${year}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

