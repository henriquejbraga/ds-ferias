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

export function getTeamOptions(
  requests: Array<{ user?: { team?: string | null } }>
): string[] {
  const teams = new Set<string>();
  requests.forEach((r) => {
    if (r.user?.team) teams.add(r.user.team);
  });
  return Array.from(teams).sort();
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
    team?: string | null;
    name?: string;
  };
  history?: Array<{
    changedAt?: Date | string;
    newStatus?: string | null;
  }>;
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
    if (filters.team && r.user?.team !== filters.team) return false;
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
  // - Primeiro quem foi aprovado por último (maior changedAt no histórico de aprovações)
  // - Fallback: último evento no histórico (changedAt) e depois startDate/endDate
  if (filters.view === "historico") {
    const maxChangedAt = (r: T): number => {
      const entries = r.history ?? [];
      let max = -Infinity;
      for (const h of entries) {
        if (!h.changedAt) continue;
        const t = new Date(h.changedAt).getTime();
        if (Number.isFinite(t) && t > max) max = t;
      }
      return Number.isFinite(max) ? max : -Infinity;
    };

    const maxApprovedChangedAt = (r: T): number => {
      const entries = r.history ?? [];
      let max = -Infinity;
      for (const h of entries) {
        if (!h.newStatus) continue;
        if (!isVacationApprovedStatus(h.newStatus)) continue;
        if (!h.changedAt) continue;
        const t = new Date(h.changedAt).getTime();
        if (Number.isFinite(t) && t > max) max = t;
      }
      return Number.isFinite(max) ? max : -Infinity;
    };

    return [...out].sort((a, b) => {
      const aApprovedAt = maxApprovedChangedAt(a);
      const bApprovedAt = maxApprovedChangedAt(b);

      if (aApprovedAt !== bApprovedAt) {
        // desc (mais recente primeiro)
        return bApprovedAt - aApprovedAt;
      }

      // Se não existe histórico de aprovação (caso seja legado/teste), usamos a regra
      // "upcoming primeiro" e "ended no final", para manter a UX e os testes esperados.
      if (aApprovedAt === -Infinity && bApprovedAt === -Infinity) {
        const nowMs = Date.now();
        const aEnded = new Date(a.endDate).getTime() < nowMs;
        const bEnded = new Date(b.endDate).getTime() < nowMs;
        if (aEnded !== bEnded) return aEnded ? 1 : -1; // ended por último

        const aStart = new Date(a.startDate).getTime();
        const bStart = new Date(b.startDate).getTime();
        if (aStart !== bStart) return aStart - bStart; // start asc (upcoming)

        const aEnd = new Date(a.endDate).getTime();
        const bEnd = new Date(b.endDate).getTime();
        return aEnd - bEnd;
      }

      const aChanged = maxChangedAt(a);
      const bChanged = maxChangedAt(b);
      if (aChanged !== bChanged) return bChanged - aChanged;

      const aStart = new Date(a.startDate).getTime();
      const bStart = new Date(b.startDate).getTime();
      if (aStart !== bStart) return bStart - aStart;

      const aEnd = new Date(a.endDate).getTime();
      const bEnd = new Date(b.endDate).getTime();
      return bEnd - aEnd;
    });
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
  if (filters.team) p.set("team", filters.team);
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
  if (filters.team) params.team = filters.team;
  return new URLSearchParams(params).toString();
}
