import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TeamCalendar } from "@/components/calendar/TeamCalendar";
import type { TeamMemberInfoSerialized } from "@/components/times-view/types";

// Mock para evitar problemas com as datas dinâmicas de feriados se necessário
vi.mock("@/lib/holidaysApi", () => ({
  ensureNationalHolidaysLoaded: vi.fn().mockResolvedValue(true),
  isNationalHolidayCached: vi.fn().mockReturnValue(false),
}));

describe("TeamCalendar Component", () => {
  const mockMembers: TeamMemberInfoSerialized[] = [
    {
      user: { id: "coord-1", name: "Coordenador Teste", role: "COORDENADOR" },
      balance: { availableDays: 30, pendingDays: 0 },
      isOnVacationNow: false,
      requests: [
        {
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          status: "APROVADO_GERENTE",
          abono: false,
        }
      ],
      calendarRowKey: "coord-row",
      calendarIsBranch: true,
      calendarDisplayName: "COORDENADOR TESTE BRANCH",
    }
  ];

  it("should render vacation segments even for branch members (Coordinator bug fix)", () => {
    // Renderizamos o componente. Se o bug persistisse, as férias não estariam no HTML.
    // Use React.createElement instead of JSX
    const html = renderToStaticMarkup(React.createElement(TeamCalendar, { members: mockMembers }));
    
    // Verificamos se o nome aparece
    expect(html).toContain("COORDENADOR TESTE BRANCH");
    
    // Verificamos se existe algum marcador de férias (div com classes de cor de status)
    // O status APROVADO_GERENTE usa classes de emerald no CSS (border-emerald-500 bg-emerald-400/80)
    expect(html).toContain("border-emerald-500");
  });

  it("should render empty div only for branch members WITHOUT requests", () => {
    const membersNoRequests: TeamMemberInfoSerialized[] = [
      {
        ...mockMembers[0],
        user: { id: "branch-only", name: "Branch Only", role: "DIRETOR" },
        requests: [],
        calendarDisplayName: "DIRETORIA GERAL",
      }
    ];
    
    // Use React.createElement instead of JSX
    const html = renderToStaticMarkup(React.createElement(TeamCalendar, { members: membersNoRequests }));
    
    // Deve conter a div de ramificação vazia (com classes de fundo azul claro/slate)
    expect(html).toContain("bg-blue-50/5");
    // NÃO deve conter as classes de férias
    expect(html).not.toContain("border-emerald-500");
    expect(html).not.toContain("border-amber-400");
  });
});
