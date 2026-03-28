import { NextResponse } from "next/server";
import { getSessionUser, shouldForcePasswordChange } from "@/lib/auth";
import { getRoleLevel, getRoleLabel, calculateVacationBalance } from "@/lib/vacationRules";
import { findUsersWithVacationForBalance } from "@/repositories/userRepository";
import { escapeCsvFormulas } from "@/lib/csv";

/** GET: relatório CSV de saldo de férias por colaborador (apenas RH). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (shouldForcePasswordChange(user)) {
    return NextResponse.json({ error: "Você precisa trocar a senha antes de continuar." }, { status: 403 });
  }
  if (getRoleLevel(user.role) < 5) {
    return NextResponse.json({ error: "Acesso restrito ao RH" }, { status: 403 });
  }

  const users = await findUsersWithVacationForBalance();

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
      escapeCsvFormulas(u.name),
      escapeCsvFormulas(u.email),
      escapeCsvFormulas(getRoleLabel(u.role)),
      escapeCsvFormulas(u.department ?? ""),
      u.hireDate ? new Date(u.hireDate).toLocaleDateString("pt-BR") : "",
      balance.entitledDays,
      balance.usedDays,
      balance.pendingDays,
      balance.availableDays,
      balance.monthsWorked,
    ].join(";");
  });

  const csv = `\uFEFF${[header, ...lines].join("\n")}`;
  const filename = `relatorio-saldo-ferias-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
