import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { canApproveRequest, getNextApprovalStatus, ROLE_LEVEL, detectTeamConflicts } from "@/lib/vacationRules";
import { notifyApproved } from "@/lib/notifications";
import { isCuid } from "@/lib/validation";
import { logger } from "@/lib/logger";
import type { VacationStatus } from "@/generated/prisma/enums";

type Params = { params: Promise<{ id: string }> };

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function toUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysBetweenInclusive(start: Date, end: Date): number {
  const s = toUtcMidnight(start);
  const e = toUtcMidnight(end);
  return Math.round((e.getTime() - s.getTime()) / ONE_DAY_MS) + 1;
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  if (!isCuid(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const user = await getSessionUser();

  // Apenas COORDENADOR, GESTOR, GERENTE e RH podem aprovar
  if (!user || ROLE_LEVEL[user.role] < 2) {
    return NextResponse.json({ error: "Sem permissão para aprovar solicitações." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const confirmConflict = body?.confirmConflict === true;

  const existing = await prisma.vacationRequest.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          managerId: true,
          manager: { select: { managerId: true } },
        },
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
  }

  // Verifica se pode aprovar (lógica de hierarquia)
  const canApprove = canApproveRequest(user.role, user.id, {
    userId: existing.userId,
    status: existing.status,
    user: { role: existing.user.role },
  });

  if (!canApprove) {
    return NextResponse.json(
      { error: "Você não tem permissão para aprovar esta solicitação neste momento." },
      { status: 403 },
    );
  }

  // Para COORDENADOR/GESTOR: só pode aprovar do seu time direto
  if (ROLE_LEVEL[user.role] === 2) {
    if (existing.user.managerId !== user.id) {
      return NextResponse.json(
        { error: "Você só pode aprovar solicitações do seu time direto." },
        { status: 403 },
      );
    }
  }

  // Para GERENTE: pode aprovar reportes diretos (coordenadores) e indiretos (funcionários dos coordenadores)
  if (ROLE_LEVEL[user.role] === 3) {
    const isDirectReport = existing.user.managerId === user.id;
    const isIndirectReport = existing.user.manager?.managerId === user.id;
    const isOwnRequest = existing.userId === user.id;

    if (!isDirectReport && !isIndirectReport && !isOwnRequest) {
      return NextResponse.json(
        { error: "Você só pode aprovar solicitações da sua cadeia de equipe." },
        { status: 403 },
      );
    }
  }

  const nextStatus = getNextApprovalStatus(user.role) as VacationStatus;
  const noteField = ROLE_LEVEL[user.role] === 2 ? "managerNote" : "hrNote";

  // Alerta de conflito de férias no time.
  let conflictWarning: string | null = null;
  let hasConflict = false;
  try {
    if (existing.user.managerId && existing.startDate && existing.endDate) {
      const teammates = await prisma.user.findMany({
        where: {
          managerId: existing.user.managerId,
          NOT: { id: existing.userId },
        },
        select: {
          name: true,
          vacationRequests: {
            select: {
              startDate: true,
              endDate: true,
              status: true,
            },
          },
        },
      });

      const teamMembers = teammates.map((t) => ({
        name: t.name,
        requests: t.vacationRequests,
      }));

      if (teamMembers.length > 0) {
        const conflict = detectTeamConflicts(
          new Date(existing.startDate),
          new Date(existing.endDate),
          teamMembers,
        );

        if (conflict.isWarning || conflict.isBlocked) {
          hasConflict = true;
          const base =
            conflict.conflictingCount === 1
              ? `${conflict.conflictingCount} outra pessoa do time está com férias neste período.`
              : `${conflict.conflictingCount} pessoas do time estão com férias neste período.`;
          const severity = conflict.isBlocked
            ? " Risco alto de conflito de férias no time."
            : " Avalie se esse conflito é aceitável antes de confirmar.";
          conflictWarning = `Atenção: ${base}${severity}`;
        }
      }
    }
  } catch (err) {
    logger.warn("Falha ao calcular conflito de férias; prosseguindo com aprovação.", { error: String(err) });
  }

  if (hasConflict && !confirmConflict && conflictWarning) {
    return NextResponse.json(
      { error: conflictWarning, requiresConfirmation: true },
      { status: 409 },
    );
  }

  const approvalNote = body?.note ?? null;
  let didCommit = false;
  let updated: any = null;

  await prisma.$transaction(async (tx) => {
    const current = await tx.vacationRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            managerId: true,
            manager: { select: { managerId: true } },
          },
        },
      },
    });

    if (!current) {
      throw new Error("Solicitação não encontrada durante transação de aprovação.");
    }

    // Se já aprovou para o mesmo status (idempotência contra retries/concorrrência),
    // não consumimos usedDays nem criamos histórico novamente.
    const isAlreadyTargetStatus = current.status === nextStatus;
    if (isAlreadyTargetStatus) {
      updated = current;
      didCommit = false;
      return;
    }

    let periodId: string | undefined;

    if (nextStatus === "APROVADO_RH") {
      const period = await tx.acquisitionPeriod.findFirst({
        where: {
          userId: current.userId,
          startDate: { lte: current.startDate },
          endDate: { gte: current.endDate },
        },
        orderBy: { startDate: "asc" },
        select: { id: true },
      });
      periodId = period?.id;
    }

    const data: Record<string, unknown> = {
      status: nextStatus,
      [noteField]: approvalNote,
    };
    if (nextStatus === "APROVADO_RH" && periodId) {
      data.acquisitionPeriodId = periodId;
    }

    // Condicao por status para evitar double-consumo em chamadas simultâneas.
    const transitioned = await tx.vacationRequest.updateMany({
      where: { id, status: { not: nextStatus } },
      data,
    });

    if (transitioned.count !== 1) {
      updated = await tx.vacationRequest.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              managerId: true,
              manager: { select: { managerId: true } },
            },
          },
        },
      });
      didCommit = false;
      return;
    }

    if (nextStatus === "APROVADO_RH" && periodId) {
      // Incremento atomicamente dentro da mesma transação.
      const period = await tx.acquisitionPeriod.findUnique({
        where: { id: periodId },
        select: { usedDays: true },
      });

      if (period) {
        const rawDays = daysBetweenInclusive(current.startDate, current.endDate);
        const days = Math.min(Math.max(1, rawDays), 30);
        await tx.acquisitionPeriod.update({
          where: { id: periodId },
          data: { usedDays: period.usedDays + days },
        });
      } else {
        logger.warn("AcquisitionPeriod não encontrado para incrementar usedDays", { requestId: id, periodId });
      }
    }

    await tx.vacationRequestHistory.create({
      data: {
        vacationRequestId: id,
        previousStatus: current.status,
        newStatus: nextStatus,
        changedByUserId: user.id,
        note: approvalNote,
      },
    });

    updated = await tx.vacationRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            managerId: true,
            manager: { select: { managerId: true } },
          },
        },
      },
    });

    didCommit = true;
  });

  if (didCommit && updated?.user?.name && updated?.user?.email && user.name) {
    notifyApproved({
      requestId: id,
      userName: updated.user.name,
      userEmail: updated.user.email,
      approverName: user.name,
      status: nextStatus,
    }).catch(() => {});
  }

  logger.info("Solicitação aprovada", {
    requestId: id,
    approverId: user.id,
    newStatus: nextStatus,
  });
  return NextResponse.json({ request: updated ?? existing, conflictWarning });
}
