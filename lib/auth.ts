import { cookies } from "next/headers";
import { NextResponse } from "next/server";
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
  avatarUrl?: string | null;
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

  // Upgrade automático de hash: se a senha for válida mas o hash for legado (não começa com scrypt.),
  // re-criptografa com scrypt e salva no banco.
  if (!user.passwordHash.startsWith("scrypt.")) {
    const newHash = hashPassword(password);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    }).catch(() => {
      // Ignora erro de persistência do hash para não bloquear o login
    });
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: (user as any).avatarUrl ?? null,
    mustChangePassword: !!(user as any).mustChangePassword,
  } as SessionUser;
}

/**
 * Valores de cookie HTTP devem ser ASCII (RFC 6265); JSON com UTF-8 (acentos em nomes)
 * fazia o browser rejeitar o Set-Cookie — o cookie nem aparecia no DevTools.
 * Formato novo: base64url(inner), onde inner é JSON ou JSON.assinatura.
 * Legado: inner em texto começando com "{".
 */
function decodeSessionCookieRaw(stored: string): string | null {
  if (stored.startsWith("{")) {
    return stored;
  }
  try {
    const buf = Buffer.from(stored, "base64url");
    if (buf.length === 0) return null;
    return buf.toString("utf8");
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const inner = decodeSessionCookieRaw(raw);
  if (inner === null) return null;

  try {
    let payload: string;
    const secret = getSessionSecret();

    // Se SESSION_SECRET está definido, exigimos assinatura válida.
    // O fallback para 'raw' sem verificação só ocorre se não houver segredo configurado.
    if (secret) {
      payload = verifyPayload(inner) ?? "";
      if (!payload) return null;
    } else {
      payload = inner;
    }
    const data = JSON.parse(payload) as SessionUser;
    if (typeof data?.id !== "string") {
      return null;
    }
    // Nunca confiar no role do cookie: sempre reidrata do banco.
    const dbUser = await prisma.user.findUnique({
      where: { id: data.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        mustChangePassword: true,
      },
    });
    if (!dbUser) return null;

    return {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      avatarUrl: dbUser.avatarUrl,
      mustChangePassword: !!dbUser.mustChangePassword,
    };
  } catch {
    return null;
  }
}

function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

/**
 * Só o id vai no cookie: `avatarUrl` pode ser uma data URL enorme (foto em base64)
 * e cookies costumam ter teto ~4KB — o browser recusa o Set-Cookie e o login falha.
 * O restante (nome, foto, papel) vem sempre do Prisma em getSessionUser().
 */
function sessionPayloadForCookie(user: SessionUser): string {
  return JSON.stringify({ id: user.id });
}

/** Valor do cookie: base64url(ASCII) do payload interno (JSON ou JSON.assinatura). */
export function getSessionCookieValue(user: SessionUser): string {
  const inner = signPayload(sessionPayloadForCookie(user));
  return Buffer.from(inner, "utf8").toString("base64url");
}

/**
 * Grava o cookie de sessão na resposta HTTP. Em Route Handlers, preferir isto a
 * `cookies().set()`, pois em alguns cenários o cookie não é enviado ao cliente.
 */
export function setSessionCookieOnResponse(response: NextResponse, user: SessionUser) {
  response.cookies.set(SESSION_COOKIE, getSessionCookieValue(user), getSessionCookieOptions());
}

export async function createSession(user: SessionUser) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, getSessionCookieValue(user), getSessionCookieOptions());
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export function hashNewUserPassword(password: string) {
  return hashPassword(password);
}

