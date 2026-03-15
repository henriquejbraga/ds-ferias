/**
 * Fonte única para listagem e export de solicitações de férias.
 * Usa buildManagedRequestsWhere + filterRequestsByVisibilityAndView para evitar duplicação de regras.
 */

import { prisma } from "@/lib/prisma";
import {
  buildManagedRequestsWhere,
  filterRequestsByVisibilityAndView,
  type DashboardFilters,
} from "@/lib/requestVisibility";

type SessionUser = { id: string; role: string };

const exportInclude = {
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
    orderBy: { changedAt: "asc" as const },
    include: {
      changedByUser: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  },
} as const;

export type VacationRequestForExport = Awaited<
  ReturnType<typeof prisma.vacationRequest.findMany<{ include: typeof exportInclude }>>
>[number];

/**
 * Retorna solicitações visíveis ao usuário com filtros aplicados (view, status, período, etc.).
 * Inclui histórico para uso em export e relatórios.
 */
export async function getVacationRequestsForExport(
  user: SessionUser,
  filters: DashboardFilters,
): Promise<VacationRequestForExport[]> {
  const { query, status, view, managerId, from, to, department } = filters;
  const statusParam = status ?? "TODOS";
  const q = (query ?? "").trim();
  const departmentParam = department ?? "";

  let where: Record<string, unknown>;
  if (user.role === "COLABORADOR" || user.role === "FUNCIONARIO") {
    where = { userId: user.id };
    if (statusParam !== "TODOS") where.status = statusParam;
    if (q || departmentParam) {
      const userCond: Record<string, unknown> = {};
      if (q) userCond.name = { contains: q, mode: "insensitive" as const };
      if (departmentParam) userCond.department = departmentParam;
      (where as Record<string, unknown>).user = userCond;
    }
  } else {
    where = buildManagedRequestsWhere(user.id, user.role, {
      query: q || undefined,
      status: statusParam !== "TODOS" ? statusParam : undefined,
      department: departmentParam || undefined,
    });
  }

  const requests = await prisma.vacationRequest.findMany({
    where: where as Record<string, unknown>,
    include: exportInclude,
    orderBy: { startDate: "asc" },
  });

  const dashboardFilters: DashboardFilters = {
    query: filters.query,
    status: filters.status,
    view: filters.view,
    managerId: filters.managerId,
    from: filters.from,
    to: filters.to,
    department: filters.department,
  };

  const filtered = filterRequestsByVisibilityAndView(user.role, user.id, requests, dashboardFilters);
  return filtered as VacationRequestForExport[];
}
