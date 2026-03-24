import { getRoleLevel, hasTeamVisibility, isVacationApprovedStatus } from "./vacationRules";
import type { DashboardFilters } from "@/types/dashboard";

/** Itens por página na view Histórico (dashboard). */
export const HISTORICO_PAGE_SIZE = 10;

export function sliceHistoricoPage<T>(requests: T[], page: number): {
  items: T[];
  page: number;
  totalPages: number;
  totalItems: number;
} {
  const totalItems = requests.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / HISTORICO_PAGE_SIZE));
  let safe = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  if (safe > totalPages) safe = totalPages;
  const start = (safe - 1) * HISTORICO_PAGE_SIZE;
  const items = requests.slice(start, start + HISTORICO_PAGE_SIZE);
  return { items, page: safe, totalPages, totalItems };
}

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
  const out = requests.filter((r) => {
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
      if (r.userId === userId) return false; // caixa de aprovação nunca mostra solicitação própria
      if (userLevel === 2 && r.status !== "PENDENTE") return false;
      if (userLevel === 3 && r.status !== "PENDENTE") return false;
      if (userLevel >= 4 && r.status !== "PENDENTE") {
        return false;
      }
    } else if (filters.view === "historico") {
      if (
        !isVacationApprovedStatus(r.status) &&
        r.status !== "REPROVADO" &&
        r.status !== "CANCELADO"
      ) {
        return false;
      }
    }
    if (filters.query && !r.user?.name?.toLowerCase().includes(filters.query.toLowerCase())) return false;
    if (filters.status !== "TODOS" && r.status !== filters.status) return false;
    return true;
  });

  // Ordenacao do HISTORICO:
  // - Primeiro quem vai sair primeiro (menor startDate)
  // - Depois quem ja terminou (endDate < agora) fica no final
  if (filters.view === "historico") {
    const now = new Date();
    const outSorted = [...out].sort((a, b) => {
      const aEnd = new Date(a.endDate).getTime();
      const bEnd = new Date(b.endDate).getTime();
      const aCompleted = aEnd < now.getTime();
      const bCompleted = bEnd < now.getTime();

      if (aCompleted !== bCompleted) {
        // nao-completados primeiro
        return aCompleted ? 1 : -1;
      }

      const aStart = new Date(a.startDate).getTime();
      const bStart = new Date(b.startDate).getTime();
      if (aStart !== bStart) return aStart - bStart;

      return aEnd - bEnd;
    });

    return outSorted;
  }

  return out;
}

export function buildHistoricoDashboardHref(filters: DashboardFilters, page: number): string {
  const p = new URLSearchParams();
  p.set("view", "historico");
  if (filters.query.trim()) p.set("q", filters.query.trim());
  if (filters.status && filters.status !== "TODOS") p.set("status", filters.status);
  if (filters.managerId && filters.managerId !== "ALL") p.set("managerId", filters.managerId);
  if (filters.from) p.set("from", filters.from);
  if (filters.to) p.set("to", filters.to);
  if (filters.department) p.set("department", filters.department);
  if (page > 1) p.set("page", String(page));
  return `/dashboard?${p.toString()}`;
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
