import { describe, it, expect, vi } from "vitest";
import {
  getManagerOptions,
  getDepartmentOptions,
  getTeamOptions,
  filterRequests,
  buildExportQuery,
  sliceHistoricoPage,
  buildHistoricoDashboardHref,
  HISTORICO_PAGE_SIZE,
} from "@/lib/dashboardFilters";

describe("getManagerOptions", () => {
  it("returns empty for role level < 4", () => {
    expect(getManagerOptions("COORDENADOR", [])).toEqual([]);
    expect(getManagerOptions("GERENTE", [{ user: { manager: { id: "g1", name: "Gerente" } } }])).toEqual([]);
  });

  it("returns unique managers for RH", () => {
    const requests = [
      { user: { manager: { id: "g1", name: "Gerente A" } } },
      { user: { manager: { id: "g1", name: "Gerente A" } } },
      { user: { manager: { id: "g2", name: "Gerente B" } } },
    ];
    expect(getManagerOptions("RH", requests)).toEqual([
      { id: "g1", name: "Gerente A" },
      { id: "g2", name: "Gerente B" },
    ]);
  });

  it("skips requests without manager", () => {
    const requests = [
      { user: {} },
      { user: { manager: { id: "g1", name: "G" } } },
    ];
    expect(getManagerOptions("RH", requests)).toEqual([{ id: "g1", name: "G" }]);
  });
});

describe("getDepartmentOptions", () => {
  it("returns sorted unique departments", () => {
    const requests = [
      { user: { department: "TI" } },
      { user: { department: "RH" } },
      { user: { department: "TI" } },
    ];
    expect(getDepartmentOptions(requests)).toEqual(["RH", "TI"]);
  });

  it("ignores null/undefined department", () => {
    const requests = [
      { user: { department: null } },
      { user: {} },
    ];
    expect(getDepartmentOptions(requests)).toEqual([]);
  });
});

describe("getTeamOptions", () => {
  it("returns sorted unique teams", () => {
    const requests = [
      { user: { team: "Design" } },
      { user: { team: "Plataforma" } },
      { user: { team: "Design" } },
      { user: { team: null } },
    ];
    expect(getTeamOptions(requests)).toEqual(["Design", "Plataforma"]);
  });
});

