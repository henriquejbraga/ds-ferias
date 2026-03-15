import { describe, it, expect } from "vitest";
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
  detectTeamConflicts,
  checkBlackoutPeriods,
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

describe("getRoleLabel", () => {
  it("returns label for known roles", () => {
    expect(getRoleLabel("FUNCIONARIO")).toBe("Funcionário(a)");
    expect(getRoleLabel("COORDENADOR")).toBe("Coordenador(a)");
    expect(getRoleLabel("GERENTE")).toBe("Gerente");
    expect(getRoleLabel("RH")).toBe("RH / Admin");
  });
  it("returns role as-is for unknown", () => {
    expect(getRoleLabel("UNKNOWN")).toBe("UNKNOWN");
  });
});

describe("ROLE_COLOR", () => {
  it("returns color for known roles", () => {
    expect(ROLE_COLOR["FUNCIONARIO"]).toBe("blue");
    expect(ROLE_COLOR["RH"]).toBe("emerald");
  });
});

describe("getNextApprovalStatus", () => {
  it("returns APROVADO_COORDENADOR for level 2", () => {
    expect(getNextApprovalStatus("COORDENADOR")).toBe("APROVADO_COORDENADOR");
  });
  it("returns APROVADO_GERENTE for level 3", () => {
    expect(getNextApprovalStatus("GERENTE")).toBe("APROVADO_GERENTE");
  });
  it("returns APROVADO_RH for level 4", () => {
    expect(getNextApprovalStatus("RH")).toBe("APROVADO_RH");
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

describe("getApprovalSteps", () => {
  it("returns 3 steps for FUNCIONARIO", () => {
    expect(getApprovalSteps("FUNCIONARIO")).toEqual(["Coordenador(a)", "Gerente", "RH"]);
  });
  it("returns 2 steps for COORDENADOR", () => {
    expect(getApprovalSteps("COORDENADOR")).toEqual(["Gerente", "RH"]);
  });
  it("returns 1 step for GERENTE", () => {
    expect(getApprovalSteps("GERENTE")).toEqual(["RH"]);
  });
  it("returns empty for RH", () => {
    expect(getApprovalSteps("RH")).toEqual([]);
  });
});

describe("getApprovalProgress", () => {
  it("returns 0 for PENDENTE", () => {
    expect(getApprovalProgress("PENDENTE")).toBe(0);
  });
  it("returns 1 for APROVADO_COORDENADOR/APROVADO_GESTOR", () => {
    expect(getApprovalProgress("APROVADO_COORDENADOR")).toBe(1);
    expect(getApprovalProgress("APROVADO_GESTOR")).toBe(1);
  });
  it("returns 2 for APROVADO_GERENTE", () => {
    expect(getApprovalProgress("APROVADO_GERENTE")).toBe(2);
  });
  it("returns 3 for APROVADO_RH", () => {
    expect(getApprovalProgress("APROVADO_RH")).toBe(3);
  });
  it("returns 0 for REPROVADO", () => {
    expect(getApprovalProgress("REPROVADO")).toBe(0);
  });
});

describe("detectTeamConflicts", () => {
  const futureStart = new Date("2026-07-01");
  const futureEnd = new Date("2026-07-14");

  it("returns zeros for empty team", () => {
    const r = detectTeamConflicts(futureStart, futureEnd, []);
    expect(r.conflictingCount).toBe(0);
    expect(r.teamSize).toBe(0);
    expect(r.isBlocked).toBe(false);
    expect(r.isWarning).toBe(false);
  });

  it("detects no conflict when no overlapping requests", () => {
    const r = detectTeamConflicts(futureStart, futureEnd, [
      { name: "A", requests: [{ startDate: new Date("2025-01-01"), endDate: new Date("2025-01-10"), status: "APROVADO_RH" }] },
    ]);
    expect(r.conflictingCount).toBe(0);
    expect(r.names).toEqual([]);
  });

  it("detects conflict when member has overlapping approved request", () => {
    const r = detectTeamConflicts(futureStart, futureEnd, [
      { name: "A", requests: [{ startDate: new Date("2026-07-05"), endDate: new Date("2026-07-12"), status: "APROVADO_RH" }] },
    ]);
    expect(r.conflictingCount).toBe(1);
    expect(r.names).toEqual(["A"]);
    expect(r.isWarning).toBe(true);
  });

  it("ignores REPROVADO/CANCELADO", () => {
    const r = detectTeamConflicts(futureStart, futureEnd, [
      { name: "A", requests: [{ startDate: new Date("2026-07-05"), endDate: new Date("2026-07-12"), status: "REPROVADO" }] },
    ]);
    expect(r.conflictingCount).toBe(0);
  });
});

describe("checkBlackoutPeriods", () => {
  it("returns null when no blackouts", () => {
    expect(checkBlackoutPeriods(new Date("2026-06-01"), new Date("2026-06-14"), [])).toBeNull();
  });

  it("returns null when request does not overlap blackout", () => {
    const blackouts = [{ startDate: new Date("2026-07-01"), endDate: new Date("2026-07-15"), reason: "Fechamento" }];
    expect(checkBlackoutPeriods(new Date("2026-06-01"), new Date("2026-06-14"), blackouts)).toBeNull();
  });

  it("returns message when request overlaps blackout", () => {
    const blackouts = [{ startDate: new Date("2026-06-05"), endDate: new Date("2026-06-20"), reason: "Fechamento" }];
    const msg = checkBlackoutPeriods(new Date("2026-06-10"), new Date("2026-06-18"), blackouts);
    expect(msg).toContain("bloqueado");
    expect(msg).toContain("Fechamento");
  });

  it("applies department-specific blackout only to same department", () => {
    const blackouts = [{ startDate: new Date("2026-06-05"), endDate: new Date("2026-06-20"), reason: "TI", department: "TI" }];
    expect(checkBlackoutPeriods(new Date("2026-06-10"), new Date("2026-06-18"), blackouts, "Vendas")).toBeNull();
    expect(checkBlackoutPeriods(new Date("2026-06-10"), new Date("2026-06-18"), blackouts, "TI")).toContain("bloqueado");
  });
});

describe("validateCltPeriod (weekend)", () => {
  it("rejects start on Friday (local date)", () => {
    const start = new Date(2026, 5, 5); // 5 = June, Friday
    const end = new Date(2026, 5, 19);
    const err = validateCltPeriod(start, end);
    expect(err).toBeTruthy();
    expect(err).toContain("sexta");
  });

  it("rejects end on Saturday (local date)", () => {
    const start = new Date(2026, 5, 3);
    const end = new Date(2026, 5, 13); // Saturday
    const err = validateCltPeriod(start, end);
    expect(err).toBeTruthy();
    expect(err).toContain("sábado");
  });
});

describe("validateCltPeriods (overlap and 14 days)", () => {
  const in60 = new Date();
  in60.setDate(in60.getDate() + 60);

  it("rejects overlapping periods (weekday ends)", () => {
    const monday = new Date(2026, 5, 1);
    const p1 = { start: new Date(monday), end: new Date(monday.getTime() + 9 * 86400000) };
    const p2 = { start: new Date(monday.getTime() + 5 * 86400000), end: new Date(monday.getTime() + 14 * 86400000) };
    const err = validateCltPeriods([p1, p2], { checkAdvanceNotice: false, existingDaysInCycle: 0 });
    expect(err).toContain("sobrepor");
  });

  it("rejects invalid period (end < start)", () => {
    const start = new Date(in60);
    const end = new Date(in60.getTime() - 86400000);
    expect(validateCltPeriods([{ start, end }], { checkAdvanceNotice: false })).toContain("inválido");
  });

  it("rejects total cycle exceeding entitledDays", () => {
    const p1 = { start: new Date(in60), end: new Date(in60.getTime() + 13 * 86400000) };
    const p2 = { start: new Date(in60.getTime() + 20 * 86400000), end: new Date(in60.getTime() + 29 * 86400000) };
    const err = validateCltPeriods([p1, p2], { checkAdvanceNotice: false, existingDaysInCycle: 10, entitledDays: 30 });
    expect(err).toContain("30");
  });

  it("rejects when start is 2 days before holiday (checkAdvanceNotice)", () => {
    const dec30 = new Date(2026, 11, 30);
    const jan13 = new Date(2027, 0, 13);
    const err = validateCltPeriods(
      [{ start: dec30, end: jan13 }],
      { checkAdvanceNotice: true, existingDaysInCycle: 0 }
    );
    expect(err).toContain("feriado");
  });

  it("rejects invalid period (NaN dates)", () => {
    const badStart = new Date("invalid");
    const end = new Date(2026, 5, 14);
    const err = validateCltPeriods([{ start: badStart, end }], { checkAdvanceNotice: false });
    expect(err).toContain("inválido");
  });
});

describe("calculateVacationBalance (null hireDate)", () => {
  it("returns hasEntitlement true and 30 entitled when hireDate is null", () => {
    const balance = calculateVacationBalance(null, []);
    expect(balance.hasEntitlement).toBe(true);
    expect(balance.entitledDays).toBe(30);
    expect(balance.availableDays).toBe(30);
  });

  it("counts pending days when hireDate is null (current year)", () => {
    const year = new Date().getFullYear();
    const requests = [
      { startDate: new Date(year, 5, 1), endDate: new Date(year, 5, 15), status: "PENDENTE" },
    ];
    const balance = calculateVacationBalance(undefined, requests);
    expect(balance.pendingDays).toBe(15);
    expect(balance.availableDays).toBeLessThan(30);
  });
});
