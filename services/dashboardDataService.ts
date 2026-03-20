import { buildManagedRequestsWhere } from "@/lib/requestVisibility";
import { hasTeamVisibility, getRoleLevel, calculateVacationBalance } from "@/lib/vacationRules";
import { canIndirectLeaderActWhenDirectOnVacation } from "@/lib/indirectLeaderRule";
import { findMyRequests, findManagedRequests } from "@/repositories/vacationRepository";
import { findBlackouts } from "@/repositories/blackoutRepository";
import { findUserWithBalance, findUserDepartment } from "@/repositories/userRepository";
import { syncAcquisitionPeriodsForUser, findAcquisitionPeriodsForUser } from "@/repositories/acquisitionRepository";

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

  // Regra de líder indireto: gerente/diretor só visualiza card de indireto
  // quando o líder direto estava de férias no momento da solicitação.
  const roleLevel = getRoleLevel(role);
  const managedRequestsFiltered =
    roleLevel >= 3
      ? await Promise.all(
          managedRequests.map(async (r) => {
            const directLeaderId = r.user?.managerId ?? null;
            const directLeaderManagerId = r.user?.manager?.managerId ?? null;
            const isDirectReport = directLeaderId === userId;
            if (isDirectReport) return r;
            const canIndirect = await canIndirectLeaderActWhenDirectOnVacation({
              approverId: userId,
              directLeaderId,
              directLeaderManagerId,
              requestCreatedAt: r.createdAt,
            });
            return canIndirect ? r : null;
          }),
        ).then((items) => items.filter((x): x is (typeof managedRequests)[number] => !!x))
      : managedRequests;

  const teamRequests = managedRequestsFiltered.filter((r) => r.status === "APROVADO_GERENTE");

  return { myRequests, managedRequests: managedRequestsFiltered, blackouts, teamRequests };
}

export async function getCurrentUserBalance(userId: string) {
  const userFull = await findUserWithBalance(userId);
  await syncAcquisitionPeriodsForUser(userId, userFull?.hireDate ?? null);
  return calculateVacationBalance(
    userFull?.hireDate ?? null,
    (userFull?.vacationRequests ?? []) as Array<{ startDate: Date; endDate: Date; status: string }>
  );
}

function addMonthsPreservingDay(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

export async function getFirstEntitlementDate(userId: string): Promise<Date | null> {
  const userFull = await findUserWithBalance(userId);
  if (!userFull?.hireDate) return null;
  return addMonthsPreservingDay(new Date(userFull.hireDate), 12);
}

export async function getUserAcquisitionPeriods(userId: string) {
  const userFull = await findUserWithBalance(userId);
  await syncAcquisitionPeriodsForUser(userId, userFull?.hireDate ?? null);
  return findAcquisitionPeriodsForUser(userId);
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
  return managedRequests.filter(
    (r) =>
      r.userId !== userId &&
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
    if (userRoleLevel === 4)
      return r.status === "PENDENTE";
    return false;
  }).length;
}

export async function getCurrentUserDepartment(userId: string): Promise<string | null> {
  return findUserDepartment(userId);
}
