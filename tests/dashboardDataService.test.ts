import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindMyRequests = vi.fn().mockResolvedValue([]);
const mockFindManagedRequests = vi.fn().mockResolvedValue([]);
const mockFindBlackouts = vi.fn().mockResolvedValue([]);
const mockFindUserWithBalance = vi.fn().mockResolvedValue(null);
const mockFindUserDepartment = vi.fn().mockResolvedValue(null);
const mockSyncAcquisitionPeriodsForUser = vi.fn().mockResolvedValue([]);
const mockFindAcquisitionPeriodsForUser = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/repositories/vacationRepository", () => ({
  findMyRequests: (...args: unknown[]) => mockFindMyRequests(...args),
  findManagedRequests: (...args: unknown[]) => mockFindManagedRequests(...args),
}));
vi.mock("@/repositories/blackoutRepository", () => ({
  findBlackouts: (...args: unknown[]) => mockFindBlackouts(...args),
}));
vi.mock("@/repositories/userRepository", () => ({
  findUserWithBalance: (...args: unknown[]) => mockFindUserWithBalance(...args),
  findUserDepartment: (...args: unknown[]) => mockFindUserDepartment(...args),
}));
vi.mock("@/repositories/acquisitionRepository", () => ({
  syncAcquisitionPeriodsForUser: (...args: unknown[]) => mockSyncAcquisitionPeriodsForUser(...args),
  findAcquisitionPeriodsForUser: (...args: unknown[]) => mockFindAcquisitionPeriodsForUser(...args),
}));
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "postgresql://localhost:5432/test";

import {
  getVisibleRequests,
  getPendingCount,
  getDashboardData,
  getCurrentUserBalance,
  getCurrentUserDepartment,
  getUserAcquisitionPeriods,
} from "@/services/dashboardDataService";

describe("getDashboardData", () => {
  beforeEach(() => {
    mockFindMyRequests.mockResolvedValue([]);
    mockFindManagedRequests.mockResolvedValue([]);
    mockFindBlackouts.mockResolvedValue([]);
  });

  it("returns only myRequests for COLABORADOR/FUNCIONARIO", async () => {
    mockFindMyRequests.mockResolvedValueOnce([{ id: "r1", status: "PENDENTE" }]);
    const out = await getDashboardData({ userId: "u1", role: "FUNCIONARIO" });
    expect(out.myRequests).toHaveLength(1);
    expect(out.managedRequests).toEqual([]);
    expect(out.blackouts).toEqual([]);
    expect(out.teamRequests).toEqual([]);
    expect(mockFindManagedRequests).not.toHaveBeenCalled();
  });

  it("returns managedRequests and teamRequests for COORDENADOR", async () => {
    mockFindMyRequests.mockResolvedValue([]);
    mockFindManagedRequests.mockResolvedValue([
      { id: "r1", status: "PENDENTE", userId: "f1", user: { managerId: "c1", manager: null } },
      { id: "r2", status: "APROVADO_GERENTE", userId: "f2", user: { managerId: "c1", manager: null } },
    ]);
    mockFindBlackouts.mockResolvedValue([]);
    const out = await getDashboardData({ userId: "c1", role: "COORDENADOR" });
    expect(out.managedRequests).toHaveLength(2);
    expect(out.teamRequests).toHaveLength(1);
    expect(out.teamRequests[0].status).toBe("APROVADO_GERENTE");
  });
});

describe("getCurrentUserBalance", () => {
  it("returns balance from findUserWithBalance", async () => {
    mockFindUserWithBalance.mockResolvedValueOnce({
      hireDate: new Date("2023-01-01"),
      vacationRequests: [
        { startDate: new Date("2025-01-06"), endDate: new Date("2025-01-20"), status: "APROVADO_RH" },
      ],
    });
    const balance = await getCurrentUserBalance("u1");
    expect(balance.entitledDays).toBeGreaterThanOrEqual(0);
    expect(balance.usedDays).toBe(15);
  });

  it("handles null user (no hireDate)", async () => {
    mockFindUserWithBalance.mockResolvedValueOnce(null);
    const balance = await getCurrentUserBalance("u1");
    expect(balance.entitledDays).toBe(30);
    expect(balance.hasEntitlement).toBe(true);
  });
});

