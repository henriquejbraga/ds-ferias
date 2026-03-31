import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/reports/acquisition-periods/route";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    acquisitionPeriod: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    }
  },
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(),
  shouldForcePasswordChange: vi.fn(() => false),
}));

vi.mock("@/repositories/userRepository", () => ({
  findUsersWithVacationForBalance: vi.fn(() => []),
}));

vi.mock("@/repositories/acquisitionRepository", () => ({
  syncAcquisitionPeriodsForUser: vi.fn(),
}));

describe("Reports API - GET /api/reports/acquisition-periods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns JSON when userId is provided (Backoffice case)", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "u-admin", role: "COORDENADOR" } as any);
    vi.mocked(prisma.acquisitionPeriod.findMany).mockResolvedValueOnce([
      { id: "ap1", startDate: new Date(), endDate: new Date(), accruedDays: 30, usedDays: 0 }
    ] as any);

    const req = new Request("http://localhost/api/reports/acquisition-periods?userId=u1");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(data.periods).toBeDefined();
    expect(data.periods.length).toBe(1);
    expect(prisma.acquisitionPeriod.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "u1" }
    }));
  });

  it("returns 403 for level 2 user when trying to access full report (CSV)", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "u-coord", role: "COORDENADOR" } as any);
    
    const req = new Request("http://localhost/api/reports/acquisition-periods");
    const res = await GET(req);
    
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Acesso restrito");
  });

  it("returns CSV for level 5 user (RH) when no userId is provided", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "u-rh", role: "RH" } as any);
    vi.mocked(prisma.acquisitionPeriod.findMany).mockResolvedValueOnce([
      { 
        id: "ap1", 
        startDate: new Date(), 
        endDate: new Date(), 
        accruedDays: 30, 
        usedDays: 0,
        user: { name: "User 1", email: "u1@test.com", department: "IT" }
      }
    ] as any);

    const req = new Request("http://localhost/api/reports/acquisition-periods");
    const res = await GET(req);
    
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    const text = await res.text();
    expect(text).toContain("Nome;Email;Departamento");
    expect(text).toContain("User 1;u1@test.com;IT");
  });
});
