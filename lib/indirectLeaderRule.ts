import { prisma } from "@/lib/prisma";
import { isVacationApprovedStatus } from "@/lib/vacationRules";

type LeaderVacationRow = {
  startDate: Date;
  endDate: Date;
  status: string;
  abono: boolean;
};

type Params = {
  approverId: string;
  directLeaderId: string | null | undefined;
  directLeaderManagerId: string | null | undefined;
  requestCreatedAt: Date;
};

/** Verifica se `requestCreatedAt` cai em algum período de férias aprovado do líder (com ajuste de abono). */
export function wasSubmittedDuringLeaderApprovedVacation(
  leaderVacations: LeaderVacationRow[] | undefined,
  requestCreatedAt: Date,
): boolean {
  const submittedAt = new Date(requestCreatedAt);
  submittedAt.setHours(0, 0, 0, 0);

  return (leaderVacations ?? []).some((r) => {
    if (!isVacationApprovedStatus(r.status)) return false;
    const start = new Date(r.startDate);
    const rawEnd = new Date(r.endDate);
    const end =
      r.abono && !Number.isNaN(rawEnd.getTime())
        ? new Date(rawEnd.getTime() - 10 * 24 * 60 * 60 * 1000)
        : rawEnd;
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return submittedAt >= start && submittedAt <= end;
  });
}

type RequestWithIndirectFields = {
  createdAt: Date;
  user?: {
    managerId?: string | null;
    manager?: { managerId?: string | null } | null;
  };
};

/**
 * Mesma regra que `canIndirectLeaderActWhenDirectOnVacation`, porém 1 consulta para todos os líderes diretos.
 * Evita N× findUnique no dashboard quando há muitas solicitações indiretas.
 */
export async function filterManagedRequestsForIndirectLeaders<T extends RequestWithIndirectFields>(
  approverId: string,
  requests: T[],
): Promise<T[]> {
  const leaderIds = new Set<string>();
  for (const r of requests) {
    const directLeaderId = r.user?.managerId ?? null;
    if (directLeaderId === approverId) continue;
    if ((r.user?.manager?.managerId ?? null) !== approverId) continue;
    if (directLeaderId) leaderIds.add(directLeaderId);
  }

  const vacByLeaderId = new Map<string, LeaderVacationRow[]>();
  if (leaderIds.size > 0) {
    const rows = await prisma.user.findMany({
      where: { id: { in: [...leaderIds] } },
      select: {
        id: true,
        vacationRequests: {
          select: { startDate: true, endDate: true, status: true, abono: true },
        },
      },
    });
    for (const row of rows) {
      vacByLeaderId.set(row.id, row.vacationRequests);
    }
  }

  return requests.filter((r) => {
    const directLeaderId = r.user?.managerId ?? null;
    if (directLeaderId === approverId) return true;
    if ((r.user?.manager?.managerId ?? null) !== approverId) return false;
    if (!directLeaderId) return false;
    const vac = vacByLeaderId.get(directLeaderId);
    return wasSubmittedDuringLeaderApprovedVacation(vac, r.createdAt);
  });
}

/**
 * Regra de líder indireto:
 * só pode atuar se for gestor do líder direto
 * E se o líder direto estava de férias quando a solicitação foi criada.
 */
export async function canIndirectLeaderActWhenDirectOnVacation({
  approverId,
  directLeaderId,
  directLeaderManagerId,
  requestCreatedAt,
}: Params): Promise<boolean> {
  if (!directLeaderId) return false;
  if (directLeaderManagerId !== approverId) return false;

  const directLeader = await prisma.user.findUnique({
    where: { id: directLeaderId },
    select: {
      vacationRequests: {
        select: { startDate: true, endDate: true, status: true, abono: true },
      },
    },
  });

  return wasSubmittedDuringLeaderApprovedVacation(
    directLeader?.vacationRequests,
    requestCreatedAt,
  );
}