describe("filterRequests", () => {
  const baseReq = {
    userId: "f1",
    status: "PENDENTE",
    startDate: new Date("2026-06-01"),
    endDate: new Date("2026-06-14"),
    user: { managerId: "coord-1", manager: null, department: "TI", name: "João" },
  };

  it("keeps request visible to coord with inbox view", () => {
    const out = filterRequests("COORDENADOR", "coord-1", [baseReq], {
      view: "inbox",
      query: "",
      status: "TODOS",
      managerId: "",
      from: "",
      to: "",
      department: "",
    });
    expect(out).toHaveLength(1);
  });

  it("filters out request when user has no team visibility", () => {
    const out = filterRequests("COORDENADOR", "coord-999", [baseReq], {
      view: "inbox",
      query: "",
      status: "TODOS",
      managerId: "",
      from: "",
      to: "",
      department: "",
    });
    expect(out).toHaveLength(0);
  });

  it("filters by department", () => {
    const out = filterRequests("COORDENADOR", "coord-1", [baseReq], {
      view: "inbox",
      query: "",
      status: "TODOS",
      managerId: "",
      from: "",
      to: "",
      department: "Vendas",
    });
    expect(out).toHaveLength(0);
  });

  it("filters by team", () => {
    const out = filterRequests("COORDENADOR", "coord-1", [{ ...baseReq, user: { ...baseReq.user, team: "Design" } }], {
      view: "inbox",
      query: "",
      status: "TODOS",
      managerId: "",
      from: "",
      to: "",
      department: "",
      team: "Plataforma",
    });
    expect(out).toHaveLength(0);
  });

  it("filters by query (case-insensitive)", () => {
    const out = filterRequests("COORDENADOR", "coord-1", [baseReq], {
      view: "inbox",
      query: "jo",
      status: "TODOS",
      managerId: "",
      from: "",
      to: "",
      department: "",
    });
    expect(out).toHaveLength(1);
    const out2 = filterRequests("COORDENADOR", "coord-1", [baseReq], {
      view: "inbox",
      query: "maria",
      status: "TODOS",
      managerId: "",
      from: "",
      to: "",
      department: "",
    });
    expect(out2).toHaveLength(0);
  });

  it("filters by date range (from/to)", () => {
    const outFromTooLate = filterRequests("COORDENADOR", "coord-1", [baseReq], {
      view: "inbox",
      query: "",
      status: "TODOS",
      managerId: "",
      from: "2026-06-10",
      to: "",
      department: "",
    });
    expect(outFromTooLate).toHaveLength(0);

    const outToTooEarly = filterRequests("COORDENADOR", "coord-1", [baseReq], {
      view: "inbox",
      query: "",
      status: "TODOS",
      managerId: "",
      from: "",
      to: "2026-06-05",
      department: "",
    });
    expect(outToTooEarly).toHaveLength(0);
  });

  it("filters by view historico", () => {
    const out = filterRequests("COORDENADOR", "coord-1", [{ ...baseReq, status: "APROVADO_GERENTE" }], {
      view: "historico",
      query: "",
      status: "TODOS",
      managerId: "",
      from: "",
      to: "",
      department: "",
    });
    expect(out).toHaveLength(1);
  });

  it("filters by status", () => {
    const out = filterRequests("COORDENADOR", "coord-1", [baseReq], {
      view: "inbox",
      query: "",
      status: "APROVADO_COORDENADOR",
      managerId: "",
      from: "",
      to: "",
      department: "",
    });
    expect(out).toHaveLength(0);
  });

  it("RH with managerId filter excludes other managers", () => {
    const reqWithManager = {
      ...baseReq,
      user: { ...baseReq.user!, manager: { id: "ger-2", managerId: null } },
    };
    const out = filterRequests("RH", "rh-1", [reqWithManager], {
      view: "inbox",
      query: "",
      status: "TODOS",
      managerId: "ger-1",
      from: "",
      to: "",
      department: "",
    });
    expect(out).toHaveLength(0);
  });

  it("RH with managerId=ALL does not exclude", () => {
    const reqWithManager = {
      ...baseReq,
      status: "PENDENTE",
      user: { ...baseReq.user!, manager: { id: "ger-2", managerId: null } },
    };
    const out = filterRequests("RH", "rh-1", [reqWithManager], {
      view: "inbox",
      query: "",
      status: "TODOS",
      managerId: "ALL",
      from: "",
      to: "",
      department: "",
    });
    expect(out).toHaveLength(1);
  });

  it("RH inbox includes only PENDENTE", () => {
    const out = filterRequests("RH", "rh-1", [{ ...baseReq, status: "PENDENTE" }], {
      view: "inbox",
      query: "",
      status: "TODOS",
      managerId: "",
      from: "",
      to: "",
      department: "",
    });
    expect(out).toHaveLength(1);
  });

  it("RH inbox excludes non-awaited statuses (e.g. APROVADO_COORDENADOR)", () => {
    const out = filterRequests("RH", "rh-1", [{ ...baseReq, status: "APROVADO_COORDENADOR" }], {
      view: "inbox",
      query: "",
      status: "TODOS",
      managerId: "",
      from: "",
      to: "",
      department: "",
    });
    expect(out).toHaveLength(0);
  });

  it("view historico filters by processed statuses only", () => {
    const out = filterRequests("COORDENADOR", "coord-1", [{ ...baseReq, status: "REPROVADO" }], {
      view: "historico",
      query: "",
      status: "TODOS",
      managerId: "",
      from: "",
      to: "",
      department: "",
    });
    expect(out).toHaveLength(1);
  });

  it("orders historico: upcoming first by startDate, ended at the end", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-12T12:00:00.000Z"));

    const ended = {
      ...baseReq,
      status: "APROVADO_GERENTE",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-01-10T00:00:00.000Z"),
    };
    const upcomingLater = {
      ...baseReq,
      status: "APROVADO_GERENTE",
      startDate: new Date("2026-02-01T00:00:00.000Z"),
      endDate: new Date("2026-02-10T00:00:00.000Z"),
    };
    const upcomingSoon = {
      ...baseReq,
      status: "APROVADO_GERENTE",
      startDate: new Date("2026-01-15T00:00:00.000Z"),
      endDate: new Date("2026-01-20T00:00:00.000Z"),
    };

    const out = filterRequests("COORDENADOR", "coord-1", [ended, upcomingLater, upcomingSoon], {
      view: "historico",
      query: "",
      status: "TODOS",
      managerId: "",
      from: "",
      to: "",
      department: "",
    });

    // upcomingSoon (start 15) deve vir antes de upcomingLater (start 1/2),
    // e "ended" deve ficar no final.
    expect(out.map((r) => r.startDate.toISOString())).toEqual([
      upcomingSoon.startDate.toISOString(),
      upcomingLater.startDate.toISOString(),
      ended.startDate.toISOString(),
    ]);

    vi.useRealTimers();
  });

  it("orders historico by latest approved history changedAt", () => {
    const reqOlderApproval = {
      ...baseReq,
      status: "APROVADO_GERENTE",
      history: [{ newStatus: "APROVADO_COORDENADOR", changedAt: "2026-01-10T10:00:00Z" }],
    };
    const reqNewerApproval = {
      ...baseReq,
      userId: "f2",
      status: "APROVADO_GERENTE",
      history: [{ newStatus: "APROVADO_GERENTE", changedAt: "2026-01-20T10:00:00Z" }],
    };
    const out = filterRequests("COORDENADOR", "coord-1", [reqOlderApproval, reqNewerApproval], {
      view: "historico",
      query: "",
      status: "TODOS",
      managerId: "",
      from: "",
      to: "",
      department: "",
    });
    expect(out.map((r) => r.userId)).toEqual(["f2", "f1"]);
  });

  it("orders historico by generic changedAt when approvedAt tie", () => {
    const a = {
      ...baseReq,
      status: "APROVADO_GERENTE",
      history: [
        { newStatus: "APROVADO_GERENTE", changedAt: "2026-01-20T10:00:00Z" },
        { newStatus: "REPROVADO", changedAt: "2026-01-21T10:00:00Z" },
      ],
    };
    const b = {
      ...baseReq,
      userId: "f2",
      status: "APROVADO_GERENTE",
      history: [
        { newStatus: "APROVADO_GERENTE", changedAt: "2026-01-20T10:00:00Z" },
        { newStatus: "REPROVADO", changedAt: "2026-01-22T10:00:00Z" },
      ],
    };
    const out = filterRequests("COORDENADOR", "coord-1", [a, b], {
      view: "historico",
      query: "",
      status: "TODOS",
      managerId: "",
      from: "",
      to: "",
      department: "",
    });
    expect(out[0].userId).toBe("f2");
  });
});

