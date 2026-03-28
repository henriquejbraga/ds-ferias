import { describe, it, expect } from "vitest";
import {
  getConcessivePeriodInclusive,
  getFirstAcquisitionPeriodEndInclusive,
  validateVacationConcessiveFifo,
} from "@/lib/concessivePeriod";

describe("getConcessivePeriodInclusive", () => {
  it("define 12 meses após o fim do período aquisitivo (inclusive)", () => {
    const paEnd = new Date(Date.UTC(2025, 11, 31));
    const { start, end } = getConcessivePeriodInclusive(paEnd);
    expect(start.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(end.toISOString().slice(0, 10)).toBe("2026-12-31");
  });
});

describe("getFirstAcquisitionPeriodEndInclusive", () => {
  it("último dia do 1º ano aquisitivo", () => {
    const hire = new Date(Date.UTC(2025, 0, 1));
    const end = getFirstAcquisitionPeriodEndInclusive(hire);
    expect(end.toISOString().slice(0, 10)).toBe("2025-12-31");
  });
});

describe("validateVacationConcessiveFifo", () => {
  const fixedToday = new Date(Date.UTC(2026, 2, 25));

  it("permite gozo dentro do período concessivo do 1º saldo (FIFO)", () => {
    const err = validateVacationConcessiveFifo({
      hireDate: new Date(Date.UTC(2020, 0, 1)),
      acquisitionPeriods: [
        {
          id: "p1",
          startDate: new Date(Date.UTC(2020, 0, 1)),
          endDate: new Date(Date.UTC(2020, 11, 31)),
          accruedDays: 30,
          usedDays: 0,
        },
      ],
      pendingVacations: [],
      newVacationPeriods: [
        { start: new Date(Date.UTC(2021, 5, 1)), end: new Date(Date.UTC(2021, 5, 30)) },
      ],
      validationToday: fixedToday,
    });
    expect(err).toBeNull();
  });

  it("bloqueia gozo após o fim do período concessivo", () => {
    const err = validateVacationConcessiveFifo({
      hireDate: new Date(Date.UTC(2020, 0, 1)),
      acquisitionPeriods: [
        {
          id: "p1",
          startDate: new Date(Date.UTC(2020, 0, 1)),
          endDate: new Date(Date.UTC(2020, 11, 31)),
          accruedDays: 30,
          usedDays: 0,
        },
      ],
      pendingVacations: [],
      newVacationPeriods: [
        { start: new Date(Date.UTC(2027, 0, 1)), end: new Date(Date.UTC(2027, 0, 30)) },
      ],
      validationToday: fixedToday,
    });
    expect(err).toBeTruthy();
    expect(err).toMatch(/fora da janela permitida|período concessivo/i);
  });

  it("retorna nulo quando não há hireDate", () => {
    const err = validateVacationConcessiveFifo({
      hireDate: null,
      acquisitionPeriods: [],
      pendingVacations: [],
      newVacationPeriods: [],
    });
    expect(err).toBeNull();
  });

  it("bloqueia quando saldo é insuficiente para cobrir o gozo", () => {
    const err = validateVacationConcessiveFifo({
      hireDate: new Date(Date.UTC(2020, 0, 1)),
      acquisitionPeriods: [
        {
          id: "p1",
          startDate: new Date(Date.UTC(2020, 0, 1)),
          endDate: new Date(Date.UTC(2020, 11, 31)),
          accruedDays: 30,
          usedDays: 30, // Saldo já usado
        },
      ],
      pendingVacations: [],
      newVacationPeriods: [
        { start: new Date(Date.UTC(2021, 5, 1)), end: new Date(Date.UTC(2021, 5, 30)) },
      ],
      validationToday: fixedToday,
    });
    expect(err).toBe("Saldo insuficiente nos períodos aquisitivos para cobrir este gozo.");
  });

  it("considera pedidos pendentes antes de validar o novo pedido", () => {
    const err = validateVacationConcessiveFifo({
      hireDate: new Date(Date.UTC(2025, 0, 1)),
      acquisitionPeriods: [
        {
          id: "p1",
          startDate: new Date(Date.UTC(2025, 0, 1)),
          endDate: new Date(Date.UTC(2025, 11, 31)),
          accruedDays: 30,
          usedDays: 0,
        },
      ],
      pendingVacations: [
        { startDate: new Date(Date.UTC(2026, 0, 1)), endDate: new Date(Date.UTC(2026, 0, 20)) },
      ],
      newVacationPeriods: [
        { start: new Date(Date.UTC(2026, 0, 21)), end: new Date(Date.UTC(2026, 1, 15)) },
      ],
      validationToday: fixedToday,
    });
    // p1 tem 30 dias. pending usa 20. new tenta usar mais de 20 (26 dias aprox). Total > 30.
    expect(err).toBe("Saldo insuficiente nos períodos aquisitivos para cobrir este gozo.");
  });

  it("retorna erro se não há períodos aquisitivos concluídos quando yearsWorked >= 1", () => {
    const err = validateVacationConcessiveFifo({
      hireDate: new Date(Date.UTC(2020, 0, 1)),
      acquisitionPeriods: [], // Vazio, mas deveria ter p1 e p2
      pendingVacations: [],
      newVacationPeriods: [
        { start: new Date(), end: new Date() },
      ],
      validationToday: fixedToday,
    });
    expect(err).toBe("Não há períodos aquisitivos concluídos para validar o período concessivo.");
  });
});
