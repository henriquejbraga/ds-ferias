import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { type Role } from "../generated/prisma/enums";
import crypto from "crypto";

const SESSION_COOKIE = "ds-ferias-session";
const SESSION_MAX_AGE = 60 * 60 * 8; // 8h

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  /**
   * Quando true e a feature estiver ativa, o usuário deve trocar a senha
   * antes de acessar o restante do sistema.
   */
  mustChangePassword?: boolean;
};

export function isPasswordChangeEnforced(): boolean {
  return process.env.ENFORCE_PASSWORD_CHANGE === "true";
}

export function shouldForcePasswordChange(user: SessionUser | null): boolean {
  return isPasswordChangeEnforced() && !!user?.mustChangePassword;
}

function getSessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= 16 ? secret : null;
}

function signPayload(payload: string): string {
  const secret = getSessionSecret();
  if (!secret) return payload;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  return payload + "." + hmac.digest("base64url");
}

function verifyPayload(signed: string): string | null {
  const secret = getSessionSecret();
  if (!secret) return null;
  try {
    const lastDot = signed.lastIndexOf(".");
    if (lastDot === -1) return null;
    const payload = signed.slice(0, lastDot);
    const sig = signed.slice(lastDot + 1);
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    const expected = hmac.digest("base64url");
    if (crypto.timingSafeEqual(Buffer.from(sig, "base64url"), Buffer.from(expected, "base64url"))) {
      return payload;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Gera hash scrypt com salt: "scrypt.salt.hash"
 */
function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt.${salt}.${derivedKey.toString("hex")}`;
}

/**
 * Verifica se a senha corresponde ao hash (suporta scrypt e legado sha256)
 */
function verifyPassword(password: string, storedHash: string): boolean {
  if (storedHash.startsWith("scrypt.")) {
    const [, salt, hash] = storedHash.split(".");
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), derivedKey);
  }
  // Fallback para SHA-256 legado
  const legacyHash = crypto.createHash("sha256").update(password).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(legacyHash, "hex"), Buffer.from(storedHash, "hex"));
}

export async function verifyCredentials(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  if (!verifyPassword(password, user.passwordHash)) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[auth] Invalid credentials for", email);
    }
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: !!(user as any).mustChangePassword,
  } as SessionUser;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  try {
    let payload: string;
    const secret = getSessionSecret();

    // Se SESSION_SECRET está definido, exigimos assinatura válida.
    // O fallback para 'raw' sem verificação só ocorre se não houver segredo configurado.
    if (secret) {
      payload = verifyPayload(raw) ?? "";
      if (!payload) return null;
    } else {
      payload = raw;
    }
    const data = JSON.parse(payload) as SessionUser;
    if (typeof data?.id !== "string" || typeof data?.email !== "string" || typeof data?.role !== "string") {
      return null;
    }
    return {
      ...data,
      mustChangePassword: typeof data.mustChangePassword === "boolean" ? data.mustChangePassword : false,
    };
  } catch {
    return null;
  }
}

export async function createSession(user: SessionUser) {
  const cookieStore = await cookies();
  const payload = JSON.stringify(user);
  const signed = signPayload(payload);
  cookieStore.set(SESSION_COOKIE, signed, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export function hashNewUserPassword(password: string) {
  return hashPassword(password);
}

