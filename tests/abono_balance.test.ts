import { describe, it, expect } from "vitest";
import { calculateVacationBalance } from "@/lib/vacationRules";

describe("Vacation Balance with Abono", () => {
  it("should consume 30 days when requesting 20 days with abono (1/3 sold)", () => {
    const hireDate = new Date();
    hireDate.setFullYear(hireDate.getFullYear() - 2); // 2 years worked
    
    const requests = [
      {
        startDate: new Date("2026-04-01"),
        endDate: new Date("2026-04-20"), // 20 days of rest
        status: "APROVADO_GERENTE",
        abono: true, // +10 days sold = 30 total
      }
    ];
    
    const balance = calculateVacationBalance(hireDate, requests, new Date("2026-05-01"));
    
    // In one cycle (30 days), if he sold 10 and took 20, he should have 0 left.
    // entitledDays should be 60 (2 periods), used should be 30.
    expect(balance.usedDays).toBe(30);
    expect(balance.availableDays).toBe(30); // 60 - 30 = 30 remaining for the other period
  });

  it("should NOT consume extra days when abono is false", () => {
    const hireDate = new Date();
    hireDate.setFullYear(hireDate.getFullYear() - 2);
    
    const requests = [
      {
        startDate: new Date("2026-04-01"),
        endDate: new Date("2026-04-20"), // 20 days
        status: "APROVADO_GERENTE",
        abono: false,
      }
    ];
    
    const balance = calculateVacationBalance(hireDate, requests, new Date("2026-05-01"));
    expect(balance.usedDays).toBe(20);
  });
});
