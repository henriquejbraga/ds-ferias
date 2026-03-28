import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const resendSendMock = vi.fn();

// Mock do Resend ANTES dos imports do código
vi.mock("resend", () => {
  return {
    Resend: class {
      emails = {
        send: resendSendMock,
      };
    },
  };
});

import {
  notify,
  notifyNewRequest,
  notifyApproved,
  notifyRejected,
  notifyUpcomingVacationReminder,
  notifyReturnToWorkReminder,
} from "@/lib/notifications";
import { logger } from "@/lib/logger";

describe("notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resendSendMock.mockResolvedValue({ data: { id: "mail_123" }, error: null });
    process.env.NOTIFY_PROVIDER = "resend";
    process.env.NODE_ENV = "production";
    process.env.MAIL_FROM = "Ferias <ferias@empresa.com>";
    process.env.RESEND_API_KEY = "re_test";
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("logs event in development mode", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    process.env.NODE_ENV = "development";
    
    await notifyNewRequest({
      requestId: "r1", userName: "U", userEmail: "u@e.com", managerEmail: "m@e.com",
      startDate: new Date(), endDate: new Date(),
    });

    expect(logSpy).toHaveBeenCalledWith("[notify]", "NEW_REQUEST", expect.any(Object));
  });

  it("notifies new request via Resend", async () => {
    await notifyNewRequest({
      requestId: "r1", userName: "Colab 1", userEmail: "colab1@empresa.com", managerEmail: "gestor1@empresa.com",
      startDate: new Date("2026-10-01T12:00:00Z"), endDate: new Date("2026-10-15T12:00:00Z"),
    });

    expect(resendSendMock).toHaveBeenCalled();
    const args = resendSendMock.mock.calls[0][0];
    expect(args.to).toEqual(["gestor1@empresa.com"]);
  });

  it("notifies approved vacation with all details", async () => {
    await notifyApproved({
      requestId: "r1", userName: "Colab 1", userEmail: "colab1@empresa.com",
      approverName: "Gestor 1", status: "APROVADO_RH",
      toEmails: ["gestor1@empresa.com", "colab1@empresa.com"],
      startDate: new Date("2026-10-01T12:00:00Z"),
      endDate: new Date("2026-10-15T12:00:00Z"),
      returnDate: new Date("2026-10-16T12:00:00Z"),
      abono: true, thirteenth: true,
    });

    const args = resendSendMock.mock.calls[0][0];
    expect(args.subject).toBe("Férias aprovadas - Colab 1 (2026-10-01 a 2026-10-15)");
    expect(args.html).toContain("Colab 1");
    expect(args.to).toEqual(["gestor1@empresa.com", "colab1@empresa.com"]);
  });

  it("notifies rejected request", async () => {
    await notifyRejected({
      requestId: "r1", userName: "Colab 1", userEmail: "colab1@empresa.com",
      approverName: "Gestor 1", note: "Saldo insuficiente",
    });

    expect(resendSendMock).toHaveBeenCalled();
    const args = resendSendMock.mock.calls[0][0];
    expect(args.to).toEqual(["colab1@empresa.com"]);
  });

  it("sends upcoming vacation reminder", async () => {
    process.env.REMINDER_CHANNELS = "email";
    
    await notifyUpcomingVacationReminder({
      requestId: "r1", userName: "Colab 1", userEmail: "colab1@empresa.com",
      managerName: "Gestor 1", managerEmail: "gestor1@empresa.com",
      toEmails: ["gestor1@empresa.com", "colab1@empresa.com"],
      startDate: new Date("2026-10-01"), endDate: new Date("2026-10-15"),
      daysUntilStart: 5, abono: false, thirteenth: false,
    });

    const args = resendSendMock.mock.calls[0][0];
    expect(args.to).toEqual(["gestor1@empresa.com", "colab1@empresa.com"]);
  });

  it("obfuscates emails in logs", async () => {
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => {});

    await notifyNewRequest({
      requestId: "r-log-1", userName: "U1", userEmail: "colaborador@test.com", managerEmail: "gestor@test.com",
      startDate: new Date("2026-10-01T12:00:00Z"), endDate: new Date("2026-10-10T12:00:00Z"),
    });

    const logCall = infoSpy.mock.calls.find(call => call[1]?.to && typeof call[1].to === "string");
    expect(logCall).toBeDefined();
    const loggedEmail = logCall![1].to;
    expect(loggedEmail).toContain("ge****@test.com");
  });

  it("logs error when resend fails with error object", async () => {
    resendSendMock.mockResolvedValueOnce({ data: null, error: { message: "API Error" } });
    const errSpy = vi.spyOn(logger, "error").mockImplementation(() => {});

    await notifyApproved({
      requestId: "r-resend-fail", userName: "U", userEmail: "u@e.com", approverName: "A", status: "APROVADO_GERENTE",
      toEmails: ["u@e.com"], startDate: new Date(), endDate: new Date(), returnDate: new Date(),
      abono: false, thirteenth: false,
    });

    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("resend error"), expect.any(Object));
  });

  it("sends both email and slack reminders when configured", async () => {
    process.env.REMINDER_CHANNELS = "email,slack";
    process.env.SLACK_WEBHOOK_URL = "https://slack.test/webhook";
    const fetchSpy = vi.spyOn(globalThis, "fetch" as any).mockResolvedValue({ ok: true } as any);

    await notifyUpcomingVacationReminder({
      requestId: "r-both", userName: "U", userEmail: "u@e.com", managerName: "M", managerEmail: "m@e.com",
      toEmails: ["m@e.com"], startDate: new Date(), endDate: new Date(), daysUntilStart: 3,
      abono: true, thirteenth: true,
    });

    expect(resendSendMock).toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalled();
  });

  it("handles 'none' provider", async () => {
    process.env.NOTIFY_PROVIDER = "none";
    const fetchSpy = vi.spyOn(globalThis, "fetch" as any);
    await notifyApproved({
      requestId: "r-none-prov", userName: "U", userEmail: "u@e.com", approverName: "A", status: "APROVADO_GERENTE",
      toEmails: ["a@e.com"], startDate: new Date(), endDate: new Date(), returnDate: new Date(),
      abono: false, thirteenth: false,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(resendSendMock).not.toHaveBeenCalled();
  });
});
