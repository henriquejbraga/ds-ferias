import { NextResponse } from "next/server";
import { getSessionUser, shouldForcePasswordChange } from "@/lib/auth";
import { getRoleLevel, isVacationApprovedStatus } from "@/lib/vacationRules";
import { findUsersWithVacationForBalance } from "@/repositories/userRepository";
import { escapeCsvFormulas } from "@/lib/csv";

/** GET: relatório de adesão — colaboradores com direito a férias que não tiraram férias no ano informado. */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (shouldForcePasswordChange(user)) {
    return NextResponse.json({ error: "Você precisa trocar a senha antes de continuar." }, { status: 403 });
  }
  if (getRoleLevel(user.role) < 5) {
    return NextResponse.json({ error: "Acesso restrito ao RH" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const year = yearParam ? Number.parseInt(yearParam, 10) || new Date().getFullYear() : new Date().getFullYear();

  const users = await findUsersWithVacationForBalance();

  const lines: string[] = [];
  lines.push([
    "Nome",
    "Email",
    "Departamento",
    "Ano",
    "TemDireitoFérias",
    "MesesEmpresa",
  ].join(";"));

  const today = new Date();

  for (const u of users) {
    const hire = u.hireDate ? new Date(u.hireDate) : null;
    if (!hire) continue;

    // meses trabalhados até o fim do ano considerado
    const endOfYear = new Date(year, 11, 31);
    let monthsWorked =
      (endOfYear.getFullYear() - hire.getFullYear()) * 12 +
      (endOfYear.getMonth() - hire.getMonth());
    if (endOfYear.getDate() < hire.getDate()) monthsWorked -= 1;
    monthsWorked = Math.max(0, monthsWorked);

    const hasEntitlement = monthsWorked >= 12;
    if (!hasEntitlement) continue;

    const hasTakenVacationInYear = u.vacationRequests.some((r) => {
      if (!isVacationApprovedStatus(r.status)) return false;
      const start = new Date(r.startDate);
      return start.getFullYear() === year;
    });

    if (hasTakenVacationInYear) continue;

    lines.push([
      escapeCsvFormulas(u.name),
      escapeCsvFormulas(u.email),
      escapeCsvFormulas(u.department ?? ""),
      String(year),
      hasEntitlement ? "SIM" : "NAO",
      String(monthsWorked),
    ].join(";"));
  }

  const csv = `\uFEFF${lines.join("\n")}`;
  const filename = `relatorio-adesao-ferias-${year}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

