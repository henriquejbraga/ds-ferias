import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncAcquisitionPeriodsForUser } from "@/repositories/acquisitionRepository";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    acquisitionPeriod: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
    },
    vacationRequest: {
      updateMany: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe("acquisitionRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty when hireDate is missing", async () => {
    const res = await syncAcquisitionPeriodsForUser("u1", null);
    expect(res).toEqual([]);
  });

  it("performs dedup when duplicate periods exist", async () => {
    const start = new Date("2020-01-01");
    const end = new Date("2020-12-31");
    const mockPeriods = [
      { id: "p1", startDate: start, endDate: end, accruedDays: 30, usedDays: 10 },
      { id: "p2", startDate: start, endDate: end, accruedDays: 30, usedDays: 5 },
    ];
    
    vi.mocked(prisma.acquisitionPeriod.findMany).mockResolvedValueOnce(mockPeriods as any);
    vi.mocked(prisma.vacationRequest.findMany).mockResolvedValue([]);

    await syncAcquisitionPeriodsForUser("u1", new Date("2020-01-01"));

    expect(prisma.vacationRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { acquisitionPeriodId: "p1" } // Canonical is p1 (more usedDays)
    }));
    expect(prisma.acquisitionPeriod.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ["p2"] } }
    }));
  });

  it("deletes unearned periods", async () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    
    const mockPeriods = [
      { id: "p-future", startDate: new Date(), endDate: futureDate, accruedDays: 30, usedDays: 0 }
    ];
    
    vi.mocked(prisma.acquisitionPeriod.findMany).mockResolvedValueOnce(mockPeriods as any);
    vi.mocked(prisma.vacationRequest.findMany).mockResolvedValue([]);

    await syncAcquisitionPeriodsForUser("u1", new Date("2020-01-01"));

    expect(prisma.acquisitionPeriod.deleteMany).toHaveBeenCalled();
  });

  it("recalculates usedDays using FIFO logic across multiple periods", async () => {
    const p1 = { id: "p1", startDate: new Date("2020-01-01"), endDate: new Date("2020-12-31"), accruedDays: 30, usedDays: 99 };
    const p2 = { id: "p2", startDate: new Date("2021-01-01"), endDate: new Date("2021-12-31"), accruedDays: 30, usedDays: 99 };

    vi.mocked(prisma.acquisitionPeriod.findMany).mockResolvedValue([p1, p2] as any);

    // R1 consome 30 dias de p1. R2 consome 5 dias de p2.
    vi.mocked(prisma.vacationRequest.findMany).mockResolvedValue([
      { id: "r1", startDate: new Date("2022-01-01"), endDate: new Date("2022-01-30"), abono: false, status: "APROVADO_RH" },
      { id: "r2", startDate: new Date("2023-06-01"), endDate: new Date("2023-06-05"), abono: false, status: "APROVADO_RH" }
    ] as any);

    await syncAcquisitionPeriodsForUser("u1", new Date("2020-01-01"));

    expect(prisma.acquisitionPeriod.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "p1" },
      data: { usedDays: 30 }
    }));
    expect(prisma.acquisitionPeriod.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "p2" },
      data: { usedDays: 5 }
    }));
    });

    it("creates missing periods for new users", async () => {
    vi.mocked(prisma.acquisitionPeriod.findMany).mockResolvedValueOnce([]); // No periods first
    vi.mocked(prisma.acquisitionPeriod.findMany).mockResolvedValue([
      { id: "p1", startDate: new Date("2020-01-01"), endDate: new Date("2020-12-30"), accruedDays: 30, usedDays: 0 }
    ] as any); // Then returns one
    vi.mocked(prisma.vacationRequest.findMany).mockResolvedValue([]);

    const hire = new Date();
    hire.setFullYear(hire.getFullYear() - 2); // 2 full cycles

    await syncAcquisitionPeriodsForUser("u1", hire);

    expect(prisma.acquisitionPeriod.createMany).toHaveBeenCalled();
    });

    it("handles missing prisma methods gracefully", async () => {
    const original = prisma.acquisitionPeriod;
    (prisma as any).acquisitionPeriod = {};
    const res = await syncAcquisitionPeriodsForUser("u1", new Date());
    expect(res).toEqual([]);
    (prisma as any).acquisitionPeriod = original;
    });
    });

    import { findAcquisitionPeriodsForUser, findAcquisitionPeriodForRange, addUsedDaysForRequest } from "@/repositories/acquisitionRepository";

    describe("acquisitionRepository helpers", () => {
    beforeEach(() => {
    vi.clearAllMocks();
    });

    it("findAcquisitionPeriodsForUser calls prisma", async () => {
    await findAcquisitionPeriodsForUser("u1");
    expect(prisma.acquisitionPeriod.findMany).toHaveBeenCalled();
    });

    it("findAcquisitionPeriodForRange finds period", async () => {
    vi.mocked(prisma.acquisitionPeriod.findMany).mockResolvedValue([{ id: "p1" }] as any);
    const res = await findAcquisitionPeriodForRange("u1", new Date(), new Date());
    expect(res?.id).toBe("p1");
    });

    it("addUsedDaysForRequest updates correctly", async () => {
    const start = new Date("2026-10-01");
    const end = new Date("2026-10-10");
    vi.mocked(prisma.acquisitionPeriod.findMany).mockResolvedValue([{ id: "p1", usedDays: 0 }] as any);

    await addUsedDaysForRequest("u1", start, end);

    expect(prisma.acquisitionPeriod.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "p1" },
      data: { usedDays: 10 }
    }));
    });
    });
