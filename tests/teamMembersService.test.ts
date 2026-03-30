import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindTeamMembersByManager = vi.fn().mockResolvedValue([]);
const mockFindTeamMembersByGerente = vi.fn().mockResolvedValue([]);
const mockFindCoordinatorsByGerente = vi.fn().mockResolvedValue([]);
const mockFindAllEmployees = vi.fn().mockResolvedValue([]);
const mockFindAllCoordinatorsForRh = vi.fn().mockResolvedValue([]);
const mockFindAllGerentesForTimes = vi.fn().mockResolvedValue([]);
const mockFindUserWithTimesVacations = vi.fn().mockResolvedValue(null);
const mockFindUsersWithTimesVacationsByIds = vi.fn().mockResolvedValue([]);
const mockPrismaFindMany = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: (...args: unknown[]) => mockPrismaFindMany(...args),
    },
  },
}));

vi.mock("@/repositories/userRepository", () => ({
  findTeamMembersByManager: (...args: unknown[]) => mockFindTeamMembersByManager(...args),
  findTeamMembersByGerente: (...args: unknown[]) => mockFindTeamMembersByGerente(...args),
  findCoordinatorsByGerente: (...args: unknown[]) => mockFindCoordinatorsByGerente(...args),
  findAllEmployees: (...args: unknown[]) => mockFindAllEmployees(...args),
  findAllCoordinatorsForRh: (...args: unknown[]) => mockFindAllCoordinatorsForRh(...args),
  findAllGerentesForTimes: (...args: unknown[]) => mockFindAllGerentesForTimes(...args),
  findUserWithTimesVacations: (...args: unknown[]) => mockFindUserWithTimesVacations(...args),
  findUsersWithTimesVacationsByIds: (...args: unknown[]) => mockFindUsersWithTimesVacationsByIds(...args),
}));
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "postgresql://localhost:5432/test";

import { getTeamMembersForTimes } from "@/services/teamMembersService";

