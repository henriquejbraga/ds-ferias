import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SidebarBalance } from "@/components/dashboard/sidebar-balance";
import type { VacationBalance } from "@/lib/vacationRules";

function renderText(balance: VacationBalance, userRole?: string): string {
  const html = renderToStaticMarkup(React.createElement(SidebarBalance, { balance, userRole }));
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function renderTextWithPeriods(
  balance: VacationBalance,
  acquisitionPeriods: Array<{ accruedDays: number; usedDays: number }>,
  userRole?: string,
): string {
  const html = renderToStaticMarkup(
    React.createElement(SidebarBalance, { balance, userRole, acquisitionPeriods }),
  );
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const entitledBalance: VacationBalance = {
  entitledDays: 30,
  usedDays: 0,
  pendingDays: 0,
  availableDays: 30,
  cycleYear: 2026,
  hasEntitlement: true,
  monthsWorked: 24,
};

describe("SidebarBalance", () => {
  it("shows simplified business-days view for GERENTE", () => {
    const text = renderText(
      {
        ...entitledBalance,
        usedDays: 0,
        pendingDays: 8,
        availableDays: 22,
      },
      "GERENTE",
    );

    expect(text).toContain("14 dias úteis");
    expect(text).toContain("Usados 0 de 22 úteis");
    expect(text).toContain("Solicitados aguardando aprovação: 8");
  });

  it("clamps pending to cycle limit for DIRETOR", () => {
    const text = renderText(
      {
        ...entitledBalance,
        usedDays: 0,
        pendingDays: 40,
        availableDays: 0,
      },
      "DIRETOR",
    );

    expect(text).toContain("0 dias úteis");
    expect(text).toContain("Usados 0 de 22 úteis");
    expect(text).toContain("Solicitados aguardando aprovação: 22");
  });

  it("shows standard cycle view for FUNCIONARIO", () => {
    const text = renderText({
      ...entitledBalance,
      usedDays: 5,
      pendingDays: 3,
      availableDays: 22,
    });

    expect(text).toContain("22 dias");
    expect(text).toContain("Usados 5 de 30 na janela atual");
    expect(text).toContain("Solicitados aguardando aprovação: 3");
  });

  it("clamps used display to total limit to avoid growth confusion", () => {
    const text = renderText({
      ...entitledBalance,
      entitledDays: 60,
      usedDays: 120,
      pendingDays: 0,
      availableDays: 0,
    });

    expect(text).toContain("Usados 60 de 60 na janela atual");
  });

  it("removes fully consumed cycles from side balance window", () => {
    const text = renderTextWithPeriods(
      {
        ...entitledBalance,
        entitledDays: 60,
        usedDays: 60,
        pendingDays: 0,
        availableDays: 0,
      },
      [
        { accruedDays: 30, usedDays: 30 },
        { accruedDays: 30, usedDays: 30 },
      ],
    );
    expect(text).toContain("0 dias");
    expect(text).toContain("Usados 0 de 0 na janela atual");
  });
});

