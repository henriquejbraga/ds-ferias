import { NextResponse } from "next/server";
import { createSession, verifyCredentials } from "@/lib/auth";
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

  const body = await request.json().catch(() => null);

  if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
    logger.warn("Login: dados inválidos", { email: body?.email ?? "(missing)" });
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const user = await verifyCredentials(body.email, body.password);

  if (!user) {
    logger.warn("Login: credenciais inválidas", { email: body.email });
    return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
  }

  await createSession(user);
  logger.info("Login: sucesso", { userId: user.id, email: user.email, role: user.role });
  return NextResponse.json({ ok: true });
}

