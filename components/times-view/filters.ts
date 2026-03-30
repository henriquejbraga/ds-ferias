import type { TeamMemberInfoSerialized } from "./types";

export const STATUS_FILTER_OPTIONS = [
  { value: "TODOS", label: "Status: Todos" },
  { value: "EM_FERIAS", label: "Em férias agora" },
  { value: "FERIAS_MARCADAS", label: "Férias marcadas" },
  { value: "DISPONIVEIS", label: "Sem férias marcadas" },
] as const;

export const ROLE_FILTER_OPTIONS = [
  { value: "ALL", label: "Cargos: Todos" },
  { value: "FUNCIONARIO", label: "Colaboradores" },
  { value: "COORDENADOR", label: "Coordenadores" },
  { value: "GERENTE", label: "Gerentes" },
  { value: "DIRETOR", label: "Diretores" },
] as const;

export function matchesFilter(
  member: TeamMemberInfoSerialized, 
  query: string, 
  statusFilter: string,
  roleFilter: string = "ALL",
  directorateFilter: string = "ALL",
  directorateName: string = ""
): boolean {
  const q = query.trim().toLowerCase();

  // Busca por nome ou departamento no input de texto
  const nameMatch =
    !q ||
    member.user.name.toLowerCase().includes(q) ||
    (member.user.department?.toLowerCase().includes(q) ?? false);
  if (!nameMatch) return false;

  // Filtro de Diretoria
  if (directorateFilter !== "ALL" && directorateName !== directorateFilter) {
    return false;
  }

  // Filtro de Papel (Role)
  if (roleFilter !== "ALL") {
    const mRole = member.user.role;
    if (roleFilter === "FUNCIONARIO" && mRole !== "FUNCIONARIO" && mRole !== "COLABORADOR") return false;
    if (roleFilter === "COORDENADOR" && mRole !== "COORDENADOR" && mRole !== "GESTOR") return false;
    if (roleFilter === "GERENTE" && mRole !== "GERENTE") return false;
    if (roleFilter === "DIRETOR" && mRole !== "DIRETOR") return false;
  }

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
  
  // Unificação: Não está de férias agora E não tem nada marcado para o futuro
  if (statusFilter === "DISPONIVEIS") {
    return !member.isOnVacationNow && !hasFutureVacation;
  }

  return true;
}
