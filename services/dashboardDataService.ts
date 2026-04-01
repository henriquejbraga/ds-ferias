import { buildManagedRequestsWhere } from "@/lib/requestVisibility";
import {
  hasTeamVisibility,
  getRoleLevel,
  calculateVacationBalance,
  isVacationApprovedStatus,
} from "@/lib/vacationRules";
import { filterManagedRequestsForIndirectLeaders } from "@/lib/indirectLeaderRule";
import {
  findMyRequests,
  findManagedRequests,
  findManagedRequestsLean,
} from "@/repositories/vacationRepository";
import { findBlackouts } from "@/repositories/blackoutRepository";
import { findUserWithBalance, findUserDepartment } from "@/repositories/userRepository";
import { prisma } from "@/lib/prisma";
import { syncAcquisitionPeriodsForUser, findAcquisitionPeriodsForUser } from "@/repositories/acquisitionRepository";

export type DashboardDataParams = {
  userId: string;
  role: string;
  query?: string;
  status?: string;
};

/** Opções para evitar trabalho pesado quando a UI não precisa (ex.: inbox não lista “minhas” solicitações). */
export type DashboardFetchOptions = {
  /** Solicitações geridas sem include de `history` (contador / Times). */
  leanManaged?: boolean;
  /** Não carregar `findMyRequests` (aprovador em inbox/histórico/times). */
  skipMyRequests?: boolean;
};

export async function getDashboardData(
  params: DashboardDataParams,
  options: DashboardFetchOptions = {},
) {
  const { userId, role, query: q, status } = params;
  const { leanManaged = false, skipMyRequests: skipMyRequestsOpt = false } = options;

  const skipMyRequests =
    skipMyRequestsOpt && role !== "COLABORADOR" && role !== "FUNCIONARIO";

  const myRequestsPromise = skipMyRequests
    ? Promise.resolve([] as Awaited<ReturnType<typeof findMyRequests>>)
    : findMyRequests(userId);

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

  const managedFetcher = leanManaged ? findManagedRequestsLean : findManagedRequests;

  const [myRequests, managedRequests, blackouts] = await Promise.all([
    myRequestsPromise,
    managedFetcher(where),
    findBlackouts(),
  ]);

  // Regra de líder indireto: gerente/diretor só visualiza card de indireto
  // quando o líder direto estava de férias no momento da solicitação.
  const roleLevel = getRoleLevel(role);
  const managedRequestsFiltered =
    roleLevel >= 3
      ? await filterManagedRequestsForIndirectLeaders(userId, managedRequests)
      : managedRequests;

  const teamRequests = managedRequestsFiltered.filter((r) => isVacationApprovedStatus(r.status));

  return { myRequests, managedRequests: managedRequestsFiltered, blackouts, teamRequests };
}

/** Saldo para o sidebar: sem sincronizar períodos aquisitivos (evita custo em telas de aprovação). */
export async function getCurrentUserBalanceLight(userId: string) {
  const userFull = await findUserWithBalance(userId);
  const acquisitionPeriods = await findAcquisitionPeriodsForUser(userId);
  return calculateVacationBalance(
    userFull?.hireDate ?? null,
    (userFull?.vacationRequests ?? []) as Array<{ startDate: Date; endDate: Date; status: string }>,
    acquisitionPeriods,
  );
}

export async function getCurrentUserBalance(userId: string) {
  const userFull = await findUserWithBalance(userId);
  const periods = await syncAcquisitionPeriodsForUser(userId, userFull?.hireDate ?? null);
  return calculateVacationBalance(
    userFull?.hireDate ?? null,
    (userFull?.vacationRequests ?? []) as Array<{ startDate: Date; endDate: Date; status: string }>,
    periods,
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
  const existing = await findAcquisitionPeriodsForUser(userId);
  const today = new Date();
  const needsSync =
    userFull?.hireDate &&
    (existing.length === 0 ||
      new Date(existing[existing.length - 1].endDate) < today);
  if (needsSync) {
    await syncAcquisitionPeriodsForUser(userId, userFull!.hireDate);
    return findAcquisitionPeriodsForUser(userId);
  }
  return existing;
}

/** Uma leitura do usuário + sync + períodos (página Minhas Férias). */
export type ConcessiveClientContext = {
  hireDateIso: string;
  acquisitionPeriods: Array<{
    id: string;
    startDate: string;
    endDate: string;
    accruedDays: number;
    usedDays: number;
  }>;
  pendingVacations: Array<{ startDate: string; endDate: string }>;
};

export async function getMyVacationSidebarContext(userId: string) {
  const userFull = await findUserWithBalance(userId);

  // Sync completo só quando necessário: novo usuário sem períodos OU ciclo atual ainda não criado.
  // Em condições normais (ciclo já existente e não expirado), apenas lê os períodos existentes,
  // evitando writes desnecessários a cada page load. O FIFO recalcula nos eventos de ação.
  const existingPeriods = await findAcquisitionPeriodsForUser(userId);
  const today = new Date();
  const needsSync =
    userFull?.hireDate &&
    (existingPeriods.length === 0 ||
      new Date(existingPeriods[existingPeriods.length - 1].endDate) < today);

  const acquisitionPeriods = needsSync
    ? await syncAcquisitionPeriodsForUser(userId, userFull!.hireDate)
    : existingPeriods;
  const balance = calculateVacationBalance(
    userFull?.hireDate ?? null,
    (userFull?.vacationRequests ?? []) as Array<{ startDate: Date; endDate: Date; status: string }>,
    acquisitionPeriods,
  );
  const firstEntitlementDate = userFull?.hireDate
    ? addMonthsPreservingDay(new Date(userFull.hireDate), 12)
    : null;

  const pendingPendente = await prisma.vacationRequest.findMany({
    where: { userId, status: "PENDENTE" },
    orderBy: { startDate: "asc" },
    select: { startDate: true, endDate: true },
  });

  const concessiveContext: ConcessiveClientContext | null = userFull?.hireDate
    ? {
        hireDateIso: userFull.hireDate.toISOString(),
        acquisitionPeriods: acquisitionPeriods.map(
          (p: { id: string; startDate: Date; endDate: Date; accruedDays: number; usedDays: number }) => ({
            id: p.id,
            startDate: p.startDate.toISOString(),
            endDate: p.endDate.toISOString(),
            accruedDays: p.accruedDays,
            usedDays: p.usedDays,
          }),
        ),
        pendingVacations: pendingPendente.map((p) => ({
          startDate: p.startDate.toISOString(),
          endDate: p.endDate.toISOString(),
        })),
      }
    : null;

  return {
    balance,
    acquisitionPeriods,
    firstEntitlementDate,
    department: userFull?.department ?? null,
    concessiveContext,
  };
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
