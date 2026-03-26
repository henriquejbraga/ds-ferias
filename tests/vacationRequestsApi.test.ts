import { describe, expect, it } from "vitest";
import { buildInclusiveOverlapConditions, hasInternalOverlapInDateRanges } from "@/lib/validation";

describe("buildInclusiveOverlapConditions", () => {
  it("gera condições inclusivas para bloquear conflito no mesmo dia", () => {
    const start = new Date("2026-04-10T00:00:00.000Z");
    const end = new Date("2026-04-15T00:00:00.000Z");

    const conditions = buildInclusiveOverlapConditions(start, end);

    expect(conditions).toEqual([
      { startDate: { lte: end } },
      { endDate: { gte: start } },
    ]);
  });
});

describe("hasInternalOverlapInDateRanges", () => {
  it("retorna true quando dois períodos se sobrepõem no mesmo payload", () => {
    const overlappingRanges = [
      {
        start: new Date("2026-05-10T00:00:00.000Z"),
        end: new Date("2026-05-15T00:00:00.000Z"),
      },
      {
        start: new Date("2026-05-15T00:00:00.000Z"),
        end: new Date("2026-05-20T00:00:00.000Z"),
      },
    ];

    expect(hasInternalOverlapInDateRanges(overlappingRanges)).toBe(true);
  });

  it("retorna false quando os períodos são distintos", () => {
    const nonOverlappingRanges = [
      {
        start: new Date("2026-06-01T00:00:00.000Z"),
        end: new Date("2026-06-05T00:00:00.000Z"),
      },
      {
        start: new Date("2026-06-06T00:00:00.000Z"),
        end: new Date("2026-06-10T00:00:00.000Z"),
      },
    ];

    expect(hasInternalOverlapInDateRanges(nonOverlappingRanges)).toBe(false);
  });
});
