"use client";

import { useState } from "react";
import type { TeamMemberInfoSerialized } from "@/components/times-view-client";

type Props = {
  members: TeamMemberInfoSerialized[];
};

function buildCalendarMatrix(members: TeamMemberInfoSerialized[], month: Date) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDay = new Date(year, m, 1);
  const lastDay = new Date(year, m + 1, 0);
  const daysInMonth = lastDay.getDate();

  return members.map((member) => {
    const row: boolean[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const current = new Date(year, m, d);
      current.setHours(0, 0, 0, 0);
      const isOnDay = member.requests.some((r) => {
        if (r.status !== "APROVADO_RH") return false;
        const start = new Date(r.startDate);
        const rawEnd = new Date(r.endDate);
        const end =
          r.abono && !Number.isNaN(rawEnd.getTime())
            ? new Date(rawEnd.getTime() - 10 * 24 * 60 * 60 * 1000)
            : rawEnd;
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        return current >= start && current <= end;
      });
      row.push(isOnDay);
    }
    return { member, days: row };
  });
}

export function TeamCalendar({ members }: Props) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const daysInMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0,
  ).getDate();

  const matrix = buildCalendarMatrix(members, currentMonth);

  const monthLabel = currentMonth.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <section className="overflow-x-auto rounded-lg border border-[#e2e8f0] bg-white p-5 dark:border-[#252a35] dark:bg-[#1a1d23]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h4 className="text-base font-semibold text-[#1a1d23] dark:text-white">
          Calendário consolidado do mês (apenas férias aprovadas)
        </h4>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Mês anterior"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e2e8f0] text-xs text-[#64748b] hover:bg-[#f5f6f8] dark:border-[#252a35] dark:text-slate-300 dark:hover:bg-[#1e2330]"
            onClick={() =>
              setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
            }
          >
            ‹
          </button>
          <span className="min-w-[120px] text-center text-sm text-[#64748b] dark:text-slate-400 capitalize">
            {monthLabel}
          </span>
          <button
            type="button"
            aria-label="Próximo mês"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e2e8f0] text-xs text-[#64748b] hover:bg-[#f5f6f8] dark:border-[#252a35] dark:text-slate-300 dark:hover:bg-[#1e2330]"
            onClick={() =>
              setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
            }
          >
            ›
          </button>
        </div>
      </div>
      <div className="min-w-full text-sm text-[#64748b] dark:text-slate-400">
        <div className="flex gap-2">
          {/* Coluna de nomes */}
          <div className="shrink-0 w-44">
            <div className="px-2 py-1 font-semibold">Colaboradores</div>
            <div className="mt-1 space-y-1">
              {matrix.map(({ member }) => (
                <div
                  key={member.user.id}
                  className="h-4 truncate px-2 text-sm text-[#475569] dark:text-slate-300"
                >
                  {member.user.name}
                </div>
              ))}
            </div>
          </div>

          {/* Área de dias */}
          <div className="flex-1 overflow-x-auto">
            <div className="min-w-[520px]">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(16px,1fr))] gap-px">
                {Array.from({ length: daysInMonth }).map((_, idx) => (
                  <div key={idx} className="py-1 text-center text-[11px]">
                    {idx + 1}
                  </div>
                ))}
              </div>
              <div className="mt-1 space-y-1">
                {matrix.map(({ member, days }) => (
                  <div key={member.user.id} className="grid grid-cols-[repeat(auto-fit,minmax(16px,1fr))] gap-px">
                    {days.map((isOnVacation, idx) => (
                      <div
                        key={idx}
                        className={[
                          "h-4 rounded-sm border border-transparent",
                          isOnVacation ? "bg-emerald-500/80" : "bg-[#f8fafc] dark:bg-[#020617]",
                        ].join(" ")}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-[#94a3b8] dark:text-slate-500">
        Considera apenas períodos com status <span className="font-semibold">Aprovado RH</span>.
        Quando há <span className="font-semibold">abono 1/3</span>, o retorno é ajustado em 10 dias
        para frente e o mapa mostra apenas os dias efetivos de descanso.
      </p>
    </section>
  );
}

