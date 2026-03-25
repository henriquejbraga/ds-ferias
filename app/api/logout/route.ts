import { NextResponse } from "next/server";
import { destroySession, getSessionUser, shouldForcePasswordChange } from "@/lib/auth";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const user = await getSessionUser();

  // Se o usuário ainda precisa trocar a senha, bloqueamos sair do sistema.
  if (user && shouldForcePasswordChange(user)) {
    if (!contentType.includes("application/json")) {
      return NextResponse.redirect(new URL("/change-password", request.url));
    }
    return NextResponse.json({ error: "Você precisa trocar a senha antes de sair." }, { status: 403 });
  }

  await destroySession();

  // Se foi chamado via <form>, redireciona para a tela de login
  if (!contentType.includes("application/json")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Caso seja via fetch/API, responde JSON
  return NextResponse.json({ ok: true });
}

