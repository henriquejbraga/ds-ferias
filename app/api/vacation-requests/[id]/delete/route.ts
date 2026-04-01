import { NextResponse } from "next/server";
import { getSessionUser, shouldForcePasswordChange } from "@/lib/auth";
import { vacationActionService, DomainError } from "@/services/vacationActionService";
import { logger } from "@/lib/logger";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  if (!id || id.trim().length < 3) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (shouldForcePasswordChange(user)) {
    return NextResponse.json({ error: "Você precisa trocar a senha antes de continuar." }, { status: 403 });
  }

  try {
    const result = await vacationActionService.cancelRequest(id, user);

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.json({ ok: true, cltWarning: result.cltWarning ?? null });
  } catch (err) {
    if (err instanceof DomainError) {
      logger.warn("Erro de validação ao cancelar férias", { userId: user.id, requestId: id, error: err.message });
      return NextResponse.json({ error: err.message, ...err.extra }, { status: err.status });
    }
    logger.error("Erro inesperado ao cancelar férias", { userId: user.id, requestId: id, error: err });
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}

