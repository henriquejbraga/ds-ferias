import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/notifications/vacation-reminders/route";
import { prisma } from "@/lib/prisma";
import * as notifications from "@/lib/notifications";
import { computeReturnDate } from "@/lib/vacationRules";

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
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-secret");
    
    // Fixamos o "hoje" para os cálculos baterem com a rota
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T10:00:00Z"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("should find and notify vacations starting soon (1 and 7 days)", async () => {
    const today = new Date("2026-04-01T00:00:00Z");
    const start1d = new Date(today.getTime() + 1 * ONE_DAY_MS);
    const start7d = new Date(today.getTime() + 7 * ONE_DAY_MS);

    vi.mocked(prisma.vacationRequest.findMany)
      .mockResolvedValueOnce([
        {
          id: "r1",
          startDate: start1d,
          endDate: new Date(start1d.getTime() + 10 * ONE_DAY_MS),
          abono: false,
          user: { name: "U1", email: "u1@e.com", manager: { name: "M1", email: "m1@e.com" } },
        },
        {
          id: "r7",
          startDate: start7d,
          endDate: new Date(start7d.getTime() + 10 * ONE_DAY_MS),
          abono: false,
          user: { name: "U7", email: "u7@e.com", manager: { name: "M1", email: "m1@e.com" } },
        }
      ] as any) // start reminders
      .mockResolvedValueOnce([]); // return reminders

    const request = new Request("http://localhost/api/notifications/vacation-reminders", {
      headers: { "x-cron-secret": "test-secret" }
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.startReminder.sent).toBe(2);
    expect(notifications.notifyUpcomingVacationReminder).toHaveBeenCalledTimes(2);
  });

  it("should find and notify return reminders (both normal and abono)", async () => {
    const today = new Date("2026-04-01T00:00:00Z");
    
    // 1. Caso Normal: Retorna amanhã (D+1). O endDate deve ser HOJE (D).
    // Na rota: returnTargetStart = D+1. computeReturnDate(endDate) deve bater com D+1.
    // normal computeReturnDate = endDate + 1. 
    // Se endDate = hoje, returnDate = hoje + 1 = amanhã. OK.
    const endNormal = new Date(today.getTime()); 
    const startNormal = new Date(today.getTime() - 10 * ONE_DAY_MS);

    // 2. Caso Abono: Retorna amanhã (D+1). Férias de 30 dias começaram em D-19.
    // endDate no banco = início + 29 dias = D-19 + 29 = D+10.
    // computeReturnDate(D+10, abono=true) = (D+10) - 9 dias = D+1 (amanhã). OK.
    const startAbono = new Date(today.getTime() - 19 * ONE_DAY_MS);
    const endAbono = new Date(startAbono.getTime() + 29 * ONE_DAY_MS);

    vi.mocked(prisma.vacationRequest.findMany)
      .mockResolvedValueOnce([]) // start reminders
      .mockResolvedValueOnce([
        {
          id: "r_normal",
          startDate: startNormal,
          endDate: endNormal,
          abono: false,
          user: { name: "UN", email: "un@e.com", manager: { name: "M1", email: "m1@e.com" } },
        },
        {
          id: "r_abono",
          startDate: startAbono,
          endDate: endAbono,
          abono: true,
          user: { name: "UA", email: "ua@e.com", manager: { name: "M1", email: "m1@e.com" } },
        }
      ] as any);

    const request = new Request("http://localhost/api/notifications/vacation-reminders", {
      headers: { "x-cron-secret": "test-secret" }
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.ok).toBe(true);
    // Verificamos se ambos foram enviados. 
    // Se found for 0, é porque não passaram no filtro computeReturnDate da rota.
    expect(data.returnReminder.sent).toBe(2);
    expect(notifications.notifyReturnToWorkReminder).toHaveBeenCalledTimes(2);
    
    // Verifica se a data de retorno do abono é amanhã
    const abonoCall = vi.mocked(notifications.notifyReturnToWorkReminder).mock.calls.find(c => c[0].userName === "UA");
    expect(abonoCall![0].returnDate.toISOString().slice(0, 10)).toBe("2026-04-02");
  });
});
