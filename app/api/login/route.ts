import { NextResponse } from "next/server";
import { setSessionCookieOnResponse, verifyCredentials } from "@/lib/auth";
import { decryptLoginPassword, isLoginPasswordEncryptionConfigured } from "@/lib/loginCrypto";
import { logger } from "@/lib/logger";
import { checkRateLimit, getClientId } from "@/lib/rateLimit";

const LOGIN_MAX_PER_MINUTE = 10;

export async function POST(request: Request) {
  const clientId = getClientId(request);
  if (!checkRateLimit(`login:${clientId}`, LOGIN_MAX_PER_MINUTE)) {
    logger.warn("Rate limit: login excedido", { clientId });
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente em alguns minutos." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { email?: unknown; password?: unknown; encryptedPassword?: unknown }
    | null;

  if (!body || typeof body.email !== "string") {
    logger.warn("Login: dados inválidos", { email: body?.email ?? "(missing)" });
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const email = body.email;

  // Rate limit por e-mail (além do por IP/ClientId)
  if (!checkRateLimit(`login-email:${email}`, 5)) {
    logger.warn("Rate limit: login por e-mail excedido", { email });
    return NextResponse.json(
      { error: "Muitas tentativas para este e-mail. Tente novamente mais tarde." },
      { status: 429 },
    );
  }

  const passwordPlain = typeof body.password === "string" ? body.password : "";
  const passwordCipher = typeof body.encryptedPassword === "string" ? body.encryptedPassword : "";

  const requireEncrypted = isLoginPasswordEncryptionConfigured();
  let plainPassword: string;

  if (requireEncrypted) {
    if (passwordPlain.length > 0) {
      logger.warn("Login: tentativa de senha em texto com criptografia obrigatória", { email });
      return NextResponse.json({ error: "Use o login criptografado. Recarregue a página." }, { status: 400 });
    }
    if (!passwordCipher) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    try {
      plainPassword = decryptLoginPassword(passwordCipher);
    } catch {
      logger.warn("Login: falha ao descriptografar senha", { email });
      return NextResponse.json({ error: "Não foi possível validar o login" }, { status: 400 });
    }
  } else {
    if (!passwordPlain) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    plainPassword = passwordPlain;
  }

  const user = await verifyCredentials(email, plainPassword);

  if (!user) {
    logger.warn("Login: credenciais inválidas", { email });
    return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  setSessionCookieOnResponse(response, user);
  logger.info("Login: sucesso", { userId: user.id, email: user.email, role: user.role });
  return response;
}

