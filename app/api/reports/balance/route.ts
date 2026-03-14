import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRoleLevel, getRoleLabel, calculateVacationBalance } from "@/lib/vacationRules";

/** GET: relatório CSV de saldo de férias por colaborador (apenas RH). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (getRoleLevel(user.role) < 4) {
    return NextResponse.json({ error: "Acesso restrito ao RH" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      hireDate: true,
      vacationRequests: {
        select: { startDate: true, endDate: true, status: true },
      },
    },
  });

  const header = [
    "Nome",
    "Email",
    "Papel",
    "Departamento",
    "Admissão",
    "DiasDireito",
    "Usados",
    "Pendentes",
    "Disponíveis",
    "MesesEmpresa",
  ].join(";");

  const lines = users.map((u) => {
    const balance = calculateVacationBalance(u.hireDate, u.vacationRequests);
    return [
      u.name.replace(/;/g, ","),
      u.email.replace(/;/g, ","),
      getRoleLabel(u.role).replace(/;/g, ","),
      (u.department ?? "").replace(/;/g, ","),
      u.hireDate ? new Date(u.hireDate).toLocaleDateString("pt-BR") : "",
      balance.entitledDays,
      balance.usedDays,
      balance.pendingDays,
      balance.availableDays,
      balance.monthsWorked,
    ].join(";");
  });

  const csv = [header, ...lines].join("\n");
  const filename = `relatorio-saldo-ferias-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
