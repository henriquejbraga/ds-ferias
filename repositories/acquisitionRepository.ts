import { prisma } from "@/lib/prisma";
import { APPROVED_VACATION_STATUSES } from "@/lib/vacationRules";

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
  return Math.min(Math.max(1, raw), 30);
}

function getChargeableDays(start: Date, end: Date, hasAbono: boolean): number {
  const raw = daysBetweenInclusiveClamped(start, end);
  // O período salvo já representa o total solicitado no ciclo.
  void hasAbono;
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

  let periods: Array<{ id: string; startDate: Date; endDate: Date; accruedDays: number; usedDays: number }> =
    await ap.findMany({
      where: { userId },
      orderBy: { startDate: "asc" },
    });

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

  if (periods.length === 0) {
    const newPeriods: Array<{ userId: string; startDate: Date; endDate: Date; accruedDays: number; usedDays: number }> = [];
    const todayUtc = utcMidnight(new Date());
    let start = new Date(hireDate);

    while (true) {
      const endExclusive = addMonths(start, 12);
      // Só cria o ciclo se ele já foi COMPLETO (12 meses cumpridos).
      // Ciclo ainda em andamento = colaborador ainda não tem direito.
      if (utcMidnight(endExclusive) > todayUtc) break;
      const end = new Date(utcMidnight(endExclusive).getTime() - 1);
      newPeriods.push({ userId, startDate: start, endDate: end, accruedDays: 30, usedDays: 0 });
      start = endExclusive;
    }

    if (newPeriods.length > 0) {
      await ap.createMany({ data: newPeriods });
    }

    periods = await ap.findMany({
      where: { userId },
      orderBy: { startDate: "asc" },
    });
  }

  // Remove períodos ainda não ganhos (ciclo em andamento) que possam ter sido
  // criados por versões anteriores do código.
  const todayUtc = utcMidnight(new Date());
  const unearnedIds = periods
    // Período com endDate no "dia de hoje" já deve aparecer na UI.
    .filter((p) => utcMidnight(new Date(p.endDate)) > todayUtc)
    .map((p) => p.id);

  if (unearnedIds.length > 0) {
    // Desvincula férias que apontam para períodos não-earned antes de deletar
    await (prisma as any).vacationRequest.updateMany({
      where: { userId, acquisitionPeriodId: { in: unearnedIds } },
      data: { acquisitionPeriodId: null },
    });
    await ap.deleteMany({ where: { id: { in: unearnedIds } } });
    periods = periods.filter((p) => !unearnedIds.includes(p.id));
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
      where: { userId, status: { in: [...APPROVED_VACATION_STATUSES] } },
      orderBy: { startDate: "asc" },
      select: { id: true, startDate: true, endDate: true, acquisitionPeriodId: true, abono: true },
    });

  // Mapa de novos usedDays calculados via FIFO (somente períodos ganhos)
  const newUsedDays = new Map<string, number>(periods.map((p) => [p.id, 0]));
  const newPeriodIdForRequest = new Map<string, string>();

  for (const req of approvedRequests) {
    // FIFO: período mais antigo com saldo disponível
    const target = periods.find((p) => (newUsedDays.get(p.id) ?? 0) < p.accruedDays);
    if (!target) continue;

    const days = getChargeableDays(req.startDate, req.endDate, !!req.abono);
    const current = newUsedDays.get(target.id) ?? 0;
    newUsedDays.set(target.id, Math.min(current + days, target.accruedDays));
    newPeriodIdForRequest.set(req.id, target.id);
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

