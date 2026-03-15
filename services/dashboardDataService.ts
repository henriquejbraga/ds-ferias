import { buildManagedRequestsWhere } from "@/lib/requestVisibility";
import { hasTeamVisibility, getRoleLevel, calculateVacationBalance } from "@/lib/vacationRules";
import { findMyRequests, findManagedRequests } from "@/repositories/vacationRepository";
import { findBlackouts } from "@/repositories/blackoutRepository";
import { findUserWithBalance, findUserDepartment } from "@/repositories/userRepository";

export type DashboardDataParams = {
  userId: string;
  role: string;
  query?: string;
  status?: string;
};

export async function getDashboardData(params: DashboardDataParams) {
  const { userId, role, query: q, status } = params;

  const myRequestsPromise = findMyRequests(userId);

  if (role === "COLABORADOR" || role === "FUNCIONARIO") {
    const myRequests = await myRequestsPromise;
    return {
      myRequests,
      managedRequests: [],
      blackouts: [],
      teamRequests: [],
    };
  }

  const where = buildManagedRequestsWhere(userId, role, {
    query: q,
    status: status && status !== "TODOS" ? status : undefined,
  }) as Record<string, unknown>;

  const [myRequests, managedRequests, blackouts] = await Promise.all([
    myRequestsPromise,
    findManagedRequests(where),
    findBlackouts(),
  ]);

  const teamRequests = managedRequests.filter((r) =>
    ["APROVADO_GERENTE", "APROVADO_RH"].includes(r.status)
  );

  return { myRequests, managedRequests, blackouts, teamRequests };
}

export async function getCurrentUserBalance(userId: string) {
  const userFull = await findUserWithBalance(userId);
  return calculateVacationBalance(
    userFull?.hireDate ?? null,
    (userFull?.vacationRequests ?? []) as Array<{ startDate: Date; endDate: Date; status: string }>
  );
}

type RequestWithVisibility = {
  userId: string;
  status: string;
  user?: { managerId?: string | null; manager?: { managerId?: string | null } | null };
};

export function getVisibleRequests(
  role: string,
  userId: string,
  managedRequests: RequestWithVisibility[]
): RequestWithVisibility[] {
  return managedRequests.filter((r) =>
    hasTeamVisibility(role, userId, r as Parameters<typeof hasTeamVisibility>[2])
  );
}

export function getPendingCount(
  userRoleLevel: number,
  visibleRequests: RequestWithVisibility[]
) {
  return visibleRequests.filter((r) => {
    if (userRoleLevel === 2) return r.status === "PENDENTE";
    if (userRoleLevel === 3)
      return ["PENDENTE", "APROVADO_COORDENADOR", "APROVADO_GESTOR"].includes(r.status);
    if (userRoleLevel === 4) return r.status === "APROVADO_GERENTE";
    return false;
  }).length;
}

export async function getCurrentUserDepartment(userId: string): Promise<string | null> {
  return findUserDepartment(userId);
}
