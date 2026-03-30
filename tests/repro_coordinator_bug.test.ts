import { describe, it, expect } from "vitest";
import { buildRhDirectorateCalendarMembers } from "@/components/times-view/buildRhCalendarMembers";
import type { TeamMemberInfoSerialized } from "@/components/times-view/types";

describe("buildRhDirectorateCalendarMembers coordinator bug repro", () => {
  it("should show coordinator's vacations in a dedicated user row under coordination branch", () => {
    const mockCoordinator: TeamMemberInfoSerialized = {
      user: { id: "coord-1", name: "Coordinator User", role: "COORDENADOR" },
      balance: { availableDays: 30, pendingDays: 0 },
      isOnVacationNow: false,
      requests: [
        {
          startDate: "2026-04-01T00:00:00.000Z",
          endDate: "2026-04-15T00:00:00.000Z",
          status: "APROVADO_GERENTE",
          abono: false,
        }
      ],
    };

    const gerentes = [
      {
        gerenteId: "ger-1",
        gerenteName: "Manager User",
        teams: [
          {
            coordinatorId: "coord-1",
            coordinatorName: "Coordinator User",
            teamKey: "team-1",
            teamName: "Team One",
            members: [
              {
                user: { id: "member-1", name: "Member One", role: "FUNCIONARIO" },
                balance: { availableDays: 30, pendingDays: 0 },
                isOnVacationNow: false,
                requests: [],
              }
            ],
          }
        ],
        coordinatorMembers: [mockCoordinator],
      }
    ];

    const result = buildRhDirectorateCalendarMembers(gerentes as any);

    const branchRow = result.find(m => m.calendarRowKey?.includes("coord-branch-coord-1"));
    const userRow = result.find(m => m.calendarRowKey?.includes("coord-member-coord-1"));

    expect(branchRow).toBeDefined();
    expect(branchRow?.calendarIsBranch).toBe(true);
    expect(branchRow?.requests.length).toBe(0);

    expect(userRow).toBeDefined();
    expect(userRow?.calendarIsBranch).not.toBe(true);
    expect(userRow?.requests.length).toBeGreaterThan(0);
  });
});
