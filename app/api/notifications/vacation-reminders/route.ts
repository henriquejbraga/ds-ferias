import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyUpcomingVacationReminder, notifyReturnToWorkReminder } from "@/lib/notifications";
import { APPROVED_VACATION_STATUSES } from "@/lib/vacationRules";

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

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const today = toUtcMidnight(new Date());
  const targetStart = new Date(today.getTime() + 7 * ONE_DAY_MS);
  const targetEnd = new Date(targetStart.getTime() + ONE_DAY_MS);
  const returnWindowStart = today;
  const returnWindowEnd = new Date(returnWindowStart.getTime() + ONE_DAY_MS);

  const startReminders = await prisma.vacationRequest.findMany({
    where: {
      status: { in: [...APPROVED_VACATION_STATUSES] },
      startDate: { gte: targetStart, lt: targetEnd },
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
      endDate: { gte: returnWindowStart, lt: returnWindowEnd },
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
    await notifyUpcomingVacationReminder({
      requestId: r.id,
      userName: r.user.name,
      userEmail: r.user.email,
      managerName,
      managerEmail,
      toEmails: recipients,
      startDate: r.startDate,
      endDate: r.endDate,
      daysUntilStart: 7,
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
      targetDate: targetStart.toISOString().slice(0, 10),
      found: startReminders.length,
      sent: sentStart,
      skipped: skippedStart,
    },
    returnReminder: {
      targetDate: returnWindowStart.toISOString().slice(0, 10),
      found: returnReminders.length,
      sent: sentReturn,
      skipped: skippedReturn,
    },
  });
}
