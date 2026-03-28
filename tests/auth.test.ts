import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  hashNewUserPassword,
  verifyCredentials,
  getSessionUser,
  createSession,
  destroySession,
  getSessionCookieValue,
  shouldForcePasswordChange,
  isPasswordChangeEnforced,
} from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
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
  it("returns scrypt hash with salt", () => {
    const hash = hashNewUserPassword("senha123");
    expect(hash).toMatch(/^scrypt\.[a-f0-9]{32}\.[a-f0-9]{128}$/);
  });

  it("same password produces different hashes due to salt", () => {
    expect(hashNewUserPassword("a")).not.toBe(hashNewUserPassword("a"));
  });

  it("different passwords produce different hashes", () => {
    expect(hashNewUserPassword("a")).not.toBe(hashNewUserPassword("b"));
  });
});

describe("verifyCredentials", () => {
  beforeEach(async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.user.findUnique).mockClear();
    vi.mocked(prisma.user.update).mockClear();
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

  it("logs warning in development when password does not match", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.stubEnv("NODE_ENV", "development");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
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

    try {
      const result = await verifyCredentials("u@e.com", "errada");
      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith("[auth] Invalid credentials for", "u@e.com");
    } finally {
      warnSpy.mockRestore();
      vi.unstubAllEnvs();
    }
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
      avatarUrl: null,
      mustChangePassword: false,
    });
  });

  it("returns session user when legacy SHA-256 password matches", async () => {
    const { prisma } = await import("@/lib/prisma");
    const crypto = await import("crypto");
    const legacyHash = crypto.createHash("sha256").update("legado").digest("hex");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u2",
      name: "Legacy",
      email: "legacy@e.com",
      role: "FUNCIONARIO",
      passwordHash: legacyHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    const result = await verifyCredentials("legacy@e.com", "legado");
    expect(result).toEqual({
      id: "u2",
      name: "Legacy",
      email: "legacy@e.com",
      role: "FUNCIONARIO",
      avatarUrl: null,
      mustChangePassword: false,
    });
    // Verifica se houve upgrade automático de hash
    expect(vi.mocked(prisma.user.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u2" },
        data: { passwordHash: expect.stringMatching(/^scrypt\./) },
      })
    );
  });
});

describe("getSessionUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const user = await getSessionUser();
    expect(user).toBeNull();
  });

  it("returns user from database when cookie has valid legacy JSON (no dot)", async () => {
    const data: SessionUser = { id: "u1", name: "Cookie", email: "cookie@e.com", role: "RH", mustChangePassword: false };
    mockGet.mockReturnValue({ value: JSON.stringify(data) });
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1",
      name: "DB User",
      email: "db@e.com",
      role: "FUNCIONARIO",
      mustChangePassword: true,
      passwordHash: "unused",
      registration: "REG1",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    const user = await getSessionUser();
    expect(user).toEqual({
      id: "u1",
      name: "DB User",
      email: "db@e.com",
      role: "FUNCIONARIO",
      mustChangePassword: true,
    });
  });

  it("returns user when SESSION_SECRET set and cookie is signed (createSession + getSessionUser)", async () => {
    process.env.SESSION_SECRET = "a".repeat(16);
    const data: SessionUser = { id: "u1", name: "U", email: "u@e.com", role: "RH", mustChangePassword: false };
    await createSession(data);
    const signedValue = mockSet.mock.calls[0][1];
    const inner = Buffer.from(signedValue, "base64url").toString("utf8");
    expect(inner).toContain(".");
    mockGet.mockReturnValue({ value: signedValue });
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1",
      name: "U",
      email: "u@e.com",
      role: "RH",
      mustChangePassword: false,
      passwordHash: "unused",
      registration: "REG1",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
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

  it("returns null when cookie has valid format but user no longer exists", async () => {
    mockGet.mockReturnValue({
      value: JSON.stringify({ id: "u-missing", name: "U", email: "u@e.com", role: "FUNCIONARIO" }),
    });
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const user = await getSessionUser();
    expect(user).toBeNull();
  });
});

describe("createSession", () => {
  beforeEach(() => {
    mockSet.mockReset();
    delete process.env.SESSION_SECRET;
  });

  it("não assina payload quando SESSION_SECRET não está definido", async () => {
    const user: SessionUser = { id: "u1", name: "U", email: "u@e.com", role: "RH", mustChangePassword: false };
    await createSession(user);
    expect(mockSet).toHaveBeenCalledWith(
      "ds-ferias-session",
      getSessionCookieValue(user),
      expect.objectContaining({ httpOnly: true, maxAge: 60 * 60 * 8 })
    );
  });

  it("assina payload quando SESSION_SECRET está definido (comprimento >= 16)", async () => {
    process.env.SESSION_SECRET = "x".repeat(16);
    const user: SessionUser = { id: "u1", name: "U", email: "u@e.com", role: "FUNCIONARIO", mustChangePassword: false };
    await createSession(user);
    const encoded = mockSet.mock.calls[0][1];
    const inner = Buffer.from(encoded, "base64url").toString("utf8");
    expect(inner).toContain(".");
    const prefix = inner.split(".")[0];
    expect(prefix.startsWith("{\"id\":\"u1\"")).toBe(true);
  });
});

describe("destroySession", () => {
  it("deletes session cookie", async () => {
    mockDelete.mockReset();
    await destroySession();
    expect(mockDelete).toHaveBeenCalledWith("ds-ferias-session");
  });
});

describe("shouldForcePasswordChange", () => {
  it("returns true if enforced and user has mustChangePassword", () => {
    vi.stubEnv("ENFORCE_PASSWORD_CHANGE", "true");
    const user: SessionUser = { id: "u1", name: "U", email: "u@e.com", role: "FUNCIONARIO", mustChangePassword: true };
    expect(shouldForcePasswordChange(user)).toBe(true);
    vi.unstubAllEnvs();
  });

  it("returns false if not enforced", () => {
    vi.stubEnv("ENFORCE_PASSWORD_CHANGE", "false");
    const user: SessionUser = { id: "u1", name: "U", email: "u@e.com", role: "FUNCIONARIO", mustChangePassword: true };
    expect(shouldForcePasswordChange(user)).toBe(false);
    vi.unstubAllEnvs();
  });

  it("returns false if user is null", () => {
    vi.stubEnv("ENFORCE_PASSWORD_CHANGE", "true");
    expect(shouldForcePasswordChange(null)).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe("isPasswordChangeEnforced", () => {
  it("reads from env", () => {
    vi.stubEnv("ENFORCE_PASSWORD_CHANGE", "true");
    expect(isPasswordChangeEnforced()).toBe(true);
    vi.stubEnv("ENFORCE_PASSWORD_CHANGE", "false");
    expect(isPasswordChangeEnforced()).toBe(false);
    vi.unstubAllEnvs();
  });
});
