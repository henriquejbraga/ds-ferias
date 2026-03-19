/**
 * Centralized request visibility and filtering for dashboard and export.
 * Single source of truth for "who sees which vacation requests".
 */

import { getRoleLevel, hasTeamVisibility } from "./vacationRules";

export type DashboardFilters = {
  query?: string;
  status?: string;
  view?: string;
  managerId?: string;
  from?: string;
  to?: string;
  department?: string;
};

/**
 * Builds Prisma where clause for vacation requests visible to the given user.
 * Use in getData (dashboard) and export to avoid loading all requests then filtering in memory.
 */
export function buildManagedRequestsWhere(
  userId: string,
  userRole: string,
  filters: { query?: string; status?: string; department?: string } = {},
): Record<string, unknown> {
  const level = getRoleLevel(userRole);
  const where: Record<string, unknown> = {};

  if (filters.status && filters.status !== "TODOS") {
    where.status = filters.status;
  }

  if (filters.query?.trim()) {
    where.user = { name: { contains: filters.query.trim(), mode: "insensitive" as const } };
  }

  if (filters.department) {
    if (where.user && typeof where.user === "object" && !Array.isArray(where.user)) {
      (where.user as Record<string, unknown>).department = filters.department;
    } else {
      where.user = { department: filters.department };
    }
  }

  if (level === 2) {
    if (where.user && typeof where.user === "object" && !Array.isArray(where.user)) {
      (where.user as Record<string, unknown>).managerId = userId;
    } else {
      where.user = { managerId: userId };
    }
  } else if (level === 3) {
    const orClause = [
      { user: { managerId: userId } },
      { user: { manager: { managerId: userId } } },
    ];
    const base = where.user && typeof where.user === "object" && !Array.isArray(where.user)
      ? { user: where.user }
      : {};
    where.AND = [
      { OR: orClause },
      ...(Object.keys(base).length > 0 ? [base] : []),
    ];
    delete where.user;
  }
  return where;
}

/**
 * Filters requests in memory by team visibility (for cases where Prisma where is not enough).
 * Also used to apply view (inbox/historico) and other filters that are easier in JS.
 */
export function filterRequestsByVisibilityAndView(
  userRole: string,
  userId: string,
  requests: Array<{
    userId: string;
    status: string;
    startDate: Date;
    endDate: Date;
    user?: {
      name?: string | null;
      managerId?: string | null;
      department?: string | null;
      manager?: { id?: string; managerId?: string | null } | null;
    } | null;
  }>,
  filters: DashboardFilters,
): typeof requests {
  const userLevel = getRoleLevel(userRole);
  const view = filters.view === "historico" ? "historico" : "inbox";

  return requests.filter((r) => {
    const managerId = r.user?.managerId ?? null;
    const manager = r.user?.manager != null ? { managerId: r.user.manager.managerId ?? null } : null;
    if (!hasTeamVisibility(userRole, userId, { userId: r.userId, user: { managerId, manager } })) {
      return false;
    }
    if (getRoleLevel(userRole) >= 4 && filters.managerId && filters.managerId !== "ALL") {
      if (r.user?.manager?.id !== filters.managerId) return false;
    }
    if (filters.department && r.user?.department !== filters.department) return false;
    if (filters.from && r.startDate < new Date(filters.from)) return false;
    if (filters.to && r.endDate > new Date(filters.to)) return false;
    if (view === "inbox") {
      if (r.userId === userId) return false; // inbox é só para aprovar terceiros
      if (userLevel === 2 && r.status !== "PENDENTE") return false;
      if (userLevel === 3 && !["PENDENTE", "APROVADO_COORDENADOR", "APROVADO_GESTOR"].includes(r.status)) return false;
      if (userLevel >= 4 && r.status !== "PENDENTE") {
        return false;
      }
    } else if (view === "historico") {
      const processed = ["APROVADO_COORDENADOR", "APROVADO_GESTOR", "APROVADO_GERENTE", "REPROVADO", "CANCELADO"];
      if (!processed.includes(r.status)) return false;
    }
    if (filters.query?.trim() && !r.user?.name?.toLowerCase().includes(filters.query.trim().toLowerCase())) return false;
    if (filters.status && filters.status !== "TODOS" && r.status !== filters.status) return false;
    return true;
  });
}
