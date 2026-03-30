import type { TeamMemberInfoSerialized } from "./types";

type GerenteTeam = {
  coordinatorId: string;
  coordinatorName: string;
  teamKey: string;
  teamName: string;
  members: TeamMemberInfoSerialized[];
  originalCoordinatorName?: string;
};

export function getRoleLabelShort(role: string): string {
  if (role === "GERENTE") return "Gerente";
  if (role === "COORDENADOR" || role === "GESTOR") return "Coord";
  if (role === "DIRETOR") return "Diretor(a)";
  return "";
}

export type GerenteBlockForCalendar = {
  gerenteId: string;
  gerenteName: string;
  diretorId?: string | null;
  diretorName?: string | null;
  gerenteSelf?: TeamMemberInfoSerialized;
  coordinatorMembers?: TeamMemberInfoSerialized[];
  teams: GerenteTeam[];
};

export function buildRhDirectorateCalendarMembers(
  gerentes: GerenteBlockForCalendar[],
  isCoordView: boolean = false,
): TeamMemberInfoSerialized[] {
  const out: TeamMemberInfoSerialized[] = [];
  const seenUserIds = new Set<string>();
  
  const push = (m: TeamMemberInfoSerialized) => {
    if (seenUserIds.has(m.user.id)) return;
    seenUserIds.add(m.user.id);
    out.push(m);
  };

  const directorates = new Map<string, GerenteBlockForCalendar[]>();
  gerentes.forEach(g => {
    const dName = g.diretorName || "Diretoria Geral";
    if (!directorates.has(dName)) directorates.set(dName, []);
    directorates.get(dName)!.push(g);
  });

  const sortedDNames = Array.from(directorates.keys()).sort((a, b) => a.localeCompare(b, "pt-BR"));

  for (const dName of sortedDNames) {
    const dGerentes = directorates.get(dName)!;
    const dKey = `dir-${dName}`;

    if (!isCoordView) {
      out.push({
        user: { id: dKey, name: dName, role: "DIRETOR" },
        balance: { availableDays: 0, pendingDays: 0 },
        isOnVacationNow: false,
        requests: [],
        calendarDisplayName: `📁 DIRETORIA: ${dName}`,
        calendarLevel: 0,
        calendarRowKey: dKey,
        calendarIsBranch: true,
        calendarCapacityGroupKey: dKey,
      } as any);
    }

    const sortedGerentes = dGerentes.sort((a, b) => a.gerenteName.localeCompare(b.gerenteName, "pt-BR"));

    for (const g of sortedGerentes) {
      const gTitleKey = `ger-title-${g.gerenteId}`;
      
      if (!isCoordView) {
        out.push({
          user: { id: gTitleKey, name: g.gerenteName, role: "GERENTE" },
          balance: { availableDays: 0, pendingDays: 0 },
          isOnVacationNow: false,
          requests: [],
          calendarDisplayName: `  ↳ 📂 GERÊNCIA: ${g.gerenteName}`,
          calendarLevel: 1,
          calendarRowKey: gTitleKey,
          calendarParentRowKey: dKey,
          calendarIsBranch: true,
          calendarCapacityGroupKey: gTitleKey,
        } as any);

        if (g.gerenteSelf) {
          const roleLabel = getRoleLabelShort(g.gerenteSelf.user.role);
          push({
            ...g.gerenteSelf,
            calendarDisplayName: `    ↳ 👤 ${g.gerenteSelf.user.name}${roleLabel ? ` (${roleLabel})` : ""}`,
            calendarLevel: 2,
            calendarRowKey: `member-${g.gerenteSelf.user.id}-${gTitleKey}`,
            calendarParentRowKey: gTitleKey,
            calendarCapacityGroupKey: gTitleKey,
          });
        }
      }

      const coordIds = Array.from(new Set([
        ...(g.coordinatorMembers?.map(c => c.user.id) ?? []),
        ...g.teams.map(t => t.coordinatorId)
      ]));

      coordIds.forEach(cId => {
        const coordUser = g.coordinatorMembers?.find(cm => cm.user.id === cId);
        const coordTeams = g.teams.filter(t => t.coordinatorId === cId);
        const cKey = `coord-branch-${cId}-${g.gerenteId}`;
        const coordDisplayName = coordUser?.user.name ?? coordTeams[0]?.coordinatorName ?? "Sem coordenação";
        out.push({
          user: { id: cKey, name: coordDisplayName, role: "COORDENADOR" },
          balance: { availableDays: 0, pendingDays: 0 },
          isOnVacationNow: false,
          requests: [],
          calendarDisplayName: isCoordView
            ? `👤 COORDENAÇÃO: ${coordDisplayName}`
            : `    ↳ 👤 COORDENAÇÃO: ${coordDisplayName}`,
          calendarLevel: isCoordView ? 0 : 2,
          calendarRowKey: cKey,
          calendarParentRowKey: isCoordView ? undefined : gTitleKey,
          calendarIsBranch: true,
          calendarCapacityGroupKey: cKey,
        } as any);

        if (coordUser) {
          const roleLabel = getRoleLabelShort(coordUser.user.role);
          push({
            ...coordUser,
            calendarDisplayName: isCoordView
              ? `  ↳ ${coordUser.user.name}${roleLabel ? ` (${roleLabel})` : ""}`
              : `      ↳ ${coordUser.user.name}${roleLabel ? ` (${roleLabel})` : ""}`,
            calendarLevel: isCoordView ? 1 : 3,
            calendarRowKey: `coord-member-${coordUser.user.id}-${g.gerenteId}`,
            calendarParentRowKey: cKey,
            calendarCapacityGroupKey: cKey,
          });
        }

        coordTeams.forEach(team => {
            const tKey = `team-branch-${team.teamKey}`;
            out.push({
                user: { id: tKey, name: team.teamName, role: "FUNCIONARIO" },
                balance: { availableDays: 0, pendingDays: 0 },
                isOnVacationNow: false,
                requests: [],
                calendarDisplayName: isCoordView
                  ? `  ↳ 👥 TIME: ${team.teamName}`
                  : `      ↳ 👥 TIME: ${team.teamName}`,
                calendarLevel: isCoordView ? 2 : 3,
                calendarRowKey: tKey,
                calendarParentRowKey: cKey,
                calendarIsBranch: true,
                calendarCapacityGroupKey: team.teamKey,
            } as any);

            team.members.forEach(m => {
                push({
                    ...m,
                    calendarDisplayName: isCoordView
                      ? `    ↳ ${m.user.name}`
                      : `        ↳ ${m.user.name}`,
                    calendarLevel: isCoordView ? 3 : 4,
                    calendarRowKey: `member-${m.user.id}-${team.teamKey}`,
                    calendarParentRowKey: tKey,
                    calendarCapacityGroupKey: team.teamKey,
                });
            });
        });
      });
    }
  }

  return out;
}
