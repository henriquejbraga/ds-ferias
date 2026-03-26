import { NextResponse } from "next/server";
import { createSession, getSessionUser, hashNewUserPassword, shouldForcePasswordChange } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !shouldForcePasswordChange(user)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (password.length < 8) {
    return NextResponse.json({ error: "A senha deve ter pelo menos 8 caracteres." }, { status: 400 });
  }

  const passwordHash = hashNewUserPassword(password);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      mustChangePassword: false,
    },
  });

  // Atualiza sessão imediatamente para remover o bloqueio de primeiro acesso.
  await createSession({
    ...user,
    mustChangePassword: false,
  });

  return NextResponse.json({ ok: true });
}

