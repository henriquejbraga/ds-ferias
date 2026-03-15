import { prisma } from "@/lib/prisma";

const vacationRequestInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
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
    },
  },
  history: {
    orderBy: { changedAt: "asc" as const },
    include: { changedByUser: { select: { name: true, role: true } } },
  },
} as const;

export async function findMyRequests(userId: string) {
  return prisma.vacationRequest.findMany({
    where: { userId },
    include: vacationRequestInclude,
    orderBy: { startDate: "asc" },
  });
}

export async function findManagedRequests(where: Record<string, unknown>) {
  return prisma.vacationRequest.findMany({
    where,
    include: vacationRequestInclude,
    orderBy: { startDate: "asc" },
  });
}
