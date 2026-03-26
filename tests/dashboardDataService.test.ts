import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindMyRequests = vi.fn().mockResolvedValue([]);
const mockFindManagedRequests = vi.fn().mockResolvedValue([]);
const mockFindBlackouts = vi.fn().mockResolvedValue([]);
const mockFindUserWithBalance = vi.fn().mockResolvedValue(null);
const mockFindUserDepartment = vi.fn().mockResolvedValue(null);
const mockSyncAcquisitionPeriodsForUser = vi.fn().mockResolvedValue([]);
const mockFindAcquisitionPeriodsForUser = vi.fn().mockResolvedValue([]);
const mockPrismaVacationFindMany = vi.fn().mockResolvedValue([]);
const mockFilterManagedRequestsForIndirectLeaders = vi.fn(
  async (_approverId: string, requests: unknown[]) => requests,
);

vi.mock("@/lib/prisma", () => ({
  prisma: { vacationRequest: { findMany: (...args: unknown[]) => mockPrismaVacationFindMany(...args) } },
}));
vi.mock("@/repositories/vacationRepository", () => ({
  findMyRequests: (...args: unknown[]) => mockFindMyRequests(...args),
  findManagedRequests: (...args: unknown[]) => mockFindManagedRequests(...args),
  findManagedRequestsLean: (...args: unknown[]) => mockFindManagedRequests(...args),
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
vi.mock("@/lib/indirectLeaderRule", () => ({
  filterManagedRequestsForIndirectLeaders: (...args: unknown[]) =>
    mockFilterManagedRequestsForIndirectLeaders(...args),
}));
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "postgresql://localhost:5432/test";

import {
  getVisibleRequests,
  getPendingCount,
  getDashboardData,
  getCurrentUserBalance,
  getCurrentUserDepartment,
  getFirstEntitlementDate,
  getMyVacationSidebarContext,
  getUserAcquisitionPeriods,
} from "@/services/dashboardDataService";

describe("getDashboardData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMyRequests.mockResolvedValue([]);
    mockFindManagedRequests.mockResolvedValue([]);
    mockFindBlackouts.mockResolvedValue([]);
    mockPrismaVacationFindMany.mockResolvedValue([]);
    mockFilterManagedRequestsForIndirectLeaders.mockImplementation(async (_id, requests) => requests as any[]);
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
    expect(mockFilterManagedRequestsForIndirectLeaders).not.toHaveBeenCalled();
  });

  it("for GERENTE, keeps direct reports and only allowed indirect reports", async () => {
    mockFindManagedRequests.mockResolvedValue([
      {
        id: "r-direct",
        status: "PENDENTE",
        createdAt: new Date("2026-03-20T12:00:00Z"),
        userId: "f-direct",
        user: { managerId: "ger-1", manager: { managerId: "dir-1" } },
      },
      {
        id: "r-indirect-allowed",
        status: "PENDENTE",
        createdAt: new Date("2026-03-20T12:00:00Z"),
        userId: "f-indirect-allowed",
        user: { managerId: "coord-1", manager: { managerId: "ger-1" } },
      },
      {
        id: "r-indirect-blocked",
        status: "PENDENTE",
        createdAt: new Date("2026-03-21T12:00:00Z"),
        userId: "f-indirect-blocked",
        user: { managerId: "coord-2", manager: { managerId: "ger-1" } },
      },
    ]);
    mockFilterManagedRequestsForIndirectLeaders.mockImplementationOnce(async (_id, requests: any[]) =>
      requests.filter((r) => r.id !== "r-indirect-blocked"),
    );

    const out = await getDashboardData({ userId: "ger-1", role: "GERENTE" });
    expect(out.managedRequests.map((r: any) => r.id)).toEqual(["r-direct", "r-indirect-allowed"]);
    expect(mockFilterManagedRequestsForIndirectLeaders).toHaveBeenCalledTimes(1);
  });

  it("for DIRETOR, keeps direct reports and only allowed indirect reports", async () => {
    mockFindManagedRequests.mockResolvedValue([
      {
        id: "r-direct-gerente",
        status: "PENDENTE",
        createdAt: new Date("2026-03-25T12:00:00Z"),
        userId: "ger-1",
        user: { managerId: "dir-1", manager: { managerId: "rh-1" } },
      },
      {
        id: "r-indirect-allowed",
        status: "PENDENTE",
        createdAt: new Date("2026-03-26T12:00:00Z"),
        userId: "f-indirect-allowed",
        user: { managerId: "ger-2", manager: { managerId: "dir-1" } },
      },
      {
        id: "r-indirect-blocked",
        status: "PENDENTE",
        createdAt: new Date("2026-03-27T12:00:00Z"),
        userId: "f-indirect-blocked",
        user: { managerId: "ger-3", manager: { managerId: "dir-1" } },
      },
    ]);
    mockFilterManagedRequestsForIndirectLeaders.mockImplementationOnce(async (_id, requests: any[]) =>
      requests.filter((r) => r.id !== "r-indirect-blocked"),
    );

    const out = await getDashboardData({ userId: "dir-1", role: "DIRETOR" });
    expect(out.managedRequests.map((r: any) => r.id)).toEqual(["r-direct-gerente", "r-indirect-allowed"]);
    expect(mockFilterManagedRequestsForIndirectLeaders).toHaveBeenCalledTimes(1);
  });

  it("uses lean fetcher and skipMyRequests when approver asks", async () => {
    await getDashboardData(
      { userId: "ger-1", role: "GERENTE", query: "ana", status: "TODOS" },
      { leanManaged: true, skipMyRequests: true },
    );
    expect(mockFindMyRequests).not.toHaveBeenCalled();
    expect(mockFindManagedRequests).toHaveBeenCalledTimes(1);
  });
});

