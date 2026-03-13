export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export type VacationPeriod = {
  start: Date;
  end: Date;
};

/**
 * Validação CLT para UM bloco de férias.
 * - mínimo 5 dias corridos
 * - máximo 30 dias corridos
 * - início com pelo menos 30 dias de antecedência
 */
export function validateCltPeriod(startDate: Date, endDate: Date): string | null {
  const days = Math.round((endDate.getTime() - startDate.getTime()) / ONE_DAY_MS) + 1;

  if (days < 5) {
    return "Período mínimo de férias em um bloco é de 5 dias corridos, conforme CLT.";
  }

  if (days > 30) {
    return "Período máximo de férias em um único bloco é de 30 dias.";
  }

  const today = new Date();
  const diffFromTodayDays = Math.floor(
    (startDate.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) / ONE_DAY_MS,
  );

  if (diffFromTodayDays < 30) {
    return "O início das férias deve respeitar aviso mínimo de 30 dias.";
  }

  return null;
}

/**
 * Validação CLT para férias fracionadas em até 3 períodos.
 *
 * Regras consideradas:
 * - até 3 períodos
 * - um período com pelo menos 14 dias corridos
 * - demais períodos com pelo menos 5 dias corridos
 * - períodos não podem se sobrepor
 * - (opcional) aviso mínimo de 30 dias com base no primeiro período
 */
export function validateCltPeriods(
  periods: VacationPeriod[],
  options: { checkAdvanceNotice?: boolean } = { checkAdvanceNotice: true },
): string | null {
  if (!periods.length) {
    return "É necessário informar ao menos um período de férias.";
  }

  if (periods.length > 3) {
    return "As férias podem ser fracionadas em no máximo 3 períodos.";
  }

  // Ordena por data de início
  const sorted = [...periods].sort((a, b) => a.start.getTime() - b.start.getTime());

  // Valida sobreposição e tamanhos individuais
  let hasPeriodWith14OrMore = false;

  for (let i = 0; i < sorted.length; i++) {
    const { start, end } = sorted[i];

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      return "Período de férias inválido.";
    }

    const days = Math.round((end.getTime() - start.getTime()) / ONE_DAY_MS) + 1;

    if (days < 5) {
      return "Cada período de férias deve ter, no mínimo, 5 dias corridos.";
    }

    if (days >= 14) {
      hasPeriodWith14OrMore = true;
    }

    if (i > 0) {
      const prev = sorted[i - 1];
      // Não permitir sobreposição
      if (start <= prev.end) {
        return "Os períodos de férias não podem se sobrepor entre si.";
      }
    }
  }

  if (!hasPeriodWith14OrMore) {
    return "Pelo menos um dos períodos de férias deve ter 14 dias corridos ou mais, conforme CLT.";
  }

  // Soma total de dias dos períodos
  const totalDays = sorted.reduce((acc, p) => {
    const days = Math.round((p.end.getTime() - p.start.getTime()) / ONE_DAY_MS) + 1;
    return acc + days;
  }, 0);

  if (totalDays !== 30) {
    return "A soma dos períodos de férias deve totalizar exatamente 30 dias corridos.";
  }

  if (options.checkAdvanceNotice) {
    const firstStart = sorted[0].start;
    const today = new Date();
    const diffFromTodayDays = Math.floor(
      (firstStart.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) / ONE_DAY_MS,
    );

    if (diffFromTodayDays < 30) {
      return "O início do primeiro período de férias deve respeitar aviso mínimo de 30 dias.";
    }
  }

  return null;
}

