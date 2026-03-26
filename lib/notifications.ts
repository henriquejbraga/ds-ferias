/**
 * Serviço de notificações (e-mail, Teams, Slack).
 * Por padrão apenas registra em log; configure NOTIFY_WEBHOOK_URL ou integração de e-mail para envio real.
 */

import { Resend } from "resend";

type NotifyProvider = "resend" | "webhook" | "both" | "none";

export type NotifyEvent =
  | { type: "NEW_REQUEST"; requestId: string; userName: string; userEmail: string; managerEmail?: string | null; startDate: string; endDate: string }
  | {
      type: "APPROVED";
      requestId: string;
      userName: string;
      userEmail: string;
      approverName: string;
      status: string;
      toEmails: string[];
      startDate: string;
      endDate: string;
      returnDate: string;
      abono: boolean;
      thirteenth: boolean;
      notes?: string | null;
      managerNote?: string | null;
      hrNote?: string | null;
    }
  | { type: "REJECTED"; requestId: string; userName: string; userEmail: string; approverName: string; note?: string | null }
  | {
      type: "UPCOMING_VACATION_REMINDER";
      requestId: string;
      userName: string;
      userEmail: string;
      managerName: string;
      managerEmail: string;
      toEmails?: string[];
      startDate: string;
      endDate: string;
      daysUntilStart: number;
      abono: boolean;
      thirteenth: boolean;
    }
  | {
      type: "RETURN_TO_WORK_REMINDER";
      requestId: string;
      userName: string;
      userEmail: string;
      managerName: string;
      managerEmail: string;
      toEmails?: string[];
      returnDate: string;
      startDate: string;
      endDate: string;
    };

function logEvent(event: NotifyEvent) {
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log("[notify]", event.type, event);
  }
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderApprovedEmailHtml(event: Extract<NotifyEvent, { type: "APPROVED" }>): string {
  const brandName = process.env.MAIL_BRAND_NAME?.trim() || "Editora Globo";
  const logoUrl = process.env.MAIL_LOGO_URL?.trim() || "";
  const hrSignature =
    process.env.MAIL_HR_SIGNATURE?.trim() || "Editora Globo - Estratégia Digital - DS-Ferias";
  const lines = [
    ["Colaborador", event.userName],
    ["E-mail do colaborador", event.userEmail],
    ["Aprovado por", event.approverName],
    ["Status", event.status],
    ["Início das férias", event.startDate],
    ["Fim das férias", event.endDate],
    ["Retorno ao trabalho", event.returnDate],
    ["Abono 1/3", event.abono ? "Sim" : "Não"],
    ["Adiantamento de 13º", event.thirteenth ? "Sim" : "Não"],
    ["Observações do colaborador", event.notes?.trim() ? event.notes : "-"],
    ["Nota do líder", event.managerNote?.trim() ? event.managerNote : "-"],
    ["Nota de RH", event.hrNote?.trim() ? event.hrNote : "-"],
    ["ID da solicitação", event.requestId],
  ];

  const rows = lines
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 10px;border:1px solid #ddd;background:#f9f9f9;font-weight:600;">${escapeHtml(
          label,
        )}</td><td style="padding:8px 10px;border:1px solid #ddd;">${escapeHtml(String(value ?? "-"))}</td></tr>`,
    )
    .join("");

  const safeBrandName = escapeHtml(brandName);
  const safeHrSignature = escapeHtml(hrSignature);
  const logoHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${safeBrandName}" style="max-height:38px;display:block;" />`
    : `<div style="font-size:18px;font-weight:700;color:#0a3d91;">${safeBrandName}</div>`;

  return `
    <div style="background:#f2f5fb;padding:24px;font-family:Arial,sans-serif;color:#1f2937;">
      <div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #dbe4f3;border-radius:12px;overflow:hidden;">
        <div style="background:#0a3d91;padding:18px 20px;color:#ffffff;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div style="filter:brightness(0) invert(1);">${logoHtml}</div>
            <div style="font-size:12px;opacity:0.9;">Comunicado oficial de ferias</div>
          </div>
          <h2 style="margin:12px 0 0 0;font-size:22px;">Solicitacao de ferias aprovada</h2>
        </div>
        <div style="padding:18px 20px;">
          <p style="margin:0 0 12px 0;">A solicitacao abaixo foi aprovada no fluxo de ferias.</p>
          <table style="border-collapse:collapse;width:100%;max-width:760px;">${rows}</table>
          <p style="margin:14px 0 2px 0;font-size:13px;color:#4b5563;">Em caso de duvidas, responder este e-mail ou acionar o time de RH.</p>
          <p style="margin:0;font-size:13px;color:#4b5563;">${safeHrSignature}</p>
        </div>
      </div>
    </div>
  `;
}

