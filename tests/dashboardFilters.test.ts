import { describe, it, expect } from "vitest";
import {
  getManagerOptions,
  getDepartmentOptions,
  filterRequests,
  buildExportQuery,
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

  it("filters by view historico", () => {
    const out = filterRequests("COORDENADOR", "coord-1", [{ ...baseReq, status: "APROVADO_RH" }], {
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
    });
    const params = new URLSearchParams(q);
    expect(params.get("q")).toBe("test");
    expect(params.get("status")).toBe("PENDENTE");
    expect(params.get("view")).toBe("inbox");
    expect(params.get("managerId")).toBe("g1");
    expect(params.get("from")).toBe("2026-01-01");
    expect(params.get("to")).toBe("2026-12-31");
    expect(params.get("department")).toBe("TI");
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
