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
};

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

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function verifyCredentials(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  const hashed = hashPassword(password);
  if (user.passwordHash !== hashed) {
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
  } as SessionUser;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  try {
    let payload: string;
    // Só tenta verificar assinatura quando SESSION_SECRET está definido; caso contrário o cookie
    // é JSON legado (e pode conter "." no email, ex.: user@empresa.com).
    if (getSessionSecret() && raw.includes(".")) {
      payload = verifyPayload(raw) ?? "";
      if (!payload) return null;
    } else {
      payload = raw;
    }
    const data = JSON.parse(payload) as SessionUser;
    if (typeof data?.id !== "string" || typeof data?.email !== "string" || typeof data?.role !== "string") {
      return null;
    }
    return data;
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

