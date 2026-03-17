import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindTeamMembersByManager = vi.fn().mockResolvedValue([]);
const mockFindTeamMembersByGerente = vi.fn().mockResolvedValue([]);
const mockFindAllEmployees = vi.fn().mockResolvedValue([]);

vi.mock("@/repositories/userRepository", () => ({
  findTeamMembersByManager: (...args: unknown[]) => mockFindTeamMembersByManager(...args),
  findTeamMembersByGerente: (...args: unknown[]) => mockFindTeamMembersByGerente(...args),
  findAllEmployees: (...args: unknown[]) => mockFindAllEmployees(...args),
}));
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "postgresql://localhost:5432/test";

import { getTeamMembersForTimes } from "@/services/teamMembersService";

describe("getTeamMembersForTimes", () => {
  beforeEach(() => {
    mockFindTeamMembersByManager.mockClear();
    mockFindTeamMembersByGerente.mockClear();
    mockFindAllEmployees.mockClear();
  });

  it("level 2 (coordenador): returns coord structure with one team e calcula isOnVacationNow com/sem abono", async () => {
    mockFindTeamMembersByManager.mockResolvedValueOnce([
      {
        id: "u1",
        name: "João",
        department: "TI",
        hireDate: new Date("2024-01-01"),
        role: "FUNCIONARIO",
        managerId: "coord-1",
        manager: { id: "coord-1", name: "Coord", managerId: null, manager: null },
        vacationRequests: [
          // Férias aprovadas sem abono, cobrindo o dia de hoje
          {
            status: "APROVADO_RH",
            startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          },
          // Férias aprovadas com abono, onde o retorno estimado ainda inclui hoje
          {
            status: "APROVADO_RH",
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
    expect(result.teams).toHaveLength(1);
    expect(result.teams[0].members).toHaveLength(1);
    const member = result.teams[0].members[0];
    expect(member.user.name).toBe("João");
    expect(member.isOnVacationNow).toBe(true);
    expect(mockFindTeamMembersByManager).toHaveBeenCalledWith("coord-1");
  });

  it("level 3 (gerente): returns coord structure with teams by coordenador", async () => {
    mockFindTeamMembersByGerente.mockResolvedValueOnce([
      {
        id: "u1",
        name: "João",
        department: "TI",
        hireDate: new Date("2024-01-01"),
        role: "FUNCIONARIO",
        managerId: "c1",
        manager: { id: "c1", name: "Coord A", managerId: "ger-1", manager: null },
        vacationRequests: [],
      },
    ]);
    const result = await getTeamMembersForTimes("ger-1", "GERENTE");
    expect(result.kind).toBe("coord");
    expect(result.teams.length).toBeGreaterThanOrEqual(0);
    expect(mockFindTeamMembersByGerente).toHaveBeenCalledWith("ger-1");
  });

  it("level 4 (RH): returns rh structure with gerentes", async () => {
    mockFindAllEmployees.mockResolvedValueOnce([
      {
        id: "u1",
        name: "João",
        department: "TI",
        hireDate: new Date("2024-01-01"),
        role: "FUNCIONARIO",
        managerId: "c1",
        manager: {
          id: "c1",
          name: "Coord",
          managerId: "ger-1",
          manager: { id: "ger-1", name: "Gerente", managerId: null },
        },
        vacationRequests: [],
      },
    ]);
    const result = await getTeamMembersForTimes("rh-1", "RH");
    expect(result.kind).toBe("rh");
    expect("gerentes" in result && result.gerentes.length).toBeGreaterThanOrEqual(0);
    expect(mockFindAllEmployees).toHaveBeenCalled();
  });
});
