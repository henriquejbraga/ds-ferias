import { prisma } from "@/lib/prisma";

type Params = {
  approverId: string;
  directLeaderId: string | null | undefined;
  directLeaderManagerId: string | null | undefined;
  requestCreatedAt: Date;
};

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

  const submittedAt = new Date(requestCreatedAt);
  submittedAt.setHours(0, 0, 0, 0);

  const directLeader = await prisma.user.findUnique({
    where: { id: directLeaderId },
    select: {
      vacationRequests: {
        select: { startDate: true, endDate: true, status: true, abono: true },
      },
    },
  });

  return (directLeader?.vacationRequests ?? []).some((r) => {
    if (!["APROVADO_GERENTE", "APROVADO_RH"].includes(r.status)) return false;
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