async function sendApprovedEmail(event: Extract<NotifyEvent, { type: "APPROVED" }>): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!apiKey || !from || event.toEmails.length === 0) return;

  const resend = new Resend(apiKey);
  const recipients = Array.from(new Set(event.toEmails.filter(Boolean)));
  if (recipients.length === 0) return;

  const subject = `Férias aprovadas - ${event.userName} (${event.startDate} a ${event.endDate})`;

  await resend.emails.send({
    from,
    to: recipients,
    subject,
    html: renderApprovedEmailHtml(event),
  });
}

function renderReminderEmailHtml(event: Extract<NotifyEvent, { type: "UPCOMING_VACATION_REMINDER" }>): string {
  const brandName = process.env.MAIL_BRAND_NAME?.trim() || "Editora Globo";
  const hrSignature =
    process.env.MAIL_HR_SIGNATURE?.trim() || "Editora Globo - Estratégia Digital - DS-Ferias";
  const safeBrandName = escapeHtml(brandName);
  const safeHrSignature = escapeHtml(hrSignature);

  return `
    <div style="font-family:Arial,sans-serif;color:#1f2937;">
      <h2 style="margin-bottom:8px;">Lembrete: ferias em ${event.daysUntilStart} dias</h2>
      <p style="margin:0 0 12px 0;">O colaborador abaixo entrara de ferias em breve.</p>
      <table style="border-collapse:collapse;width:100%;max-width:760px;">
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f9f9f9;font-weight:600;">Colaborador</td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(event.userName)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f9f9f9;font-weight:600;">Inicio</td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(event.startDate)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f9f9f9;font-weight:600;">Fim</td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(event.endDate)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f9f9f9;font-weight:600;">Abono</td><td style="padding:8px;border:1px solid #ddd;">${event.abono ? "Sim" : "Nao"}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f9f9f9;font-weight:600;">Adiantamento 13o</td><td style="padding:8px;border:1px solid #ddd;">${event.thirteenth ? "Sim" : "Nao"}</td></tr>
      </table>
      <p style="margin:14px 0 2px 0;font-size:13px;color:#4b5563;">${safeBrandName}</p>
      <p style="margin:0;font-size:13px;color:#4b5563;">${safeHrSignature}</p>
    </div>
  `;
}

async function sendReminderEmail(event: Extract<NotifyEvent, { type: "UPCOMING_VACATION_REMINDER" }>): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!apiKey || !from) return;

  const resend = new Resend(apiKey);
  const recipients = Array.from(
    new Set((event.toEmails?.length ? event.toEmails : [event.managerEmail]).filter(Boolean)),
  );
  if (recipients.length === 0) return;
  await resend.emails.send({
    from,
    to: recipients,
    subject: `Lembrete: ${event.userName} entra de ferias em ${event.daysUntilStart} dias`,
    html: renderReminderEmailHtml(event),
  });
}

