import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getVacationRequestsForExport } from "@/services/vacationRequestListService";

export async function GET(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
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

  // Monta CSV – Excel lê CSV sem problemas.
  const lines: string[] = [];

  // Cabeçalho
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
    const colaborador = r.user?.name ?? "";
    const emailColab = r.user?.email ?? "";
    const gestor = r.user?.manager?.name ?? "";
    const statusAtual = r.status;
    const dataInicio = r.startDate.toLocaleDateString("pt-BR");
    const dataFim = r.endDate.toLocaleDateString("pt-BR");

    if (!r.history.length) {
      // Linha única de solicitação sem histórico
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

    // Linha principal da solicitação (dados gerais)
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

    // Linhas de histórico
    for (const h of r.history) {
      const changedByName = h.changedByUser?.name ?? "";
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
        h.previousStatus ?? "",
        h.newStatus ?? "",
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

