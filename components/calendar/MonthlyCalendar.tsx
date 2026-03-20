"use client";

import { useState } from "react";

type CalendarEntry = {
  startDate: Date | string;
  endDate: Date | string;
  status: string;
  abono?: boolean;
  thirteenth?: boolean;
};

type Props = {
  entries: CalendarEntry[];
};

const STATUS_COLOR: Record<string, string> = {
  PENDENTE: "bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200",
  APROVADO_COORDENADOR: "bg-emerald-200 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200",
  APROVADO_GERENTE: "bg-emerald-200 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200",
  REPROVADO: "bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-200",
  CANCELADO: "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-200",
};

function getStatusColor(status: string): string {
  return STATUS_COLOR[status] ?? "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
}

export function MonthlyCalendar({ entries }: Props) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth(); // 0-11

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  const firstWeekday = firstDay.getDay(); // 0 (dom) - 6 (sáb)

  const days: { day: number; statuses: string[]; hasAbono: boolean; hasThirteenth: boolean }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const current = new Date(year, month, d);
    const matching = entries.filter((e) => {
      const start = new Date(e.startDate);
      const endRaw = new Date(e.endDate);
      // Se houver abono 1/3, destacamos apenas o período estimado de descanso (até 10 dias a menos)
      const end =
        e.abono && !isNaN(endRaw.getTime())
          ? new Date(endRaw.getTime() - 10 * 24 * 60 * 60 * 1000)
          : endRaw;
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return current >= start && current <= end;
    });
    const statuses = matching.map((e) => e.status);
    const hasAbono = matching.some((e) => e.abono);
    const hasThirteenth = matching.some((e) => e.thirteenth);
    days.push({ day: d, statuses, hasAbono, hasThirteenth });
  }

  const blanks = (firstWeekday + 6) % 7; // alinhar para semana começando em segunda

  const monthLabel = currentMonth.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <section aria-label="Calendário de férias" className="rounded-lg border border-[#e2e8f0] bg-white p-4 dark:border-[#252a35] dark:bg-[#1a1d23]">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[#1a1d23] dark:text-white">
          Calendário deste mês
        </h4>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Mês anterior"
            className="flex h-6 w-6 items-center justify-center rounded-md border border-[#e2e8f0] text-xs text-[#64748b] hover:bg-[#f5f6f8] dark:border-[#252a35] dark:text-slate-300 dark:hover:bg-[#1e2330]"
            onClick={() =>
              setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
            }
          >
            ‹
          </button>
          <span className="min-w-[96px] text-center text-xs text-[#64748b] dark:text-slate-400 capitalize">
            {monthLabel}
          </span>
          <button
            type="button"
            aria-label="Próximo mês"
            className="flex h-6 w-6 items-center justify-center rounded-md border border-[#e2e8f0] text-xs text-[#64748b] hover:bg-[#f5f6f8] dark:border-[#252a35] dark:text-slate-300 dark:hover:bg-[#1e2330]"
            onClick={() =>
              setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
            }
          >
            ›
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-[#64748b] dark:text-slate-400">
        {["S", "T", "Q", "Q", "S", "S", "D"].map((dow, index) => (
          <div key={`dow-${index}`} className="py-1 font-medium">
            {dow}
          </div>
        ))}
        {Array.from({ length: blanks }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {days.map(({ day, statuses, hasAbono, hasThirteenth }) => {
          const isToday = day === today.getDate();
          const hasStatus = statuses.length > 0;
          const mainStatus = hasStatus ? statuses[0] : "";
          return (
            <div
              key={day}
              className={[
                "flex h-10 flex-col items-center justify-center rounded-md border text-[10px]",
                "border-transparent",
                isToday ? "border-blue-500" : "border-transparent",
                hasStatus ? getStatusColor(mainStatus) : "bg-[#f5f6f8] dark:bg-[#0f1117] text-[#475569] dark:text-slate-300",
              ].join(" ")}
            >
              <span className="font-semibold leading-none">{day}</span>
              {(hasAbono || hasThirteenth) && (
                <span className="mt-0.5 flex gap-0.5">
                  {hasAbono && <span className="rounded-sm bg-emerald-600 px-0.5 text-[8px] font-semibold text-white">A</span>}
                  {hasThirteenth && <span className="rounded-sm bg-amber-600 px-0.5 text-[8px] font-semibold text-white">13</span>}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-[#64748b] dark:text-slate-400">
        <span className="font-semibold">Legenda:</span>
        <span className={["inline-flex items-center gap-1 rounded-full px-2 py-0.5", getStatusColor("PENDENTE")].join(" ")}>
          <span className="h-1.5 w-1.5 rounded-full bg-current/80" /> Pendente
        </span>
        <span className={["inline-flex items-center gap-1 rounded-full px-2 py-0.5", getStatusColor("APROVADO_GERENTE")].join(" ")}>
          <span className="h-1.5 w-1.5 rounded-full bg-current/80" /> Aprovado
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
          <span className="rounded-sm bg-white/20 px-1 text-[9px]">A</span> Dia com pedido de abono 1/3 (retorno até 10 dias antes)
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-semibold text-white">
          <span className="rounded-sm bg-white/20 px-1 text-[9px]">13</span> Dia com pedido de adiantamento de 13º
        </span>
      </div>
    </section>
  );
}

