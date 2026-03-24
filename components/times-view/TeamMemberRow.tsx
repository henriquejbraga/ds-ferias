"use client";

import { useMemo, useState } from "react";
import type { TeamMemberInfoSerialized, VacationRequestSummary } from "./types";
import { TeamMemberStatusBadge } from "./TeamMemberStatusBadge";
import { Chevron } from "./Chevron";
import { getVacationStatusDisplayLabel, isVacationApprovedStatus } from "@/lib/vacationRules";

function formatDateRange(start: string | Date, end: string | Date) {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })} – ${e.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;
}

export function TeamMemberRow({
  member,
  requestsSummary,
}: {
  member: TeamMemberInfoSerialized;
  requestsSummary: VacationRequestSummary[];
}) {
  const { user } = member;
  const [expanded, setExpanded] = useState(false);
  const sortedRequests = useMemo(
    () =>
      [...requestsSummary].sort(
        (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
      ),
    [requestsSummary],
  );
  const hasRequests = sortedRequests.length > 0;
  const nextUpcomingIndex = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let winner = -1;
    let winnerTime = Number.POSITIVE_INFINITY;
    sortedRequests.forEach((r, idx) => {
      const start = new Date(r.startDate);
      start.setHours(0, 0, 0, 0);
      if (start >= today && start.getTime() < winnerTime) {
        winner = idx;
        winnerTime = start.getTime();
      }
    });
    return winner;
  }, [sortedRequests]);

  function statusChipClass(status: string): string {
    if (status === "PENDENTE") {
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
    }
    if (status === "APROVADO_GERENTE" || status === "APROVADO_COORDENADOR" || status === "APROVADO_GESTOR") {
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
    }
    if (status === "REPROVADO") {
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
    }
    return "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
  }

  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white dark:border-[#252a35] dark:bg-[#1a1d23]">
      <button
        type="button"
        onClick={() => hasRequests && setExpanded((v) => !v)}
        className="flex w-full flex-wrap items-center gap-3 p-4 text-left transition-colors hover:bg-[#f8fafc] sm:flex-nowrap dark:hover:bg-[#141720]"
        aria-expanded={hasRequests ? expanded : undefined}
        aria-label={hasRequests ? (expanded ? `Ocultar ${user.name}` : `Expandir ${user.name}`) : user.name}
      >
        {hasRequests && (
          <Chevron open={expanded} />
        )}
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-[#1a1d23] dark:text-white">{user.name}</span>
          {user.department && <span className="block truncate text-sm text-[#64748b] dark:text-slate-400">{user.department}</span>}
        </span>
        <span className="w-full shrink-0 sm:w-auto">
          <TeamMemberStatusBadge member={member} />
        </span>
      </button>

      {hasRequests && expanded && (
        <div className="border-t border-[#e2e8f0] dark:border-[#252a35]">
          <div className="space-y-2 p-4 pt-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#94a3b8] dark:text-slate-500">
              Solicitações
            </p>

            <ul className="space-y-1.5">
              {sortedRequests.map((r, i) => {
                const end = new Date(r.endDate);
                const backWithAbono =
                  r.abono && !Number.isNaN(end.getTime()) ? new Date(end.getTime() - 10 * 24 * 60 * 60 * 1000) : null;

                return (
                  <li key={i} className="flex flex-wrap items-center gap-2 rounded-md bg-[#f5f6f8] px-3 py-2 text-sm dark:bg-[#0f1117]">
                    <div className="flex flex-1 flex-col gap-0.5 text-[#475569] dark:text-slate-400">
                      <span className={i === nextUpcomingIndex ? "font-semibold text-[#0f172a] dark:text-slate-100" : ""}>
                        {formatDateRange(r.startDate, r.endDate)}
                      </span>
                      {backWithAbono && (
                        <span className="text-sm text-[#64748b] dark:text-slate-400">
                          Retorno estimado em{" "}
                          <span className="font-semibold text-[#0f172a] dark:text-slate-100">{backWithAbono.toLocaleDateString("pt-BR")}</span>{" "}
                          (10 dias antes do fim corrido, por abono 1/3).
                        </span>
                      )}
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-sm font-semibold ${statusChipClass(r.status)}`}>
                      {getVacationStatusDisplayLabel(r.status)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

