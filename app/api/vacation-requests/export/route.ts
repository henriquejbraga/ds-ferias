import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { buildManagedRequestsWhere } from "@/lib/requestVisibility";

export async function GET(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const statusParam = searchParams.get("status") ?? "TODOS";
  const viewParam = searchParams.get("view") ?? "inbox";
  const managerParam = searchParams.get("managerId") ?? "";
  const fromParam = searchParams.get("from") ?? "";
  const toParam = searchParams.get("to") ?? "";
  const departmentParam = searchParams.get("department") ?? "";

  let where: Record<string, unknown>;
  if (user.role === "COLABORADOR" || user.role === "FUNCIONARIO") {
    where = { userId: user.id };
    if (statusParam !== "TODOS") where.status = statusParam;
    if (q?.trim() || departmentParam) {
      (where as any).user = {};
      if (q?.trim()) (where as any).user.name = { contains: q.trim(), mode: "insensitive" };
      if (departmentParam) (where as any).user.department = departmentParam;
    }
  } else {
    where = buildManagedRequestsWhere(user.id, user.role, {
      query: q?.trim() || undefined,
      status: statusParam !== "TODOS" ? statusParam : undefined,
      department: departmentParam || undefined,
    });
  }

  const requests = await prisma.vacationRequest.findMany({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: where as any,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          managerId: true,
          manager: {
            select: {
              id: true,
              name: true,
              managerId: true,
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

  const isCoord = user.role === "GESTOR" || user.role === "COORDENADOR";
  const isGerente = user.role === "GERENTE";
  const isRH = user.role === "RH";

  const filtered = requests.filter((r) => {
    // Escopo: coordenador vê apenas reportes diretos; gerente vê coordenadores e seus reportes; RH vê todos
    if (isCoord && r.user?.managerId !== user.id) return false;
    if (isGerente) {
      const managerId = r.user?.managerId;
      const manager = r.user?.manager;
      const isMyReport = managerId === user.id || manager?.managerId === user.id;
      if (!isMyReport) return false;
    }

    // Escopo por view
    if (isCoord || isGerente || isRH) {
      if (view === "inbox") {
        if (isCoord && r.status !== "PENDENTE") return false;
        if (isGerente && !["APROVADO_COORDENADOR", "APROVADO_GESTOR"].includes(r.status)) return false;
        if (isRH && r.status !== "APROVADO_GERENTE") return false;
      }
      if (view === "historico") {
        if (isCoord) {
          if (!["APROVADO_COORDENADOR", "APROVADO_GESTOR", "APROVADO_GERENTE", "APROVADO_RH", "REPROVADO"].includes(r.status)) return false;
        }
        if (isGerente) {
          if (!["APROVADO_GERENTE", "APROVADO_RH", "REPROVADO"].includes(r.status)) return false;
        }
        if (isRH) {
          if (!["APROVADO_RH", "REPROVADO"].includes(r.status)) return false;
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

    // Filtro por coordenador (RH)
    if (isRH && managerParam && managerParam !== "ALL") {
      if (!r.user?.manager?.id || r.user.manager.id !== managerParam) return false;
    }

    // Filtro por departamento
    if (departmentParam && r.user?.department !== departmentParam) return false;

    // Filtro de período (todas as roles)
    if (fromParam) {
      const fromDate = new Date(fromParam);
      if (r.startDate < fromDate) return false;
    }

    if (toParam) {
      const toDate = new Date(toParam);
      if (r.endDate > toDate) return false;
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

