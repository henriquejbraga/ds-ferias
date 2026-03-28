import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as cronGET } from "@/app/api/notifications/vacation-reminders/route";
import { GET as requestsGET, POST as requestsPOST } from "@/app/api/vacation-requests/route";
import { GET as usersGET } from "@/app/api/users/route";
import { POST as loginPOST } from "@/app/api/login/route";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import * as rateLimit from "@/lib/rateLimit";
import * as acquisitionRepo from "@/repositories/acquisitionRepository";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vacationRequest: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(({ data }) => ({ ...data, id: "new-id" })),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    blackoutPeriod: {
      findMany: vi.fn(),
    },
    acquisitionPeriod: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    vacationRequestHistory: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(),
  verifyCredentials: vi.fn(),
  createSession: vi.fn(),
  setSessionCookieOnResponse: vi.fn(),
  shouldForcePasswordChange: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: vi.fn(),
  getClientId: vi.fn().mockReturnValue("test-client"),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("API Security and Privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  describe("CRON Vacation Reminders", () => {
    it("fails when not authorized", async () => {
      const request = new Request("http://localhost/api/notifications/vacation-reminders");
      const response = await cronGET(request);
      expect(response.status).toBe(401);
    });

    it("succeeds with correct secret in header", async () => {
      // Mocking prisma to return empty list
      vi.mocked(prisma.vacationRequest.findMany).mockResolvedValue([]);
      
      const request = new Request("http://localhost/api/notifications/vacation-reminders", {
        headers: { "x-cron-secret": "test-secret" }
      });
      const response = await cronGET(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.startReminder.found).toBe(0);
      expect(data.returnReminder.found).toBe(0);
    });
  });

  describe("Vacation Requests Privacy", () => {
    it("shows user email even for regular employees", async () => {
      vi.mocked(getSessionUser).mockResolvedValue({
        id: "u1", name: "User", email: "u@e.com", role: "FUNCIONARIO"
      });
      
      vi.mocked(prisma.vacationRequest.findMany).mockResolvedValue([]);

      const request = new Request("http://localhost/api/vacation-requests");
      await requestsGET(request);

      expect(prisma.vacationRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            user: { select: { name: true, email: true } }
          })
        })
      );
    });
  });

  describe("Login Rate Limit", () => {
    it("blocks login after too many attempts for same email", async () => {
      // First call (clientId) returns true, second call (email) returns false
      vi.mocked(rateLimit.checkRateLimit)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      const request = new Request("http://localhost/api/login", {
        method: "POST",
        body: JSON.stringify({ email: "target@test.com", password: "123" })
      });

      const response = await loginPOST(request);
      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toContain("Muitas tentativas para este e-mail");
      
      expect(rateLimit.checkRateLimit).toHaveBeenCalledWith("login:test-client", 10);
      expect(rateLimit.checkRateLimit).toHaveBeenCalledWith("login-email:target@test.com", 5);
    });
  });

  describe("Users API Restriction", () => {
    it("denies access to user list for regular employees", async () => {
      vi.mocked(getSessionUser).mockResolvedValue({
        id: "u1", name: "Employee", email: "u@e.com", role: "FUNCIONARIO", mustChangePassword: false
      });

      const response = await usersGET();
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain("Acesso restrito");
    });

    it("allows access to user list for leaders (Manager/Coordinator)", async () => {
      vi.mocked(getSessionUser).mockResolvedValue({
        id: "m1", name: "Manager", email: "m@e.com", role: "GERENTE", mustChangePassword: false
      });
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);

      const response = await usersGET();
      expect(response.status).toBe(200);
    });
  });

    describe("Input Sanitization", () => {
    it("sanitizes notes in vacation requests", async () => {
      vi.mocked(getSessionUser).mockResolvedValue({
        id: "u1", name: "U", email: "u@e.com", role: "FUNCIONARIO", mustChangePassword: false
      });
      vi.mocked(rateLimit.checkRateLimit).mockReturnValue(true);
      
      // Mocks para passar pelas validações de saldo/ciclo
      vi.mocked(prisma.blackoutPeriod.findMany).mockResolvedValue([]);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "u1",
        hireDate: new Date("2025-01-01"),
        department: "IT",
      } as any);

      // Precisamos mockar o repositório para evitar o erro de .slice() em undefined
      const mockAps = [
        { id: "p1", startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31"), accruedDays: 30, usedDays: 0 },
      ];
      vi.spyOn(acquisitionRepo, "findAcquisitionPeriodsForUser").mockResolvedValue(mockAps);
      vi.spyOn(acquisitionRepo, "syncAcquisitionPeriodsForUser").mockResolvedValue({} as any);

      // Precisamos mockar o prisma.$transaction
      vi.mocked(prisma.$transaction).mockResolvedValue([{ 
        id: "r1", startDate: new Date("2026-10-01"), endDate: new Date("2026-10-30") 
      }]);

      const xssNote = "<script>alert('xss')</script>Hello";
      const request = new Request("http://localhost/api/vacation-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startDate: "2026-10-01",
          endDate: "2026-10-30",
          notes: xssNote
        })
      });

      const response = await requestsPOST(request);
      if (response.status !== 201) {
        console.log("Error Response:", await response.json());
      }

      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            notes: "alert('xss')Hello" // Tags removidas
          })
        ])
      );
    });
  });
});
