"use client";

import { useState } from "react";
import type { TeamMemberInfoSerialized } from "@/components/times-view-client";

type Props = {
  members: TeamMemberInfoSerialized[];
};

function atMidnight(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getVacationSegments(member: TeamMemberInfoSerialized, monthStart: Date, monthEnd: Date) {
  const monthStartMs = atMidnight(monthStart).getTime();
  const monthEndMs = atMidnight(monthEnd).getTime();

  return member.requests
    .filter((r) => r.status === "APROVADO_GERENTE" || r.status === "PENDENTE")
    .map((r) => {
      const start = atMidnight(new Date(r.startDate));
      const rawEnd = atMidnight(new Date(r.endDate));
      const end =
        r.abono && !Number.isNaN(rawEnd.getTime())
          ? atMidnight(new Date(rawEnd.getTime() - 10 * 24 * 60 * 60 * 1000))
          : rawEnd;
      return { start, end, status: r.status };
    })
    .filter((r) => r.end.getTime() >= monthStartMs && r.start.getTime() <= monthEndMs)
    .map((r) => ({
      start: r.start.getTime() < monthStartMs ? atMidnight(monthStart) : r.start,
      end: r.end.getTime() > monthEndMs ? atMidnight(monthEnd) : r.end,
      status: r.status,
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function TeamCalendar({ members }: Props) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [viewMode, setViewMode] = useState<"month" | "year">("month");

  const daysInMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0,
  ).getDate();
  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), daysInMonth);
  const dayWidth = 28;
  const nameColWidth = 240;
  const timelineWidth = daysInMonth * dayWidth;
  const isCurrentMonth =
    currentMonth.getFullYear() === today.getFullYear() &&
    currentMonth.getMonth() === today.getMonth();
  const todayDay = isCurrentMonth ? today.getDate() : null;
  const todayLineLeft = todayDay ? (todayDay - 1) * dayWidth : null;

  const monthLabel = currentMonth.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const sortedMembers = [...members].sort((a, b) =>
    (a.user.name ?? "").localeCompare(b.user.name ?? "", "pt-BR", { sensitivity: "base" }),
  );

  const memberSegments = sortedMembers.map((member) => ({
    member,
    segments: getVacationSegments(member, monthStart, monthEnd),
  }));

  const capacityByDay = Array.from({ length: daysInMonth }, (_, idx) => {
    const day = idx + 1;
    const count = memberSegments.reduce((sum, row) => {
      const isOnDay = row.segments.some((s) => day >= s.start.getDate() && day <= s.end.getDate());
      return sum + (isOnDay ? 1 : 0);
    }, 0);
    return count;
  });

  const yearMonths = Array.from({ length: 12 }, (_, monthIndex) => {
    const monthStartY = new Date(currentMonth.getFullYear(), monthIndex, 1);
    const monthEndY = new Date(currentMonth.getFullYear(), monthIndex + 1, 0);
    const days = monthEndY.getDate();
    const rows = sortedMembers.map((member) => ({
      member,
      segments: getVacationSegments(member, monthStartY, monthEndY),
    }));
    const counts = Array.from({ length: days }, (_, dayIdx) => {
      const day = dayIdx + 1;
      return rows.reduce((sum, row) => {
        const onDay = row.segments.some((s) => day >= s.start.getDate() && day <= s.end.getDate());
        return sum + (onDay ? 1 : 0);
      }, 0);
    });
    const hasPending = rows.some((r) => r.segments.some((s) => s.status === "PENDENTE"));
    const hasApproved = rows.some((r) => r.segments.some((s) => s.status === "APROVADO_GERENTE"));
    const affectedDays = counts.filter((c) => c >= 2).length;
    const approvedDays = rows.reduce(
      (sum, row) =>
        sum +
        row.segments.filter((s) => s.status === "APROVADO_GERENTE").reduce((acc, s) => {
          return acc + (s.end.getDate() - s.start.getDate() + 1);
        }, 0),
      0,
    );
    const pendingDays = rows.reduce(
      (sum, row) =>
        sum +
        row.segments.filter((s) => s.status === "PENDENTE").reduce((acc, s) => {
          return acc + (s.end.getDate() - s.start.getDate() + 1);
        }, 0),
      0,
    );
    const daysWithVacation = counts
      .map((count, idx) => ({ count, day: idx + 1 }))
      .filter((x) => x.count > 0);
    const firstBusyDay = daysWithVacation.length > 0 ? daysWithVacation[0].day : null;
    const lastBusyDay = daysWithVacation.length > 0 ? daysWithVacation[daysWithVacation.length - 1].day : null;
    return {
      monthIndex,
      monthStartY,
      days,
      counts,
      hasPending,
      hasApproved,
      affectedDays,
      approvedDays,
      pendingDays,
      firstBusyDay,
      lastBusyDay,
    };
  });

  const dayMeta = Array.from({ length: daysInMonth }, (_, idx) => {
    const day = idx + 1;
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const weekDay = d.getDay(); // 0 dom, 6 sab
    const isWeekend = weekDay === 0 || weekDay === 6;
    const weekLabel = ["D", "S", "T", "Q", "Q", "S", "S"][weekDay];
    return { day, isWeekend, weekLabel };
  });

  return (
    <section className="overflow-x-auto rounded-lg border border-[#e2e8f0] bg-white p-5 dark:border-[#252a35] dark:bg-[#1a1d23]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h4 className="text-base font-semibold text-[#1a1d23] dark:text-white">
          {viewMode === "month"
            ? "Calendário consolidado do mês (aprovadas e pendentes)"
            : "Calendário consolidado do ano (aprovadas e pendentes)"}
        </h4>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-[#e2e8f0] px-2.5 py-1 text-sm font-semibold text-[#475569] hover:bg-[#f5f6f8] dark:border-[#252a35] dark:text-slate-200 dark:hover:bg-[#1e2330]"
            onClick={() => setViewMode((v) => (v === "month" ? "year" : "month"))}
          >
            {viewMode === "month" ? "Ver ano completo" : "Ver mês"}
          </button>
          <button
            type="button"
            aria-label="Mês anterior"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e2e8f0] text-xs text-[#64748b] hover:bg-[#f5f6f8] dark:border-[#252a35] dark:text-slate-300 dark:hover:bg-[#1e2330]"
            onClick={() =>
              setCurrentMonth((prev) =>
                viewMode === "year"
                  ? new Date(prev.getFullYear() - 1, prev.getMonth(), 1)
                  : new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
              )
            }
          >
            ‹
          </button>
          <span
            className="min-w-[140px] cursor-pointer text-center text-base font-semibold text-[#475569] dark:text-slate-300 capitalize"
            onClick={() => setViewMode((v) => (v === "month" ? "year" : "month"))}
            title="Clique para alternar entre mês e ano"
          >
            {viewMode === "month" ? monthLabel : currentMonth.getFullYear()}
          </span>
          <button
            type="button"
            aria-label="Próximo mês"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e2e8f0] text-xs text-[#64748b] hover:bg-[#f5f6f8] dark:border-[#252a35] dark:text-slate-300 dark:hover:bg-[#1e2330]"
            onClick={() =>
              setCurrentMonth((prev) =>
                viewMode === "year"
                  ? new Date(prev.getFullYear() + 1, prev.getMonth(), 1)
                  : new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
              )
            }
          >
            ›
          </button>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2 text-sm text-[#64748b] dark:text-slate-400">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
        <span>Férias aprovadas</span>
        <span className="ml-3 inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span>Férias pendentes</span>
        <span className="ml-3 inline-block h-2.5 w-2.5 rounded-full bg-red-300 dark:bg-red-700/70" />
        <span>Capacidade afetada (2+ no mesmo dia)</span>
      </div>

      {viewMode === "year" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {yearMonths.map((m) => (
            <button
              key={m.monthIndex}
              type="button"
              className="rounded-lg border border-[#e2e8f0] bg-white p-3 text-left hover:bg-[#f8fafc] dark:border-[#252a35] dark:bg-[#1a1d23] dark:hover:bg-[#141720]"
              onClick={() => {
                setCurrentMonth(new Date(currentMonth.getFullYear(), m.monthIndex, 1));
                setViewMode("month");
              }}
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-base font-semibold capitalize text-[#1a1d23] dark:text-white">
                  {m.monthStartY.toLocaleDateString("pt-BR", { month: "long" })}
                </p>
                <span className="text-xs text-[#64748b] dark:text-slate-400">
                  {m.firstBusyDay && m.lastBusyDay
                    ? `${String(m.firstBusyDay).padStart(2, "0")}–${String(m.lastBusyDay).padStart(2, "0")}`
                    : "Sem férias"}
                </span>
              </div>
              <div
                className="grid gap-0.5"
                style={{ gridTemplateColumns: `repeat(${m.days}, minmax(0, 1fr))` }}
              >
                {m.counts.map((count, idx) => (
                  <div
                    key={`${m.monthIndex}-${idx}`}
                    className={[
                      "h-3 rounded-sm",
                      count >= 2
                        ? "bg-red-300 dark:bg-red-700/70"
                        : count === 1 && m.hasPending
                          ? "bg-amber-300 dark:bg-amber-600/70"
                          : count === 1 && m.hasApproved
                            ? "bg-emerald-400 dark:bg-emerald-600/70"
                            : "bg-[#e2e8f0] dark:bg-[#252a35]",
                    ].join(" ")}
                    title={`${idx + 1}/${m.monthIndex + 1}: ${count} pessoa(s) de férias`}
                  />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  Aprovadas: {m.approvedDays}
                </span>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  Pendentes: {m.pendingDays}
                </span>
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  Dias afetados: {m.affectedDays}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-[#e2e8f0] dark:border-[#252a35]">
        <div className="min-w-max">
          <div className="mb-2 flex">
            <div
              className="sticky left-0 z-20 shrink-0 bg-white px-2 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-[#64748b] dark:bg-[#1a1d23] dark:text-slate-400"
              style={{ width: nameColWidth }}
            >
              Colaborador
            </div>
            <div
              className="grid gap-0.5 pt-1"
              style={{ width: timelineWidth, gridTemplateColumns: `repeat(${daysInMonth}, minmax(0, 1fr))` }}
            >
              {dayMeta.map((d) => (
                <div
                  key={d.day}
                  className={[
                    "flex min-h-[34px] flex-col items-center justify-center rounded-sm pt-1 pb-1 text-[11px] leading-none",
                    d.isWeekend
                      ? "bg-slate-100 text-slate-500 dark:bg-slate-800/40 dark:text-slate-400"
                      : "text-[#64748b] dark:text-slate-300",
                    todayDay === d.day
                      ? "ring-1 ring-blue-400/70 dark:ring-blue-400/60"
                      : "",
                  ].join(" ")}
                >
                  <span className="text-[10px] font-semibold leading-none">{d.weekLabel}</span>
                  <span className="mt-0.5 text-xs font-bold leading-none">{d.day}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            {memberSegments.map(({ member, segments }, rowIdx) => {
              return (
                <div key={member.user.id} className="group flex items-center py-0.5">
                  <div
                    className={[
                      "sticky left-0 z-10 shrink-0 truncate px-2 text-sm text-[#475569] dark:text-slate-300",
                      rowIdx % 2 === 0 ? "bg-white dark:bg-[#1a1d23]" : "bg-[#fafbfc] dark:bg-[#161922]",
                    ].join(" ")}
                    style={{ width: nameColWidth }}
                    title={member.user.name}
                  >
                    {member.user.name}
                  </div>
                  <div
                    className={[
                      "relative h-9 overflow-hidden rounded-md border border-[#e2e8f0] dark:border-[#252a35]",
                      rowIdx % 2 === 0 ? "bg-[#f8fafc] dark:bg-[#020617]" : "bg-[#f1f5f9] dark:bg-[#0b1020]",
                      "group-hover:ring-1 group-hover:ring-blue-200/70 dark:group-hover:ring-blue-900/40",
                    ].join(" ")}
                    style={{ width: timelineWidth }}
                  >
                    {todayLineLeft !== null && (
                      <div
                        className="pointer-events-none absolute inset-y-0 z-10 w-px bg-blue-500/80 dark:bg-blue-400/80"
                        style={{ left: todayLineLeft + dayWidth / 2 }}
                      />
                    )}
                    <div
                      className="pointer-events-none absolute inset-0 grid gap-0.5"
                      style={{ gridTemplateColumns: `repeat(${daysInMonth}, minmax(0, 1fr))` }}
                    >
                      {dayMeta.map((d, idx) => {
                        const count = capacityByDay[idx] ?? 0;
                        return (
                        <div
                          key={d.day}
                          className={[
                            "border-r last:border-r-0",
                            count >= 2
                              ? "bg-red-50/80 border-red-100/80 dark:bg-red-900/15 dark:border-red-800/30"
                              : d.isWeekend
                                ? "bg-slate-100/70 border-slate-200/70 dark:bg-slate-800/20 dark:border-slate-700/30"
                              : "border-[#e2e8f0]/60 dark:border-[#252a35]/50",
                          ].join(" ")}
                          title={count >= 2 ? `Capacidade afetada: ${count} pessoa(s) no dia ${d.day}` : undefined}
                        />
                        );
                      })}
                    </div>

                    {segments.map((s, idx) => {
                      const startDay = Math.max(1, s.start.getDate());
                      const endDay = Math.min(daysInMonth, s.end.getDate());
                      const left = (startDay - 1) * dayWidth + 1;
                      const rawWidth = Math.max(dayWidth - 2, (endDay - startDay + 1) * dayWidth - 2);
                      const width = Math.min(rawWidth, timelineWidth - left - 1);
                      return (
                        <div
                          key={`${member.user.id}-seg-${idx}`}
                          className={[
                            "absolute top-2 h-5 rounded-sm border shadow-sm",
                            s.status === "PENDENTE"
                              ? "border-amber-500/40 bg-amber-400/90"
                              : "border-emerald-600/40 bg-emerald-500/90",
                          ].join(" ")}
                          style={{ left, width }}
                          title={`${member.user.name}: ${s.start.toLocaleDateString("pt-BR")} a ${s.end.toLocaleDateString("pt-BR")} (${s.status === "PENDENTE" ? "Pendente" : "Aprovado"})`}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      )}

      <p className="mt-3 text-xs text-[#94a3b8] dark:text-slate-500">
        Considera períodos com status <span className="font-semibold">Aprovado</span> e{" "}
        <span className="font-semibold">Pendente</span>.
        Quando há <span className="font-semibold">abono 1/3</span>, o retorno é ajustado em 10 dias
        para frente e a barra mostra apenas os dias efetivos de descanso.
      </p>
      <p className="mt-1 text-[11px] text-[#94a3b8] dark:text-slate-500">
        Dica: role horizontalmente para ver o mês completo.
      </p>
    </section>
  );
}

