import { describe, it, expect } from "vitest";
import { buildRhDirectorateCalendarMembers } from "@/components/times-view/buildRhCalendarMembers";
import type { TeamMemberInfoSerialized } from "@/components/times-view/types";

describe("buildRhDirectorateCalendarMembers coordinator bug repro", () => {
  it("should show coordinator's vacations even when they are a branch", () => {
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

    const coordRow = result.find(m => m.user.id === "coord-1" || (m.calendarRowKey && m.calendarRowKey.includes("coord-branch-coord-1")));
    
    expect(coordRow).toBeDefined();
    expect(coordRow?.requests.length).toBeGreaterThan(0);
    expect(coordRow?.calendarIsBranch).toBe(true);
    
    // The bug is that when calendarIsBranch is true, TeamCalendar.tsx doesn't render segments.
    // So if the coordinator row IS a branch, it must either:
    // 1. Not be a branch (but then how to have children?)
    // 2. Or TeamCalendar.tsx must render segments for branches that have requests.
  });
});
