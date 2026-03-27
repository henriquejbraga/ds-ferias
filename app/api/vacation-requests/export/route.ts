import { NextResponse } from "next/server";
import { getSessionUser, shouldForcePasswordChange } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getVacationRequestsForExport } from "@/services/vacationRequestListService";
import { escapeCsvFormulas } from "@/lib/csv";

export async function GET(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (shouldForcePasswordChange(user)) {
    return NextResponse.json({ error: "Você precisa trocar a senha antes de continuar." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filters = {
    query: searchParams.get("q") ?? "",
    status: searchParams.get("status") ?? "TODOS",
    view: searchParams.get("view") ?? "inbox",
    managerId: searchParams.get("managerId") ?? "",
    from: searchParams.get("from") ?? "",
    to: searchParams.get("to") ?? "",
    department: searchParams.get("department") ?? "",
  };

  const filtered = await getVacationRequestsForExport(user, filters);

  const lines: string[] = [];

  lines.push([
    "Colaborador",
    "EmailColaborador",
    "Gestor",
    "StatusAtual",
    "DataInicio",
    "DataFim",
    "StatusAnterior",
    "StatusNovo",
    "AlteradoPor",
    "DataAlteracao",
  ].join(";"));

  for (const r of filtered) {
    const colaborador = escapeCsvFormulas(r.user?.name ?? "");
    const emailColab = escapeCsvFormulas(r.user?.email ?? "");
    const gestor = escapeCsvFormulas(r.user?.manager?.name ?? "");
    const statusAtual = escapeCsvFormulas(r.status);
    const dataInicio = r.startDate.toLocaleDateString("pt-BR");
    const dataFim = r.endDate.toLocaleDateString("pt-BR");

    if (!r.history.length) {
      lines.push([
        colaborador,
        emailColab,
        gestor,
        statusAtual,
        dataInicio,
        dataFim,
        "",
        "",
        "",
        "",
      ].join(";"));
      continue;
    }

    lines.push([
      colaborador,
      emailColab,
      gestor,
      statusAtual,
      dataInicio,
      dataFim,
      "",
      "",
      "",
      "",
    ].join(";"));

    for (const h of r.history) {
      const changedByName = escapeCsvFormulas(h.changedByUser?.name ?? "");
      const changedAt = h.changedAt.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      lines.push([
        colaborador,
        emailColab,
        gestor,
        statusAtual,
        dataInicio,
        dataFim,
        escapeCsvFormulas(h.previousStatus ?? ""),
        escapeCsvFormulas(h.newStatus ?? ""),
        changedByName,
        changedAt,
      ].join(";"));
    }
  }

  const csv = `\uFEFF${lines.join("\n")}`;
  const filename = `relatorio-ferias-${new Date().toISOString().slice(0, 10)}.csv`;
  logger.info("Export CSV concluído", { userId: user.id, count: filtered.length });

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
