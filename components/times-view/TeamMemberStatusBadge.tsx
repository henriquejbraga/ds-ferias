"use client";

import type { TeamMemberInfoSerialized } from "./types";
import { isVacationApprovedStatus } from "@/lib/vacationRules";

export function TeamMemberStatusBadge({ member }: { member: TeamMemberInfoSerialized }) {
  const { isOnVacationNow, balance, requests } = member;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const hasFutureApprovedVacation = requests.some((r) => {
    if (!isVacationApprovedStatus(r.status)) return false;
    const start = new Date(r.startDate);
    start.setHours(0, 0, 0, 0);
    return start > today;
  });
  const hasPendingApproval = requests.some((r) => r.status === "PENDENTE");
  const hasTakenVacation = requests.some((r) => {
    if (!isVacationApprovedStatus(r.status)) return false;
    const end = new Date(r.endDate);
    end.setHours(0, 0, 0, 0);
    return end < today;
  });

  if (isOnVacationNow) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
        Em férias
      </span>
    );
  }

  if (
    !isOnVacationNow &&
    (hasPendingApproval ||
      hasFutureApprovedVacation ||
      balance.availableDays > 0 ||
      balance.pendingDays > 0)
  ) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        {hasPendingApproval && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
            Pendente aprovação
          </span>
        )}

        {hasFutureApprovedVacation && !hasTakenVacation && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
            Férias marcadas
          </span>
        )}

        {!hasPendingApproval && !hasFutureApprovedVacation && balance.availableDays > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
            Férias a tirar
            <span className="font-normal opacity-90"> ({balance.availableDays} dias)</span>
          </span>
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
