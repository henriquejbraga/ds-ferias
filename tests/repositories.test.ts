import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vacationRequest: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn().mockResolvedValue({}),
    },
    acquisitionPeriod: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    blackoutPeriod: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "postgresql://localhost:5432/test";

import {
  findMyRequests,
  findManagedRequests,
} from "@/repositories/vacationRepository";
import {
  syncAcquisitionPeriodsForUser,
  findAcquisitionPeriodsForUser,
  findAcquisitionPeriodForRange,
  addUsedDaysForRequest,
} from "@/repositories/acquisitionRepository";
import { findBlackouts } from "@/repositories/blackoutRepository";
import {
  findUserWithBalance,
  findUserDepartment,
  findTeamMembersByManager,
  findTeamMembersByGerente,
  findAllEmployees,
  findAllUsersForAdmin,
  findManagersForAdmin,
} from "@/repositories/userRepository";

describe("vacationRepository", () => {
  it("findMyRequests calls prisma with userId", async () => {
    const { prisma } = await import("@/lib/prisma");
    await findMyRequests("user-1");
    expect(prisma.vacationRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    );
  });

  it("findManagedRequests calls prisma with where", async () => {
    const { prisma } = await import("@/lib/prisma");
    await findManagedRequests({ status: "PENDENTE" });
    expect(prisma.vacationRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "PENDENTE" } })
    );
  });
});

