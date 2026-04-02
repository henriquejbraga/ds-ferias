import { prisma } from "@/lib/prisma";
import { 
  checkBlackoutPeriods, 
  validateCltPeriods, 
  calculateVacationBalance, 
  PENDING_OR_APPROVED_VACATION_STATUSES,
  isVacationApprovedStatus,
  getNextApprovalStatus,
  ROLE_LEVEL,
  detectTeamConflicts,
  hasTeamVisibility,
  getChargeableDays,
  computeReturnDate,
} from "@/lib/vacationRules";
import { validateVacationConcessiveFifo } from "@/lib/concessivePeriod";
import { syncAcquisitionPeriodsForUser, findAcquisitionPeriodsForUser } from "@/repositories/acquisitionRepository";
import { notifyNewRequest, notifyApproved, notifyRejected } from "@/lib/notifications";
import { logger } from "@/lib/logger";
import { canIndirectLeaderActWhenDirectOnVacation } from "@/lib/indirectLeaderRule";
import { canApproveRequest } from "@/lib/vacationRules";
import { hasInternalOverlapInDateRanges } from "@/lib/validation";
import type { SessionUser } from "@/lib/auth";
import { type VacationStatus } from "@/generated/prisma/client";

// Tipagem para erros de domínio
export class DomainError extends Error {
  constructor(public message: string, public status: number = 400, public extra?: any) {
    super(message);
    this.name = "DomainError";
  }
}

// Helpers internos (mantidos para fidelidade lógica)
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
function toUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
function addMonthsUtc(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const tentative = new Date(Date.UTC(y, m + months, d));
  if (tentative.getUTCDate() !== d) return new Date(Date.UTC(y, m + months + 1, 0));
  return tentative;
}
function daysBetweenInclusive(start: Date, end: Date): number {
  return Math.round((toUtcMidnight(end).getTime() - toUtcMidnight(start).getTime()) / ONE_DAY_MS) + 1;
}
function businessDaysBetweenInclusive(start: Date, end: Date): number {
  const s = toUtcMidnight(start);
  const e = toUtcMidnight(end);
  let count = 0;
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) count += 1;
  }
  return count;
}
function overlapBusinessDaysInclusive(start: Date, end: Date, rangeStart: Date, rangeEnd: Date): number {
  const s = new Date(Math.max(toUtcMidnight(start).getTime(), toUtcMidnight(rangeStart).getTime()));
  const e = new Date(Math.min(toUtcMidnight(end).getTime(), toUtcMidnight(rangeEnd).getTime()));
  if (e < s) return 0;
  return businessDaysBetweenInclusive(s, e);
}
function getCurrentCycleRange(today: Date, hireDate: Date | null | undefined) {
  const now = toUtcMidnight(today);
  if (!hireDate) return { start: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)), end: new Date(Date.UTC(now.getUTCFullYear(), 11, 31)) };
  const hire = toUtcMidnight(hireDate);
  let start = new Date(Date.UTC(now.getUTCFullYear(), hire.getUTCMonth(), hire.getUTCDate()));
  if (start > now) start.setUTCFullYear(start.getUTCFullYear() - 1);
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  end.setUTCDate(end.getUTCDate() - 1);
  return { start, end };
}
async function hasOverlappingRequest(userId: string, start: Date, end: Date) {
  const overlapping = await prisma.vacationRequest.findFirst({
    where: {
      userId,
      status: { in: [...PENDING_OR_APPROVED_VACATION_STATUSES] },
      AND: [{ startDate: { lt: end } }, { endDate: { gt: start } }],
    },
  });
  return !!overlapping;
}

