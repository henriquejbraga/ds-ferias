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
  detectTeamConflicts,
  checkBlackoutPeriods,
} from "@/lib/vacationRules";

describe("validateCltPeriod (aviso prévio)", () => {
  it("returns advance notice error when start is < 30 days ahead", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T12:00:00Z"));
    const start = new Date("2026-03-25T12:00:00Z"); // 24 dias
    // terminar em dia útil para não disparar regra de sábado/domingo antes do aviso prévio
    const end = new Date("2026-04-03T12:00:00Z"); // sexta
    expect(validateCltPeriod(start, end)).toContain("Aviso prévio mínimo de 30 dias");
    vi.useRealTimers();
  });

  it("returns null when start is >= 30 days ahead and other rules pass", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T12:00:00Z"));
    // 2026-04-01 é quarta; 10 dias e término em sexta (dia útil)
    const start = new Date("2026-04-01T12:00:00Z");
    const end = new Date("2026-04-10T12:00:00Z");
    expect(validateCltPeriod(start, end)).toBeNull();
    vi.useRealTimers();
  });
});

describe("detectTeamConflicts", () => {
  it("handles empty team", () => {
    const out = detectTeamConflicts(new Date("2026-06-01"), new Date("2026-06-10"), []);
    expect(out.teamSize).toBe(0);
    expect(out.conflictingCount).toBe(0);
    expect(out.isBlocked).toBe(false);
  });
});

describe("validateCltPeriods (limite do ciclo)", () => {
  it("errors when total in cycle exceeds entitledDays", () => {
    // período mínimo de 5 dias (seg → sex) e término em dia útil
    const start = new Date("2026-06-01T12:00:00Z"); // seg
    const endSafe = new Date("2026-06-05T12:00:00Z"); // sex (5 dias)
    const msg = validateCltPeriods(
      [{ start, end: endSafe }],
      { checkAdvanceNotice: false, existingDaysInCycle: 29, entitledDays: 30 },
    );
    expect(msg).toContain("Total do ciclo não pode ultrapassar 30 dias");
  });
});

describe("validateCltPeriods (início sexta/sábado)", () => {
  it("errors when first period starts on Friday with advance notice check enabled", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    // 2026-02-06 é sexta; 36 dias à frente
    const start = new Date("2026-02-06T12:00:00Z");
    const end = new Date("2026-02-12T12:00:00Z"); // quinta (término em dia útil)
    const msg = validateCltPeriods([{ start, end }], { checkAdvanceNotice: true, existingDaysInCycle: 14 });
    expect(msg).toContain("O início das férias não pode ocorrer na sexta ou no sábado");
    vi.useRealTimers();
  });
});

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
  it("returns 4 for DIRETOR e 5 para RH", () => {
    expect(getRoleLevel("DIRETOR")).toBe(4);
    expect(getRoleLevel("RH")).toBe(5);
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

  it("returns false for Coordenador approving APROVADO_GERENTE (status final)", () => {
    expect(
      canApproveRequest("COORDENADOR", "coord-1", {
        userId: "func-1",
        status: "APROVADO_GERENTE",
        user: { role: "FUNCIONARIO" },
      }),
    ).toBe(false);
  });

  it("returns false for RH approving APROVADO_GERENTE (status final)", () => {
    expect(
      canApproveRequest("RH", "rh-1", {
        userId: "func-1",
        status: "APROVADO_GERENTE",
        user: { role: "FUNCIONARIO" },
      }),
    ).toBe(false);
  });
});