describe("getCurrentUserDepartment", () => {
  it("returns department from repository", async () => {
    mockFindUserDepartment.mockResolvedValueOnce("TI");
    expect(await getCurrentUserDepartment("u1")).toBe("TI");
  });

  it("returns null when user has no department", async () => {
    mockFindUserDepartment.mockResolvedValueOnce(null);
    expect(await getCurrentUserDepartment("u1")).toBeNull();
  });
});

describe("getUserAcquisitionPeriods", () => {
  it("syncs acquisition periods and returns acquisition periods list", async () => {
    const hireDate = new Date("2023-01-01T12:00:00Z");
    mockFindUserWithBalance.mockResolvedValueOnce({ hireDate } as any);
    mockSyncAcquisitionPeriodsForUser.mockResolvedValueOnce([]);
    mockFindAcquisitionPeriodsForUser.mockResolvedValueOnce([{ id: "p1" }] as any);

    const out = await getUserAcquisitionPeriods("u1");
    expect(mockSyncAcquisitionPeriodsForUser).toHaveBeenCalledWith("u1", hireDate);
    expect(out).toEqual([{ id: "p1" }]);
  });

  it("passes null hireDate when user is null", async () => {
    mockFindUserWithBalance.mockResolvedValueOnce(null);
    mockSyncAcquisitionPeriodsForUser.mockResolvedValueOnce([]);
    mockFindAcquisitionPeriodsForUser.mockResolvedValueOnce([{ id: "p1" }] as any);

    const out = await getUserAcquisitionPeriods("u1");
    expect(mockSyncAcquisitionPeriodsForUser).toHaveBeenCalledWith("u1", null);
    expect(out).toEqual([{ id: "p1" }]);
  });
});

describe("getVisibleRequests", () => {
  const baseReq = {
    userId: "f1",
    status: "PENDENTE",
    user: { managerId: "coord-1", manager: null },
  };

  it("RH sees all requests", () => {
    const list = [
      { ...baseReq, userId: "f1" },
      { ...baseReq, userId: "f2", user: { managerId: "other", manager: null } },
    ];
    const out = getVisibleRequests("RH", "rh-1", list);
    expect(out).toHaveLength(2);
  });

  it("Coordenador sees only direct reports", () => {
    const list = [
      { ...baseReq, userId: "f1", user: { managerId: "coord-1", manager: null } },
      { ...baseReq, userId: "f2", user: { managerId: "other", manager: null } },
    ];
    const out = getVisibleRequests("COORDENADOR", "coord-1", list);
    expect(out).toHaveLength(1);
    expect(out[0].userId).toBe("f1");
  });

  it("Gerente sees indirect reports", () => {
    const list = [
      {
        ...baseReq,
        userId: "f1",
        user: { managerId: "coord-1", manager: { managerId: "ger-1" } },
      },
    ];
    const out = getVisibleRequests("GERENTE", "ger-1", list);
    expect(out).toHaveLength(1);
  });
});

describe("getPendingCount", () => {
  const req = (status: string) => ({
    userId: "f1",
    status,
    user: { managerId: "c1", manager: null },
  });

  it("level 2: counts only PENDENTE", () => {
    const list = [
      req("PENDENTE"),
      req("PENDENTE"),
      req("APROVADO_COORDENADOR"),
    ];
    expect(getPendingCount(2, list)).toBe(2);
  });

  it("level 3: counts PENDENTE and APROVADO_COORDENADOR/APROVADO_GESTOR", () => {
    const list = [
      req("PENDENTE"),
      req("APROVADO_COORDENADOR"),
      req("APROVADO_GERENTE"),
    ];
    expect(getPendingCount(3, list)).toBe(2);
  });

  it("level 4: counts only APROVADO_GERENTE", () => {
    const list = [
      req("APROVADO_GERENTE"),
      req("APROVADO_GERENTE"),
      req("PENDENTE"),
    ];
    expect(getPendingCount(4, list)).toBe(2);
  });

  it("other level: returns 0", () => {
    expect(getPendingCount(1, [req("PENDENTE")])).toBe(0);
  });
});
