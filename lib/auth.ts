import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { type Role } from "../generated/prisma/enums";
import crypto from "crypto";

const SESSION_COOKIE = "ds-ferias-session";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function verifyCredentials(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  const hashed = hashPassword(password);
  if (user.passwordHash !== hashed) {
    console.error("[auth] senha inválida", {
      email,
      hashed,
      stored: user.passwordHash,
    });
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
    const data = JSON.parse(raw) as SessionUser;
    return data;
  } catch {
    return null;
  }
}

export async function createSession(user: SessionUser) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, JSON.stringify(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8, // 8h
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export function hashNewUserPassword(password: string) {
  return hashPassword(password);
}

