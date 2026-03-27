import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  notify,
  notifyNewRequest,
  notifyApproved,
  notifyRejected,
  notifyUpcomingVacationReminder,
  notifyReturnToWorkReminder,
} from "@/lib/notifications";
import { logger } from "@/lib/logger";

const resendSendMock = vi.fn().mockResolvedValue({ data: { id: "mail_123" }, error: null });

vi.mock("resend", () => {
  class ResendMock {
    emails = { send: resendSendMock };
  }
  return {
    Resend: ResendMock,
  };
});

describe("notifications", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    resendSendMock.mockClear();
    process.env = { ...originalEnv };
    // Garante que o provedor padrão seja 'both' para os testes
    delete process.env.NOTIFY_PROVIDER;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("does nothing when webhook is not configured", async () => {
    delete process.env.NOTIFY_WEBHOOK_URL;
    delete process.env.RESEND_API_KEY;
    delete process.env.MAIL_FROM;
    const fetchSpy = vi.spyOn(globalThis, "fetch" as any);
    await notify({
      type: "APPROVED",
      requestId: "r1",
      userName: "U",
      userEmail: "u@example.com",
      approverName: "A",
      status: "APROVADO_GERENTE",
      toEmails: ["a@example.com"],
      startDate: "2026-06-01",
      endDate: "2026-06-10",
      returnDate: "2026-06-11",
      abono: false,
      thirteenth: false,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("skips webhook when provider is resend only", async () => {
    process.env.NOTIFY_PROVIDER = "resend";
    process.env.NOTIFY_WEBHOOK_URL = "https://example.test/webhook";
    process.env.RESEND_API_KEY = "re_test";
    process.env.MAIL_FROM = "Ferias <ferias@empresa.com>";
    const fetchSpy = vi.spyOn(globalThis, "fetch" as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
    } as any);

    await notifyApproved({
      requestId: "r-provider-resend",
      userName: "User R",
      userEmail: "ur@example.com",
      approverName: "Leader",
      status: "APROVADO_GERENTE",
      toEmails: ["leader@example.com"],
      startDate: new Date("2026-08-01T12:00:00Z"),
      endDate: new Date("2026-08-10T12:00:00Z"),
      returnDate: new Date("2026-08-11T12:00:00Z"),
      abono: false,
      thirteenth: false,
    });

    expect(resendSendMock).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("skips resend when provider is webhook only", async () => {
    process.env.NOTIFY_PROVIDER = "webhook";
    process.env.NOTIFY_WEBHOOK_URL = "https://example.test/webhook";
    process.env.RESEND_API_KEY = "re_test";
    process.env.MAIL_FROM = "Ferias <ferias@empresa.com>";
    const fetchSpy = vi.spyOn(globalThis, "fetch" as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
    } as any);

    await notifyApproved({
      requestId: "r-provider-webhook",
      userName: "User W",
      userEmail: "uw@example.com",
      approverName: "Leader",
      status: "APROVADO_GERENTE",
      toEmails: ["leader@example.com"],
      startDate: new Date("2026-08-01T12:00:00Z"),
      endDate: new Date("2026-08-10T12:00:00Z"),
      returnDate: new Date("2026-08-11T12:00:00Z"),
      abono: false,
      thirteenth: false,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(resendSendMock).not.toHaveBeenCalled();
  });

  it("posts to webhook when configured (ok response)", async () => {
    process.env.NOTIFY_WEBHOOK_URL = "https://example.test/webhook";
    process.env.RESEND_API_KEY = "re_test";
    process.env.MAIL_FROM = "Ferias <ferias@empresa.com>";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch" as any)
      .mockResolvedValue({ ok: true, status: 200, text: async () => "" } as any);

    await notifyApproved({
      requestId: "r2",
      userName: "U2",
      userEmail: "u2@example.com",
      approverName: "A2",
      status: "APROVADO_GERENTE",
      toEmails: ["a2@example.com", "lider@example.com"],
      startDate: new Date("2026-07-01T12:00:00Z"),
      endDate: new Date("2026-07-20T12:00:00Z"),
      returnDate: new Date("2026-07-21T12:00:00Z"),
      abono: true,
      thirteenth: true,
      notes: "Observação do colaborador",
      managerNote: "Aprovado",
      hrNote: null,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as any[];
    expect(url).toBe("https://example.test/webhook");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(init.body);
    expect(body.source).toBe("ds-ferias");
    expect(body.type).toBe("APPROVED");
    expect(body.requestId).toBe("r2");
    expect(body.toEmails).toEqual(["a2@example.com", "lider@example.com"]);
    expect(body.startDate).toBe("2026-07-01");
    expect(body.endDate).toBe("2026-07-20");
    expect(body.returnDate).toBe("2026-07-21");
    expect(body.abono).toBe(true);
    expect(body.thirteenth).toBe(true);
    expect(body.notes).toBe("Observação do colaborador");
    expect(typeof body.at).toBe("string");
    expect(resendSendMock).toHaveBeenCalledTimes(1);
  });

  it("sends email via resend for approved notifications", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.MAIL_FROM = "Ferias <ferias@empresa.com>";
    delete process.env.NOTIFY_WEBHOOK_URL;

    await notifyApproved({
      requestId: "r2x",
      userName: "U2",
      userEmail: "u2@example.com",
      approverName: "A2",
      status: "APROVADO_GERENTE",
      toEmails: ["a2@example.com", "a2@example.com", "lider@example.com"],
      startDate: new Date("2026-07-01T12:00:00Z"),
      endDate: new Date("2026-07-20T12:00:00Z"),
      returnDate: new Date("2026-07-21T12:00:00Z"),
      abono: true,
      thirteenth: true,
      notes: "Obs",
      managerNote: "Ok",
      hrNote: null,
    });

    expect(resendSendMock).toHaveBeenCalledTimes(1);
    const args = resendSendMock.mock.calls[0][0];
    expect(args.from).toBe("Ferias <ferias@empresa.com>");
    expect(args.to).toEqual(["a2@example.com", "lider@example.com"]);
    expect(args.subject).toContain("Férias aprovadas");
    expect(args.html).toContain("Retorno ao trabalho");
  });

  it("logs webhook failure when response not ok", async () => {
    process.env.NOTIFY_WEBHOOK_URL = "https://example.test/webhook";
    vi.spyOn(globalThis, "fetch" as any).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "fail",
    } as any);
    const errSpy = vi.spyOn(logger, "error").mockImplementation(() => {});

    await notifyRejected({
      requestId: "r3",
      userName: "U3",
      userEmail: "u3@example.com",
      approverName: "A3",
      note: "x",
    });

    expect(errSpy).toHaveBeenCalledWith("[notify] webhook failed", expect.objectContaining({ status: 500, text: "fail" }));
  });

  it("logs webhook error when fetch throws", async () => {
    process.env.NOTIFY_WEBHOOK_URL = "https://example.test/webhook";
    vi.spyOn(globalThis, "fetch" as any).mockRejectedValue(new Error("net"));
    const errSpy = vi.spyOn(logger, "error").mockImplementation(() => {});

    await notifyNewRequest({
      requestId: "r4",
      userName: "U4",
      userEmail: "u4@example.com",
      managerEmail: "m@example.com",
      startDate: new Date("2026-06-01T12:00:00Z"),
      endDate: new Date("2026-06-10T12:00:00Z"),
    });

    expect(errSpy).toHaveBeenCalledWith("[notify] webhook error", expect.objectContaining({ error: expect.any(String) }));
  });

  it("logs event in development mode", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.NOTIFY_WEBHOOK_URL;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await notify({
      type: "NEW_REQUEST",
      requestId: "r5",
      userName: "U5",
      userEmail: "u5@example.com",
      managerEmail: "m@example.com",
      startDate: "2026-06-01",
      endDate: "2026-06-10",
    });

    expect(logSpy).toHaveBeenCalledWith("[notify]", "NEW_REQUEST", expect.any(Object));
  });

  it("sends vacation reminder to manager by email", async () => {
    process.env.NOTIFY_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test";
    process.env.MAIL_FROM = "Ferias <ferias@empresa.com>";
    process.env.REMINDER_CHANNELS = "email";

    await notifyUpcomingVacationReminder({
      requestId: "r-rem-1",
      userName: "Colab 1",
      userEmail: "colab1@empresa.com",
      managerName: "Gestor 1",
      managerEmail: "gestor1@empresa.com",
      toEmails: ["gestor1@empresa.com", "colab1@empresa.com"],
      startDate: new Date("2026-09-04T12:00:00Z"),
      endDate: new Date("2026-09-15T12:00:00Z"),
      daysUntilStart: 7,
      abono: true,
      thirteenth: false,
    });

    expect(resendSendMock).toHaveBeenCalledTimes(1);
    const args = resendSendMock.mock.calls[0][0];
    expect(args.to).toEqual(["gestor1@empresa.com", "colab1@empresa.com"]);
    expect(args.subject).toContain("entra de ferias em 7 dias");
  });

  it("sends return-to-work reminder to manager and collaborator", async () => {
    process.env.NOTIFY_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test";
    process.env.MAIL_FROM = "Ferias <ferias@empresa.com>";
    process.env.REMINDER_CHANNELS = "email";

    await notifyReturnToWorkReminder({
      requestId: "r-ret-1",
      userName: "Colab 2",
      userEmail: "colab2@empresa.com",
      managerName: "Gestor 2",
      managerEmail: "gestor2@empresa.com",
      toEmails: ["gestor2@empresa.com", "colab2@empresa.com"],
      startDate: new Date("2026-09-01T12:00:00Z"),
      endDate: new Date("2026-09-10T12:00:00Z"),
      returnDate: new Date("2026-09-11T12:00:00Z"),
    });

    expect(resendSendMock).toHaveBeenCalledTimes(1);
    const args = resendSendMock.mock.calls[0][0];
    expect(args.to).toEqual(["gestor2@empresa.com", "colab2@empresa.com"]);
    expect(args.subject).toContain("retorno de Colab 2");
    expect(args.html).toContain("retorno");
  });
});

