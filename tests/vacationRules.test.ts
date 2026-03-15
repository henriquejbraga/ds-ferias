import { describe, it, expect } from "vitest";
import {
  getRoleLevel,
  canApproveRequest,
  hasTeamVisibility,
  validateCltPeriods,
  validateCltPeriod,
  calculateVacationBalance,
  getNextApprover,
} from "@/lib/vacationRules";

describe("getRoleLevel", () => {
  it("returns 1 for FUNCIONARIO and COLABORADOR", () => {
    expect(getRoleLevel("FUNCIONARIO")).toBe(1);
    expect(getRoleLevel("COLABORADOR")).toBe(1);
  });
  it("returns 2 for COORDENADOR and GESTOR", () => {
    expect(getRoleLevel("COORDENADOR")).toBe(2);
    expect(getRoleLevel("GESTOR")).toBe(2);
  });
  it("returns 3 for GERENTE", () => {
    expect(getRoleLevel("GERENTE")).toBe(3);
  });
  it("returns 4 for RH", () => {
    expect(getRoleLevel("RH")).toBe(4);
  });
  it("returns 1 for unknown role", () => {
    expect(getRoleLevel("UNKNOWN")).toBe(1);
  });
});

describe("canApproveRequest", () => {
  it("returns false when approver is the request owner (self-approval)", () => {
    const result = canApproveRequest("RH", "user-1", {
      userId: "user-1",
      status: "APROVADO_GERENTE",
      user: { role: "FUNCIONARIO" },
    });
    expect(result).toBe(false);
  });

  it("returns false when approver level <= requester level", () => {
    expect(
      canApproveRequest("FUNCIONARIO", "user-1", {
        userId: "user-2",
        status: "PENDENTE",
        user: { role: "COORDENADOR" },
      }),
    ).toBe(false);
  });

  it("returns true for Coordenador approving PENDENTE from Funcionario", () => {
    expect(
      canApproveRequest("COORDENADOR", "coord-1", {
        userId: "func-1",
        status: "PENDENTE",
        user: { role: "FUNCIONARIO" },
      }),
    ).toBe(true);
  });

  it("returns false for Coordenador approving APROVADO_GERENTE (needs RH)", () => {
    expect(
      canApproveRequest("COORDENADOR", "coord-1", {
        userId: "func-1",
        status: "APROVADO_GERENTE",
        user: { role: "FUNCIONARIO" },
      }),
    ).toBe(false);
  });

  it("returns true for RH approving APROVADO_GERENTE", () => {
    expect(
      canApproveRequest("RH", "rh-1", {
        userId: "func-1",
        status: "APROVADO_GERENTE",
        user: { role: "FUNCIONARIO" },
      }),
    ).toBe(true);
  });
});

describe("hasTeamVisibility", () => {
  it("RH sees all requests", () => {
    expect(
      hasTeamVisibility("RH", "rh-1", {
        userId: "any",
        user: { managerId: "other", manager: { managerId: null } },
      }),
    ).toBe(true);
  });

  it("Coordenador sees only direct reports", () => {
    expect(
      hasTeamVisibility("COORDENADOR", "coord-1", {
        userId: "func-1",
        user: { managerId: "coord-1", manager: null },
      }),
    ).toBe(true);
    expect(
      hasTeamVisibility("COORDENADOR", "coord-1", {
        userId: "func-2",
        user: { managerId: "other-coord", manager: null },
      }),
    ).toBe(false);
  });

  it("Gerente sees direct and indirect reports", () => {
    expect(
      hasTeamVisibility("GERENTE", "ger-1", {
        userId: "func-1",
        user: { managerId: "coord-1", manager: { managerId: "ger-1" } },
      }),
    ).toBe(true);
    expect(
      hasTeamVisibility("GERENTE", "ger-1", {
        userId: "func-2",
        user: { managerId: "other-ger", manager: { managerId: "other-ger" } },
      }),
    ).toBe(false);
  });
});

