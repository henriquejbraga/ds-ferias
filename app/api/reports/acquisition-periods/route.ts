import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getRoleLevel } from "@/lib/vacationRules";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (getRoleLevel(user.role) < 5) {
    return NextResponse.json({ error: "Acesso restrito ao RH" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const year = yearParam ? Number.parseInt(yearParam, 10) || new Date().getFullYear() : new Date().getFullYear();

  const periods = await prisma.acquisitionPeriod.findMany({
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
        p.user.name.replace(/;/g, ","),
        p.user.email.replace(/;/g, ","),
        (p.user.department ?? "").replace(/;/g, ","),
        p.startDate.toISOString().slice(0, 10),
        p.endDate.toISOString().slice(0, 10),
        String(p.accruedDays),
        String(p.usedDays),
        status,
      ].join(";"),
    );
  }

  const csv = lines.join("\n");
  const filename = `relatorio-periodos-aquisitivos-${year}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

