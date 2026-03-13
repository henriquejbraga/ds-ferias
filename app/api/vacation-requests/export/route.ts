import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const statusParam = searchParams.get("status") ?? "TODOS";
  const viewParam = searchParams.get("view") ?? "inbox";

  // Busca base no banco
  const where: any = {};

  if (user.role === "COLABORADOR") {
    where.userId = user.id;
  }

  if (statusParam && statusParam !== "TODOS") {
    where.status = statusParam;
  }

  if (q) {
    where.user = {
      name: { contains: q, mode: "insensitive" },
    };
  }

  const requests = await prisma.vacationRequest.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          managerId: true,
          manager: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      history: {
        orderBy: { changedAt: "asc" },
        include: {
          changedByUser: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: { startDate: "asc" },
  });

  const view = viewParam === "historico" ? "historico" : "inbox";
  const normalizedQuery = q.trim().toLowerCase();
  const normalizedStatus = statusParam || "TODOS";

  const filtered = requests.filter((r) => {
    // Escopo do gestor: apenas seu time direto
    if (user.role === "GESTOR") {
      if (r.user?.managerId !== user.id) return false;
    }

    // Escopo por view (apenas para gestor/RH)
    if (user.role === "GESTOR" || user.role === "RH") {
      if (view === "inbox") {
        if (user.role === "GESTOR" && r.status !== "PENDENTE") return false;
        if (user.role === "RH" && r.status !== "APROVADO_GESTOR") return false;
      }

      if (view === "historico") {
        if (user.role === "GESTOR") {
          const allowed = ["APROVADO_GESTOR", "APROVADO_RH", "REPROVADO"];
          if (!allowed.includes(r.status)) return false;
        }
        if (user.role === "RH") {
          const allowed = ["APROVADO_RH", "REPROVADO"];
          if (!allowed.includes(r.status)) return false;
        }
      }
    }

    // Filtro por nome (reforço em cima do where.user)
    if (normalizedQuery) {
      const name = r.user?.name?.toLowerCase() ?? "";
      if (!name.includes(normalizedQuery)) return false;
    }

    if (normalizedStatus !== "TODOS" && r.status !== normalizedStatus) {
      return false;
    }

    return true;
  });

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

  const csv = lines.join("\n");
  const filename = `relatorio-ferias-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

