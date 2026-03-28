import { NextResponse } from "next/server";
import { getSessionUser, shouldForcePasswordChange } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { vacationActionService, DomainError } from "@/services/vacationActionService";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  if (!id || id.trim().length < 3) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (shouldForcePasswordChange(user)) {
    return NextResponse.json({ error: "Você precisa trocar a senha antes de continuar." }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const confirmConflict = body?.confirmConflict === true;

    const result = await vacationActionService.approveRequest(id, user, confirmConflict);

    return NextResponse.json({ request: result });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message, ...err.extra }, { status: err.status });
    }
    logger.error("Erro inesperado na aprovação de férias", { error: String(err), requestId: id });
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}
