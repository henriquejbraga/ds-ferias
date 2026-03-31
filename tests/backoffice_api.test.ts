import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH, DELETE } from "@/app/api/users/[id]/route";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { NextResponse } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn((cb) => cb(prisma)),
    user: {
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    acquisitionPeriod: {
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    vacationRequest: {
      deleteMany: vi.fn(),
    },
    vacationRequestHistory: {
      deleteMany: vi.fn(),
    },
    blackoutPeriod: {
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(),
  shouldForcePasswordChange: vi.fn(() => false),
}));

describe("Backoffice API - /api/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PATCH", () => {
    it("returns 401 if user is not authenticated", async () => {
      vi.mocked(getSessionUser).mockResolvedValueOnce(null);
      const req = new Request("http://localhost/api/users/u1", { method: "PATCH", body: JSON.stringify({}) });
      const res = await PATCH(req, { params: Promise.resolve({ id: "u1" }) });
      expect(res.status).toBe(401);
    });

    it("returns 403 if user is not level 2+", async () => {
      vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "u-low", role: "FUNCIONARIO", name: "User" } as any);
      const req = new Request("http://localhost/api/users/u1", { method: "PATCH", body: JSON.stringify({}) });
      const res = await PATCH(req, { params: Promise.resolve({ id: "u1" }) });
      expect(res.status).toBe(403);
    });

    it("updates user data and acquisition periods in a transaction", async () => {
      vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "u-admin", role: "RH", name: "Admin" } as any);
      vi.mocked(prisma.user.update).mockResolvedValueOnce({ id: "u1", name: "Updated" } as any);

      const body = {
        name: "New Name",
        acquisitionPeriods: [
          { id: "ap1", usedDays: 15, accruedDays: 30 }
        ]
      };

      const req = new Request("http://localhost/api/users/u1", { 
        method: "PATCH", 
        body: JSON.stringify(body) 
      });
      
      const res = await PATCH(req, { params: Promise.resolve({ id: "u1" }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.name).toBe("Updated");
      
      // Verifica se a transação foi chamada
      expect(prisma.$transaction).toHaveBeenCalled();
      
      // Verifica se o ciclo foi atualizado com a trava de segurança (userId)
      expect(prisma.acquisitionPeriod.update).toHaveBeenCalledWith({
        where: { id: "ap1", userId: "u1" },
        data: { usedDays: 15 }
      });

      // Verifica se o usuário foi atualizado
      expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: "u1" },
        data: expect.objectContaining({ name: "New Name" })
      }));
    });

    it("enforces max limit on usedDays during update", async () => {
      vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "u-admin", role: "RH", name: "Admin" } as any);
      vi.mocked(prisma.user.update).mockResolvedValueOnce({ id: "u1" } as any);

      const body = {
        acquisitionPeriods: [
          { id: "ap1", usedDays: 50, accruedDays: 30 } // Tentando colocar 50 dias num ciclo de 30
        ]
      };

      const req = new Request("http://localhost/api/users/u1", { method: "PATCH", body: JSON.stringify(body) });
      await PATCH(req, { params: Promise.resolve({ id: "u1" }) });

      // Deve ter limitado a 30
      expect(prisma.acquisitionPeriod.update).toHaveBeenCalledWith({
        where: { id: "ap1", userId: "u1" },
        data: { usedDays: 30 }
      });
    });
  });

  describe("DELETE", () => {
    it("returns 403 if trying to delete self", async () => {
      vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "u1", role: "RH", name: "Admin" } as any);
      const req = new Request("http://localhost/api/users/u1", { method: "DELETE" });
      const res = await DELETE(req, { params: Promise.resolve({ id: "u1" }) });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("próprio");
    });

    it("reassigns reports if user is a manager", async () => {
      vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "u-admin", role: "RH", name: "Admin" } as any);
      // Mock do usuário a ser deletado (que é gerente de alguém)
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "u-manager",
        managerId: "u-boss",
        _count: { reports: 5 }
      } as any);

      const req = new Request("http://localhost/api/users/u-manager", { method: "DELETE" });
      const res = await DELETE(req, { params: Promise.resolve({ id: "u-manager" }) });

      expect(res.status).toBe(200);
      // Deve ter realocado os subordinados para o u-boss
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { managerId: "u-manager" },
        data: { managerId: "u-boss" }
      });
      // Deve ter limpado os vínculos antes de deletar
      expect(prisma.vacationRequest.deleteMany).toHaveBeenCalled();
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: "u-manager" } });
    });
  });
});
