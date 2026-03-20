"use client";

import type { TeamMemberInfoSerialized } from "./types";

export function TeamMemberStatusBadge({ member }: { member: TeamMemberInfoSerialized }) {
  const { isOnVacationNow, balance, requests } = member;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const hasFutureVacation = requests.some((r) => {
    const start = new Date(r.startDate);
    start.setHours(0, 0, 0, 0);
    return start > today;
  });

  if (isOnVacationNow) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
        Em férias
      </span>
    );
  }

  if (!isOnVacationNow && (hasFutureVacation || balance.availableDays > 0 || balance.pendingDays > 0)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
        {hasFutureVacation ? "Férias marcadas" : "Férias a tirar"}
        {!hasFutureVacation && balance.availableDays > 0 && (
          <span className="font-normal opacity-90"> ({balance.availableDays} dias)</span>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
      Não está de férias e não tem férias a tirar
    </span>
  );
}

