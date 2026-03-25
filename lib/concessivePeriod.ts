/**
 * Período concessivo (CLT): 12 meses após o término do período aquisitivo,
 * dentro dos quais as férias correspondentes devem ser gozadas (regra adotada pelo produto).
 */

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function toUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  const d = toUtcMidnight(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function addMonthsUtc(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const tentative = new Date(Date.UTC(y, m + months, d));
  if (tentative.getUTCDate() !== d) {
    return new Date(Date.UTC(y, m + months + 1, 0));
  }
  return tentative;
}

function daysBetweenInclusive(start: Date, end: Date): number {
  const s = toUtcMidnight(start);
  const e = toUtcMidnight(end);
  return Math.round((e.getTime() - s.getTime()) / ONE_DAY_MS) + 1;
}

/** Último dia (inclusive) do 1º período aquisitivo a partir da admissão. */
export function getFirstAcquisitionPeriodEndInclusive(hireDate: Date): Date {
  const hireUtc = toUtcMidnight(hireDate);
  const endExclusive = addMonthsUtc(hireUtc, 12);
  return new Date(toUtcMidnight(endExclusive).getTime() - ONE_DAY_MS);
}

/**
 * Período concessivo (início e fim inclusive) após o fim do período aquisitivo.
 */
export function getConcessivePeriodInclusive(acquisitionPeriodEndInclusive: Date): { start: Date; end: Date } {
  const endPa = toUtcMidnight(acquisitionPeriodEndInclusive);
  const start = addUtcDays(endPa, 1);
  const endExclusive = addMonthsUtc(start, 12);
  const end = new Date(toUtcMidnight(endExclusive).getTime() - ONE_DAY_MS);
  return { start, end };
}

export type AcquisitionPeriodForConcessive = {
  id: string;
  startDate: Date;
  endDate: Date;
  accruedDays: number;
  usedDays: number;
};

export function computeAcquiredCycleCount(hireDate: Date, today = new Date()): number {
  const todayUtc = toUtcMidnight(today);
  const hireUtc = toUtcMidnight(hireDate);
  let monthsWorked =
    (todayUtc.getUTCFullYear() - hireUtc.getUTCFullYear()) * 12 + (todayUtc.getUTCMonth() - hireUtc.getUTCMonth());
  if (todayUtc.getUTCDate() < hireUtc.getUTCDate()) monthsWorked -= 1;
  monthsWorked = Math.max(0, monthsWorked);
  const yearsWorked = Math.floor(monthsWorked / 12);
  return Math.min(yearsWorked, 2);
}

function fmt(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/**
 * Valida se o gozo (datas corridas) cabe no período concessivo de cada fatia de saldo (FIFO),
 * após consumir pedidos ainda PENDENTE e o saldo já aprovado (usedDays).
 */
export function validateVacationConcessiveFifo(opts: {
  hireDate: Date | null;
  acquisitionPeriods: AcquisitionPeriodForConcessive[];
  /** Somente solicitações PENDENTE (ainda não consumiram usedDays). */
  pendingVacations: Array<{ startDate: Date; endDate: Date }>;
  newVacationPeriods: Array<{ start: Date; end: Date }>;
  /** Para testes ou cálculo determinístico (default: agora). */
  validationToday?: Date;
}): string | null {
  if (!opts.hireDate) return null;

  const hireUtc = toUtcMidnight(opts.hireDate);
  const acquiredCount = computeAcquiredCycleCount(opts.hireDate, opts.validationToday ?? new Date());

  let orderedAps: AcquisitionPeriodForConcessive[];

  if (acquiredCount < 1) {
    const endFirst = getFirstAcquisitionPeriodEndInclusive(hireUtc);
    orderedAps = [
      {
        id: "__virtual_first__",
        startDate: hireUtc,
        endDate: endFirst,
        accruedDays: 30,
        usedDays: 0,
      },
    ];
  } else {
    const sorted = [...opts.acquisitionPeriods].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    );
    orderedAps = sorted.slice(0, acquiredCount);
    if (orderedAps.length === 0) {
      return "Não há períodos aquisitivos concluídos para validar o período concessivo.";
    }
  }

  const remaining = new Map<string, number>();
  for (const ap of orderedAps) {
    remaining.set(ap.id, Math.max(0, ap.accruedDays - ap.usedDays));
  }

  const periodEndById = new Map(orderedAps.map((ap) => [ap.id, ap.endDate] as const));

  const consumeDay = (cursor: Date, periodId: string): string | null => {
    const paEnd = periodEndById.get(periodId);
    if (!paEnd) return "Erro interno ao validar período aquisitivo.";
    const range = getConcessivePeriodInclusive(paEnd);
    const c = toUtcMidnight(cursor);
    if (c.getTime() < range.start.getTime() || c.getTime() > range.end.getTime()) {
      return (
        `O gozo das férias deve ocorrer dentro do período concessivo (12 meses após o fim do período aquisitivo). ` +
        `O dia ${fmt(c)} está fora da janela permitida (${fmt(range.start)} a ${fmt(range.end)}). ` +
        `Ajuste as datas para concluir a solicitação.`
      );
    }
    return null;
  };

  const orderedIds = orderedAps.map((a) => a.id);

  const consumeBlock = (start: Date, totalDays: number): string | null => {
    let cursor = toUtcMidnight(start);
    for (let i = 0; i < totalDays; i++) {
      const pid = orderedIds.find((id) => (remaining.get(id) ?? 0) > 0);
      if (!pid) {
        return "Saldo insuficiente nos períodos aquisitivos para cobrir este gozo.";
      }
      const err = consumeDay(cursor, pid);
      if (err) return err;
      remaining.set(pid, (remaining.get(pid) ?? 0) - 1);
      cursor = addUtcDays(cursor, 1);
    }
    return null;
  };

  const pendingSorted = [...opts.pendingVacations]
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  for (const pv of pendingSorted) {
    const d = Math.min(daysBetweenInclusive(pv.startDate, pv.endDate), 30);
    const err = consumeBlock(pv.startDate, d);
    if (err) return err;
  }

  const newSorted = [...opts.newVacationPeriods]
    .filter((p) => !isNaN(p.start.getTime()) && !isNaN(p.end.getTime()) && p.end >= p.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  for (const nv of newSorted) {
    const d = Math.min(daysBetweenInclusive(nv.start, nv.end), 30);
    const err = consumeBlock(nv.start, d);
    if (err) return err;
  }

  return null;
}
