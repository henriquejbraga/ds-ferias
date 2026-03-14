/**
 * Serviço de notificações (e-mail, Teams, Slack).
 * Por padrão apenas registra em log; configure NOTIFY_WEBHOOK_URL ou integração de e-mail para envio real.
 */

export type NotifyEvent =
  | { type: "NEW_REQUEST"; requestId: string; userName: string; userEmail: string; managerEmail?: string | null; startDate: string; endDate: string }
  | { type: "APPROVED"; requestId: string; userName: string; userEmail: string; approverName: string; status: string }
  | { type: "REJECTED"; requestId: string; userName: string; userEmail: string; approverName: string; note?: string | null };

function logEvent(event: NotifyEvent) {
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log("[notify]", event.type, event);
  }
}

/**
 * Envia notificação (webhook genérico ou log).
 * Para ativar: NOTIFY_WEBHOOK_URL (POST JSON) ou implementar envio por e-mail (ex.: Resend).
 */
export async function notify(event: NotifyEvent): Promise<void> {
  logEvent(event);

  const webhookUrl = process.env.NOTIFY_WEBHOOK_URL;
  if (webhookUrl) {
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
}) {
  return notify({
    type: "APPROVED",
    ...payload,
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
