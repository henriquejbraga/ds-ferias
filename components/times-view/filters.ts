import type { TeamMemberInfoSerialized } from "./types";

export const STATUS_FILTER_OPTIONS = [
  { value: "TODOS", label: "Todos" },
  { value: "EM_FERIAS", label: "Em férias" },
  { value: "FERIAS_MARCADAS", label: "Férias marcadas" },
  { value: "FERIAS_A_TIRAR", label: "Férias a tirar" },
  { value: "SEM_FERIAS", label: "Sem férias no momento" },
] as const;

export function matchesFilter(member: TeamMemberInfoSerialized, query: string, statusFilter: string): boolean {
  const q = query.trim().toLowerCase();

  const nameMatch =
    !q ||
    member.user.name.toLowerCase().includes(q) ||
    (member.user.department?.toLowerCase().includes(q) ?? false);
  if (!nameMatch) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const hasFutureVacation = member.requests.some((r) => {
    const start = new Date(r.startDate);
    start.setHours(0, 0, 0, 0);
    return start > today;
  });

  if (statusFilter === "TODOS") return true;
  if (statusFilter === "EM_FERIAS") return member.isOnVacationNow;
  if (statusFilter === "FERIAS_MARCADAS") return !member.isOnVacationNow && hasFutureVacation;
  if (statusFilter === "FERIAS_A_TIRAR") {
    return !member.isOnVacationNow && !hasFutureVacation && (member.balance.availableDays > 0 || member.balance.pendingDays > 0);
  }
  if (statusFilter === "SEM_FERIAS") {
    return !member.isOnVacationNow && !hasFutureVacation && member.balance.availableDays === 0 && member.balance.pendingDays === 0;
  }

  return true;
}