describe("acquisitionRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns [] when hireDate is null/undefined", async () => {
    expect(await syncAcquisitionPeriodsForUser("u1", null)).toEqual([]);
    expect(await syncAcquisitionPeriodsForUser("u1", undefined)).toEqual([]);
  });

  it("returns [] when prisma client has no acquisitionPeriod (safety fallback)", async () => {
    const { prisma } = await import("@/lib/prisma");
    const original = (prisma as any).acquisitionPeriod;
    (prisma as any).acquisitionPeriod = undefined;
    try {
      const out = await syncAcquisitionPeriodsForUser("u1", new Date("2025-01-01T12:00:00Z"));
      expect(out).toEqual([]);
    } finally {
      (prisma as any).acquisitionPeriod = original;
    }
  });

  it("returns existing periods if already present", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked((prisma as any).acquisitionPeriod.findMany).mockResolvedValueOnce([
      { id: "p1", userId: "u1", startDate: new Date("2023-01-01"), endDate: new Date("2023-12-31"), accruedDays: 30, usedDays: 0 },
    ]);
    const out = await syncAcquisitionPeriodsForUser("u1", new Date("2024-01-01T12:00:00Z"));
    expect(out).toHaveLength(1);
    expect((prisma as any).acquisitionPeriod.createMany).not.toHaveBeenCalled();
  });

  it("creates periods when none exist and returns them", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));

    // first call: no existing
    vi.mocked((prisma as any).acquisitionPeriod.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "p1", userId: "u1" },
        { id: "p2", userId: "u1" },
      ] as any);

    await syncAcquisitionPeriodsForUser("u1", new Date("2024-01-10T12:00:00Z"));

    expect((prisma as any).acquisitionPeriod.createMany).toHaveBeenCalledTimes(1);
    const arg = vi.mocked((prisma as any).acquisitionPeriod.createMany).mock.calls[0][0];
    expect(Array.isArray(arg.data)).toBe(true);
    expect(arg.data.length).toBeGreaterThan(0);
    expect(arg.data[0].userId).toBe("u1");

    vi.useRealTimers();
  });

  it("covers addMonths day overflow case (e.g. Feb 29 -> non-leap year)", async () => {
    const { prisma } = await import("@/lib/prisma");

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-03-15T12:00:00Z"));

    // first call: no existing periods
    vi.mocked((prisma as any).acquisitionPeriod.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "p1",
          userId: "u1",
          startDate: new Date("2024-02-29"),
          endDate: new Date("2025-02-27"),
          accruedDays: 30,
          usedDays: 0,
        },
      ] as any);

    vi.mocked((prisma as any).vacationRequest.findMany).mockResolvedValueOnce([]);

    await syncAcquisitionPeriodsForUser("u1", new Date("2024-02-29T12:00:00Z"));

    expect((prisma as any).acquisitionPeriod.createMany).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("removes unearned acquisition periods (and detaches linked requests)", async () => {
    const { prisma } = await import("@/lib/prisma");

    const earned = {
      id: "earned",
      userId: "u1",
      startDate: new Date("2023-01-01"),
      endDate: new Date("2023-12-31"),
      accruedDays: 30,
      usedDays: 0,
    };

    const unearned = {
      id: "unearned",
      userId: "u1",
      startDate: new Date("2025-01-01"),
      endDate: new Date("2027-12-31"), // >= today => será removido
      accruedDays: 30,
      usedDays: 0,
    };

    vi.mocked((prisma as any).acquisitionPeriod.findMany).mockResolvedValueOnce([earned, unearned]);
    vi.mocked((prisma as any).vacationRequest.findMany).mockResolvedValueOnce([]); // approvedRequests vazios

    const out = await syncAcquisitionPeriodsForUser("u1", new Date("2024-01-01T12:00:00Z"));
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("earned");

    expect(prisma.vacationRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1", acquisitionPeriodId: { in: ["unearned"] } },
        data: { acquisitionPeriodId: null },
      })
    );
    expect((prisma as any).acquisitionPeriod.deleteMany).toHaveBeenCalled();
  });

  it("resync FIFO updates usedDays and acquisitionPeriodId for APROVADO_GERENTE", async () => {
    const { prisma } = await import("@/lib/prisma");

    const p1 = {
      id: "p1",
      userId: "u1",
      startDate: new Date("2023-01-01"),
      endDate: new Date("2023-12-31"),
      accruedDays: 30,
      usedDays: 0,
    };

    const p2 = {
      id: "p2",
      userId: "u1",
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-12-31"),
      accruedDays: 30,
      usedDays: 0,
    };

    const request = {
      id: "r1",
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-01-15"), // 15 dias
      acquisitionPeriodId: "p2", // está errado, deve ir para p1 (FIFO)
    };

    vi.mocked((prisma as any).acquisitionPeriod.findMany).mockResolvedValueOnce([p1, p2]);
    vi.mocked((prisma as any).vacationRequest.findMany).mockResolvedValueOnce([request]);

    const out = await syncAcquisitionPeriodsForUser("u1", new Date("2024-01-01T12:00:00Z"));
    expect(out).toHaveLength(2);

    // Consumo FIFO no primeiro período com saldo
    expect((prisma as any).acquisitionPeriod.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p1" }, data: { usedDays: 15 } })
    );

    // Corrige o acquisitionPeriodId do request
    expect((prisma as any).vacationRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "r1" }, data: { acquisitionPeriodId: "p1" } })
    );
  });

  it("FIFO resync does not update request when target period cannot be selected", async () => {
    const { prisma } = await import("@/lib/prisma");

    // accruedDays = 0 => novoUsedDays (0) nunca será < accruedDays (0)
    const p1 = {
      id: "p1",
      userId: "u1",
      startDate: new Date("2023-01-01"),
      endDate: new Date("2023-12-31"),
      accruedDays: 0,
      usedDays: 0,
    };

    const request = {
      id: "r1",
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-01-15"),
      acquisitionPeriodId: null,
    };

    vi.mocked((prisma as any).acquisitionPeriod.findMany).mockResolvedValueOnce([p1]);
    vi.mocked((prisma as any).vacationRequest.findMany).mockResolvedValueOnce([request]);

    await syncAcquisitionPeriodsForUser("u1", new Date("2024-01-01T12:00:00Z"));

    expect((prisma as any).vacationRequest.update).not.toHaveBeenCalled();
  });

  it("findAcquisitionPeriodsForUser returns acquisition periods list ordered by startDate", async () => {
    const { prisma } = await import("@/lib/prisma");
    const periods = [
      { id: "p2", userId: "u1", startDate: new Date("2024-01-01"), endDate: new Date("2024-12-31"), accruedDays: 30, usedDays: 0 },
      { id: "p1", userId: "u1", startDate: new Date("2023-01-01"), endDate: new Date("2023-12-31"), accruedDays: 30, usedDays: 0 },
    ];
    vi.mocked((prisma as any).acquisitionPeriod.findMany).mockResolvedValueOnce(periods);

    const out = await findAcquisitionPeriodsForUser("u1");
    expect(out).toEqual(periods);
    expect((prisma as any).acquisitionPeriod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" }, orderBy: { startDate: "asc" } })
    );
  });

  it("findAcquisitionPeriodForRange returns first matching period or null", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked((prisma as any).acquisitionPeriod.findMany).mockResolvedValueOnce([
      { id: "p1", userId: "u1", startDate: new Date("2023-01-01"), endDate: new Date("2023-12-31"), accruedDays: 30, usedDays: 0 },
      { id: "pX", userId: "u1", startDate: new Date("2022-01-01"), endDate: new Date("2022-12-31"), accruedDays: 30, usedDays: 0 },
    ]);

    const out = await findAcquisitionPeriodForRange("u1", new Date("2023-02-01"), new Date("2023-02-10"));
    expect(out?.id).toBe("p1");

    vi.mocked((prisma as any).acquisitionPeriod.findMany).mockResolvedValueOnce([]);
    const out2 = await findAcquisitionPeriodForRange("u1", new Date("2030-01-01"), new Date("2030-01-10"));
    expect(out2).toBeNull();
  });

  it("addUsedDaysForRequest increments usedDays when a period exists", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked((prisma as any).acquisitionPeriod.findMany).mockResolvedValueOnce([
      { id: "p1", userId: "u1", startDate: new Date("2023-01-01"), endDate: new Date("2023-12-31"), accruedDays: 30, usedDays: 5 },
    ]);

    await addUsedDaysForRequest("u1", new Date("2023-01-10"), new Date("2023-01-15")); // 6 dias (inclusive)

    expect((prisma as any).acquisitionPeriod.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p1" }, data: { usedDays: 11 } })
    );
  });
});

