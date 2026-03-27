import { getRoleLevel, calculateVacationBalance, isVacationApprovedStatus } from "@/lib/vacationRules";
import { prisma } from "@/lib/prisma";
import {
  findTeamMembersByManager,
  findTeamMembersByGerente,
  findCoordinatorsByGerente,
  findAllEmployees,
  findAllCoordinatorsForRh,
  findAllGerentes,
} from "@/repositories/userRepository";
import type { TeamMemberInfo, TeamDataCoord, TeamDataRH } from "@/types/dashboard";

/** Nó mínimo da cadeia manager → manager (inclui `role` para não confundir diretor com gerente). */
type ManagerChainNode = {
  id: string;
  name: string;
  role: string;
  managerId?: string | null;
  manager?: ManagerChainNode | null;
};

function findAncestorByRole(
  start: ManagerChainNode | null | undefined,
  targetRole: string,
): ManagerChainNode | null {
  let cur: ManagerChainNode | null | undefined = start;
  while (cur) {
    if (cur.role === targetRole) return cur;
    cur = cur.manager ?? null;
  }
  return null;
}

async function attachDiretoriaToGerentes(gerentes: TeamDataRH["gerentes"]): Promise<TeamDataRH["gerentes"]> {
  const ids = [...new Set(gerentes.map((g) => g.gerenteId))].filter((id) => id !== "sem-gerente");
  if (ids.length === 0) return gerentes;
  const rows = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      manager: { select: { id: true, name: true, role: true } },
    },
  });
  const managerByGerente = new Map(rows.map((r) => [r.id, r.manager]));
  return gerentes.map((g) => {
    const m = managerByGerente.get(g.gerenteId);
    if (m?.role === "DIRETOR") {
      return { ...g, diretorId: m.id, diretorName: m.name };
    }
    return { ...g, diretorId: null, diretorName: null };
  });
}

