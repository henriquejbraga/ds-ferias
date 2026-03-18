"use client";

import type { TeamMemberInfoSerialized, VacationRequestSummary } from "./types";
import { TeamMemberStatusBadge } from "./TeamMemberStatusBadge";

function formatDateRange(start: string | Date, end: string | Date) {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })} – ${e.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDENTE: "Pendente",
    APROVADO_COORDENADOR: "Aprovado Coord.",
    APROVADO_GESTOR: "Aprovado Coord.",
    APROVADO_GERENTE: "Aprovado Gerente",
    APROVADO_RH: "Aprovado RH",
    REPROVADO: "Reprovado",
    CANCELADO: "Cancelado",
  };
  return map[status] ?? status.replace(/_/g, " ");
}

export function TeamMemberRow({
  member,
  requestsSummary,
}: {
  member: TeamMemberInfoSerialized;
  requestsSummary: VacationRequestSummary[];
}) {
  const { user } = member;

  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white dark:border-[#252a35] dark:bg-[#1a1d23]">
      <div className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-[#1a1d23] dark:text-white">{user.name}</p>
          {user.department && <p className="truncate text-sm text-[#64748b] dark:text-slate-400">{user.department}</p>}
        </div>
        <div className="w-full shrink-0 sm:w-auto">
          <TeamMemberStatusBadge member={member} />
        </div>
      </div>

      {requestsSummary.length > 0 && (
        <div className="border-t border-[#e2e8f0] dark:border-[#252a35]">
          <div className="space-y-2 p-4 pt-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#94a3b8] dark:text-slate-500">
              Solicitações
            </p>

            <ul className="space-y-1.5">
              {requestsSummary.map((r, i) => {
                const end = new Date(r.endDate);
                const backWithAbono =
                  r.abono && !Number.isNaN(end.getTime()) ? new Date(end.getTime() - 10 * 24 * 60 * 60 * 1000) : null;

                return (
                  <li key={i} className="flex flex-wrap items-center gap-2 rounded-md bg-[#f5f6f8] px-3 py-2 text-sm dark:bg-[#0f1117]">
                    <div className="flex flex-1 flex-col gap-0.5 text-[#475569] dark:text-slate-400">
                      <span>{formatDateRange(r.startDate, r.endDate)}</span>
                      {backWithAbono && (
                        <span className="text-sm text-[#64748b] dark:text-slate-400">
                          Retorno estimado em{" "}
                          <span className="font-semibold text-[#0f172a] dark:text-slate-100">{backWithAbono.toLocaleDateString("pt-BR")}</span>{" "}
                          (10 dias antes do fim corrido, por abono 1/3).
                        </span>
                      )}
                    </div>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-sm font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                      {statusLabel(r.status)}
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

