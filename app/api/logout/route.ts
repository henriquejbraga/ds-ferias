import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST(request: Request) {
  await destroySession();

  const contentType = request.headers.get("content-type") ?? "";

  // Se foi chamado via <form>, redireciona para a tela de login
  if (!contentType.includes("application/json")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Caso seja via fetch/API, responde JSON
  return NextResponse.json({ ok: true });
}

