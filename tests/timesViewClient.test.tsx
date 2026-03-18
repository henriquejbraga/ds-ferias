import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { TeamMemberStatusBadge, type TeamMemberInfoSerialized } from "@/components/times-view-client";

function renderText(member: TeamMemberInfoSerialized): string {
  const html = renderToStaticMarkup(<TeamMemberStatusBadge member={member} />);
  return html.replace(/<[^>]+>/g, "");
}

const baseMember: TeamMemberInfoSerialized = {
  user: { id: "u1", name: "Colaborador Teste", role: "FUNCIONARIO", department: null, hireDate: null },
  balance: { availableDays: 0, pendingDays: 0, isOnVacationNow: false },
  isOnVacationNow: false,
  requests: [],
};

describe("TeamMemberStatusBadge", () => {
  it("shows 'Em férias' when isOnVacationNow is true", () => {
    const text = renderText({
      ...baseMember,
      isOnVacationNow: true,
    });
    expect(text).toContain("Em férias");
  });

  it("shows 'Férias marcadas' when there is a future approved request", () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    const text = renderText({
      ...baseMember,
      balance: { availableDays: 0, pendingDays: 0, isOnVacationNow: false },
      isOnVacationNow: false,
      requests: [
        {
          status: "APROVADO_RH",
          startDate: future.toISOString(),
          endDate: future.toISOString(),
          abono: false,
        },
      ],
    });
    expect(text).toContain("Férias marcadas");
  });

  it("shows 'Férias a tirar' when there is balance but no future request", () => {
    const text = renderText({
      ...baseMember,
      balance: { availableDays: 10, pendingDays: 0, isOnVacationNow: false },
      isOnVacationNow: false,
      requests: [],
    });
    expect(text).toContain("Férias a tirar");
    expect(text).toContain("10 dias");
  });

  it("shows 'Não está de férias e não tem férias a tirar' when no balance and no requests", () => {
    const text = renderText(baseMember);
    expect(text).toContain("Não está de férias e não tem férias a tirar");
  });
});

