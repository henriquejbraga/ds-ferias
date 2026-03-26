import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindMany = vi.fn().mockResolvedValue([]);
const mockFindUnique = vi.fn().mockResolvedValue(null);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

import {
  canIndirectLeaderActWhenDirectOnVacation,
  filterManagedRequestsForIndirectLeaders,
  wasSubmittedDuringLeaderApprovedVacation,
} from "@/lib/indirectLeaderRule";

describe("wasSubmittedDuringLeaderApprovedVacation", () => {
  it("returns true when creation date is inside approved vacation", () => {
    const out = wasSubmittedDuringLeaderApprovedVacation(
      [
        {
          startDate: new Date("2026-03-10T00:00:00Z"),
          endDate: new Date("2026-03-20T00:00:00Z"),
          status: "APROVADO_GERENTE",
          abono: false,
        },
      ],
      new Date("2026-03-15T10:00:00Z"),
    );
    expect(out).toBe(true);
  });

  it("respects abono adjustment by removing 10 days from end", () => {
    const out = wasSubmittedDuringLeaderApprovedVacation(
      [
        {
          startDate: new Date("2026-03-01T00:00:00Z"),
          endDate: new Date("2026-03-30T00:00:00Z"),
          status: "APROVADO_GERENTE",
          abono: true,
        },
      ],
      new Date("2026-03-25T00:00:00Z"),
    );
    expect(out).toBe(false);
  });

  it("ignores non-approved statuses and undefined vacations", () => {
    expect(
      wasSubmittedDuringLeaderApprovedVacation(
        [
          {
            startDate: new Date("2026-03-01T00:00:00Z"),
            endDate: new Date("2026-03-30T00:00:00Z"),
            status: "PENDENTE",
            abono: false,
          },
        ],
        new Date("2026-03-15T00:00:00Z"),
      ),
    ).toBe(false);
    expect(wasSubmittedDuringLeaderApprovedVacation(undefined, new Date("2026-03-15T00:00:00Z"))).toBe(false);
  });
});

describe("filterManagedRequestsForIndirectLeaders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
  });

  it("keeps direct reports and only allowed indirect requests", async () => {
    const requests = [
      {
        id: "direct",
        createdAt: new Date("2026-03-10T00:00:00Z"),
        user: { managerId: "ger-1", manager: { managerId: "dir-1" } },
      },
      {
        id: "indirect-allowed",
        createdAt: new Date("2026-03-12T00:00:00Z"),
        user: { managerId: "coord-1", manager: { managerId: "ger-1" } },
      },
      {
        id: "indirect-blocked",
        createdAt: new Date("2026-03-25T00:00:00Z"),
        user: { managerId: "coord-1", manager: { managerId: "ger-1" } },
      },
      {
        id: "outside-scope",
        createdAt: new Date("2026-03-12T00:00:00Z"),
        user: { managerId: "coord-x", manager: { managerId: "other" } },
      },
    ];
    mockFindMany.mockResolvedValueOnce([
      {
        id: "coord-1",
        vacationRequests: [
          {
            startDate: new Date("2026-03-01T00:00:00Z"),
            endDate: new Date("2026-03-20T00:00:00Z"),
            status: "APROVADO_GERENTE",
            abono: false,
          },
        ],
      },
    ]);

    const out = await filterManagedRequestsForIndirectLeaders("ger-1", requests as any[]);
    expect(out.map((r: any) => r.id)).toEqual(["direct", "indirect-allowed"]);
    expect(mockFindMany).toHaveBeenCalledTimes(1);
  });

  it("skips lookup when there are no indirect leaders to resolve", async () => {
    const out = await filterManagedRequestsForIndirectLeaders("ger-1", [
      { id: "direct", createdAt: new Date(), user: { managerId: "ger-1", manager: { managerId: "dir-1" } } },
    ] as any[]);
    expect(out).toHaveLength(1);
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});

describe("canIndirectLeaderActWhenDirectOnVacation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue(null);
  });

  it("returns false without direct leader or manager mismatch", async () => {
    await expect(
      canIndirectLeaderActWhenDirectOnVacation({
        approverId: "ger-1",
        directLeaderId: null,
        directLeaderManagerId: "ger-1",
        requestCreatedAt: new Date("2026-03-10T00:00:00Z"),
      }),
    ).resolves.toBe(false);

    await expect(
      canIndirectLeaderActWhenDirectOnVacation({
        approverId: "ger-1",
        directLeaderId: "coord-1",
        directLeaderManagerId: "other",
        requestCreatedAt: new Date("2026-03-10T00:00:00Z"),
      }),
    ).resolves.toBe(false);

    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("returns true when leader was on approved vacation at submission time", async () => {
    mockFindUnique.mockResolvedValueOnce({
      vacationRequests: [
        {
          startDate: new Date("2026-03-01T00:00:00Z"),
          endDate: new Date("2026-03-30T00:00:00Z"),
          status: "APROVADO_COORDENADOR",
          abono: false,
        },
      ],
    });
    const out = await canIndirectLeaderActWhenDirectOnVacation({
      approverId: "ger-1",
      directLeaderId: "coord-1",
      directLeaderManagerId: "ger-1",
      requestCreatedAt: new Date("2026-03-10T00:00:00Z"),
    });
    expect(out).toBe(true);
    expect(mockFindUnique).toHaveBeenCalledTimes(1);
  });
});
