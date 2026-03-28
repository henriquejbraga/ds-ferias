import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, shouldForcePasswordChange } from "@/lib/auth";
import { buildManagedRequestsWhere } from "@/lib/requestVisibility";
import { checkRateLimit } from "@/lib/rateLimit";
import { sanitizeText } from "@/lib/validation";
import { logger } from "@/lib/logger";
import { vacationActionService, DomainError } from "@/services/vacationActionService";
import { type VacationStatus } from "../../../generated/prisma/enums";

const POST_REQUESTS_MAX_PER_MINUTE = 20;

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (shouldForcePasswordChange(user)) {
    return NextResponse.json({ error: "Você precisa trocar a senha antes de continuar." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;
  const statusParam = searchParams.get("status") ?? undefined;

  const where: Record<string, unknown> =
    user.role === "COLABORADOR" || user.role === "FUNCIONARIO"
      ? { userId: user.id }
      : buildManagedRequestsWhere(user.id, user.role, {
          query: q,
          status: statusParam && statusParam !== "TODOS" ? statusParam : undefined,
        });

  if (statusParam && statusParam !== "TODOS") {
    where.status = statusParam as VacationStatus;
  }
  if (q && (user.role === "COLABORADOR" || user.role === "FUNCIONARIO")) {
    where.user = { name: { contains: q, mode: "insensitive" as const } };
  }

  const requests = await prisma.vacationRequest.findMany({
    where: where as Record<string, unknown>,
    take: 100, // Limite de segurança para performance
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: { startDate: "desc" },
  });

  return NextResponse.json({ requests });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (shouldForcePasswordChange(user)) {
    return NextResponse.json({ error: "Você precisa trocar a senha antes de continuar." }, { status: 403 });
  }

  if (!checkRateLimit(`vacation-post:${user.id}`, POST_REQUESTS_MAX_PER_MINUTE)) {
    return NextResponse.json(
      { error: "Muitas solicitações. Aguarde um momento antes de criar outra." },
      { status: 429 },
    );
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let startDateRaw: string | null = null;
    let endDateRaw: string | null = null;
    let periodsRaw: { startDate: string; endDate: string }[] | null = null;
    let notes: string | null = null;
    let abono: boolean = false;
    let thirteenth: boolean = false;

    if (contentType.includes("application/json")) {
      const body = await request.json();
      periodsRaw = Array.isArray(body?.periods) ? body.periods : null;
      startDateRaw = body?.startDate ?? null;
      endDateRaw = body?.endDate ?? null;
      notes = sanitizeText(body?.notes);
      abono = Boolean(body?.abono);
      thirteenth = Boolean(body?.thirteenth);
    } else {
      const form = await request.formData();
      startDateRaw = (form.get("startDate") as string) ?? null;
      endDateRaw = (form.get("endDate") as string) ?? null;
    }

    let periods: { start: Date; end: Date }[] = [];
    if (periodsRaw && periodsRaw.length > 0) {
      periods = periodsRaw
        .filter((p) => p.startDate && p.endDate)
        .slice(0, 3)
        .map((p) => ({
          start: new Date(`${p.startDate}T12:00:00Z`),
          end: new Date(`${p.endDate}T12:00:00Z`),
        }));
    } else if (startDateRaw && endDateRaw) {
      periods = [{ start: new Date(`${startDateRaw}T12:00:00Z`), end: new Date(`${endDateRaw}T12:00:00Z`) }];
    }

    const created = await vacationActionService.createRequest({
      user, periods, notes, abono, thirteenth
    });

    return NextResponse.json({ requests: created }, { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message, ...err.extra }, { status: err.status });
    }
    logger.error("Erro inesperado na criação de férias", { error: String(err) });
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}
