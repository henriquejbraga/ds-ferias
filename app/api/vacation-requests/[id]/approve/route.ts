import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, shouldForcePasswordChange } from "@/lib/auth";
import {
  canApproveRequest,
  getNextApprovalStatus,
  isVacationApprovedStatus,
  ROLE_LEVEL,
  detectTeamConflicts,
} from "@/lib/vacationRules";
import { canIndirectLeaderActWhenDirectOnVacation } from "@/lib/indirectLeaderRule";
import { notifyApproved } from "@/lib/notifications";
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

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  if (!id || id.trim().length < 3) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const user = await getSessionUser();

  // Aprovação única: apenas líderes diretos (coordenador/gestor, gerente, diretor).
  if (!user || ROLE_LEVEL[user.role] < 2 || ROLE_LEVEL[user.role] > 4) {
    return NextResponse.json({ error: "Sem permissão para aprovar solicitações." }, { status: 403 });
  }
  if (user && shouldForcePasswordChange(user)) {
    return NextResponse.json({ error: "Você precisa trocar a senha antes de continuar." }, { status: 403 });
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
          team: true,
          createdAt: true,
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

  const isIndirectApproval = existing.user.managerId !== user.id;

  if (isIndirectApproval) {
    const canIndirect = await canIndirectLeaderActWhenDirectOnVacation({
      approverId: user.id,
      directLeaderId: existing.user.managerId,
      directLeaderManagerId: existing.user.manager?.managerId ?? null,
      requestCreatedAt: existing.createdAt,
    });
    if (!canIndirect) {
      return NextResponse.json(
        {
          error:
            "Somente o líder direto pode aprovar. Líder indireto só pode aprovar quando o líder direto estava de férias no momento da solicitação.",
        },
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
      const targetTeam = existing.user.team ?? null;
      const teammates = await prisma.user.findMany({
        where: {
          managerId: existing.user.managerId,
          // Evita contar:
          // - a própria pessoa (dona do pedido que está sendo aprovado)
          // - e o aprovador (para não alertar conflito causado por férias do mesmo usuário)
          id: { notIn: [existing.userId, user.id] },
          // “Time” no domínio = squad (campo `team` / `time` no banco).
          // Assim, um mesmo coordenador com squads diferentes não deve gerar conflito.
          ...(targetTeam ? { team: targetTeam } : {}),
        },
        select: {
          id: true,
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

      // Segurança contra qualquer possível duplicidade na lista de usuários.
      const uniqueById = new Map<string, (typeof teammates)[number]>();
      for (const t of teammates) uniqueById.set(t.id, t);

      const teamMembers = Array.from(uniqueById.values()).map((t) => ({
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
          const names = conflict.names?.length ? ` Conflitantes: ${conflict.names.join(", ")}` : "";
          conflictWarning = `Atenção: ${base}${severity}${names}`;
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

    if (isVacationApprovedStatus(nextStatus)) {
      // FIFO: consome o período aquisitivo mais antigo que ainda tenha saldo disponível.
      // A data das férias NÃO precisa cair dentro do período — CLT permite usar dias
      // de ciclos anteriores em qualquer data futura.
      const allPeriods = await tx.acquisitionPeriod.findMany({
        where: { userId: current.userId },
        orderBy: { startDate: "asc" },
        select: { id: true, accruedDays: true, usedDays: true },
      });
      const oldest = allPeriods.find((p) => p.usedDays < p.accruedDays);
      periodId = oldest?.id;
    }

    const data: Record<string, unknown> = {
      status: nextStatus,
      [noteField]: approvalNote,
    };
    if (isVacationApprovedStatus(nextStatus) && periodId) {
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

    if (isVacationApprovedStatus(nextStatus) && periodId) {
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

  if (didCommit && updated?.user?.name && updated?.user?.email && user.name && user.email) {
    const recipientSet = new Set<string>([user.email]);

    if (isIndirectApproval && updated.user.managerId) {
      const directLeader = await prisma.user.findUnique({
        where: { id: updated.user.managerId },
        select: { email: true },
      });
      if (directLeader?.email) recipientSet.add(directLeader.email);
    }

    notifyApproved({
      requestId: id,
      userName: updated.user.name,
      userEmail: updated.user.email,
      approverName: user.name,
      status: nextStatus,
      toEmails: Array.from(recipientSet),
      startDate: updated.startDate,
      endDate: updated.endDate,
      returnDate: addDays(updated.endDate, 1),
      abono: updated.abono,
      thirteenth: updated.thirteenth,
      notes: updated.notes,
      managerNote: updated.managerNote,
      hrNote: updated.hrNote,
    }).catch(() => {});
  }

  logger.info("Solicitação aprovada", {
    requestId: id,
    approverId: user.id,
    newStatus: nextStatus,
  });
  return NextResponse.json({ request: updated ?? existing, conflictWarning });
}
