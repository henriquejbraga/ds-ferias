import { getRoleLevel, hasTeamVisibility } from "./vacationRules";
import type { DashboardFilters } from "@/types/dashboard";

export function getManagerOptions(
  userRole: string,
  requests: Array<{ user?: { manager?: { id: string; name: string } | null } }>
): Array<{ id: string; name: string }> {
  if (getRoleLevel(userRole) < 4) return [];
  return Array.from(
    new Map(
      requests
        .filter((r): r is typeof r & { user: { manager: { id: string; name: string } } } => !!r.user?.manager?.id)
        .map((r) => [r.user.manager.id, r.user.manager.name])
    ).entries()
  ).map(([id, name]) => ({ id, name }));
}

export function getDepartmentOptions(
  requests: Array<{ user?: { department?: string | null } }>
): string[] {
  const depts = new Set<string>();
  requests.forEach((r) => {
    if (r.user?.department) depts.add(r.user.department);
  });
  return Array.from(depts).sort();
}

type RequestForFilter = {
  userId: string;
  status: string;
  startDate: Date | string;
  endDate: Date | string;
  user?: {
    managerId?: string | null;
    manager?: { id?: string; managerId?: string | null } | null;
    department?: string | null;
    name?: string;
  };
};

export function filterRequests<T extends RequestForFilter>(
  userRole: string,
  userId: string,
  requests: T[],
  filters: DashboardFilters
): T[] {
  return requests.filter((r) => {
    if (!hasTeamVisibility(userRole, userId, r as Parameters<typeof hasTeamVisibility>[2]))
      return false;
    if (getRoleLevel(userRole) >= 4 && filters.managerId && filters.managerId !== "ALL") {
      if (r.user?.manager?.id !== filters.managerId) return false;
    }
    if (filters.department && r.user?.department !== filters.department) return false;
    if (filters.from && new Date(r.startDate) < new Date(filters.from)) return false;
    if (filters.to && new Date(r.endDate) > new Date(filters.to)) return false;
    const userLevel = getRoleLevel(userRole);
    if (filters.view === "inbox") {
      if (userLevel === 2 && r.status !== "PENDENTE") return false;
      if (userLevel === 3 && !["PENDENTE", "APROVADO_COORDENADOR", "APROVADO_GESTOR"].includes(r.status)) return false;
      if (userLevel >= 4 && r.status !== "APROVADO_GERENTE") return false;
    } else if (filters.view === "historico") {
      const processed = ["APROVADO_COORDENADOR", "APROVADO_GESTOR", "APROVADO_GERENTE", "APROVADO_RH", "REPROVADO", "CANCELADO"];
      if (!processed.includes(r.status)) return false;
    }
    if (filters.query && !r.user?.name?.toLowerCase().includes(filters.query.toLowerCase())) return false;
    if (filters.status !== "TODOS" && r.status !== filters.status) return false;
    return true;
  });
}

export function buildExportQuery(filters: DashboardFilters): string {
  const params: Record<string, string> = {
    q: filters.query,
    status: filters.status || "TODOS",
    view: filters.view,
  };
  if (filters.managerId) params.managerId = filters.managerId;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.department) params.department = filters.department;
  return new URLSearchParams(params).toString();
}
