import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyUpcomingVacationReminder, notifyReturnToWorkReminder } from "@/lib/notifications";
import { APPROVED_VACATION_STATUSES } from "@/lib/vacationRules";
import { logger } from "@/lib/logger";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function toUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseCronAuth(request: Request): string {
  const header = request.headers.get("x-cron-secret")?.trim();
  if (header) return header;
  const auth = request.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return "";
}

function isAuthorized(request: Request): boolean {
  const expected = (process.env.REMINDER_CRON_SECRET ?? process.env.CRON_SECRET ?? "").trim();
  if (!expected) return false;
  return parseCronAuth(request) === expected;
}

export async function GET(request: Request) {
  logger.info("[cron] Iniciando processamento de lembretes de férias");
  
  if (!isAuthorized(request)) {
    logger.warn("[cron] Tentativa de execução não autorizada", {
      authHeader: request.headers.get("authorization") ? "present" : "missing",
      cronHeader: request.headers.get("x-cron-secret") ? "present" : "missing",
    });
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const today = toUtcMidnight(new Date());
  const target7dStart = new Date(today.getTime() + 7 * ONE_DAY_MS);
  const target7dEnd = new Date(target7dStart.getTime() + ONE_DAY_MS);
  const target1dStart = new Date(today.getTime() + 1 * ONE_DAY_MS);
  const target1dEnd = new Date(target1dStart.getTime() + ONE_DAY_MS);

  // Lembrete de retorno: disparar 1 dia ANTES das férias acabarem.
  // Se as férias acabam amanhã (D+1), hoje avisamos que amanhã é o último dia e o retorno é depois de amanhã.
  const returnTargetStart = new Date(today.getTime() + 1 * ONE_DAY_MS);
  const returnTargetEnd = new Date(returnTargetStart.getTime() + ONE_DAY_MS);

  const startReminders = await prisma.vacationRequest.findMany({
    where: {
      status: { in: [...APPROVED_VACATION_STATUSES] },
      OR: [
        { startDate: { gte: target7dStart, lt: target7dEnd } },
        { startDate: { gte: target1dStart, lt: target1dEnd } },
      ],
      user: { managerId: { not: null } },
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      abono: true,
      thirteenth: true,
      user: {
        select: {
          name: true,
          email: true,
          manager: { select: { name: true, email: true } },
        },
      },
    },
  });

  const returnReminders = await prisma.vacationRequest.findMany({
    where: {
      status: { in: [...APPROVED_VACATION_STATUSES] },
      endDate: { gte: returnTargetStart, lt: returnTargetEnd },
      user: { managerId: { not: null } },
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      user: {
        select: {
          name: true,
          email: true,
          manager: { select: { name: true, email: true } },
        },
      },
    },
  });

  let sentStart = 0;
  let skippedStart = 0;
  for (const r of startReminders) {
    const managerEmail = r.user.manager?.email ?? "";
    const managerName = r.user.manager?.name ?? "Lider";
    const recipients = Array.from(new Set([managerEmail, r.user.email].filter(Boolean)));
    if (recipients.length === 0) {
      skippedStart += 1;
      continue;
    }
    const daysUntilStart = Math.round((toUtcMidnight(r.startDate).getTime() - today.getTime()) / ONE_DAY_MS);

    await notifyUpcomingVacationReminder({
      requestId: r.id,
      userName: r.user.name,
      userEmail: r.user.email,
      managerName,
      managerEmail,
      toEmails: recipients,
      startDate: r.startDate,
      endDate: r.endDate,
      daysUntilStart,
      abono: r.abono,
      thirteenth: r.thirteenth,
    });
    sentStart += 1;
  }

  let sentReturn = 0;
  let skippedReturn = 0;
  for (const r of returnReminders) {
    const managerEmail = r.user.manager?.email ?? "";
    const managerName = r.user.manager?.name ?? "Lider";
    const recipients = Array.from(new Set([managerEmail, r.user.email].filter(Boolean)));
    if (recipients.length === 0) {
      skippedReturn += 1;
      continue;
    }
    const returnDate = new Date(r.endDate.getTime() + ONE_DAY_MS);
    await notifyReturnToWorkReminder({
      requestId: r.id,
      userName: r.user.name,
      userEmail: r.user.email,
      managerName,
      managerEmail,
      toEmails: recipients,
      startDate: r.startDate,
      endDate: r.endDate,
      returnDate,
    });
    sentReturn += 1;
  }

  return NextResponse.json({
    ok: true,
    startReminder: {
      target7dDate: target7dStart.toISOString().slice(0, 10),
      target1dDate: target1dStart.toISOString().slice(0, 10),
      found: startReminders.length,
      sent: sentStart,
      skipped: skippedStart,
    },
    returnReminder: {
      targetReturnEnd: returnTargetStart.toISOString().slice(0, 10),
      found: returnReminders.length,
      sent: sentReturn,
      skipped: skippedReturn,
    },
  });
}
