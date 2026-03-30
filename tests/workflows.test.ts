import { describe, it, expect } from "vitest";
import {
  canApproveRequest,
  getNextApprovalStatus,
  getApprovalProgress,
  hasTeamVisibility,
  validateCltPeriods,
  checkBlackoutPeriods,
  calculateVacationBalance,
} from "@/lib/vacationRules";

/**
 * Testes de fluxos de negócio (workflows) que garantem que as regras
 * usadas nas APIs e no dashboard se comportam de forma consistente.
 */

describe("Workflow: approval chain (aprovação única do líder direto)", () => {
  it("PENDENTE can be approved by Coordenador or Gerente", () => {
    const request = { userId: "f1", status: "PENDENTE", user: { role: "FUNCIONARIO" } };
    expect(canApproveRequest("COORDENADOR", "c1", request)).toBe(true);
    expect(canApproveRequest("GERENTE", "g1", request)).toBe(true);
    expect(canApproveRequest("RH", "r1", request)).toBe(false); // RH não aprova mais
    expect(getNextApprovalStatus("COORDENADOR")).toBe("APROVADO_COORDENADOR");
  });

  it("APROVADO_COORDENADOR é terminal no novo fluxo", () => {
    const request = { userId: "f1", status: "APROVADO_COORDENADOR", user: { role: "FUNCIONARIO" } };
    expect(canApproveRequest("COORDENADOR", "c1", request)).toBe(false);
    expect(canApproveRequest("GERENTE", "g1", request)).toBe(false);
    expect(canApproveRequest("RH", "r1", request)).toBe(false);
    expect(getNextApprovalStatus("GERENTE")).toBe("APROVADO_GERENTE");
  });

  it("approval progress matches chain", () => {
    expect(getApprovalProgress("PENDENTE")).toBe(0);
    expect(getApprovalProgress("APROVADO_COORDENADOR")).toBe(1);
    expect(getApprovalProgress("APROVADO_GERENTE")).toBe(1);
  });
});

describe("Workflow: permission checks (who can approve whom)", () => {
  it("Coordenador cannot approve own request", () => {
    expect(
      canApproveRequest("COORDENADOR", "c1", {
        userId: "c1",
        status: "PENDENTE",
        user: { role: "COORDENADOR" },
      })
    ).toBe(false);
  });

  it("Coordenador can only approve direct reports (team visibility)", () => {
    expect(
      hasTeamVisibility("COORDENADOR", "c1", {
        userId: "f1",
        user: { managerId: "c1", manager: null },
      })
    ).toBe(true);
    expect(
      hasTeamVisibility("COORDENADOR", "c1", {
        userId: "f2",
        user: { managerId: "other", manager: null },
      })
    ).toBe(false);
  });

  it("Gerente can approve direct and indirect reports", () => {
    expect(
      hasTeamVisibility("GERENTE", "g1", {
        userId: "f1",
        user: { managerId: "c1", manager: { managerId: "g1" } },
      })
    ).toBe(true);
  });
});

describe("Workflow: request creation validation (CLT + blackout)", () => {
  // Escolhe um período futuro que não caia em sexta/sábado (início) nem sábado/domingo (término),
  // para não ser reprovado pelas regras de DSR.
  const baseStart = new Date();
  baseStart.setDate(baseStart.getDate() + 90);
  function pickValidPeriod() {
    let start = new Date(baseStart);
    let end = new Date(start);
    end.setDate(end.getDate() + 13);
    // 0=domingo,1=segunda,...,5=sexta,6=sábado
    // CLT: Início não pode ser nos 2 dias que antecedem feriado ou DSR
    while ([4, 5, 6].includes(start.getDay()) || [0, 6].includes(end.getDay())) {
      start.setDate(start.getDate() + 1);
      end = new Date(start);
      end.setDate(end.getDate() + 13);
    }
    return { start, end };
  }
  const { start: futureStart, end: futureEnd } = pickValidPeriod();

  it("valid period passes validateCltPeriods with checkAdvanceNotice", () => {
    const err = validateCltPeriods([{ start: futureStart, end: futureEnd }], {
      checkAdvanceNotice: true,
      existingDaysInCycle: 0,
    });
    expect(err).toBeNull();
  });

  it("blackout blocks overlapping period", () => {
    const blackouts = [
      {
        startDate: new Date(futureStart.getTime() + 2 * 86400000),
        endDate: new Date(futureStart.getTime() + 10 * 86400000),
        reason: "Fechamento",
      },
    ];
    const msg = checkBlackoutPeriods(futureStart, futureEnd, blackouts);
    expect(msg).toContain("bloqueado");
  });

  it("blackout does not apply when no overlap", () => {
    const blackouts = [
      {
        startDate: new Date(futureStart.getTime() + 20 * 86400000),
        endDate: new Date(futureStart.getTime() + 30 * 86400000),
        reason: "Fechamento",
      },
    ];
    expect(checkBlackoutPeriods(futureStart, futureEnd, blackouts)).toBeNull();
  });
});

describe("Workflow: vacation balance and entitlement", () => {
  it("employee with less than 12 months has no entitlement", () => {
    const hireDate = new Date();
    hireDate.setMonth(hireDate.getMonth() - 6);
    const balance = calculateVacationBalance(hireDate, []);
    expect(balance.hasEntitlement).toBe(false);
    expect(balance.availableDays).toBe(0);
  });

  it("employee with 12+ months has 30 days; used days reduce available", () => {
    const hireDate = new Date();
    hireDate.setFullYear(hireDate.getFullYear() - 2);
    const requests = [
      {
        startDate: new Date("2025-01-06"),
        endDate: new Date("2025-01-20"),
        status: "APROVADO_GERENTE",
      },
    ];
    const balance = calculateVacationBalance(hireDate, requests);
    expect(balance.hasEntitlement).toBe(true);
    expect(balance.usedDays).toBe(15);
    expect(balance.availableDays).toBeLessThanOrEqual(balance.entitledDays - 15);
  });
});
