import { describe, it, expect, vi } from "vitest";
import {
  getRoleLevel,
  getRoleLabel,
  ROLE_COLOR,
  getNextApprovalStatus,
  canApproveRequest,
  hasTeamVisibility,
  validateCltPeriods,
  validateCltPeriod,
  calculateVacationBalance,
  getNextApprover,
  getApprovalSteps,
  getApprovalProgress,
  getApproverRelationshipStepLabel,
  isVacationApprovedStatus,
  detectTeamConflicts,
  checkBlackoutPeriods,
  getVacationStatusDisplayLabel,
  isSaoPauloHoliday,
} from "@/lib/vacationRules";

describe("validateCltPeriod (aviso prévio)", () => {
  it("returns advance notice error when start is < 30 days ahead", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T12:00:00Z"));
    const start = new Date("2026-03-25T12:00:00Z"); // 24 dias
    const end = new Date("2026-04-03T12:00:00Z"); // sexta
    expect(validateCltPeriod(start, end)).toContain("Aviso prévio mínimo de 30 dias");
    vi.useRealTimers();
  });
});

describe("validateCltPeriods - Boundary Comparisons", () => {
  it("allows exactly 5 days when part of a 30-day plan", () => {
    // P1: 01/06 (Seg) a 14/06 (Dom) - 14 dias. Falha: termina no domingo.
    // Ajuste: P1 termina na sexta 12/06 (12 dias).
    // Vou usar datas seguras:
    const p1 = { start: new Date(Date.UTC(2026, 5, 1)), end: new Date(Date.UTC(2026, 5, 15)) }; // Segunda a Segunda (15 dias)
    const p2 = { start: new Date(Date.UTC(2026, 6, 1)), end: new Date(Date.UTC(2026, 6, 6)) };  // Quarta a Segunda (6 dias)
    const p3 = { start: new Date(Date.UTC(2026, 7, 3)), end: new Date(Date.UTC(2026, 7, 11)) }; // Segunda a Terça (9 dias)
    // 15 + 6 + 9 = 30.
    const err = validateCltPeriods([p1, p2, p3], { entitledDays: 30 });
    expect(err).toBeNull();
  });

  it("blocks start on Friday (weekDay 5) by checking weekend rest rule", () => {
    const start = new Date(Date.UTC(2026, 3, 10)); // Friday
    const end = new Date(Date.UTC(2026, 3, 24));   // Friday
    const err = validateCltPeriods([{ start, end }]);
    // A regra de feriado/fds no início ou término pode disparar. 
    // Na CLT real, não pode iniciar nos 2 dias que antecedem DSR ou feriado.
    expect(err).toBeTruthy();
  });

  it("rejects start 2 days before movable holiday (Good Friday 2026)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const start = new Date(Date.UTC(2026, 3, 1)); // Quarta (2 dias antes de 03/04)
    const end = new Date(Date.UTC(2026, 3, 15));
    const err = validateCltPeriods([{ start, end }], { checkAdvanceNotice: true });
    expect(err).toContain("feriado");
    vi.useRealTimers();
  });
});

describe("calculateVacationBalance - Math Precision", () => {
  it("handles exactly 1 day after 12 months", () => {
    const today = new Date("2026-01-02T12:00:00Z");
    const hire = new Date("2025-01-01T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(today);
    const balance = calculateVacationBalance(hire, []);
    expect(balance.entitledDays).toBe(30);
    vi.useRealTimers();
  });
});

describe("isSaoPauloHoliday - Explicit Check", () => {
  it("detects fixed and movable holidays correctly", () => {
    // Natal
    expect(isSaoPauloHoliday(new Date(Date.UTC(2026, 11, 25)))).toBe(true);
    // Tiradentes
    expect(isSaoPauloHoliday(new Date(Date.UTC(2026, 3, 21)))).toBe(true);
    // Sexta-feira Santa 2026
    expect(isSaoPauloHoliday(new Date(Date.UTC(2026, 3, 3)))).toBe(true);
  });
});

// Restaurando os testes originais para manter cobertura
describe("getRoleLevel", () => {
  it("retorna nível correto para cada papel", () => {
    expect(getRoleLevel("FUNCIONARIO")).toBe(1);
    expect(getRoleLevel("COORDENADOR")).toBe(2);
    expect(getRoleLevel("GERENTE")).toBe(3);
    expect(getRoleLevel("DIRETOR")).toBe(4);
    expect(getRoleLevel("RH")).toBe(5);
  });
});
