import { describe, it, expect } from "vitest";
import {
  buildManagedRequestsWhere,
  filterRequestsByVisibilityAndView,
} from "@/lib/requestVisibility";

describe("buildManagedRequestsWhere", () => {
  it("returns empty where for level 1 (colaborador not used in practice)", () => {
    const where = buildManagedRequestsWhere("user-1", "FUNCIONARIO", {});
    expect(where).toEqual({});
  });

  it("adds status when filter provided", () => {
    const where = buildManagedRequestsWhere("user-1", "RH", { status: "PENDENTE" });
    expect(where.status).toBe("PENDENTE");
  });

  it("ignores TODOS status", () => {
    const where = buildManagedRequestsWhere("user-1", "RH", { status: "TODOS" });
    expect(where.status).toBeUndefined();
  });

  it("adds user name contains for query", () => {
    const where = buildManagedRequestsWhere("user-1", "RH", { query: "  João  " });
    expect(where.user).toEqual({ name: { contains: "João", mode: "insensitive" } });
  });

  it("adds department when filter provided", () => {
    const where = buildManagedRequestsWhere("user-1", "RH", { department: "TI" });
    expect(where.user).toEqual({ department: "TI" });
  });

  it("level 2 (coordenador): filters by managerId", () => {
    const where = buildManagedRequestsWhere("coord-1", "COORDENADOR", {});
    expect(where.user).toEqual({ managerId: "coord-1" });
  });

  it("level 2 with query: merges user conditions", () => {
    const where = buildManagedRequestsWhere("coord-1", "COORDENADOR", { query: "Maria" });
    expect(where.user).toMatchObject({ managerId: "coord-1", name: { contains: "Maria", mode: "insensitive" } });
  });

  it("level 2 with query and department: merges all into user", () => {
    const where = buildManagedRequestsWhere("coord-1", "COORDENADOR", { query: "Maria", department: "TI" });
    expect(where.user).toMatchObject({
      managerId: "coord-1",
      name: { contains: "Maria", mode: "insensitive" },
      department: "TI",
    });
  });

  it("level 3 (gerente) with existing user filter: uses AND with base", () => {
    const where = buildManagedRequestsWhere("ger-1", "GERENTE", { department: "TI" });
    expect(where.AND).toBeDefined();
    expect(where.AND).toHaveLength(2);
    expect((where.AND as unknown[])[1]).toMatchObject({ user: { department: "TI" } });
  });

  it("level 3 (gerente): uses OR for direct and indirect reports", () => {
    const where = buildManagedRequestsWhere("ger-1", "GERENTE", {});
    expect(where.AND).toBeDefined();
    expect(where.AND).toHaveLength(1);
    expect((where.AND as unknown[])[0]).toMatchObject({
      OR: [
        { user: { managerId: "ger-1" } },
        { user: { manager: { managerId: "ger-1" } } },
      ],
    });
  });
});

describe("filterRequestsByVisibilityAndView", () => {
  const baseRequest = {
    userId: "func-1",
    status: "PENDENTE",
    startDate: new Date("2026-06-01"),
    endDate: new Date("2026-06-14"),
    user: { name: "João", managerId: "coord-1", department: "TI", manager: null },
  };

  it("filters out request when coord has no team visibility", () => {
    const list = filterRequestsByVisibilityAndView(
      "COORDENADOR",
      "coord-1",
      [{ ...baseRequest, user: { ...baseRequest.user!, managerId: "other-coord", manager: null } }],
      { view: "inbox" }
    );
    expect(list).toHaveLength(0);
  });

  it("keeps request when coord has team visibility and inbox view", () => {
    const list = filterRequestsByVisibilityAndView(
      "COORDENADOR",
      "coord-1",
      [{ ...baseRequest }],
      { view: "inbox" }
    );
    expect(list).toHaveLength(1);
  });

  it("filters out PENDENTE for coord in inbox (only PENDENTE shown)", () => {
    const list = filterRequestsByVisibilityAndView(
      "COORDENADOR",
      "coord-1",
      [{ ...baseRequest, status: "APROVADO_COORDENADOR" }],
      { view: "inbox" }
    );
    expect(list).toHaveLength(0);
  });

  it("historico view: only processed statuses", () => {
    const list = filterRequestsByVisibilityAndView(
      "COORDENADOR",
      "coord-1",
      [
        { ...baseRequest, status: "APROVADO_RH" },
        { ...baseRequest, status: "PENDENTE", userId: "f2" },
      ],
      { view: "historico" }
    );
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe("APROVADO_RH");
  });

  it("RH with managerId filter", () => {
    const reqWithManager = {
      ...baseRequest,
      status: "APROVADO_GERENTE",
      user: { ...baseRequest.user!, manager: { id: "ger-1", managerId: null } },
    };
    const list = filterRequestsByVisibilityAndView(
      "RH",
      "rh-1",
      [reqWithManager],
      { view: "inbox", managerId: "ger-1" }
    );
    expect(list).toHaveLength(1);
  });

  it("filters by from/to date", () => {
    const list = filterRequestsByVisibilityAndView(
      "COORDENADOR",
      "coord-1",
      [{ ...baseRequest, startDate: new Date("2026-05-01"), endDate: new Date("2026-05-14") }],
      { view: "inbox", from: "2026-06-01", to: "2026-12-31" }
    );
    expect(list).toHaveLength(0);
  });

  it("filters by query (name)", () => {
    const list = filterRequestsByVisibilityAndView(
      "COORDENADOR",
      "coord-1",
      [{ ...baseRequest, user: { ...baseRequest.user!, name: "Maria" } }],
      { view: "inbox", query: "João" }
    );
    expect(list).toHaveLength(0);
  });

  it("filters by status", () => {
    const list = filterRequestsByVisibilityAndView(
      "COORDENADOR",
      "coord-1",
      [{ ...baseRequest, status: "APROVADO_COORDENADOR" }],
      { view: "historico", status: "APROVADO_RH" }
    );
    expect(list).toHaveLength(0);
  });

  it("RH inbox sees approvals pendentes para RH (APROVADO_COORDENADOR / GERENTE)", () => {
    const requests = [
      { ...baseRequest, status: "APROVADO_COORDENADOR" as const },
      { ...baseRequest, status: "APROVADO_GERENTE" as const },
      { ...baseRequest, status: "PENDENTE" as const },
    ];

    const list = filterRequestsByVisibilityAndView("RH", "rh-1", requests, { view: "inbox" });
    const statuses = list.map((r) => r.status);

    expect(statuses).toContain("APROVADO_COORDENADOR");
    expect(statuses).toContain("APROVADO_GERENTE");
    expect(statuses).not.toContain("PENDENTE");
  });
});