function renderReturnReminderEmailHtml(event: Extract<NotifyEvent, { type: "RETURN_TO_WORK_REMINDER" }>): string {
  const brandName = process.env.MAIL_BRAND_NAME?.trim() || "Editora Globo";
  const hrSignature =
    process.env.MAIL_HR_SIGNATURE?.trim() || "Editora Globo - Estratégia Digital - DS-Ferias";
  const safeBrandName = escapeHtml(brandName);
  const safeHrSignature = escapeHtml(hrSignature);

  return `
    <div style="font-family:Arial,sans-serif;color:#1f2937;">
      <h2 style="margin-bottom:8px;">Lembrete: retorno ao trabalho amanha</h2>
      <p style="margin:0 0 12px 0;">As ferias abaixo se encerram hoje e o retorno ocorre amanha.</p>
      <table style="border-collapse:collapse;width:100%;max-width:760px;">
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f9f9f9;font-weight:600;">Colaborador</td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(event.userName)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f9f9f9;font-weight:600;">Inicio</td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(event.startDate)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f9f9f9;font-weight:600;">Fim</td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(event.endDate)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f9f9f9;font-weight:600;">Retorno</td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(event.returnDate)}</td></tr>
      </table>
      <p style="margin:14px 0 2px 0;font-size:13px;color:#4b5563;">${safeBrandName}</p>
      <p style="margin:0;font-size:13px;color:#4b5563;">${safeHrSignature}</p>
    </div>
  `;
}

async function sendReturnReminderEmail(event: Extract<NotifyEvent, { type: "RETURN_TO_WORK_REMINDER" }>): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!apiKey || !from) return;

  const resend = new Resend(apiKey);
  const recipients = Array.from(
    new Set((event.toEmails?.length ? event.toEmails : [event.managerEmail]).filter(Boolean)),
  );
  if (recipients.length === 0) return;
  await resend.emails.send({
    from,
    to: recipients,
    subject: `Lembrete: retorno de ${event.userName} ao trabalho em 1 dia`,
    html: renderReturnReminderEmailHtml(event),
  });
}

function shouldSendReminderEmail(): boolean {
  const channels = (process.env.REMINDER_CHANNELS ?? "email").toLowerCase();
  return channels.includes("email");
}

function shouldSendReminderSlack(): boolean {
  const channels = (process.env.REMINDER_CHANNELS ?? "email").toLowerCase();
  return channels.includes("slack");
}

async function sendReminderSlack(event: Extract<NotifyEvent, { type: "UPCOMING_VACATION_REMINDER" }>): Promise<void> {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return;

  const text =
    `:calendar: *Lembrete de ferias* - ${event.userName} entra de ferias em ${event.daysUntilStart} dias.\n` +
    `*Inicio:* ${event.startDate}\n*Fim:* ${event.endDate}\n*Abono:* ${event.abono ? "Sim" : "Nao"}\n*13o:* ${event.thirteenth ? "Sim" : "Nao"}\n` +
    `*Lider:* ${event.managerName} (${event.managerEmail})`;

  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    console.error("[notify] slack reminder failed", res.status, await res.text());
  }
}

function getNotifyProvider(): NotifyProvider {
  const raw = (process.env.NOTIFY_PROVIDER ?? "").trim().toLowerCase();
  if (raw === "resend" || raw === "webhook" || raw === "both" || raw === "none") {
    return raw;
  }
  // Retrocompatibilidade: sem configuração explícita, mantém comportamento atual.
  return "both";
}

/**
 * Envia notificação (webhook genérico ou log).
 * Para ativar: NOTIFY_WEBHOOK_URL (POST JSON) ou implementar envio por e-mail (ex.: Resend).
 */
export async function notify(event: NotifyEvent): Promise<void> {
  logEvent(event);

  const provider = getNotifyProvider();
  const shouldSendEmail = provider === "resend" || provider === "both";
  const shouldSendWebhook = provider === "webhook" || provider === "both";

  if (shouldSendEmail && event.type === "APPROVED") {
    try {
      await sendApprovedEmail(event);
    } catch (err) {
      console.error("[notify] email send error", err);
    }
  }

  if (event.type === "UPCOMING_VACATION_REMINDER") {
    if (shouldSendEmail && shouldSendReminderEmail()) {
      try {
        await sendReminderEmail(event);
      } catch (err) {
        console.error("[notify] reminder email send error", err);
      }
    }
    if (shouldSendReminderSlack()) {
      try {
        await sendReminderSlack(event);
      } catch (err) {
        console.error("[notify] reminder slack send error", err);
      }
    }
  }

  if (event.type === "RETURN_TO_WORK_REMINDER") {
    if (shouldSendEmail && shouldSendReminderEmail()) {
      try {
        await sendReturnReminderEmail(event);
      } catch (err) {
        console.error("[notify] return reminder email send error", err);
      }
    }
    if (shouldSendReminderSlack()) {
      // TODO: opcional no futuro, por enquanto sem webhook dedicado.
    }
  }

  const webhookUrl = process.env.NOTIFY_WEBHOOK_URL;
  if (shouldSendWebhook && webhookUrl) {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "ds-ferias",
          ...event,
          at: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        console.error("[notify] webhook failed", res.status, await res.text());
      }
    } catch (err) {
      console.error("[notify] webhook error", err);
    }
  }
}

