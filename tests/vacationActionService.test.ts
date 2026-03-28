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
    vi.spyOn(rules, "detectTeamConflicts").mockReturnValue({ isWarning: false, isBlocked: false, conflictingCount: 0 } as any);
    vi.spyOn(rules, "getNextApprovalStatus").mockReturnValue("APROVADO_COORDENADOR");
  });

  describe("createRequest", () => {
    it("throws if periods are empty", async () => {
      await expect(vacationActionService.createRequest({ user: mockUser, periods: [] })).rejects.toThrow();
    });

    it("throws on internal overlap", async () => {
      const p = [{ start: new Date("2026-01-01T12:00:00Z"), end: new Date("2026-01-10T12:00:00Z") }, { start: new Date("2026-01-05T12:00:00Z"), end: new Date("2026-01-15T12:00:00Z") }];
      await expect(vacationActionService.createRequest({ user: mockUser, periods: p })).rejects.toThrow(/sobrepõem/);
    });

    it("throws if overlapping request exists", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ hireDate: null } as any);
      vi.mocked(prisma.vacationRequest.findFirst).mockResolvedValue({ id: "existing" } as any);
      const period = { start: new Date("2026-06-01T12:00:00Z"), end: new Date("2026-06-15T12:00:00Z") };
      await expect(vacationActionService.createRequest({ user: mockUser, periods: [period] })).rejects.toThrow("Já existe uma solicitação que conflita com este período.");
    });

    it("throws if Gerente business days limit is exceeded", async () => {
      const manager = { ...mockUser, role: "GERENTE" };
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ hireDate: new Date("2020-01-01"), department: "IT" } as any);
      vi.mocked(prisma.vacationRequest.findMany).mockResolvedValue([
        { startDate: new Date("2026-01-01T12:00:00Z"), endDate: new Date("2026-01-28T12:00:00Z"), status: "APROVADO_GERENTE" }
      ] as any);
      const newPeriod = [{ start: new Date("2026-06-01T12:00:00Z"), end: new Date("2026-06-05T12:00:00Z") }];
      await expect(vacationActionService.createRequest({ user: manager, periods: newPeriod })).rejects.toThrow(/limite é de 22 dias úteis/);
    });

    it("throws if starting before first entitlement date (pre-scheduling)", async () => {
      const hireDate = new Date();
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ hireDate } as any);
      const start = new Date(hireDate.getTime() + 10 * 86400000);
      const end = new Date(start.getTime() + 30 * 86400000);
      await expect(vacationActionService.createRequest({ user: mockUser, periods: [{ start, end }] })).rejects.toThrow(/Pré-agendamento permitido somente/);
    });

    it("throws if balance insufficient for pre-scheduling", async () => {
      const hireDate = new Date();
      hireDate.setFullYear(hireDate.getFullYear() - 1);
      hireDate.setDate(hireDate.getDate() + 1);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ hireDate } as any);
      vi.mocked(prisma.vacationRequest.findMany).mockResolvedValue([{ startDate: new Date(), endDate: new Date(), abono: true, status: "PENDENTE" }] as any);
      const start = new Date();
      start.setFullYear(start.getFullYear() + 1);
      const end = new Date(start.getTime() + 15 * 86400000);
      await expect(vacationActionService.createRequest({ user: mockUser, periods: [{ start, end }] })).rejects.toThrow(/Saldo insuficiente|totalizar 30 dias/);
    });

    it("throws if no acquisition periods found", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ hireDate: new Date("2020-01-01") } as any);
      vi.mocked(acquisitionRepo.findAcquisitionPeriodsForUser).mockResolvedValue([]);
      const period = { start: new Date("2026-06-01T12:00:00Z"), end: new Date("2026-06-30T12:00:00Z") };
      await expect(vacationActionService.createRequest({ user: mockUser, periods: [period] })).rejects.toThrow(/Sem períodos aquisitivos disponíveis/);
    });

    it("successfully creates with notifications and fallback validation", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ hireDate: null, vacationRequests: [] } as any);
      vi.mocked(prisma.vacationRequest.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.vacationRequest.create).mockResolvedValue({ id: "r1", startDate: new Date(), endDate: new Date() } as any);
      const p = [{ start: new Date("2026-01-01"), end: new Date("2026-01-10") }];
      const res = await vacationActionService.createRequest({ user: mockUser, periods: p });
      expect(res).toBeDefined();
      await new Promise(process.nextTick);
      expect(notifications.notifyNewRequest).toHaveBeenCalled();
    });
  });

  describe("approveRequest", () => {
    it("throws if role not allowed", async () => {
      await expect(vacationActionService.approveRequest("r1", { ...mockUser, role: "FUNCIONARIO" })).rejects.toThrow(/permissão/);
    });

    it("throws if request disappeared during transaction", async () => {
      const manager = { ...mockUser, id: "m1", role: "GERENTE" };
      vi.mocked(prisma.vacationRequest.findUnique).mockResolvedValueOnce({ id: "r1", userId: "u1", user: { managerId: "m1" } } as any).mockResolvedValueOnce(null);
      await expect(vacationActionService.approveRequest("r1", manager)).rejects.toThrow("Solicitação não encontrada.");
    });

    it("handles team conflict block (> 50%)", async () => {
      const manager = { ...mockUser, id: "m1", role: "GERENTE" };
      vi.mocked(prisma.vacationRequest.findUnique).mockResolvedValue({ id: "r1", userId: "u1", startDate: new Date(), endDate: new Date(), user: { managerId: "m1" } } as any);
      vi.spyOn(rules, "detectTeamConflicts").mockReturnValue({ isBlocked: true, conflictingCount: 5 } as any);
      await expect(vacationActionService.approveRequest("r1", manager, false)).rejects.toThrow(/Conflito/);
    });

    it("handles idempotency", async () => {
      const mockReq = { id: "r1", status: "APROVADO_GERENTE", user: { id: "u1", name: "U", email: "e", managerId: "m1" } };
      vi.mocked(prisma.vacationRequest.findUnique).mockResolvedValue(mockReq as any);
      vi.spyOn(rules, "getNextApprovalStatus").mockReturnValue("APROVADO_GERENTE");
      const res = await vacationActionService.approveRequest("r1", { ...mockUser, id: "m1", role: "GERENTE" });
      expect(res.id).toBe("r1");
    });

    it("executes full approval path with period update", async () => {
      const mockReq = { id: "r1", status: "PENDENTE", startDate: new Date(), endDate: new Date(), user: { id: "u1", name: "U", email: "e", managerId: "m1", role: "FUNCIONARIO" } };
      vi.mocked(prisma.vacationRequest.findUnique).mockResolvedValue(mockReq as any);
      vi.mocked(prisma.acquisitionPeriod.findMany).mockResolvedValue([{ id: "p1", accruedDays: 30, usedDays: 0 }] as any);
      vi.spyOn(rules, "getNextApprovalStatus").mockReturnValue("APROVADO_RH");
      vi.mocked(prisma.vacationRequest.updateMany).mockResolvedValue({ count: 1 });
      const res = await vacationActionService.approveRequest("r1", { ...mockUser, id: "m1", role: "GERENTE", name: "Boss" });
      expect(res).toBeDefined();
      await new Promise(process.nextTick);
      expect(notifications.notifyApproved).toHaveBeenCalled();
    });
  });

  describe("rejectRequest", () => {
    it("throws if not found", async () => {
      vi.mocked(prisma.vacationRequest.findUnique).mockResolvedValue(null);
      await expect(vacationActionService.rejectRequest("r1", { ...mockUser, role: "GERENTE" })).rejects.toThrow();
    });

    it("throws if not direct manager", async () => {
      vi.mocked(prisma.vacationRequest.findUnique).mockResolvedValue({ userId: "u2", user: { managerId: "m1" } } as any);
      await expect(vacationActionService.rejectRequest("r1", { ...mockUser, id: "m2", role: "GERENTE" })).rejects.toThrow(/direto/);
    });

    it("successfully rejects and handles notification failure", async () => {
      vi.mocked(prisma.vacationRequest.findUnique).mockResolvedValue({ id: "r1", userId: "u2", status: "PENDENTE", user: { managerId: "m1", name: "U", email: "e" } } as any);
      vi.mocked(prisma.vacationRequest.update).mockResolvedValue({ id: "r1", user: { name: "U", email: "e" } } as any);
      vi.mocked(notifications.notifyRejected).mockRejectedValueOnce(new Error("Failure"));
      await vacationActionService.rejectRequest("r1", { ...mockUser, id: "m1", role: "GERENTE", name: "Boss" });
      expect(prisma.vacationRequest.update).toHaveBeenCalled();
    });
  });
});
