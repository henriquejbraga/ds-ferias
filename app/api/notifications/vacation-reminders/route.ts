import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyUpcomingVacationReminder } from "@/lib/notifications";
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

  const reminders = await prisma.vacationRequest.findMany({
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

  let sent = 0;
  let skipped = 0;
  for (const r of reminders) {
    const managerEmail = r.user.manager?.email ?? "";
    const managerName = r.user.manager?.name ?? "Lider";
    if (!managerEmail) {
      skipped += 1;
      continue;
    }
    await notifyUpcomingVacationReminder({
      requestId: r.id,
      userName: r.user.name,
      userEmail: r.user.email,
      managerName,
      managerEmail,
      startDate: r.startDate,
      endDate: r.endDate,
      daysUntilStart: 7,
      abono: r.abono,
      thirteenth: r.thirteenth,
    });
    sent += 1;
  }

  return NextResponse.json({
    ok: true,
    targetDate: targetStart.toISOString().slice(0, 10),
    found: reminders.length,
    sent,
    skipped,
  });
}