describe("blackoutRepository", () => {
  it("findBlackouts returns list from prisma", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.blackoutPeriod.findMany).mockResolvedValueOnce([
      { id: "b1", startDate: new Date(), endDate: new Date(), reason: "Fechamento", department: null, createdById: "u1", createdBy: { name: "Admin" } } as never,
    ]);
    const list = await findBlackouts();
    expect(list).toHaveLength(1);
    expect(list[0].reason).toBe("Fechamento");
  });
});

describe("userRepository", () => {
  it("findUserWithBalance calls prisma with userId", async () => {
    const { prisma } = await import("@/lib/prisma");
    await findUserWithBalance("user-1");
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-1" } })
    );
  });

  it("findUserDepartment returns department or null", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ department: "TI" } as never);
    const dept = await findUserDepartment("user-1");
    expect(dept).toBe("TI");
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    expect(await findUserDepartment("user-2")).toBeNull();
  });

  it("findTeamMembersByManager calls prisma with managerId", async () => {
    const { prisma } = await import("@/lib/prisma");
    await findTeamMembersByManager("coord-1");
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { managerId: "coord-1" } })
    );
  });

  it("findTeamMembersByGerente calls prisma with manager.managerId", async () => {
    const { prisma } = await import("@/lib/prisma");
    await findTeamMembersByGerente("ger-1");
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { manager: { managerId: "ger-1" } } })
    );
  });

  it("findAllEmployees calls prisma with role filter", async () => {
    const { prisma } = await import("@/lib/prisma");
    await findAllEmployees();
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: { in: ["FUNCIONARIO", "COLABORADOR"] } } })
    );
  });

  it("findAllUsersForAdmin chama prisma com ordenação e seleção de campos esperados", async () => {
    const { prisma } = await import("@/lib/prisma");
    await findAllUsersForAdmin();
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ role: "asc" }, { name: "asc" }],
        select: expect.objectContaining({
          id: true,
          name: true,
          email: true,
          role: true,
          registration: true,
          department: true,
          manager: { select: { id: true, name: true } },
        }),
      })
    );
  });

  it("findAllUsersForAdmin computes tookVacationInCurrentCycle", async () => {
    const { prisma } = await import("@/lib/prisma");

    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      // usedDays undefined + hireDate ausente => null
      {
        id: "u1",
        name: "A",
        email: "a@test.com",
        role: "FUNCIONARIO",
        registration: "r1",
        department: "Eng",
        hireDate: null,
        team: "T1",
        managerId: null,
        manager: null,
        _count: { reports: 0 },
        acquisitionPeriods: [],
      },
      // usedDays undefined + hireDate presente => false
      {
        id: "u2",
        name: "B",
        email: "b@test.com",
        role: "FUNCIONARIO",
        registration: "r2",
        department: "Eng",
        hireDate: new Date("2023-01-01"),
        team: "T1",
        managerId: null,
        manager: null,
        _count: { reports: 0 },
        acquisitionPeriods: [],
      },
      // usedDays definido: 0 => false
      {
        id: "u3",
        name: "C",
        email: "c@test.com",
        role: "FUNCIONARIO",
        registration: "r3",
        department: "Eng",
        hireDate: new Date("2023-01-01"),
        team: "T1",
        managerId: null,
        manager: null,
        _count: { reports: 0 },
        acquisitionPeriods: [{ usedDays: 0 }],
      },
      // usedDays definido: >0 => true
      {
        id: "u4",
        name: "D",
        email: "d@test.com",
        role: "FUNCIONARIO",
        registration: "r4",
        department: "Eng",
        hireDate: new Date("2023-01-01"),
        team: "T1",
        managerId: null,
        manager: null,
        _count: { reports: 0 },
        acquisitionPeriods: [{ usedDays: 5 }],
      },
    ] as any);

    const out = await findAllUsersForAdmin();
    const byId = new Map(out.map((u: any) => [u.id, u.tookVacationInCurrentCycle]));

    expect(byId.get("u1")).toBeNull();
    expect(byId.get("u2")).toBe(false);
    expect(byId.get("u3")).toBe(false);
    expect(byId.get("u4")).toBe(true);
  });

  it("findUsersWithVacationForBalance calls prisma with expected orderBy/select", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findUsersWithVacationForBalance } = await import("@/repositories/userRepository");

    await findUsersWithVacationForBalance();
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ name: "asc" }],
        select: expect.objectContaining({
          id: true,
          name: true,
          email: true,
          role: true,
          department: true,
          hireDate: true,
        }),
      })
    );
  });

  it("findManagersForAdmin chama prisma filtrando coordenadores/gerentes/gestores/diretores", async () => {
    const { prisma } = await import("@/lib/prisma");
    await findManagersForAdmin();
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: { in: ["COORDENADOR", "GERENTE", "GESTOR", "DIRETOR"] } },
        select: { id: true, name: true },
      })
    );
  });

  it("findUserWithBalance returns null if prisma returns null", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    const res = await findUserWithBalance("u-none");
    expect(res).toBeNull();
  });
});
