import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/notifications/vacation-reminders/route";
import { prisma } from "@/lib/prisma";
import * as notifications from "@/lib/notifications";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vacationRequest: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/notifications", () => ({
  notifyUpcomingVacationReminder: vi.fn().mockResolvedValue(undefined),
  notifyReturnToWorkReminder: vi.fn().mockResolvedValue(undefined),
}));

describe("Vacation Reminders Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should find and notify vacations starting in 1 and 7 days", async () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    const start7d = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const start1d = new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000);

    // Mocking findMany for start reminders - returning two records
    vi.mocked(prisma.vacationRequest.findMany).mockResolvedValueOnce([
      {
        id: "r7",
        startDate: start7d,
        endDate: new Date(start7d.getTime() + 10 * 24 * 60 * 60 * 1000),
        abono: false,
        thirteenth: false,
        user: {
          name: "User 7 Days",
          email: "user7@test.com",
          manager: { name: "Manager", email: "manager@test.com" },
        },
      },
      {
        id: "r1",
        startDate: start1d,
        endDate: new Date(start1d.getTime() + 10 * 24 * 60 * 60 * 1000),
        abono: true,
        thirteenth: false,
        user: {
          name: "User 1 Day",
          email: "user1@test.com",
          manager: { name: "Manager", email: "manager@test.com" },
        },
      }
    ] as any).mockResolvedValueOnce([]); // Empty for return reminders

    const request = new Request("http://localhost/api/notifications/vacation-reminders", {
      headers: { "x-cron-secret": "test-secret" }
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.startReminder.found).toBe(2);
    
    // Check call for 7 days
    expect(vi.mocked(notifications.notifyUpcomingVacationReminder)).toHaveBeenCalledWith(
      expect.objectContaining({
        userName: "User 7 Days",
        daysUntilStart: 7
      })
    );

    // Check call for 1 day
    expect(vi.mocked(notifications.notifyUpcomingVacationReminder)).toHaveBeenCalledWith(
      expect.objectContaining({
        userName: "User 1 Day",
        daysUntilStart: 1
      })
    );
  });

  it("should find and notify return to work reminder when vacation ends in 1 day", async () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    const end1d = new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000);

    // First call empty (no start reminders), second call with return reminder
    vi.mocked(prisma.vacationRequest.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "r_ret",
          startDate: new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000),
          endDate: end1d,
          user: {
            name: "Returning User",
            email: "return@test.com",
            manager: { name: "Manager", email: "manager@test.com" },
          },
        }
      ] as any);

    const request = new Request("http://localhost/api/notifications/vacation-reminders", {
      headers: { "x-cron-secret": "test-secret" }
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.returnReminder.found).toBe(1);
    
    expect(vi.mocked(notifications.notifyReturnToWorkReminder)).toHaveBeenCalledWith(
      expect.objectContaining({
        userName: "Returning User",
        returnDate: new Date(end1d.getTime() + 24 * 60 * 60 * 1000)
      })
    );
  });
});
