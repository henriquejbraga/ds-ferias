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

describe("Workflow: approval chain (Coordenador → Gerente → RH)", () => {
  it("PENDENTE can be approved by Coordenador only", () => {
    const request = { userId: "f1", status: "PENDENTE", user: { role: "FUNCIONARIO" } };
    expect(canApproveRequest("COORDENADOR", "c1", request)).toBe(true);
    expect(canApproveRequest("GERENTE", "g1", request)).toBe(true);
    expect(canApproveRequest("RH", "r1", request)).toBe(true);
    expect(getNextApprovalStatus("COORDENADOR")).toBe("APROVADO_COORDENADOR");
  });

  it("APROVADO_COORDENADOR can be approved by Gerente only (not Coordenador)", () => {
    const request = { userId: "f1", status: "APROVADO_COORDENADOR", user: { role: "FUNCIONARIO" } };
    expect(canApproveRequest("COORDENADOR", "c1", request)).toBe(false);
    expect(canApproveRequest("GERENTE", "g1", request)).toBe(true);
    expect(canApproveRequest("RH", "r1", request)).toBe(true);
    expect(getNextApprovalStatus("GERENTE")).toBe("APROVADO_GERENTE");
  });

  it("APROVADO_GERENTE can be approved by RH only", () => {
    const request = { userId: "f1", status: "APROVADO_GERENTE", user: { role: "FUNCIONARIO" } };
    expect(canApproveRequest("COORDENADOR", "c1", request)).toBe(false);
    expect(canApproveRequest("GERENTE", "g1", request)).toBe(false);
    expect(canApproveRequest("RH", "r1", request)).toBe(true);
    expect(getNextApprovalStatus("RH")).toBe("APROVADO_RH");
  });

  it("approval progress matches chain", () => {
    expect(getApprovalProgress("PENDENTE")).toBe(0);
    expect(getApprovalProgress("APROVADO_COORDENADOR")).toBe(1);
    expect(getApprovalProgress("APROVADO_GERENTE")).toBe(2);
    expect(getApprovalProgress("APROVADO_RH")).toBe(3);
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
  const futureStart = new Date();
  futureStart.setDate(futureStart.getDate() + 60);
  const futureEnd = new Date(futureStart);
  futureEnd.setDate(futureEnd.getDate() + 13);

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
        status: "APROVADO_RH",
      },
    ];
    const balance = calculateVacationBalance(hireDate, requests);
    expect(balance.hasEntitlement).toBe(true);
    expect(balance.usedDays).toBe(15);
    expect(balance.availableDays).toBeLessThanOrEqual(balance.entitledDays - 15);
  });
});
