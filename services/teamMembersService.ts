import { getRoleLevel, calculateVacationBalance } from "@/lib/vacationRules";
import { findTeamMembersByManager, findTeamMembersByGerente, findAllEmployees } from "@/repositories/userRepository";
import type { TeamMemberInfo, TeamDataCoord, TeamDataRH } from "@/types/dashboard";

function isOnVacationNow(
  requests: Array<{ status: string; startDate: Date; endDate: Date; abono?: boolean }>
): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return requests.some((r) => {
    if (r.status !== "APROVADO_RH") return false;
    const start = new Date(r.startDate);
    const rawEnd = new Date(r.endDate);
    const end =
      r.abono && !Number.isNaN(rawEnd.getTime())
        ? new Date(rawEnd.getTime() - 10 * 24 * 60 * 60 * 1000)
        : rawEnd;
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return today >= start && today <= end;
  });
}

function mapUsersToMembers(users: Array<{ id: string; name: string; department?: string | null; hireDate?: Date | null; role: string; vacationRequests?: Array<{ startDate: Date; endDate: Date; status: string }> }>): TeamMemberInfo[] {
  return users.map((u) => ({
    user: {
      id: u.id,
      name: u.name,
      department: u.department,
      hireDate: u.hireDate,
      role: u.role,
    },
    balance: calculateVacationBalance(u.hireDate ?? null, u.vacationRequests ?? []),
    isOnVacationNow: isOnVacationNow(u.vacationRequests ?? []),
    requests: u.vacationRequests ?? [],
  }));
}

export async function getTeamMembersForTimes(
  userId: string,
  role: string
): Promise<TeamDataCoord | TeamDataRH> {
  const level = getRoleLevel(role);

  if (level === 2) {
    const users = await findTeamMembersByManager(userId);
    const members = mapUsersToMembers(users);
    return {
      kind: "coord",
      teams: [{ coordinatorId: userId, coordinatorName: "Meu time", members }],
    };
  }

  if (level === 3) {
    const users = await findTeamMembersByGerente(userId);
    const members = mapUsersToMembers(users);
    const byCoord: Record<string, TeamMemberInfo[]> = {};
    members.forEach((m, i) => {
      const u = users[i];
      const coordId = u?.managerId ?? "sem-coord";
      if (!byCoord[coordId]) byCoord[coordId] = [];
      byCoord[coordId].push(m);
    });
    const coordNames = new Map<string, string>();
    users.forEach((u) => {
      if (u.managerId && u.manager) coordNames.set(u.managerId, u.manager.name);
    });
    const teams = Object.entries(byCoord).map(([coordId, mems]) => ({
      coordinatorId: coordId,
      coordinatorName: coordNames.get(coordId) ?? "Sem coordenador",
      members: mems.sort((a, b) => a.user.name.localeCompare(b.user.name)),
    }));
    return { kind: "coord", teams };
  }

  const users = await findAllEmployees();
  const members = mapUsersToMembers(users);
  const byGerente = new Map<string, Map<string, TeamMemberInfo[]>>();
  users.forEach((u, i) => {
    const m = members[i];
    const gerenteId = (u as { manager?: { manager?: { id: string; name: string } } }).manager?.manager?.id ?? "sem-gerente";
    const coordId = (u as { manager?: { id: string; name: string } }).manager?.id ?? "sem-coord";
    if (!byGerente.has(gerenteId)) byGerente.set(gerenteId, new Map());
    const byCoord = byGerente.get(gerenteId)!;
    if (!byCoord.has(coordId)) byCoord.set(coordId, []);
    byCoord.get(coordId)!.push(m);
  });
  const gerentes: TeamDataRH["gerentes"] = [];
  byGerente.forEach((byCoord, gerenteId) => {
    const firstUser = users.find(
      (u) => ((u as { manager?: { manager?: { id: string } } }).manager?.manager?.id ?? "sem-gerente") === gerenteId
    ) as { manager?: { manager?: { name: string }; name: string } } | undefined;
    const gerenteName = firstUser?.manager?.manager?.name ?? "Sem gerente";
    const teams = Array.from(byCoord.entries()).map(([coordId, mems]) => {
      const firstInCoord = mems[0];
      const u = users.find((x) => x.id === firstInCoord.user.id) as { manager?: { name: string } } | undefined;
      return {
        coordinatorId: coordId,
        coordinatorName: u?.manager?.name ?? "Sem coordenador",
        members: mems.sort((a, b) => a.user.name.localeCompare(b.user.name)),
      };
    });
    gerentes.push({ gerenteId, gerenteName, teams });
  });
  gerentes.sort((a, b) => a.gerenteName.localeCompare(b.gerenteName));
  return { kind: "rh", gerentes };
}