describe("sliceHistoricoPage", () => {
  it("returns first page and correct totals", () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    const a = sliceHistoricoPage(items, 1);
    expect(a.items).toHaveLength(HISTORICO_PAGE_SIZE);
    expect(a.page).toBe(1);
    expect(a.totalPages).toBe(3);
    expect(a.totalItems).toBe(25);
  });

  it("clamps page to totalPages when too high", () => {
    const items = [1, 2, 3];
    const a = sliceHistoricoPage(items, 99);
    expect(a.page).toBe(1);
    expect(a.items).toEqual([1, 2, 3]);
  });

  it("page 2 slice", () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    const a = sliceHistoricoPage(items, 2);
    expect(a.items[0]).toBe(10);
    expect(a.items).toHaveLength(10);
  });
});

describe("buildHistoricoDashboardHref", () => {
  it("includes page when > 1", () => {
    const href = buildHistoricoDashboardHref(
      {
        query: "",
        status: "TODOS",
        view: "historico",
        managerId: "",
        from: "",
        to: "",
        department: "",
      },
      2,
    );
    expect(href).toContain("view=historico");
    expect(href).toContain("page=2");
  });

  it("includes team in dashboard href when provided", () => {
    const href = buildHistoricoDashboardHref(
      {
        query: "",
        status: "TODOS",
        view: "historico",
        managerId: "",
        from: "",
        to: "",
        department: "",
        team: "Design",
      },
      1,
    );
    expect(href).toContain("team=Design");
  });

  it("omits page on first page", () => {
    const href = buildHistoricoDashboardHref(
      {
        query: "ana",
        status: "TODOS",
        view: "historico",
        managerId: "",
        from: "",
        to: "",
        department: "",
      },
      1,
    );
    expect(href).not.toContain("page=");
    expect(href).toContain("q=ana");
  });
});

describe("buildExportQuery", () => {
  it("builds query string from filters", () => {
    const q = buildExportQuery({
      query: "test",
      status: "PENDENTE",
      view: "inbox",
      managerId: "g1",
      from: "2026-01-01",
      to: "2026-12-31",
      department: "TI",
      team: "Design",
    });
    const params = new URLSearchParams(q);
    expect(params.get("q")).toBe("test");
    expect(params.get("status")).toBe("PENDENTE");
    expect(params.get("view")).toBe("inbox");
    expect(params.get("managerId")).toBe("g1");
    expect(params.get("from")).toBe("2026-01-01");
    expect(params.get("to")).toBe("2026-12-31");
    expect(params.get("department")).toBe("TI");
    expect(params.get("team")).toBe("Design");
  });

  it("uses TODOS when status empty", () => {
    const q = buildExportQuery({
      query: "",
      status: "",
      view: "inbox",
      managerId: "",
      from: "",
      to: "",
      department: "",
    });
    expect(q).toContain("status=TODOS");
  });
});