export const vacationActionService = {
  /**
   * Cria um ou mais períodos de férias para um usuário.
   */
  async createRequest(params: {
    user: SessionUser;
    periods: { start: Date; end: Date }[];
    notes?: string | null;
    abono?: boolean;
    thirteenth?: boolean;
  }) {
    const { user, periods, notes, abono = false, thirteenth = false } = params;

    if (!periods.length) throw new DomainError("É necessário informar ao menos um período de férias.");

    if (hasInternalOverlapInDateRanges(periods)) {
      throw new DomainError("Os períodos informados se sobrepõem entre si. Ajuste as datas e tente novamente.");
    }

    // Buscar usuário e períodos de bloqueio
    const [blackouts, userFull] = await Promise.all([
      prisma.blackoutPeriod.findMany(),
      prisma.user.findUnique({
        where: { id: user.id },
        select: {
          hireDate: true,
          department: true,
          vacationRequests: { select: { startDate: true, endDate: true, status: true } },
        },
      }),
    ]);

    if (userFull?.hireDate) {
      // Validação: abono pecuniário é permitido no máximo uma vez por ciclo aquisitivo.
      // Impede que dois pedidos com abono=true consumam o mesmo ciclo, inflando o usedDays.
      if (abono) {
        const todayUtcAbono = toUtcMidnight(new Date());
        const hireUtcAbono = toUtcMidnight(new Date(userFull.hireDate));
        let monthsWorkedAbono =
          (todayUtcAbono.getUTCFullYear() - hireUtcAbono.getUTCFullYear()) * 12 +
          (todayUtcAbono.getUTCMonth() - hireUtcAbono.getUTCMonth());
        if (todayUtcAbono.getUTCDate() < hireUtcAbono.getUTCDate()) monthsWorkedAbono -= 1;
        const acquiredCountAbono = Math.min(Math.floor(Math.max(0, monthsWorkedAbono) / 12), 2);
        const maxAbonoAllowed = Math.max(1, acquiredCountAbono);

        const existingAbono = await prisma.vacationRequest.count({
          where: { userId: user.id, abono: true, status: { in: [...PENDING_OR_APPROVED_VACATION_STATUSES] } },
        });
        if (existingAbono >= maxAbonoAllowed) {
          throw new DomainError(
            "Já existe um pedido com abono pecuniário para este período aquisitivo. O abono é permitido apenas uma vez por ciclo de 30 dias."
          );
        }
      }

      if (user.role === "GERENTE" || user.role === "DIRETOR") {
        const WORKING_DAYS_LIMIT_PER_CYCLE = 22;
        const cycle = getCurrentCycleRange(new Date(), userFull.hireDate);
        const cycleRequests = await prisma.vacationRequest.findMany({
          where: {
            userId: user.id,
            status: { in: [...PENDING_OR_APPROVED_VACATION_STATUSES] },
            AND: [{ startDate: { lte: cycle.end } }, { endDate: { gte: cycle.start } }],
          },
          select: { startDate: true, endDate: true },
        });

        const usedInCycle = cycleRequests.reduce((sum: number, r: any) => sum + overlapBusinessDaysInclusive(r.startDate, r.endDate, cycle.start, cycle.end), 0);
        const requestedInCycle = periods.reduce((sum: number, p: any) => sum + overlapBusinessDaysInclusive(p.start, p.end, cycle.start, cycle.end), 0);
        
        if (usedInCycle + requestedInCycle > WORKING_DAYS_LIMIT_PER_CYCLE) {
          throw new DomainError(`Para ${user.role === "GERENTE" ? "gerente" : "diretor"}, o limite é de ${WORKING_DAYS_LIMIT_PER_CYCLE} dias úteis por ciclo.`);
        }
      }

      await syncAcquisitionPeriodsForUser(user.id, userFull.hireDate);
      const todayUtc = toUtcMidnight(new Date());
      const hireUtc = toUtcMidnight(new Date(userFull.hireDate));
      let monthsWorked = (todayUtc.getUTCFullYear() - hireUtc.getUTCFullYear()) * 12 + (todayUtc.getUTCMonth() - hireUtc.getUTCMonth());
      if (todayUtc.getUTCDate() < hireUtc.getUTCDate()) monthsWorked -= 1;
      const acquiredCount = Math.min(Math.floor(Math.max(0, monthsWorked) / 12), 2);
      const firstEntitlementDate = addMonthsUtc(hireUtc, 12);

      if (acquiredCount < 1) {
        if (periods.some((p) => toUtcMidnight(p.start) < firstEntitlementDate)) {
          throw new DomainError(`Pré-agendamento permitido somente com início a partir de ${firstEntitlementDate.toLocaleDateString("pt-BR")}.`);
        }
        const pendingRequests = await prisma.vacationRequest.findMany({
          where: { userId: user.id, status: { in: [...PENDING_OR_APPROVED_VACATION_STATUSES] }, startDate: { gte: firstEntitlementDate } },
          select: { startDate: true, endDate: true, abono: true },
        });
        const existingDaysInCycle = pendingRequests.reduce((sum: number, r: any) => sum + getChargeableDays(r.startDate, r.endDate, !!r.abono), 0);
        const cltError = validateCltPeriods(periods.map(p => ({ start: p.start, end: p.end })), { checkAdvanceNotice: true, existingDaysInCycle, entitledDays: 30 });
        if (cltError) throw new DomainError(cltError);

        const totalRequestedDays = periods.reduce((sum: number, p: any) => sum + getChargeableDays(p.start, p.end, abono), 0);
        const isEmployee = user.role === "COLABORADOR" || user.role === "FUNCIONARIO";
        if (isEmployee && totalRequestedDays !== 30) throw new DomainError(`Pela CLT, a solicitação precisa totalizar 30 dias. Faltam ${30 - totalRequestedDays} dia(s).`);
        
        if (totalRequestedDays > Math.max(0, 30 - existingDaysInCycle)) throw new DomainError("Saldo insuficiente para pré-agendamento.");
      } else {
        const allAcquisitionPeriods = await findAcquisitionPeriodsForUser(user.id);
        const acquiredPeriods = allAcquisitionPeriods.slice(0, acquiredCount);
        if (acquiredPeriods.length === 0) throw new DomainError("Sem períodos aquisitivos disponíveis.");

        const totalEntitled = acquiredPeriods.reduce((sum: number, p: any) => sum + p.accruedDays, 0);
        const totalUsed = acquiredPeriods.reduce((sum: number, p: any) => sum + p.usedDays, 0);
        const pendingRequests = await prisma.vacationRequest.findMany({
          where: { userId: user.id, status: "PENDENTE" },
          select: { startDate: true, endDate: true, abono: true },
        });
        const totalPending = pendingRequests.reduce((sum: number, r: any) => sum + getChargeableDays(r.startDate, r.endDate, !!r.abono), 0);
        const existingDaysInCycle = totalUsed + totalPending;

        const cltError = validateCltPeriods(periods.map(p => ({ start: p.start, end: p.end })), { checkAdvanceNotice: true, existingDaysInCycle, entitledDays: totalEntitled });
        if (cltError) throw new DomainError(cltError);

        const totalRequestedDays = periods.reduce((sum: number, p: any) => sum + getChargeableDays(p.start, p.end, abono), 0);
        const isEmployee = user.role === "COLABORADOR" || user.role === "FUNCIONARIO";
        if (isEmployee && totalRequestedDays !== 30) throw new DomainError(`Pela CLT, a solicitação precisa totalizar 30 dias.`);
        if (totalRequestedDays > Math.max(0, totalEntitled - totalUsed - totalPending)) throw new DomainError("Saldo insuficiente.");
      }

      const pendingPendente = await prisma.vacationRequest.findMany({
        where: { userId: user.id, status: "PENDENTE" },
        orderBy: { startDate: "asc" },
        select: { startDate: true, endDate: true },
      });
      const concessiveErr = validateVacationConcessiveFifo({
        hireDate: userFull.hireDate,
        acquisitionPeriods: await findAcquisitionPeriodsForUser(user.id),
        pendingVacations: pendingPendente,
        newVacationPeriods: periods,
      });
      if (concessiveErr) throw new DomainError(concessiveErr);
    }

    for (const p of periods) {
      const blackoutError = checkBlackoutPeriods(p.start, p.end, blackouts, userFull?.department);
      if (blackoutError) throw new DomainError(blackoutError);
      if (await hasOverlappingRequest(user.id, p.start, p.end)) throw new DomainError("Já existe uma solicitação que conflita com este período.");
    }

    const created = await prisma.$transaction(
      periods.map((p) => prisma.vacationRequest.create({
        data: { userId: user.id, startDate: p.start, endDate: p.end, notes, abono, thirteenth },
      }))
    );

    // Notificações
    if (created[0] && user.name && user.email) {
      try {
        const m = await prisma.user.findUnique({ where: { id: user.id }, select: { manager: { select: { email: true } } } });
        await notifyNewRequest({
          requestId: created[0].id, userName: user.name!, userEmail: user.email!, managerEmail: m?.manager?.email ?? null,
          startDate: created[0].startDate, endDate: created[0].endDate
        });
      } catch (err) {
        logger.error("Falha ao notificar nova solicitação", { error: err });
      }
    }

    return created;
  },

  /**
   * Aprova uma solicitação de férias.
   */
  async approveRequest(id: string, approver: SessionUser, confirmConflict: boolean = false) {
    if (ROLE_LEVEL[approver.role] < 2 || ROLE_LEVEL[approver.role] > 4) throw new DomainError("Sem permissão para aprovar.", 403);

    const existing = await prisma.vacationRequest.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true, role: true, team: true, createdAt: true, managerId: true, manager: { select: { managerId: true } } } } },
    });

    if (!existing) throw new DomainError("Solicitação não encontrada.", 404);
    if (!canApproveRequest(approver.role, approver.id, { userId: existing.userId, status: existing.status, user: { role: existing.user.role } })) {
      throw new DomainError("Você não tem permissão para aprovar esta solicitação neste momento.", 403);
    }

    const isIndirectApproval = existing.user.managerId !== approver.id;
    if (isIndirectApproval) {
      const canIndirect = await canIndirectLeaderActWhenDirectOnVacation({
        approverId: approver.id, directLeaderId: existing.user.managerId, 
        directLeaderManagerId: existing.user.manager?.managerId ?? null, requestCreatedAt: existing.createdAt
      });
      if (!canIndirect) throw new DomainError("Somente o líder direto pode aprovar (líder indireto somente se o direto estava de férias).", 403);
    }

    // Alerta de conflito
    if (!confirmConflict && existing.user.managerId) {
      const teammates = await prisma.user.findMany({
        where: { managerId: existing.user.managerId, id: { notIn: [existing.userId, approver.id] }, ...(existing.user.team ? { team: existing.user.team } : {}) },
        select: { id: true, name: true, vacationRequests: { select: { startDate: true, endDate: true, status: true } } },
      });
      const conflict = detectTeamConflicts(new Date(existing.startDate), new Date(existing.endDate), teammates.map(t => ({ name: t.name, requests: t.vacationRequests })));
      if (conflict.isWarning || conflict.isBlocked) {
        const msg = `Conflito detectado: ${conflict.conflictingCount} pessoa(s) do time em férias.`;
        throw new DomainError(msg, 409, { requiresConfirmation: true });
      }
    }

    const nextStatus = getNextApprovalStatus(approver.role) as VacationStatus;
    const noteField = ROLE_LEVEL[approver.role] === 2 ? "managerNote" : "hrNote";
    const finalUpdated = await prisma.$transaction(async (tx) => {
      const current = await tx.vacationRequest.findUnique({ 
        where: { id }, 
        include: { user: { select: { id: true, name: true, email: true, role: true, managerId: true, hireDate: true, manager: { select: { managerId: true } } } } } 
      });
      if (!current) throw new Error("Solicitação não encontrada.");
      
      const isAlreadyTargetStatus = current.status === nextStatus;
      if (isAlreadyTargetStatus) { 
        return current; 
      }

      const transitioned = await tx.vacationRequest.updateMany({ where: { id, status: { not: nextStatus } }, data: { status: nextStatus } });
      if (transitioned.count === 1) {
        await tx.vacationRequestHistory.create({ data: { vacationRequestId: id, previousStatus: current.status, newStatus: nextStatus, changedByUserId: approver.id } });
      }
      return await tx.vacationRequest.findUnique({ where: { id }, include: { user: { select: { id: true, name: true, email: true, role: true, managerId: true, hireDate: true, manager: { select: { managerId: true } } } } } });
    });

    // Recalcula os períodos aquisitivos via FIFO completo após a aprovação.
    // Isso garante que o usedDays seja sempre consistente, independente da ordem de aprovação.
    if (finalUpdated?.user?.hireDate) {
      await syncAcquisitionPeriodsForUser(finalUpdated.user.id, finalUpdated.user.hireDate).catch(err =>
        logger.error("Erro ao sincronizar períodos aquisitivos após aprovação", { error: String(err), requestId: id })
      );
    }

    logger.info("Solicitação de férias aprovada", {
      actorId: approver.id,
      requestId: id,
      action: "APPROVE",
      nextStatus
    });

    if (finalUpdated && approver.name) {
      await notifyApproved({
        requestId: id, userName: finalUpdated.user.name, userEmail: finalUpdated.user.email, approverName: approver.name,
        status: nextStatus, toEmails: [finalUpdated.user.email, approver.email], startDate: finalUpdated.startDate, endDate: finalUpdated.endDate,
        returnDate: computeReturnDate(new Date(finalUpdated.startDate), new Date(finalUpdated.endDate), finalUpdated.abono), abono: finalUpdated.abono, thirteenth: finalUpdated.thirteenth
      }).catch(err => logger.error("Erro ao notificar aprovação", { error: err }));
    }

    return finalUpdated;
  },

  /**
   * Reprova uma solicitação.
   */
  async rejectRequest(id: string, approver: SessionUser, note?: string | null) {
    if (ROLE_LEVEL[approver.role] < 2 || ROLE_LEVEL[approver.role] > 4) throw new DomainError("Sem permissão.", 403);

    const existing = await prisma.vacationRequest.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true, role: true, managerId: true } } },
    });

    if (!existing) throw new DomainError("Solicitação não encontrada.", 404);
    if (existing.userId === approver.id) throw new DomainError("Você não pode reprovar a própria solicitação.");
    if (!canApproveRequest(approver.role, approver.id, { userId: existing.userId, status: existing.status, user: { role: existing.user.role } })) {
      throw new DomainError("Sem permissão para reprovar.", 403);
    }

    if (existing.user.managerId !== approver.id) {
      throw new DomainError("Somente o líder direto pode reprovar esta solicitação.", 403);
    }

    const noteField = ROLE_LEVEL[approver.role] === 2 ? "managerNote" : "hrNote";
    const updated = await prisma.vacationRequest.update({
      where: { id },
      data: {
        status: "REPROVADO",
        [noteField]: note,
        history: { create: { previousStatus: existing.status, newStatus: "REPROVADO", changedByUserId: approver.id, note } }
      },
      include: { user: { select: { name: true, email: true } } }
    });

    logger.info("Solicitação de férias reprovada", {
      actorId: approver.id,
      requestId: id,
      action: "REJECT",
      note
    });

    if (updated.user.name && updated.user.email) {
      await notifyRejected({ requestId: id, userName: updated.user.name, userEmail: updated.user.email, approverName: approver.name!, note })
        .catch(err => logger.error("Erro ao notificar reprovação", { error: err }));
    }

    return updated;
  },

  /**
   * Cancela/Exclui uma solicitação.
   */
  async cancelRequest(id: string, actor: SessionUser) {
    const existing = await prisma.vacationRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            createdAt: true,
            managerId: true,
            manager: { select: { managerId: true } },
          },
        },
      },
    });

    if (!existing) throw new DomainError("Pedido não encontrado", 404);

    const isOwner = existing.userId === actor.id;
    const isApprover = ROLE_LEVEL[actor.role] >= 2;
    const roleLevel = ROLE_LEVEL[actor.role];

    // Validações de permissão (copiadas do route para centralizar com log)
    if (isOwner) {
      if (existing.status !== "PENDENTE") {
        throw new DomainError("Você só pode excluir solicitações que ainda estão pendentes de aprovação.");
      }
    } else if (!isApprover) {
      throw new DomainError("Você não tem permissão para excluir este pedido.", 403);
    }

    // Coordenador e Gerente só podem excluir solicitações da sua equipe; RH pode excluir qualquer
    if (isApprover && !isOwner && ROLE_LEVEL[actor.role] < 5) {
      const visible = hasTeamVisibility(actor.role, actor.id, {
        userId: existing.userId,
        user: {
          managerId: existing.user?.managerId ?? null,
          manager: existing.user?.manager ?? null,
        },
      });
      if (!visible) {
        throw new DomainError("Você não tem permissão para excluir este pedido.", 403);
      }
    }

    if (isApprover && !isOwner && ROLE_LEVEL[actor.role] < 5 && existing.user.managerId !== actor.id) {
      const canIndirect = await canIndirectLeaderActWhenDirectOnVacation({
        approverId: actor.id,
        directLeaderId: existing.user.managerId,
        directLeaderManagerId: existing.user.manager?.managerId ?? null,
        requestCreatedAt: existing.createdAt,
      });
      if (!canIndirect) {
        throw new DomainError("Somente o líder direto pode excluir. Líder indireto só pode excluir quando o líder direto estava de férias no momento da solicitação.", 403);
      }
    }

    // Regras de aprovadores (Gerente/RH vs Coordenador)
    if (!isOwner && isVacationApprovedStatus(existing.status) && roleLevel < 3) {
      const directLeaderApprovedStatuses = ["APROVADO_COORDENADOR", "APROVADO_GESTOR"];
      const isApprovedByThisDirectLeader =
        directLeaderApprovedStatuses.includes(existing.status) &&
        existing.user.managerId === actor.id;

      if (!isApprovedByThisDirectLeader) {
        throw new DomainError("Somente Gerente ou RH podem cancelar pedidos já aprovados por outras lideranças.", 403);
      }
    }

    const cancelledUserId = existing.userId;

    await prisma.$transaction(async (tx) => {
      await tx.vacationRequestHistory.deleteMany({
        where: { vacationRequestId: existing.id },
      });

      await tx.vacationRequest.delete({
        where: { id: existing.id },
      });
    });

    // Recalcula os períodos aquisitivos via FIFO após o cancelamento.
    const cancelledUser = await prisma.user.findUnique({ where: { id: cancelledUserId }, select: { hireDate: true } });
    if (cancelledUser?.hireDate) {
      await syncAcquisitionPeriodsForUser(cancelledUserId, cancelledUser.hireDate).catch(err =>
        logger.error("Erro ao sincronizar períodos aquisitivos após cancelamento", { error: String(err), requestId: id })
      );
    }

    // Verifica regra CLT dos 14 dias: se restaram 2+ pedidos no ciclo e nenhum tem ≥ 14 dias → aviso.
    let cltWarning: string | null = null;
    const remainingRequests = await prisma.vacationRequest.findMany({
      where: { userId: cancelledUserId, status: { in: [...PENDING_OR_APPROVED_VACATION_STATUSES] } },
      select: { startDate: true, endDate: true },
    });
    if (remainingRequests.length >= 2) {
      const has14Days = remainingRequests.some((r) => {
        const days =
          Math.round((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / ONE_DAY_MS) + 1;
        return days >= 14;
      });
      if (!has14Days) {
        cltWarning =
          "Atenção: as solicitações restantes não contêm nenhum período de 14 dias ou mais (exigência CLT art. 134). Considere reorganizar as datas.";
      }
    }

    logger.info("Solicitação de férias cancelada/excluída", {
      actorId: actor.id,
      requestId: id,
      action: "CANCEL",
      previousStatus: existing.status
    });

    return { ok: true, cltWarning };
  }
};
