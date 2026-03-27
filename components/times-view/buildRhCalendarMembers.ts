import { getRoleLabel } from "@/lib/vacationRules";
import type { TeamMemberInfoSerialized } from "./types";

type GerenteTeam = {
  coordinatorId: string;
  coordinatorName: string;
  teamKey: string;
  teamName: string;
  members: TeamMemberInfoSerialized[];
  originalCoordinatorName?: string;
};

export type GerenteBlockForCalendar = {
  gerenteId: string;
  gerenteName: string;
  coordinatorMembers?: TeamMemberInfoSerialized[];
  teams: GerenteTeam[];
};

/**
 * Uma única lista para o calendário consolidado da diretoria: coordenadores por gerência,
 * depois colaboradores por time (capacidade isolada por time / bloco de coordenação).
 */
export function buildRhDirectorateCalendarMembers(
  gerentes: GerenteBlockForCalendar[],
): TeamMemberInfoSerialized[] {
  const out: TeamMemberInfoSerialized[] = [];
  const seenUserIds = new Set<string>();
  const push = (m: TeamMemberInfoSerialized) => {
    if (seenUserIds.has(m.user.id)) return;
    seenUserIds.add(m.user.id);
    out.push(m);
  };

  const sortedGerentes = [...gerentes].sort((a, b) =>
    a.gerenteName.localeCompare(b.gerenteName, "pt-BR", { sensitivity: "base" }),
  );

  for (const g of sortedGerentes) {
    const coordKey = `lideranca-gerente-${g.gerenteId}`;
    const coordinations = [...(g.coordinatorMembers ?? [])].sort((a, b) =>
      (a.user.name ?? "").localeCompare(b.user.name ?? "", "pt-BR", { sensitivity: "base" }),
    );
    coordinations.forEach((c) => {
      push({
        ...c,
        calendarCapacityGroupKey: coordKey,
        calendarSectionOrder: 0,
        calendarSectionTitle: `${g.gerenteName} — Liderança direta (coordenações)`,
        calendarDisplayName: `${c.user.name} · ${getRoleLabel(c.user.role)}`,
      });
    });

    const sortedTeams = [...g.teams].sort((a, b) => {
      const byC = a.coordinatorName.localeCompare(b.coordinatorName, "pt-BR");
      if (byC !== 0) return byC;
      return a.teamName.localeCompare(b.teamName, "pt-BR");
    });

    sortedTeams.forEach((team) => {
      const labelCoord = team.originalCoordinatorName ?? team.coordinatorName;
      const mems = [...team.members].sort((a, b) =>
        (a.user.name ?? "").localeCompare(b.user.name ?? "", "pt-BR", { sensitivity: "base" }),
      );
      mems.forEach((m) => {
        push({
          ...m,
          calendarCapacityGroupKey: team.teamKey,
          calendarSectionOrder: 1,
          calendarSectionTitle: `${g.gerenteName} — Colaboradores (por time)`,
          calendarSubsectionTitle: `${labelCoord} · ${team.teamName}`,
          calendarDisplayName: `${m.user.name} · ${getRoleLabel(m.user.role)}`,
        });
      });
    });
  }

  return out;
}