describe("getTeamMembersForTimes", () => {
  beforeEach(() => {
    mockFindTeamMembersByManager.mockClear();
    mockFindTeamMembersByGerente.mockClear();
    mockFindCoordinatorsByGerente.mockClear();
    mockFindAllEmployees.mockClear();
    mockFindAllCoordinatorsForRh.mockClear();
    mockFindAllGerentesForTimes.mockClear();
    mockFindUserWithTimesVacations.mockClear();
    mockFindUsersWithTimesVacationsByIds.mockClear();
    mockPrismaFindMany.mockClear();
    mockPrismaFindMany.mockResolvedValue([]);
    mockFindUsersWithTimesVacationsByIds.mockResolvedValue([]);
  });

  it("level 2 (coordenador): returns coord structure with one team e calcula isOnVacationNow com/sem abono", async () => {
    mockFindUserWithTimesVacations.mockResolvedValueOnce({
      id: "coord-1",
      name: "Coord",
      role: "COORDENADOR",
      department: null,
      hireDate: null,
      vacationRequests: [],
      manager: null,
    });
    mockFindTeamMembersByManager.mockResolvedValueOnce([
      {
        id: "u1",
        name: "João",
        department: "TI",
        hireDate: new Date("2024-01-01"),
        role: "FUNCIONARIO",
        managerId: "coord-1",
        manager: { id: "coord-1", name: "Coord", role: "COORDENADOR", managerId: null, manager: null },
        vacationRequests: [
          // Férias aprovadas sem abono, cobrindo o dia de hoje
          {
            status: "APROVADO_GERENTE",
            startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          },
          // Férias aprovadas com abono, onde o retorno estimado ainda inclui hoje
          {
            status: "APROVADO_GERENTE",
            startDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000),
            abono: true,
          },
          // Férias com status diferente não devem contar
          {
            status: "PENDENTE",
            startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          },
        ],
      },
    ]);
    const result = await getTeamMembersForTimes("coord-1", "COORDENADOR");
    expect(result.kind).toBe("coord");
    if (result.kind === "coord") {
      expect(result.coordinatorSelf?.user.id).toBe("coord-1");
    }
    expect(result.teams).toHaveLength(1);
    expect(result.teams[0].members).toHaveLength(1);
    const member = result.teams[0].members[0];
    expect(member.user.name).toBe("João");
    expect(member.isOnVacationNow).toBe(true);
    expect(mockFindTeamMembersByManager).toHaveBeenCalledWith("coord-1");
  });

  it("level 3 (gerente): returns tree structure with gerente > coordenador > colaboradores", async () => {
    mockFindUserWithTimesVacations.mockResolvedValueOnce({
      id: "ger-1",
      name: "Ger",
      role: "GERENTE",
      department: "TI",
      hireDate: null,
      vacationRequests: [],
      manager: null,
    });
    mockFindTeamMembersByGerente.mockResolvedValueOnce([
      {
        id: "u1",
        name: "Zeca",
        department: "TI",
        hireDate: new Date("2024-01-01"),
        role: "FUNCIONARIO",
        managerId: "c1",
        manager: {
          id: "c1",
          name: "Coord A",
          role: "COORDENADOR",
          managerId: "ger-1",
          manager: { id: "ger-1", name: "Ger", role: "GERENTE", managerId: null, manager: null },
        },
        vacationRequests: [],
      },
      {
        id: "u2",
        name: "Ana",
        department: "TI",
        hireDate: new Date("2024-01-01"),
        role: "FUNCIONARIO",
        managerId: "c1",
        manager: {
          id: "c1",
          name: "Coord A",
          role: "COORDENADOR",
          managerId: "ger-1",
          manager: { id: "ger-1", name: "Ger", role: "GERENTE", managerId: null, manager: null },
        },
        vacationRequests: [],
      },
    ]);
    mockFindCoordinatorsByGerente.mockResolvedValueOnce([
      {
        id: "c1",
        name: "Coord A",
        department: "TI",
        hireDate: new Date("2023-01-01"),
        role: "COORDENADOR",
        managerId: "ger-1",
        manager: { id: "ger-1", name: "Ger", role: "GERENTE", managerId: null, manager: null },
        vacationRequests: [],
      },
    ]);
    const result = await getTeamMembersForTimes("ger-1", "GERENTE");
    expect(result.kind).toBe("rh");
    expect(result.gerentes.length).toBe(1);
    expect(result.gerentes[0].gerenteId).toBe("ger-1");
    expect(result.gerentes[0].gerenteSelf?.user.id).toBe("ger-1");
    expect(result.gerentes[0].teams.length).toBeGreaterThanOrEqual(1);
    expect(result.gerentes[0].coordinatorMembers?.map((m) => m.user.id)).toEqual(["c1"]);
    // garante que o comparator do sort foi exercitado
    expect(result.gerentes[0].teams[0].members.map((m) => m.user.name)).toEqual(["Ana", "Zeca"]);
    expect(mockFindTeamMembersByGerente).toHaveBeenCalledWith("ger-1");
    expect(mockFindCoordinatorsByGerente).toHaveBeenCalledWith("ger-1");
  });

  it("level 4 (RH): returns rh structure with gerentes", async () => {
    mockFindAllGerentesForTimes.mockResolvedValueOnce([
      {
        id: "ger-1",
        name: "Gerente",
        role: "GERENTE",
        department: "TI",
        hireDate: null,
        vacationRequests: [],
        manager: { id: "d1", name: "Dir", role: "DIRETOR", managerId: null, manager: null },
      },
    ]);
    mockFindAllCoordinatorsForRh.mockResolvedValueOnce([
      {
        id: "c1",
        name: "Coord",
        department: "TI",
        hireDate: new Date("2023-01-01"),
        role: "COORDENADOR",
        managerId: "ger-1",
        manager: { id: "ger-1", name: "Gerente", role: "GERENTE", managerId: null, manager: null },
        vacationRequests: [],
      },
    ]);
    mockFindAllEmployees.mockResolvedValueOnce([
      {
        id: "u1",
        name: "Zeca",
        department: "TI",
        hireDate: new Date("2024-01-01"),
        role: "FUNCIONARIO",
        managerId: "c1",
        manager: {
          id: "c1",
          name: "Coord",
          role: "COORDENADOR",
          managerId: "ger-1",
          manager: { id: "ger-1", name: "Gerente", role: "GERENTE", managerId: null, manager: null },
        },
        vacationRequests: [],
      },
      {
        id: "u2",
        name: "Ana",
        department: "TI",
        hireDate: new Date("2024-01-01"),
        role: "FUNCIONARIO",
        managerId: "c1",
        manager: {
          id: "c1",
          name: "Coord",
          role: "COORDENADOR",
          managerId: "ger-1",
          manager: { id: "ger-1", name: "Gerente", role: "GERENTE", managerId: null, manager: null },
        },
        vacationRequests: [],
      },
    ]);
    const result = await getTeamMembersForTimes("rh-1", "RH");
    expect(result.kind).toBe("rh");
    expect("gerentes" in result && result.gerentes.length).toBeGreaterThanOrEqual(0);
    // garante que o comparator do sort foi exercitado
    const firstTeamMembers = result.gerentes[0]?.teams[0]?.members?.map((m) => m.user.name) ?? [];
    expect(firstTeamMembers).toEqual(["Ana", "Zeca"]);
    expect(result.gerentes[0]?.gerenteSelf?.user.name).toBe("Gerente");
    expect(mockFindAllEmployees).toHaveBeenCalled();
    expect(mockFindAllCoordinatorsForRh).toHaveBeenCalled();
    expect(mockFindAllGerentesForTimes).toHaveBeenCalled();
  });

  it("level 4 (RH): includes coordenador inferred from team manager when missing in coordinators query", async () => {
    mockFindAllGerentesForTimes.mockResolvedValueOnce([
      {
        id: "ger-1",
        name: "Gerente",
        role: "GERENTE",
        manager: { id: "d1", name: "Dir", role: "DIRETOR", managerId: null, manager: null },
        vacationRequests: [],
      },
    ]);
    mockFindAllCoordinatorsForRh.mockResolvedValueOnce([]);
    mockFindAllEmployees.mockResolvedValueOnce([
      {
        id: "u1",
        name: "Colab",
        role: "FUNCIONARIO",
        managerId: "c-missing",
        manager: {
          id: "c-missing",
          name: "Coord Missing",
          role: "COORDENADOR",
          manager: { id: "ger-1", name: "Gerente", role: "GERENTE" },
        },
        vacationRequests: [],
      },
    ]);
    mockFindUsersWithTimesVacationsByIds.mockResolvedValueOnce([
      {
        id: "c-missing",
        name: "Coord Missing",
        role: "COORDENADOR",
        managerId: "ger-1",
        manager: { id: "ger-1", name: "Gerente", role: "GERENTE", manager: null },
        vacationRequests: [{ status: "APROVADO_GERENTE", startDate: new Date(), endDate: new Date() }],
      },
    ]);

    const result = await getTeamMembersForTimes("rh-1", "RH");
    expect(result.kind).toBe("rh");
    expect(result.gerentes[0].coordinatorMembers?.map((m) => m.user.id)).toContain("c-missing");
    expect(mockFindUsersWithTimesVacationsByIds).toHaveBeenCalledWith(["c-missing"]);
  });

  it("handles members without a coordinator reporting directly to a manager", async () => {
    mockFindUserWithTimesVacations.mockResolvedValueOnce({
      id: "ger-1", name: "Ger", role: "GERENTE", department: "TI", hireDate: null, vacationRequests: [], manager: null
    });
    mockFindTeamMembersByGerente.mockResolvedValueOnce([
      {
        id: "u1", name: "Direct Report", department: "TI", hireDate: new Date(), role: "FUNCIONARIO", 
        managerId: "ger-1", 
        manager: { id: "ger-1", name: "Ger", role: "GERENTE", managerId: null, manager: null },
        vacationRequests: []
      }
    ]);
    mockFindCoordinatorsByGerente.mockResolvedValueOnce([]); // No coordinators

    const result = await getTeamMembersForTimes("ger-1", "GERENTE");
    expect(result.kind).toBe("rh");
    expect(result.gerentes[0].teams[0].members[0].user.name).toBe("Direct Report");
  });

  it("returns empty structure when user is not found", async () => {
    mockFindUserWithTimesVacations.mockResolvedValueOnce(null);
    const result = await getTeamMembersForTimes("ghost", "COORDENADOR");
    expect(result.kind).toBe("coord");
    expect(result.teams).toHaveLength(0);
  });

  it("identifies member on vacation when today is exactly endDate", async () => {
    mockFindUserWithTimesVacations.mockResolvedValueOnce({ id: "c1", role: "COORDENADOR" } as any);
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    
    mockFindTeamMembersByManager.mockResolvedValueOnce([
      {
        id: "u1", name: "Vacationer", role: "FUNCIONARIO", managerId: "c1",
        vacationRequests: [{ status: "APROVADO_RH", startDate: new Date(today.getTime() - 86400000), endDate: today }]
      }
    ]);

    const result = await getTeamMembersForTimes("c1", "COORDENADOR");
    expect(result.teams[0].members[0].isOnVacationNow).toBe(true);
  });

  it("handles RH structure with managers reporting to directors", async () => {
    mockFindAllGerentesForTimes.mockResolvedValueOnce([
      { id: "ger-1", name: "Gerente 1", role: "GERENTE", managerId: "dir-1" }
    ]);
    mockFindAllCoordinatorsForRh.mockResolvedValueOnce([]);
    mockFindAllEmployees.mockResolvedValueOnce([
      { 
        id: "u1", name: "Worker", role: "FUNCIONARIO", 
        manager: { id: "c1", name: "Coord", role: "COORDENADOR", manager: { id: "ger-1", name: "Ger 1", role: "GERENTE" } } 
      }
    ]);
    mockPrismaFindMany.mockResolvedValueOnce([
      { id: "ger-1", manager: { id: "dir-1", name: "Diretor Top", role: "DIRETOR" } }
    ]);

    const result = await getTeamMembersForTimes("rh-1", "RH");
    expect(result.kind).toBe("rh");
    expect(result.gerentes[0].diretorName).toBe("Diretor Top");
  });

  it("handles case where manager is not a director in attachDiretoriaToGerentes", async () => {
    mockFindAllGerentesForTimes.mockResolvedValueOnce([{ id: "g1", name: "G1", role: "GERENTE" }]);
    mockFindAllCoordinatorsForRh.mockResolvedValueOnce([]);
    mockFindAllEmployees.mockResolvedValueOnce([]);
    mockPrismaFindMany.mockResolvedValueOnce([
      { id: "g1", manager: { id: "m1", name: "Outro Gerente", role: "GERENTE" } }
    ]);

    const result = await getTeamMembersForTimes("rh-1", "RH");
    expect(result.gerentes[0].diretorId).toBeNull();
  });

  it("handles complex RH data with mixed management structures", async () => {
    // Gerente 1 com Coordenador 1
    // Gerente 2 sem Coordenador
    // Usuário sem Gerente
    mockFindAllGerentesForTimes.mockResolvedValueOnce([
      { id: "g1", name: "Gerente 1", role: "GERENTE" },
      { id: "g2", name: "Gerente 2", role: "GERENTE" }
    ]);
    mockFindAllCoordinatorsForRh.mockResolvedValueOnce([
      { id: "c1", name: "Coord 1", role: "COORDENADOR", manager: { id: "g1", role: "GERENTE" } }
    ]);
    mockFindAllEmployees.mockResolvedValueOnce([
      { id: "u1", name: "User 1", role: "FUNCIONARIO", manager: { id: "c1", role: "COORDENADOR", manager: { id: "g1", role: "GERENTE" } } },
      { id: "u2", name: "User 2", role: "FUNCIONARIO", manager: { id: "g2", role: "GERENTE" } },
      { id: "u3", name: "User 3", role: "FUNCIONARIO", manager: null }
    ]);
    mockPrismaFindMany.mockResolvedValueOnce([]); // No Directors

    const result = await getTeamMembersForTimes("rh-1", "RH");
    expect(result.kind).toBe("rh");
    const gIds = result.gerentes.map(g => g.gerenteId);
    expect(gIds).toContain("g1");
    expect(gIds).toContain("g2");
    expect(gIds).toContain("sem-gerente");
  });
});