/** Notifica coordenador/gerente sobre nova solicitação de férias. */
export function notifyNewRequest(payload: {
  requestId: string;
  userName: string;
  userEmail: string;
  managerEmail?: string | null;
  startDate: Date;
  endDate: Date;
}) {
  return notify({
    type: "NEW_REQUEST",
    requestId: payload.requestId,
    userName: payload.userName,
    userEmail: payload.userEmail,
    managerEmail: payload.managerEmail,
    startDate: payload.startDate.toISOString().slice(0, 10),
    endDate: payload.endDate.toISOString().slice(0, 10),
  });
}

/** Notifica colaborador sobre aprovação. */
export function notifyApproved(payload: {
  requestId: string;
  userName: string;
  userEmail: string;
  approverName: string;
  status: string;
  toEmails: string[];
  startDate: Date;
  endDate: Date;
  returnDate: Date;
  abono: boolean;
  thirteenth: boolean;
  notes?: string | null;
  managerNote?: string | null;
  hrNote?: string | null;
}) {
  return notify({
    type: "APPROVED",
    requestId: payload.requestId,
    userName: payload.userName,
    userEmail: payload.userEmail,
    approverName: payload.approverName,
    status: payload.status,
    toEmails: payload.toEmails,
    startDate: payload.startDate.toISOString().slice(0, 10),
    endDate: payload.endDate.toISOString().slice(0, 10),
    returnDate: payload.returnDate.toISOString().slice(0, 10),
    abono: payload.abono,
    thirteenth: payload.thirteenth,
    notes: payload.notes,
    managerNote: payload.managerNote,
    hrNote: payload.hrNote,
  });
}

/** Notifica colaborador sobre reprovação. */
export function notifyRejected(payload: {
  requestId: string;
  userName: string;
  userEmail: string;
  approverName: string;
  note?: string | null;
}) {
  return notify({
    type: "REJECTED",
    ...payload,
  });
}

export function notifyUpcomingVacationReminder(payload: {
  requestId: string;
  userName: string;
  userEmail: string;
  managerName: string;
  managerEmail: string;
  toEmails?: string[];
  startDate: Date;
  endDate: Date;
  daysUntilStart: number;
  abono: boolean;
  thirteenth: boolean;
}) {
  return notify({
    type: "UPCOMING_VACATION_REMINDER",
    requestId: payload.requestId,
    userName: payload.userName,
    userEmail: payload.userEmail,
    managerName: payload.managerName,
    managerEmail: payload.managerEmail,
    toEmails: payload.toEmails,
    startDate: payload.startDate.toISOString().slice(0, 10),
    endDate: payload.endDate.toISOString().slice(0, 10),
    daysUntilStart: payload.daysUntilStart,
    abono: payload.abono,
    thirteenth: payload.thirteenth,
  });
}

export function notifyReturnToWorkReminder(payload: {
  requestId: string;
  userName: string;
  userEmail: string;
  managerName: string;
  managerEmail: string;
  toEmails?: string[];
  returnDate: Date;
  startDate: Date;
  endDate: Date;
}) {
  return notify({
    type: "RETURN_TO_WORK_REMINDER",
    requestId: payload.requestId,
    userName: payload.userName,
    userEmail: payload.userEmail,
    managerName: payload.managerName,
    managerEmail: payload.managerEmail,
    toEmails: payload.toEmails,
    returnDate: payload.returnDate.toISOString().slice(0, 10),
    startDate: payload.startDate.toISOString().slice(0, 10),
    endDate: payload.endDate.toISOString().slice(0, 10),
  });
}