describe("getCurrentUserBalance", () => {
  it("returns balance from findUserWithBalance", async () => {
    mockFindUserWithBalance.mockResolvedValueOnce({
      hireDate: new Date("2023-01-01"),
      vacationRequests: [
        { startDate: new Date("2025-01-06"), endDate: new Date("2025-01-20"), status: "APROVADO_GERENTE" },
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

describe("entitlement and sidebar context", () => {
  it("getFirstEntitlementDate returns null with missing hireDate", async () => {
    mockFindUserWithBalance.mockResolvedValueOnce(null);
    expect(await getFirstEntitlementDate("u1")).toBeNull();
  });

  it("getFirstEntitlementDate adds 12 months preserving day", async () => {
    mockFindUserWithBalance.mockResolvedValueOnce({ hireDate: new Date("2024-01-31T12:00:00Z") });
    const out = await getFirstEntitlementDate("u1");
    expect(out?.toISOString().slice(0, 10)).toBe("2025-01-31");
  });

  it("getMyVacationSidebarContext returns concessive context when hireDate exists", async () => {
    const hireDate = new Date("2024-01-01T00:00:00Z");
    mockFindUserWithBalance.mockResolvedValueOnce({
      hireDate,
      department: "Produto",
      vacationRequests: [],
    });
    mockFindAcquisitionPeriodsForUser.mockResolvedValueOnce([
      {
        id: "p1",
        startDate: new Date("2024-01-01T00:00:00Z"),
        endDate: new Date("2024-12-31T23:59:59Z"),
        accruedDays: 30,
        usedDays: 10,
      },
    ]);
    mockPrismaVacationFindMany.mockResolvedValueOnce([
      { startDate: new Date("2026-01-05T00:00:00Z"), endDate: new Date("2026-01-19T00:00:00Z") },
    ]);

    const out = await getMyVacationSidebarContext("u1");
    expect(mockSyncAcquisitionPeriodsForUser).toHaveBeenCalledWith("u1", hireDate);
    expect(out.department).toBe("Produto");
    expect(out.concessiveContext?.hireDateIso).toBe(hireDate.toISOString());
    expect(out.concessiveContext?.acquisitionPeriods[0].id).toBe("p1");
    expect(out.concessiveContext?.pendingVacations).toHaveLength(1);
  });

  it("getMyVacationSidebarContext returns null concessive context without hireDate", async () => {
    mockFindUserWithBalance.mockResolvedValueOnce({
      hireDate: null,
      department: null,
      vacationRequests: [],
    });
    mockFindAcquisitionPeriodsForUser.mockResolvedValueOnce([]);
    mockPrismaVacationFindMany.mockResolvedValueOnce([]);

    const out = await getMyVacationSidebarContext("u1");
    expect(out.concessiveContext).toBeNull();
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

  it("level 4: counts only PENDENTE", () => {
    const list = [
      req("APROVADO_GERENTE"),
      req("APROVADO_GERENTE"),
      req("PENDENTE"),
    ];
    expect(getPendingCount(4, list)).toBe(1);
  });

  it("other level: returns 0", () => {
    expect(getPendingCount(1, [req("PENDENTE")])).toBe(0);
  });
});