describe("hasTeamVisibility (papel sem visibilidade)", () => {
  it("returns false for non-approver role", () => {
    const out = hasTeamVisibility("FUNCIONARIO", "u1", {
      userId: "u2",
      user: { managerId: null, manager: null },
    });
    expect(out).toBe(false);
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
    // Datas fixas para evitar cair em fim de semana (regra de término não sábado/domingo)
    // 2026-06-03 (qua) → 2026-06-09 (ter) = 7 dias
    const start = new Date("2026-06-03T12:00:00Z");
    const end = new Date("2026-06-09T12:00:00Z");
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

  it("counts used days from APROVADO_GERENTE requests", () => {
    const hireDate = new Date("2023-01-01");
    const requests = [
      { startDate: new Date("2025-01-06"), endDate: new Date("2025-01-20"), status: "APROVADO_GERENTE" },
    ];
    const balance = calculateVacationBalance(hireDate, requests);
    expect(balance.usedDays).toBe(15);
    expect(balance.availableDays).toBeLessThanOrEqual(balance.entitledDays - 15);
  });

  it("caps entitlement at 60 days (2 períodos aquisitivos) mesmo após muitos anos", () => {
    const hireDate = new Date();
    hireDate.setFullYear(hireDate.getFullYear() - 10);
    const balance = calculateVacationBalance(hireDate, []);
    expect(balance.hasEntitlement).toBe(true);
    expect(balance.entitledDays).toBe(60);
    expect(balance.availableDays).toBe(60);
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
  it("returns APROVADO_GERENTE for level 2 (aprovação única)", () => {
    expect(getNextApprovalStatus("COORDENADOR")).toBe("APROVADO_GERENTE");
  });
  it("returns APROVADO_GERENTE for level 3 (gerente é aprovação final)", () => {
    expect(getNextApprovalStatus("GERENTE")).toBe("APROVADO_GERENTE");
  });
  it("returns APROVADO_GERENTE for level 4 (legado)", () => {
    expect(getNextApprovalStatus("RH")).toBe("APROVADO_GERENTE");
  });
});

describe("getNextApprover", () => {
  it("returns Líder direto for PENDENTE from Funcionario", () => {
    expect(getNextApprover("PENDENTE", "FUNCIONARIO")).toContain("Líder direto");
  });
  it("returns null for APROVADO_COORDENADOR (status legado terminal)", () => {
    expect(getNextApprover("APROVADO_COORDENADOR", "FUNCIONARIO")).toBeNull();
  });
  it("returns null for APROVADO_GERENTE (final)", () => {
    expect(getNextApprover("APROVADO_GERENTE", "FUNCIONARIO")).toBeNull();
  });
});

describe("getApprovalSteps", () => {
  it("returns 1 step (Líder direto) for FUNCIONARIO", () => {
    expect(getApprovalSteps("FUNCIONARIO")).toEqual(["Líder direto"]);
  });
  it("returns empty for COORDENADOR", () => {
    expect(getApprovalSteps("COORDENADOR")).toEqual([]);
  });
  it("returns empty for GERENTE", () => {
    expect(getApprovalSteps("GERENTE")).toEqual([]);
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
  it("returns 1 for APROVADO_GERENTE (etapa final atual)", () => {
    expect(getApprovalProgress("APROVADO_GERENTE")).toBe(1);
  });
  it("returns 0 for REPROVADO", () => {
    expect(getApprovalProgress("REPROVADO")).toBe(0);
  });
});

describe("getApproverRelationshipStepLabel", () => {
  const baseEmployee = {
    managerId: "coord-1" as string | null,
    manager: undefined as { id?: string | null } | undefined,
  };

  it("returns RH label for role RH", () => {
    expect(getApproverRelationshipStepLabel("rh-1", "RH", baseEmployee)).toBe("Aprovação pelo RH");
  });

  it("returns direct-leader label for gerente when managerId matches", () => {
    expect(
      getApproverRelationshipStepLabel("ger-1", "GERENTE", { ...baseEmployee, managerId: "ger-1" })
    ).toBe("Você é o líder direto");
  });

  it("returns indirect label for gerente when managerId points to subordinate coordinator", () => {
    expect(getApproverRelationshipStepLabel("ger-1", "GERENTE", baseEmployee)).toBe(
      "Você aprova como líder indireto",
    );
  });

  it("returns direct-leader label for coordenador when managerId matches (uses manager.id fallback)", () => {
    expect(
      getApproverRelationshipStepLabel("coord-1", "COORDENADOR", {
        ...baseEmployee,
        managerId: null,
        manager: { id: "coord-1" },
      })
    ).toBe("Você é o líder direto");
  });

  it("returns undefined for coordenador when not the direct manager", () => {
    expect(getApproverRelationshipStepLabel("coord-x", "COORDENADOR", baseEmployee)).toBeUndefined();
  });

  it("returns directoria label for diretor when not direct manager", () => {
    expect(getApproverRelationshipStepLabel("dir-1", "DIRETOR", baseEmployee)).toBe("Aprovação na diretoria");
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
      { name: "A", requests: [{ startDate: new Date("2025-01-01"), endDate: new Date("2025-01-10"), status: "APROVADO_GERENTE" }] },
    ]);
    expect(r.conflictingCount).toBe(0);
    expect(r.names).toEqual([]);
  });

  it("detects conflict when member has overlapping approved request", () => {
    const r = detectTeamConflicts(futureStart, futureEnd, [
      { name: "A", requests: [{ startDate: new Date("2026-07-05"), endDate: new Date("2026-07-12"), status: "APROVADO_GERENTE" }] },
    ]);
    expect(r.conflictingCount).toBe(1);
    expect(r.names).toEqual(["A"]);
    expect(r.isWarning).toBe(true);
  });

  it("warns on overlap even when conflicting teammate is under 30% of team", () => {
    const team = [
      { name: "A", requests: [{ startDate: new Date("2026-07-05"), endDate: new Date("2026-07-12"), status: "APROVADO_GERENTE" }] },
      { name: "B", requests: [] as { startDate: Date; endDate: Date; status: string }[] },
      { name: "C", requests: [] },
      { name: "D", requests: [] },
    ];
    const r = detectTeamConflicts(futureStart, futureEnd, team);
    expect(r.conflictingCount).toBe(1);
    expect(r.conflictPercent).toBe(25);
    expect(r.isWarning).toBe(true);
    expect(r.isBlocked).toBe(false);
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
    expect(err).not.toBeNull();
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
