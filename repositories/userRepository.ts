import { prisma } from "@/lib/prisma";

/**
 * Times / visões de equipe: férias sem histórico aninhado (reduz muito o payload e o tempo de query).
 */
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
    select: {
      id: true,
      startDate: true,
      endDate: true,
      status: true,
      abono: true,
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

/** Coordenadores (e alias GESTOR) com gestor direto = gerente. */
export async function findCoordinatorsByGerente(gerenteId: string) {
  return prisma.user.findMany({
    where: {
      managerId: gerenteId,
      role: { in: ["COORDENADOR", "GESTOR"] },
    },
    include: baseInclude,
  });
}

export async function findAllEmployees() {
  return prisma.user.findMany({
    where: { role: { in: ["FUNCIONARIO", "COLABORADOR"] } },
    include: baseInclude,
  });
}

export async function findAllUsersForAdmin() {
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  return prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      registration: true,
      department: true,
      hireDate: true,
      team: true,
      managerId: true,
      manager: { select: { id: true, name: true } },
      _count: { select: { reports: true } },
      acquisitionPeriods: {
        where: {
          startDate: { lte: todayUtc },
          endDate: { gte: todayUtc },
        },
        orderBy: { startDate: "desc" },
        take: 1,
        select: { usedDays: true },
      },
    },
  }).then((rows) =>
    rows.map((u) => {
      const usedDays = u.acquisitionPeriods?.[0]?.usedDays;
      const hasHireDate = u.hireDate != null;
      return {
        ...u,
        tookVacationInCurrentCycle:
          usedDays === undefined ? (hasHireDate ? false : null) : usedDays > 0,
      };
    }),
  );
}

export async function findManagersForAdmin() {
  return prisma.user.findMany({
    where: { role: { in: ["COORDENADOR", "GERENTE", "GESTOR", "DIRETOR"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function findUsersWithVacationForBalance() {
  return prisma.user.findMany({
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      hireDate: true,
      vacationRequests: {
        select: { startDate: true, endDate: true, status: true },
      },
    },
  });
}
