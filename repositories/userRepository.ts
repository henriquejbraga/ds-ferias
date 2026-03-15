import { prisma } from "@/lib/prisma";

const baseInclude = {
  manager: {
    select: {
      id: true,
      name: true,
      managerId: true,
      manager: { select: { id: true, name: true } },
    },
  },
  vacationRequests: {
    orderBy: { startDate: "asc" as const },
    include: {
      history: {
        orderBy: { changedAt: "asc" as const },
        include: { changedByUser: { select: { name: true, role: true } } },
      },
    },
  },
} as const;

export async function findUserWithBalance(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      hireDate: true,
      department: true,
      vacationRequests: {
        select: { startDate: true, endDate: true, status: true },
      },
    },
  });
}

export async function findUserDepartment(userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { department: true },
  });
  return u?.department ?? null;
}

export async function findTeamMembersByManager(managerId: string) {
  return prisma.user.findMany({
    where: { managerId },
    include: baseInclude,
  });
}

export async function findTeamMembersByGerente(gerenteId: string) {
  return prisma.user.findMany({
    where: { manager: { managerId: gerenteId } },
    include: baseInclude,
  });
}

export async function findAllEmployees() {
  return prisma.user.findMany({
    where: { role: { in: ["FUNCIONARIO", "COLABORADOR"] } },
    include: baseInclude,
  });
}