function isOnVacationNow(
  requests: Array<{ status: string; startDate: Date; endDate: Date; abono?: boolean }>
): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return requests.some((r) => {
    if (!isVacationApprovedStatus(r.status)) return false;
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

function sortTeamsByCoordinatorAndName<T extends { coordinatorName: string; teamName: string }>(teams: T[]): T[] {
  return [...teams].sort((a, b) => {
    const byCoordinator = a.coordinatorName.localeCompare(b.coordinatorName, "pt-BR");
    if (byCoordinator !== 0) return byCoordinator;
    return a.teamName.localeCompare(b.teamName, "pt-BR");
  });
}

export async function getTeamMembersForTimes(
  userId: string,
  role: string
): Promise<TeamDataCoord | TeamDataRH> {
  const level = getRoleLevel(role);

  if (level === 2) {
    const users = await findTeamMembersByManager(userId);
    return {
      kind: "coord",
      teams: Array.from(
        users.reduce((acc: Map<string, typeof users>, u) => {
          const teamName = (u as any).team ?? "Sem time";
          if (!acc.has(teamName)) acc.set(teamName, []);
          acc.get(teamName)!.push(u);
          return acc;
        }, new Map<string, typeof users>()),
      ).map(([teamName, teamUsers]) => ({
        coordinatorId: userId,
        coordinatorName: "Meu time",
        teamKey: `${userId}__${teamName}`,
        teamName,
        members: mapUsersToMembers(teamUsers as any),
      })),
    };
  }

  if (level === 3) {
    const [users, coordinatorUsers] = await Promise.all([
      findTeamMembersByGerente(userId),
      findCoordinatorsByGerente(userId),
    ]);
    const members = mapUsersToMembers(users);
    const coordinatorMembers = mapUsersToMembers(coordinatorUsers).sort((a, b) =>
      a.user.name.localeCompare(b.user.name, "pt-BR"),
    );
    const byCoordTeam: Record<string, Record<string, TeamMemberInfo[]>> = {};
    members.forEach((m, i) => {
      const u = users[i] as any;
      const coordId = u?.managerId ?? "sem-coord";
      const teamName = u?.team ?? "Sem time";
      if (!byCoordTeam[coordId]) byCoordTeam[coordId] = {};
      if (!byCoordTeam[coordId][teamName]) byCoordTeam[coordId][teamName] = [];
      byCoordTeam[coordId][teamName].push(m);
    });
    const coordNames = new Map<string, string>();
    users.forEach((u) => {
      if (u.managerId && u.manager) coordNames.set(u.managerId, u.manager.name);
    });
    const teams: TeamDataCoord["teams"] = [];
    for (const [coordId, byTeam] of Object.entries(byCoordTeam)) {
      for (const [teamName, mems] of Object.entries(byTeam)) {
        teams.push({
          coordinatorId: coordId,
          coordinatorName: coordNames.get(coordId) ?? "Sem coordenador",
          teamKey: `${coordId}__${teamName}`,
          teamName,
          members: mems.sort((a, b) => a.user.name.localeCompare(b.user.name)),
        });
      }
    }
    return {
      kind: "rh",
      gerentes: [
        {
          gerenteId: userId,
          gerenteName: "Minha gestão",
          coordinatorMembers,
          teams: sortTeamsByCoordinatorAndName(teams),
        },
      ],
    };
  }

  const [users, coordinators, gerentesBase] = await Promise.all([
    findAllEmployees(),
    findAllCoordinatorsForRh(),
    findAllGerentes(),
  ]);
  const members = mapUsersToMembers(users);
  const coordinatorMembers = mapUsersToMembers(coordinators).sort((a, b) =>
    a.user.name.localeCompare(b.user.name, "pt-BR"),
  );
  const byGerente = new Map<
    string,
    {
      gerenteName: string;
      byCoord: Map<string, TeamMemberInfo[]>;
      coordinatorMembers: TeamMemberInfo[];
    }
  >();

  gerentesBase.forEach((g) => {
    byGerente.set(g.id, {
      gerenteName: g.name,
      byCoord: new Map<string, TeamMemberInfo[]>(),
      coordinatorMembers: [],
    });
  });

  coordinators.forEach((c, i) => {
    const gerenteNode = findAncestorByRole((c as { manager?: ManagerChainNode }).manager, "GERENTE");
    const gerenteId = gerenteNode?.id ?? "sem-gerente";
    const bucket = byGerente.get(gerenteId);
    if (!bucket) return;
    bucket.coordinatorMembers.push(coordinatorMembers[i]);
  });

  users.forEach((u, i) => {
    const m = members[i];
    const gerenteNode = findAncestorByRole((u as { manager?: ManagerChainNode }).manager, "GERENTE");
    const gerenteId = gerenteNode?.id ?? "sem-gerente";
    const coordId = (u as { manager?: { id: string; name: string } }).manager?.id ?? "sem-coord";
    const teamName = (u as any).team ?? "Sem time";
    const teamKey = `${coordId}__${teamName}`;
    if (!byGerente.has(gerenteId)) {
      byGerente.set(gerenteId, {
        gerenteName: gerenteNode?.name ?? "Sem gerente",
        byCoord: new Map<string, TeamMemberInfo[]>(),
        coordinatorMembers: [],
      });
    }
    const bucket = byGerente.get(gerenteId)!;
    if (!bucket.byCoord.has(teamKey)) bucket.byCoord.set(teamKey, []);
    bucket.byCoord.get(teamKey)!.push(m);
  });

  const gerentes: TeamDataRH["gerentes"] = [];
  byGerente.forEach((bucket, gerenteId) => {
    const teams = Array.from(bucket.byCoord.entries()).map(([teamKey, mems]) => {
      const [coordId, teamName] = teamKey.split("__");
      const firstInCoord = mems[0];
      const u = users.find((x) => x.id === firstInCoord.user.id) as { manager?: { name: string } } | undefined;
      return {
        coordinatorId: coordId ?? "sem-coord",
        coordinatorName: u?.manager?.name ?? "Sem coordenador",
        teamKey,
        teamName: teamName ?? "Sem time",
        members: mems.sort((a, b) => a.user.name.localeCompare(b.user.name)),
      };
    });
    gerentes.push({
      gerenteId,
      gerenteName: bucket.gerenteName,
      coordinatorMembers: bucket.coordinatorMembers,
      teams: sortTeamsByCoordinatorAndName(teams),
    });
  });
  gerentes.sort((a, b) => a.gerenteName.localeCompare(b.gerenteName, "pt-BR"));
  const gerentesComDiretoria = await attachDiretoriaToGerentes(gerentes);
  return { kind: "rh", gerentes: gerentesComDiretoria };
}
