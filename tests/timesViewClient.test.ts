import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { TeamMemberStatusBadge, type TeamMemberInfoSerialized } from "@/components/times-view-client";

function renderText(member: TeamMemberInfoSerialized): string {
  // Using React.createElement instead of JSX to allow .ts extension
  const html = renderToStaticMarkup(React.createElement(TeamMemberStatusBadge, { member }));
  return html.replace(/<[^>]+>/g, "");
}

const baseMember: TeamMemberInfoSerialized = {
  user: { id: "u1", name: "Colaborador Teste", role: "FUNCIONARIO", department: null, hireDate: null },
  balance: { availableDays: 0, pendingDays: 0, isOnVacationNow: false },
  isOnVacationNow: false,
  requests: [],
};

describe("TeamMemberStatusBadge", () => {
  it("shows 'Em férias' when isOnVacationNow is true (DEPRECATED - now returns null in Times View)", () => {
    const text = renderText({
      ...baseMember,
      isOnVacationNow: true,
    });
    expect(text).toBe("");
  });

  it("shows 'Férias marcadas' when there is a future approved request (DEPRECATED - now returns null in Times View)", () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    const text = renderText({
      ...baseMember,
      balance: { availableDays: 0, pendingDays: 0, isOnVacationNow: false },
      isOnVacationNow: false,
      requests: [
        {
          status: "APROVADO_GERENTE",
          startDate: future.toISOString(),
          endDate: future.toISOString(),
          abono: false,
        },
      ],
    });
    expect(text).toBe("");
  });

  it("shows both 'Pendente' and 'Férias marcadas' when both exist in future (DEPRECATED - now returns null in Times View)", () => {
    const futureApproved = new Date();
    futureApproved.setDate(futureApproved.getDate() + 10);
    const futurePending = new Date();
    futurePending.setDate(futurePending.getDate() + 20);

    const text = renderText({
      ...baseMember,
      requests: [
        {
          status: "APROVADO_GERENTE",
          startDate: futureApproved.toISOString(),
          endDate: futureApproved.toISOString(),
          abono: false,
        },
        {
          status: "PENDENTE",
          startDate: futurePending.toISOString(),
          endDate: futurePending.toISOString(),
          abono: false,
        },
      ],
    });

    expect(text).toBe("");
  });

  it("hides 'Férias marcadas' when employee already took vacation (DEPRECATED - now returns null in Times View)", () => {
    const pastApprovedStart = new Date();
    pastApprovedStart.setDate(pastApprovedStart.getDate() - 30);
    const pastApprovedEnd = new Date();
    pastApprovedEnd.setDate(pastApprovedEnd.getDate() - 20);
    const futureApproved = new Date();
    futureApproved.setDate(futureApproved.getDate() + 10);

    const text = renderText({
      ...baseMember,
      requests: [
        {
          status: "APROVADO_GERENTE",
          startDate: pastApprovedStart.toISOString(),
          endDate: pastApprovedEnd.toISOString(),
          abono: false,
        },
        {
          status: "APROVADO_GERENTE",
          startDate: futureApproved.toISOString(),
          endDate: futureApproved.toISOString(),
          abono: false,
        },
      ],
    });

    expect(text).toBe("");
  });

  it("shows 'Férias a tirar' when there is balance but no future request (DEPRECATED - now returns null in Times View)", () => {
    const text = renderText({
      ...baseMember,
      balance: { availableDays: 10, pendingDays: 0, isOnVacationNow: false },
      isOnVacationNow: false,
      requests: [],
    });
    expect(text).toBe("");
  });

  it("shows 'Não está de férias e não tem férias a tirar' when no balance and no requests (DEPRECATED - now returns null in Times View)", () => {
    const text = renderText(baseMember);
    expect(text).toBe("");
  });
});
