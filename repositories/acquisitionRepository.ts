import { prisma } from "@/lib/prisma";
import { APPROVED_VACATION_STATUSES, getChargeableDays, calculateAccruedDays } from "@/lib/vacationRules";
import { logger } from "@/lib/logger";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Ajusta quando o mês alvo não tiver o mesmo dia (ex.: 31 → 30)
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d;
}

function daysBetweenInclusiveClamped(start: Date, end: Date): number {
  const s = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const e = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  const raw = Math.round((e.getTime() - s.getTime()) / ONE_DAY_MS) + 1;
  // CLT: um período de gozo não pode exceder 30 dias em 1 único bloco. 
  // No FIFO, se a soma das solicitações aprovadas passar de 30, o excedente vai para o próximo ciclo.
  return raw;
}

function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Gera os períodos aquisitivos para o usuário e faz resync FIFO completo:
 * recalcula o usedDays de cada período a partir de TODAS as solicitações com status aprovado,
 * do mais antigo para o mais novo (FIFO). Isso garante que períodos mais antigos
 * sejam consumidos primeiro, independente da data das férias.
 *
 * É idempotente: pode ser chamado a qualquer momento sem duplicar dados.
 */
export async function syncAcquisitionPeriodsForUser(
  userId: string,
  hireDate: Date | null | undefined,
) {
  if (!hireDate) return [];

  // Em dev, pode acontecer de o Prisma Client ainda não ter sido regenerado após migrations.
  const ap = (prisma as any)?.acquisitionPeriod;
  if (!ap?.findMany || !ap?.createMany) return [];

  let periods: Array<{ id: string; startDate: Date; endDate: Date; accruedDays: number; usedDays: number; unjustifiedAbsences: number; isManual: boolean }> =
    await ap.findMany({
      where: { userId },
      orderBy: { startDate: "asc" },
    });

  // Se a data de admissão mudou drasticamente (o primeiro ciclo não bate), 
  // precisamos resetar os períodos para este usuário.
  if (periods.length > 0 && hireDate) {
    const firstPeriodStart = new Date(periods[0].startDate).toISOString().slice(0, 10);
    const expectedStart = new Date(hireDate).toISOString().slice(0, 10);
    
    if (firstPeriodStart !== expectedStart) {
      logger.info("Full resync of acquisition periods triggered", { userId, reason: "hireDate change", oldStart: firstPeriodStart, newStart: expectedStart });
      // Desvincula e remove tudo para recomeçar do zero com a nova data
      await (prisma as any).vacationRequest.updateMany({
        where: { userId, acquisitionPeriodId: { not: null } },
        data: { acquisitionPeriodId: null },
      });
      await ap.deleteMany({ where: { userId } });
      periods = [];
    }
  }

  // Dedup defensivo: se existirem períodos duplicados para o mesmo intervalo,
  // mantém apenas 1 registro canônico, religa requests e remove o restante.
  if (periods.length > 1) {
    const byRange = new Map<string, Array<{ id: string; startDate: Date; endDate: Date; accruedDays: number; usedDays: number }>>();
    for (const p of periods) {
      const key = `${new Date(p.startDate).toISOString()}::${new Date(p.endDate).toISOString()}`;
      const list = byRange.get(key) ?? [];
      list.push(p);
      byRange.set(key, list);
    }

    const duplicateIdsToDelete: string[] = [];
    for (const group of byRange.values()) {
      if (group.length <= 1) continue;
      const canonical = [...group].sort((a, b) => (b.usedDays ?? 0) - (a.usedDays ?? 0))[0];
      const duplicates = group.filter((p) => p.id !== canonical.id);
      const duplicateIds = duplicates.map((p) => p.id);
      if (duplicateIds.length === 0) continue;

      await (prisma as any).vacationRequest.updateMany({
        where: { userId, acquisitionPeriodId: { in: duplicateIds } },
        data: { acquisitionPeriodId: canonical.id },
      });
      duplicateIdsToDelete.push(...duplicateIds);
    }

    if (duplicateIdsToDelete.length > 0) {
      await ap.deleteMany({ where: { id: { in: duplicateIdsToDelete } } });
      periods = periods.filter((p) => !duplicateIdsToDelete.includes(p.id));
    }
  }

    // 1. Geração/Atualização de períodos faltantes
  const todayUtc = utcMidnight(new Date());
  
  if (hireDate) {
    let currentStart = new Date(hireDate);
    
    // Se já existem períodos, verificamos se o último já cobre hoje ou o futuro.
    if (periods.length > 0) {
      const lastPeriod = periods[periods.length - 1];
      const lastEnd = new Date(lastPeriod.endDate);
      if (utcMidnight(lastEnd) >= todayUtc) {
        // Já temos o período atual (ou futuro) garantido.
        currentStart = null as any; 
      } else {
        // Próximo início é o dia seguinte ao fim do último período
        currentStart = new Date(Date.UTC(lastEnd.getUTCFullYear(), lastEnd.getUTCMonth(), lastEnd.getUTCDate() + 1));
      }
    }

    const newPeriodsToCreate = [];
    if (currentStart) {
      // Enquanto o último período criado ainda não cobrir a data de hoje
      // (ou se não houver nenhum período ainda)
      while (true) {
        const endExclusive = addMonths(currentStart, 12);
        const end = new Date(utcMidnight(endExclusive).getTime() - 1);
        
        newPeriodsToCreate.push({ 
          userId, 
          startDate: currentStart, 
          endDate: end, 
          accruedDays: 30, 
          usedDays: 0,
          unjustifiedAbsences: 0,
          isManual: false
        });

        // Se este ciclo que acabamos de planejar termina no futuro, ele é o ciclo atual.
        // Paramos por aqui.
        if (utcMidnight(endExclusive) > todayUtc) break;
        
        currentStart = endExclusive;
      }
    }

    if (newPeriodsToCreate.length > 0) {
      await ap.createMany({ data: newPeriodsToCreate });
      logger.info("New acquisition cycles generated", { userId, count: newPeriodsToCreate.length });
      // Recarrega a lista completa após criar os novos
      periods = await ap.findMany({
        where: { userId },
        orderBy: { startDate: "asc" },
      });
    }
  }

  // Recalcula o accruedDays para períodos NÃO manuais com base nas faltas injustificadas.
  // Isso permite que o RH atualize o número de faltas e o saldo seja recalculado no sync.
  for (const period of periods) {
    if (!period.isManual) {
      const computedAccrued = calculateAccruedDays(period.unjustifiedAbsences || 0);
      if (period.accruedDays !== computedAccrued) {
        await ap.update({ where: { id: period.id }, data: { accruedDays: computedAccrued } });
        period.accruedDays = computedAccrued;
      }
    }
  }

  // Resync FIFO completo: recalcula usedDays de cada período a partir das solicitações aprovadas.
  // Isso corrige atribuições erradas geradas pelo código legado (que usava range de datas).
  const approvedRequests: Array<{
    id: string;
    startDate: Date;
    endDate: Date;
    acquisitionPeriodId: string | null;
    abono: boolean;
  }> =
    await (prisma as any).vacationRequest.findMany({
      where: { userId, status: { in: [...APPROVED_VACATION_STATUSES, "APROVADO_RH"] } },
      orderBy: { startDate: "asc" },
      select: { id: true, startDate: true, endDate: true, acquisitionPeriodId: true, abono: true },
    });

  // FIFO limpo: sempre recomeça do zero.
  // O manualUsedDays NÃO é usado como base aqui porque causava overflow para o ciclo atual
  // quando gravado acidentalmente com valor > 0. O campo fica no schema para exibição no
  // backoffice mas não influencia o cálculo automático.
  const newUsedDays = new Map<string, number>();
  for (const p of periods) {
    newUsedDays.set(p.id, 0);
  }

  const newPeriodIdForRequest = new Map<string, string>();

  for (const req of approvedRequests) {
    let daysRemaining = getChargeableDays(req.startDate, req.endDate, !!req.abono);
    
    // Distribui os dias do pedido nos ciclos disponíveis (FIFO)
    for (const p of periods) {
      if (daysRemaining <= 0) break;
      
      const currentUsed = newUsedDays.get(p.id) ?? 0;
      const availableInPeriod = p.accruedDays - currentUsed;
      
      if (availableInPeriod > 0) {
        const toConsume = Math.min(daysRemaining, availableInPeriod);
        newUsedDays.set(p.id, currentUsed + toConsume);
        daysRemaining -= toConsume;
        
        // Vincula o pedido ao PRIMEIRO período que ele começar a consumir
        if (!newPeriodIdForRequest.has(req.id)) {
          newPeriodIdForRequest.set(req.id, p.id);
        }
      }
    }
  }

  // Aplica diferenças no banco (apenas o que mudou)
  for (const period of periods) {
    const computed = newUsedDays.get(period.id) ?? 0;
    if ((period.usedDays ?? 0) !== computed) {
      await ap.update({ where: { id: period.id }, data: { usedDays: computed } });
      period.usedDays = computed;
    }
  }

  for (const req of approvedRequests) {
    const targetId = newPeriodIdForRequest.get(req.id);
    if (targetId && req.acquisitionPeriodId !== targetId) {
      await (prisma as any).vacationRequest.update({
        where: { id: req.id },
        data: { acquisitionPeriodId: targetId },
      });
    }
  }

  return periods;
}

export async function findAcquisitionPeriodsForUser(userId: string) {
  const ap = (prisma as any)?.acquisitionPeriod;
  if (!ap?.findMany) return [];
  return ap.findMany({
    where: { userId },
    orderBy: { startDate: "asc" },
  });
}

export async function findAcquisitionPeriodForRange(
  userId: string,
  start: Date,
  end: Date,
) {
  const ap = (prisma as any)?.acquisitionPeriod;
  if (!ap?.findMany) return null;

  const periods = await ap.findMany({
    where: {
      userId,
      startDate: { lte: start },
      endDate: { gte: end },
    },
    orderBy: { startDate: "asc" },
  });
  return periods[0] ?? null;
}

export async function addUsedDaysForRequest(
  userId: string,
  start: Date,
  end: Date,
) {
  const period = await findAcquisitionPeriodForRange(userId, start, end);
  if (!period) return null;

  const days =
    Math.round(
      (end.setHours(0, 0, 0, 0) - start.setHours(0, 0, 0, 0)) /
        (24 * 60 * 60 * 1000),
    ) + 1;

  const ap = (prisma as any)?.acquisitionPeriod;
  await ap.update({
    where: { id: period.id },
    data: { usedDays: period.usedDays + days },
  });

  return period;
}

