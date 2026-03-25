import { prisma } from "@/lib/prisma";

const vacationRequestUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  department: true,
  team: true,
  hireDate: true,
  managerId: true,
  manager: {
    select: {
      id: true,
      name: true,
      managerId: true,
      manager: { select: { id: true, name: true } },
    },
  },
} as const;

/** Inbox/histórico: inclui histórico de aprovação (mais pesado). */
const vacationRequestInclude = {
  user: { select: vacationRequestUserSelect },
  history: {
    orderBy: { changedAt: "asc" as const },
    include: { changedByUser: { select: { name: true, role: true } } },
  },
} as const;

/** Contagem de pendentes / Times: mesmo relacionamento de usuário, sem histórico. */
const vacationRequestIncludeLean = {
  user: { select: vacationRequestUserSelect },
} as const;

export async function findMyRequests(userId: string) {
  return prisma.vacationRequest.findMany({
    where: { userId },
    include: vacationRequestInclude,
    orderBy: { startDate: "desc" },
  });
}

export async function findManagedRequests(where: Record<string, unknown>) {
  return prisma.vacationRequest.findMany({
    where,
    include: vacationRequestInclude,
    orderBy: { startDate: "desc" },
  });
}

export async function findManagedRequestsLean(where: Record<string, unknown>) {
  return prisma.vacationRequest.findMany({
    where,
    include: vacationRequestIncludeLean,
    orderBy: { startDate: "desc" },
  });
}
