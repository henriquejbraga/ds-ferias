import { describe, it, expect, vi, beforeEach } from "vitest";
import { vacationActionService, DomainError } from "@/services/vacationActionService";
import { prisma } from "@/lib/prisma";
import * as acquisitionRepo from "@/repositories/acquisitionRepository";
import * as notifications from "@/lib/notifications";
import * as indirectRule from "@/lib/indirectLeaderRule";
import * as rules from "@/lib/vacationRules";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vacationRequest: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    blackoutPeriod: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    acquisitionPeriod: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
    vacationRequestHistory: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (arg) => {
      if (typeof arg === "function") return await arg(prisma);
      return await Promise.all(arg);
    }),
  },
}));

vi.mock("@/repositories/acquisitionRepository");
vi.mock("@/lib/notifications", () => ({
  notifyNewRequest: vi.fn().mockResolvedValue({}),
  notifyApproved: vi.fn().mockResolvedValue({}),
  notifyRejected: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/indirectLeaderRule");
vi.mock("@/lib/logger");

describe("vacationActionService", () => {
  const mockUser: any = { id: "u1", name: "User", email: "u@e.com", role: "FUNCIONARIO" };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(rules, "canApproveRequest").mockReturnValue(true);
  });

  describe("createRequest", () => {
    it("throws DomainError if periods are empty", async () => {
      await expect(vacationActionService.createRequest({ user: mockUser, periods: [] }))
        .rejects.toThrow("É necessário informar ao menos um período de férias.");
    });

    it("throws DomainError if internal periods overlap", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ hireDate: null } as any);
      const periods = [
        { start: new Date("2026-06-01T12:00:00Z"), end: new Date("2026-06-10T12:00:00Z") },
        { start: new Date("2026-06-05T12:00:00Z"), end: new Date("2026-06-15T12:00:00Z") }
      ];
      await expect(vacationActionService.createRequest({ user: mockUser, periods }))
        .rejects.toThrow("Os períodos informados se sobrepõem entre si.");
    });

    it("throws DomainError if Gerente limit is exceeded", async () => {
      const gerente = { ...mockUser, role: "GERENTE" };
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ hireDate: new Date("2020-01-01"), department: "IT" } as any);
      vi.mocked(prisma.vacationRequest.findMany).mockResolvedValue([
        { startDate: new Date("2026-01-01"), endDate: new Date("2026-01-28") }
      ] as any);
      const newPeriods = [{ start: new Date("2026-06-01"), end: new Date("2026-06-15") }];
      await expect(vacationActionService.createRequest({ user: gerente, periods: newPeriods }))
        .rejects.toThrow(/limite é de 22 dias úteis/);
    });

    it("successfully creates request for worker with full cycle", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ hireDate: new Date("2025-01-01"), department: "IT" } as any);
      vi.mocked(acquisitionRepo.findAcquisitionPeriodsForUser).mockResolvedValue([
        { id: "p1", startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31"), accruedDays: 30, usedDays: 0 }
      ] as any);
      vi.mocked(prisma.vacationRequest.findMany).mockResolvedValue([]);
      vi.mocked(prisma.vacationRequest.create).mockResolvedValue({ id: "r1", startDate: new Date(), endDate: new Date() } as any);

      const period = { start: new Date("2026-06-01T12:00:00Z"), end: new Date("2026-06-30T12:00:00Z") };
      const result = await vacationActionService.createRequest({ user: mockUser, periods: [period] });
      expect(result).toHaveLength(1);
    });

    it("throws DomainError for worker requesting less than 30 days (but valid CLT block)", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ hireDate: new Date("2025-01-01") } as any);
      vi.mocked(acquisitionRepo.findAcquisitionPeriodsForUser).mockResolvedValue([{ id: "p1", startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31"), accruedDays: 30, usedDays: 0 }] as any);
      vi.mocked(prisma.vacationRequest.findMany).mockResolvedValue([]);

      // 15 dias passa na regra de bloco de 14, mas falha na regra de totalizar 30 para funcionário
      const period = { start: new Date("2026-06-01T12:00:00Z"), end: new Date("2026-06-15T12:00:00Z") };
      await expect(vacationActionService.createRequest({ user: mockUser, periods: [period] }))
        .rejects.toThrow(/precisa totalizar 30 dias/);
    });
  });

  describe("approveRequest", () => {
    it("handles idempotency when already approved", async () => {
      const manager = { ...mockUser, id: "m1", role: "COORDENADOR" };
      const mockReq = {
        id: "r1", userId: "u1", status: "APROVADO_COORDENADOR", startDate: new Date(), endDate: new Date(),
        user: { id: "u1", name: "U", email: "u@e.com", managerId: "m1", role: "FUNCIONARIO" }
      };
      vi.mocked(prisma.vacationRequest.findUnique).mockResolvedValue(mockReq as any);
      const result = await vacationActionService.approveRequest("r1", manager);
      expect(result.status).toBe("APROVADO_COORDENADOR");
    });

    it("successfully approves as indirect leader when rules allow", async () => {
      const manager = { ...mockUser, id: "m2", role: "GERENTE", name: "Indirect" };
      const mockReq = {
        id: "r1", userId: "u1", status: "PENDENTE", startDate: new Date(), endDate: new Date(),
        user: { id: "u1", name: "U", email: "u@e.com", managerId: "m1", role: "FUNCIONARIO", manager: { managerId: "dir1" } }
      };
      vi.mocked(prisma.vacationRequest.findUnique).mockResolvedValue(mockReq as any);
      vi.mocked(indirectRule.canIndirectLeaderActWhenDirectOnVacation).mockResolvedValue(true);
      vi.mocked(prisma.acquisitionPeriod.findMany).mockResolvedValue([{ id: "p1", accruedDays: 30, usedDays: 0 }] as any);
      const result = await vacationActionService.approveRequest("r1", manager);
      expect(result.id).toBe("r1");
      await new Promise(process.nextTick); 
      expect(notifications.notifyApproved).toHaveBeenCalled();
    });
  });

  describe("rejectRequest", () => {
    it("successfully rejects and notifies", async () => {
      const manager = { ...mockUser, id: "m1", role: "COORDENADOR" };
      vi.mocked(prisma.vacationRequest.findUnique).mockResolvedValue({
        id: "r1", userId: "u1", status: "PENDENTE", user: { id: "u1", managerId: "m1", name: "U", email: "u@e.com", role: "FUNCIONARIO" }
      } as any);
      vi.mocked(prisma.vacationRequest.update).mockResolvedValue({ id: "r1", user: { name: "U", email: "u@e.com" } } as any);
      await vacationActionService.rejectRequest("r1", manager, "Reprovado");
      expect(prisma.vacationRequest.update).toHaveBeenCalled();
      await new Promise(process.nextTick);
      expect(notifications.notifyRejected).toHaveBeenCalled();
    });

    it("throws DomainError if not direct manager during rejection", async () => {
      const manager = { ...mockUser, id: "m-wrong", role: "COORDENADOR" };
      vi.mocked(prisma.vacationRequest.findUnique).mockResolvedValue({
        id: "r1", userId: "u1", status: "PENDENTE",
        user: { id: "u1", managerId: "m-correct", role: "FUNCIONARIO" }
      } as any);
      await expect(vacationActionService.rejectRequest("r1", manager)).rejects.toThrow("Somente o líder direto");
    });
  });
});
