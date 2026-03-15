import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashNewUserPassword, verifyCredentials, getSessionUser, createSession, destroySession } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDelete = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ get: mockGet, set: mockSet, delete: mockDelete })),
}));

describe("hashNewUserPassword", () => {
  it("returns hex string of fixed length for sha256", () => {
    const hash = hashNewUserPassword("senha123");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("same password produces same hash", () => {
    expect(hashNewUserPassword("a")).toBe(hashNewUserPassword("a"));
  });

  it("different passwords produce different hashes", () => {
    expect(hashNewUserPassword("a")).not.toBe(hashNewUserPassword("b"));
  });
});

describe("verifyCredentials", () => {
  beforeEach(async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.user.findUnique).mockReset();
  });

  it("returns null when user not found", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const result = await verifyCredentials("nao@existe.com", "qualquer");
    expect(result).toBeNull();
  });

  it("returns null when password does not match", async () => {
    const { prisma } = await import("@/lib/prisma");
    const hashed = hashNewUserPassword("correta");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1",
      name: "User",
      email: "u@e.com",
      role: "FUNCIONARIO",
      passwordHash: hashed,
      department: null,
      hireDate: null,
      managerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    const result = await verifyCredentials("u@e.com", "errada");
    expect(result).toBeNull();
  });

  it("returns session user when password matches", async () => {
    const { prisma } = await import("@/lib/prisma");
    const hashed = hashNewUserPassword("correta");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1",
      name: "User",
      email: "u@e.com",
      role: "FUNCIONARIO",
      passwordHash: hashed,
      department: null,
      hireDate: null,
      managerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    const result = await verifyCredentials("u@e.com", "correta");
    expect(result).toEqual({
      id: "u1",
      name: "User",
      email: "u@e.com",
      role: "FUNCIONARIO",
    });
  });
});

describe("getSessionUser", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSet.mockReset();
    delete process.env.SESSION_SECRET;
  });

  it("returns null when no cookie", async () => {
    mockGet.mockReturnValue(undefined);
    const user = await getSessionUser();
    expect(user).toBeNull();
  });

  it("returns null when cookie value is invalid JSON", async () => {
    mockGet.mockReturnValue({ value: "invalid-json" });
    const user = await getSessionUser();
    expect(user).toBeNull();
  });

  it("returns null when payload missing required fields", async () => {
    mockGet.mockReturnValue({ value: JSON.stringify({ id: "u1" }) });
    const user = await getSessionUser();
    expect(user).toBeNull();
  });

  it("returns user when cookie has valid legacy JSON (no dot)", async () => {
    const data: SessionUser = { id: "u1", name: "U", email: "u@e.com", role: "FUNCIONARIO" };
    mockGet.mockReturnValue({ value: JSON.stringify(data) });
    const user = await getSessionUser();
    expect(user).toEqual(data);
  });

  it("returns user when SESSION_SECRET set and cookie is signed (createSession + getSessionUser)", async () => {
    process.env.SESSION_SECRET = "a".repeat(16);
    const data: SessionUser = { id: "u1", name: "U", email: "u@e.com", role: "RH" };
    await createSession(data);
    const signedValue = mockSet.mock.calls[0][1];
    expect(signedValue).toContain(".");
    mockGet.mockReturnValue({ value: signedValue });
    const user = await getSessionUser();
    expect(user).toEqual(data);
  });

  it("returns null when SESSION_SECRET set but signature invalid", async () => {
    process.env.SESSION_SECRET = "a".repeat(16);
    const payload = JSON.stringify({ id: "u1", name: "U", email: "u@e.com", role: "FUNCIONARIO" });
    mockGet.mockReturnValue({ value: payload + ".invalidsignature" });
    const user = await getSessionUser();
    expect(user).toBeNull();
  });
});

describe("createSession", () => {
  it("sets cookie with user payload", async () => {
    mockSet.mockReset();
    const user: SessionUser = { id: "u1", name: "U", email: "u@e.com", role: "RH" };
    await createSession(user);
    expect(mockSet).toHaveBeenCalledWith(
      "ds-ferias-session",
      expect.any(String),
      expect.objectContaining({ httpOnly: true, maxAge: 60 * 60 * 8 })
    );
  });

  it("signs payload when SESSION_SECRET is set", async () => {
    mockSet.mockReset();
    process.env.SESSION_SECRET = "x".repeat(16);
    const user: SessionUser = { id: "u1", name: "U", email: "u@e.com", role: "FUNCIONARIO" };
    await createSession(user);
    const signed = mockSet.mock.calls[0][1];
    expect(signed).toContain(".");
    expect(signed.startsWith("{\"id\":")).toBe(true);
  });
});

describe("destroySession", () => {
  it("deletes session cookie", async () => {
    mockDelete.mockReset();
    await destroySession();
    expect(mockDelete).toHaveBeenCalledWith("ds-ferias-session");
  });
});