describe("validateCltPeriods", () => {
  const today = new Date();
  const in60 = new Date(today);
  in60.setDate(in60.getDate() + 60);

  it("rejects empty periods", () => {
    expect(validateCltPeriods([])).not.toBeNull();
  });

  it("rejects more than 3 periods", () => {
    const periods = [
      { start: new Date(in60), end: new Date(in60.getTime() + 9 * 86400000) },
      { start: new Date(in60.getTime() + 20 * 86400000), end: new Date(in60.getTime() + 29 * 86400000) },
      { start: new Date(in60.getTime() + 40 * 86400000), end: new Date(in60.getTime() + 49 * 86400000) },
      { start: new Date(in60.getTime() + 60 * 86400000), end: new Date(in60.getTime() + 69 * 86400000) },
    ];
    expect(validateCltPeriods(periods)).not.toBeNull();
  });

  it("requires at least one period of 14+ days when existingDaysInCycle < 14", () => {
    const start = new Date(in60);
    const end = new Date(in60.getTime() + 6 * 86400000);
    expect(
      validateCltPeriods([{ start, end }], { checkAdvanceNotice: false, existingDaysInCycle: 0 }),
    ).toContain("14");
  });

  it("accepts period of 14 days with end on weekday (checkAdvanceNotice false)", () => {
    const start = new Date("2026-06-03T12:00:00Z");
    const end = new Date("2026-06-16T12:00:00Z");
    const err = validateCltPeriods([{ start, end }], { checkAdvanceNotice: false, existingDaysInCycle: 0 });
    expect(err).toBeNull();
  });
});

describe("validateCltPeriod", () => {
  it("rejects period < 5 days", () => {
    const start = new Date("2026-06-01");
    const end = new Date("2026-06-03");
    expect(validateCltPeriod(start, end)).toContain("5");
  });

  it("rejects period > 30 days", () => {
    const start = new Date("2026-06-01");
    const end = new Date("2026-07-05");
    expect(validateCltPeriod(start, end)).toContain("30");
  });
});

describe("calculateVacationBalance", () => {
  it("returns hasEntitlement false when hireDate is less than 12 months ago", () => {
    const hireDate = new Date();
    hireDate.setMonth(hireDate.getMonth() - 6);
    const balance = calculateVacationBalance(hireDate, []);
    expect(balance.hasEntitlement).toBe(false);
    expect(balance.entitledDays).toBe(0);
    expect(balance.availableDays).toBe(0);
  });

  it("returns 30 entitled when hireDate is 12+ months ago and no requests", () => {
    const hireDate = new Date();
    hireDate.setFullYear(hireDate.getFullYear() - 2);
    const balance = calculateVacationBalance(hireDate, []);
    expect(balance.hasEntitlement).toBe(true);
    expect(balance.entitledDays).toBe(60);
    expect(balance.usedDays).toBe(0);
    expect(balance.availableDays).toBe(60);
  });

  it("counts used days from APROVADO_RH requests", () => {
    const hireDate = new Date("2023-01-01");
    const requests = [
      { startDate: new Date("2025-01-06"), endDate: new Date("2025-01-20"), status: "APROVADO_RH" },
    ];
    const balance = calculateVacationBalance(hireDate, requests);
    expect(balance.usedDays).toBe(15);
    expect(balance.availableDays).toBeLessThanOrEqual(balance.entitledDays - 15);
  });
});

describe("getNextApprover", () => {
  it("returns Coordenador for PENDENTE from Funcionario", () => {
    expect(getNextApprover("PENDENTE", "FUNCIONARIO")).toContain("Coordenador");
  });
  it("returns Gerente for APROVADO_COORDENADOR", () => {
    expect(getNextApprover("APROVADO_COORDENADOR", "FUNCIONARIO")).toContain("Gerente");
  });
  it("returns RH for APROVADO_GERENTE", () => {
    expect(getNextApprover("APROVADO_GERENTE", "FUNCIONARIO")).toContain("RH");
  });
  it("returns null for APROVADO_RH", () => {
    expect(getNextApprover("APROVADO_RH", "FUNCIONARIO")).toBeNull();
  });
});
