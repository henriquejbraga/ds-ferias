import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
  getRoleLevel as getRoleLevelFn,
} from "@/lib/vacationRules";

describe("vacationRules", () => {
  describe("getRoleLevel", () => {
    it("returns correct level for each role", () => {
      expect(getRoleLevel("FUNCIONARIO")).toBe(1);
      expect(getRoleLevel("COORDENADOR")).toBe(2);
      expect(getRoleLevel("GERENTE")).toBe(3);
      expect(getRoleLevel("DIRETOR")).toBe(4);
      expect(getRoleLevel("RH")).toBe(5);
      expect(getRoleLevel("UNKNOWN")).toBe(1);
    });
  });

  describe("getRoleLabel", () => {
    it("returns correct label for each role", () => {
      expect(getRoleLabel("FUNCIONARIO")).toBe("Funcionário(a)");
      expect(getRoleLabel("COORDENADOR")).toBe("Coordenador(a)");
      expect(getRoleLabel("GERENTE")).toBe("Gerente");
      expect(getRoleLabel("RH")).toBe("RH / Admin");
      expect(getRoleLabel("UNKNOWN")).toBe("UNKNOWN");
    });
  });

  describe("isVacationApprovedStatus", () => {
    it("identifies approved statuses correctly", () => {
      expect(isVacationApprovedStatus("APROVADO_COORDENADOR")).toBe(true);
      expect(isVacationApprovedStatus("APROVADO_GERENTE")).toBe(true);
      expect(isVacationApprovedStatus("APROVADO_DIRETOR")).toBe(true);
      expect(isVacationApprovedStatus("APROVADO_RH")).toBe(true);
      expect(isVacationApprovedStatus("PENDENTE")).toBe(false);
      expect(isVacationApprovedStatus("REPROVADO")).toBe(false);
    });
  });

  describe("getVacationStatusDisplayLabel", () => {
    it("returns friendly labels", () => {
      expect(getVacationStatusDisplayLabel("PENDENTE")).toBe("Pendente aprovação");
      expect(getVacationStatusDisplayLabel("APROVADO_COORDENADOR")).toBe("Aprovado (coordenador)");
      expect(getVacationStatusDisplayLabel("REPROVADO")).toBe("Reprovado");
      expect(getVacationStatusDisplayLabel("SOME_OTHER")).toBe("SOME OTHER");
    });
  });

  describe("getNextApprovalStatus", () => {
    it("returns correct next status based on approver role", () => {
      expect(getNextApprovalStatus("COORDENADOR")).toBe("APROVADO_COORDENADOR");
      expect(getNextApprovalStatus("GERENTE")).toBe("APROVADO_GERENTE");
      expect(getNextApprovalStatus("DIRETOR")).toBe("APROVADO_DIRETOR");
      expect(getNextApprovalStatus("RH")).toBe("APROVADO_DIRETOR");
      expect(getNextApprovalStatus("FUNCIONARIO")).toBe("PENDENTE");
    });
  });

  describe("canApproveRequest", () => {
    const request = {
      userId: "u1",
      status: "PENDENTE",
      user: { role: "FUNCIONARIO" }
    };

    it("prevents RH from approving", () => {
      expect(canApproveRequest("RH", "rh1", request)).toBe(false);
    });

    it("prevents self-approval", () => {
      expect(canApproveRequest("GERENTE", "u1", request)).toBe(false);
    });

    it("prevents lower or equal level from approving", () => {
      expect(canApproveRequest("FUNCIONARIO", "u2", request)).toBe(false);
      const coordRequest = { ...request, user: { role: "COORDENADOR" } };
      expect(canApproveRequest("COORDENADOR", "u2", coordRequest)).toBe(false);
    });

    it("allows higher level to approve PENDENTE", () => {
      expect(canApproveRequest("COORDENADOR", "u2", request)).toBe(true);
      expect(canApproveRequest("GERENTE", "u2", request)).toBe(true);
    });

    it("returns false for terminal statuses", () => {
      const approvedRequest = { ...request, status: "APROVADO_DIRETOR" };
      expect(canApproveRequest("GERENTE", "u2", approvedRequest)).toBe(false);
    });

    it("returns false for unknown statuses", () => {
      const unknownRequest = { ...request, status: "UNKNOWN" };
      expect(canApproveRequest("GERENTE", "u2", unknownRequest)).toBe(false);
    });
  });

  describe("getNextApprover", () => {
    it("returns correct next approver label", () => {
      expect(getNextApprover("PENDENTE", "FUNCIONARIO")).toBe("Líder direto");
      expect(getNextApprover("APROVADO_DIRETOR", "FUNCIONARIO")).toBeNull();
    });
  });

  describe("getApprovalSteps", () => {
    it("returns steps for level 1", () => {
      expect(getApprovalSteps("FUNCIONARIO")).toEqual(["Líder direto"]);
    });
    it("returns empty for level >= 2", () => {
      expect(getApprovalSteps("COORDENADOR")).toEqual([]);
    });
  });

  describe("getApprovalProgress", () => {
    it("returns 0 for PENDENTE", () => {
      expect(getApprovalProgress("PENDENTE")).toBe(0);
    });
    it("returns 1 for any approved status", () => {
      expect(getApprovalProgress("APROVADO_COORDENADOR")).toBe(1);
      expect(getApprovalProgress("APROVADO_RH")).toBe(1);
    });
    it("returns 0 for others", () => {
      expect(getApprovalProgress("REPROVADO")).toBe(0);
    });
  });

  describe("getApproverRelationshipStepLabel", () => {
    const employee = { managerId: "m1" };

    it("returns undefined if no employee", () => {
      expect(getApproverRelationshipStepLabel("a1", "GERENTE", null)).toBeUndefined();
    });

    it("returns direct leader message", () => {
      expect(getApproverRelationshipStepLabel("m1", "GERENTE", employee)).toBe("Você é o líder direto");
    });

    it("returns indirect leader message for Gerente", () => {
      expect(getApproverRelationshipStepLabel("m2", "GERENTE", employee)).toBe("Você aprova como líder indireto");
    });

    it("returns diretoria message for Diretor", () => {
      expect(getApproverRelationshipStepLabel("d1", "DIRETOR", employee)).toBe("Aprovação na diretoria");
    });

    it("returns undefined for RH", () => {
      expect(getApproverRelationshipStepLabel("rh1", "RH", employee)).toBeUndefined();
    });

    it("returns undefined for Coordenador who is not direct manager", () => {
      expect(getApproverRelationshipStepLabel("c1", "COORDENADOR", employee)).toBeUndefined();
    });
  });

  describe("hasTeamVisibility", () => {
    const request = {
      userId: "u1",
      user: {
        managerId: "m1",
        manager: { managerId: "g1", manager: { managerId: "d1" } }
      }
    };

    it("allows RH to see everything", () => {
      expect(hasTeamVisibility("RH", "any", request as any)).toBe(true);
    });

    it("allows Coordenador to see direct reports and self", () => {
      expect(hasTeamVisibility("COORDENADOR", "m1", request as any)).toBe(true);
      expect(hasTeamVisibility("COORDENADOR", "u1", request as any)).toBe(true);
      expect(hasTeamVisibility("COORDENADOR", "other", request as any)).toBe(false);
    });

    it("allows Gerente to see direct and indirect reports", () => {
      expect(hasTeamVisibility("GERENTE", "g1", request as any)).toBe(true);
      expect(hasTeamVisibility("GERENTE", "m1", request as any)).toBe(true);
      expect(hasTeamVisibility("GERENTE", "u1", request as any)).toBe(true);
      expect(hasTeamVisibility("GERENTE", "other", request as any)).toBe(false);
    });

    it("allows Diretor to see full chain", () => {
      expect(hasTeamVisibility("DIRETOR", "d1", request as any)).toBe(true);
      expect(hasTeamVisibility("DIRETOR", "g1", request as any)).toBe(true);
      expect(hasTeamVisibility("DIRETOR", "m1", request as any)).toBe(true);
      expect(hasTeamVisibility("DIRETOR", "u1", request as any)).toBe(true);
      expect(hasTeamVisibility("DIRETOR", "other", request as any)).toBe(false);
    });
    
    it("returns false for unknown role level", () => {
      expect(hasTeamVisibility("UNKNOWN", "any", request as any)).toBe(false);
    });
  });

  describe("calculateVacationBalance", () => {
    it("handles null hireDate with used days", () => {
      const today = new Date("2026-06-01");
      const requests = [
        { startDate: new Date("2026-01-01"), endDate: new Date("2026-01-10"), status: "APROVADO_COORDENADOR", abono: false }
      ];
      const balance = calculateVacationBalance(null, requests, today);
      expect(balance.usedDays).toBe(10);
      expect(balance.availableDays).toBe(20);
    });

    it("caps used days at 30 for null hireDate", () => {
      const today = new Date("2026-06-01");
      const requests = [
        { startDate: new Date("2026-01-01"), endDate: new Date("2026-01-30"), status: "APROVADO_COORDENADOR", abono: true }
      ]; // 30 + 10 = 40 days
      const balance = calculateVacationBalance(null, requests, today);
      expect(balance.usedDays).toBe(30);
    });

    it("returns zero balance for < 12 months worked", () => {
      const hire = new Date("2026-01-01");
      const today = new Date("2026-06-01");
      const balance = calculateVacationBalance(hire, [], today);
      expect(balance.hasEntitlement).toBe(false);
      expect(balance.availableDays).toBe(0);
    });

    it("calculates balance for 2 cycles", () => {
      const hire = new Date("2024-01-01");
      const today = new Date("2026-02-01"); // 25 months
      const balance = calculateVacationBalance(hire, [], today);
      expect(balance.entitledDays).toBe(60);
      expect(balance.availableDays).toBe(60);
    });
    
    it("subtracts pending days correctly", () => {
      const hire = new Date("2024-01-01");
      const today = new Date("2026-01-01");
      const requests = [
        { startDate: new Date("2025-06-01"), endDate: new Date("2025-06-10"), status: "PENDENTE" }
      ];
      const balance = calculateVacationBalance(hire, requests, today);
      expect(balance.pendingDays).toBe(10);
      expect(balance.availableDays).toBe(50);
    });
  });

  describe("detectTeamConflicts", () => {
    it("returns no conflicts for empty team", () => {
      const res = detectTeamConflicts(new Date(), new Date(), []);
      expect(res.conflictingCount).toBe(0);
    });

    it("detects conflicts correctly", () => {
      const start = new Date("2026-10-01");
      const end = new Date("2026-10-10");
      const team = [
        { name: "User 1", requests: [{ startDate: new Date("2026-10-05"), endDate: new Date("2026-10-15"), status: "PENDENTE" }] },
        { name: "User 2", requests: [{ startDate: new Date("2026-09-01"), endDate: new Date("2026-09-10"), status: "APROVADO_COORDENADOR" }] },
        { name: "User 3", requests: [{ startDate: new Date("2026-10-01"), endDate: new Date("2026-10-10"), status: "REPROVADO" }] }
      ];
      const res = detectTeamConflicts(start, end, team);
      expect(res.conflictingCount).toBe(1);
      expect(res.names).toContain("User 1");
      expect(res.isWarning).toBe(true);
      expect(res.isBlocked).toBe(false);
    });

    it("blocks when > 50%", () => {
      const start = new Date("2026-10-01");
      const end = new Date("2026-10-10");
      const team = [
        { name: "U1", requests: [{ startDate: new Date("2026-10-01"), endDate: new Date("2026-10-10"), status: "PENDENTE" }] },
        { name: "U2", requests: [{ startDate: new Date("2026-10-01"), endDate: new Date("2026-10-10"), status: "PENDENTE" }] }
      ];
      const res = detectTeamConflicts(start, end, team);
      expect(res.isBlocked).toBe(true);
    });
  });

  describe("validateCltPeriod (single block)", () => {
    it("validates minimum days", () => {
      expect(validateCltPeriod(new Date("2026-10-01"), new Date("2026-10-02"))).toContain("mínimo de férias é de 5 dias");
    });
    it("validates maximum days", () => {
      expect(validateCltPeriod(new Date("2026-10-01"), new Date("2026-11-10"))).toContain("máximo em um único bloco é de 30 dias");
    });
    it("validates start weekday", () => {
      // 2026-10-02 is Friday
      expect(validateCltPeriod(new Date("2026-10-02"), new Date("2026-10-15"))).toContain("não pode ocorrer na sexta ou no sábado");
    });
    it("validates end weekday", () => {
      // 2026-10-11 is Sunday
      expect(validateCltPeriod(new Date("2026-10-01"), new Date("2026-10-11"))).toContain("não pode ocorrer no sábado ou no domingo");
    });
  });

  describe("validateCltPeriods (multi block)", () => {
    it("rejects zero periods", () => {
      expect(validateCltPeriods([])).toBe("É necessário informar ao menos um período de férias.");
    });
    it("rejects more than 3 periods", () => {
      expect(validateCltPeriods([{} as any, {} as any, {} as any, {} as any])).toBe("As férias podem ser fracionadas em no máximo 3 períodos.");
    });
    it("rejects invalid dates", () => {
      expect(validateCltPeriods([{ start: new Date("invalid"), end: new Date() }])).toBe("Período de férias inválido.");
    });
    it("rejects overlapping periods", () => {
      const p1 = { start: new Date("2026-10-05"), end: new Date("2026-10-14") }; // Mon to Wed
      const p2 = { start: new Date("2026-10-08"), end: new Date("2026-10-16") }; // Thu to Fri
      expect(validateCltPeriods([p1, p2])).toBe("Os períodos não podem se sobrepor.");
    });
    it("rejects if no period has 14+ days", () => {
      const p1 = { start: new Date("2026-10-05"), end: new Date("2026-10-14") }; // 10 days (Monday to Wednesday)
      const p2 = { start: new Date("2026-11-02"), end: new Date("2026-11-11") }; // 10 days (Monday to Wednesday)
      expect(validateCltPeriods([p1, p2])).toContain("Pelo menos um período deve ter 14 dias ou mais");
    });
    it("rejects if total days exceed entitlement", () => {
      const p1 = { start: new Date("2026-10-05"), end: new Date("2026-10-23") }; // 19 days (Mon to Fri)
      expect(validateCltPeriods([p1], { existingDaysInCycle: 15, entitledDays: 30 })).toContain("Total do ciclo não pode ultrapassar 30 dias");
    });
  });

  describe("checkBlackoutPeriods", () => {
    const blackouts = [
      { startDate: new Date("2026-12-20"), endDate: new Date("2026-12-31"), reason: "Year end", department: null },
      { startDate: new Date("2026-06-01"), endDate: new Date("2026-06-15"), reason: "Launch", department: "IT" }
    ];

    it("returns error for global blackout", () => {
      const res = checkBlackoutPeriods(new Date("2026-12-25"), new Date("2027-01-05"), blackouts, "HR");
      expect(res).toContain("Year end");
    });

    it("returns error for department blackout", () => {
      const res = checkBlackoutPeriods(new Date("2026-06-05"), new Date("2026-06-10"), blackouts, "IT");
      expect(res).toContain("Launch");
    });

    it("ignores blackout for different department", () => {
      const res = checkBlackoutPeriods(new Date("2026-06-05"), new Date("2026-06-10"), blackouts, "Sales");
      expect(res).toBeNull();
    });
  });

  describe("isSaoPauloHoliday", () => {
    it("detects fixed holidays", () => {
      expect(isSaoPauloHoliday(new Date("2026-01-01"))).toBe(true);
      expect(isSaoPauloHoliday(new Date("2026-07-09"))).toBe(true);
    });
    it("detects movable holidays", () => {
      // 2026: Easter Apr 5, Good Friday Apr 3, Carnival Feb 17, Corpus Christi Jun 4
      expect(isSaoPauloHoliday(new Date("2026-04-03"))).toBe(true);
      expect(isSaoPauloHoliday(new Date("2026-02-17"))).toBe(true);
      expect(isSaoPauloHoliday(new Date("2026-06-04"))).toBe(true);
    });
    it("returns false for non-holidays", () => {
      expect(isSaoPauloHoliday(new Date("2026-05-15"))).toBe(false);
    });
  });
});
