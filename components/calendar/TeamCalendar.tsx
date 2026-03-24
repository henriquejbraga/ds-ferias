"use client";

import { Fragment, useState } from "react";
import type { TeamMemberInfoSerialized } from "@/components/times-view-client";
import { isVacationApprovedStatus } from "@/lib/vacationRules";

const GLOBAL_CAPACITY_KEY = "__global_capacity__";

type Props = {
  members: TeamMemberInfoSerialized[];
  /** Se true, vermelho (2+ no dia) só dentro do mesmo calendarCapacityGroupKey. */
  capacityScopedByGroup?: boolean;
};

function capacityGroupKey(member: TeamMemberInfoSerialized, scoped: boolean): string {
  if (!scoped) return GLOBAL_CAPACITY_KEY;
  return member.calendarCapacityGroupKey ?? GLOBAL_CAPACITY_KEY;
}

function atMidnight(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function dayIndexInRange(d: Date, rangeStart: Date, rangeEnd: Date): number {
  const t = atMidnight(d).getTime();
  const t0 = atMidnight(rangeStart).getTime();
  const t1 = atMidnight(rangeEnd).getTime();
  const idx = Math.round((t - t0) / ONE_DAY_MS);
  const max = Math.round((t1 - t0) / ONE_DAY_MS);
  return Math.min(Math.max(0, idx), max);
}

function daysInYear(year: number): number {
  return Math.round((new Date(year + 1, 0, 1).getTime() - new Date(year, 0, 1).getTime()) / ONE_DAY_MS);
}

function getVacationSegments(member: TeamMemberInfoSerialized, monthStart: Date, monthEnd: Date) {
  const monthStartMs = atMidnight(monthStart).getTime();
  const monthEndMs = atMidnight(monthEnd).getTime();

  return member.requests
    .filter((r) => r.status === "PENDENTE" || isVacationApprovedStatus(r.status))
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

export function TeamCalendar({ members, capacityScopedByGroup = false }: Props) {
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

  const sortedMembers = [...members].sort((a, b) => {
    const so = (a.calendarSectionOrder ?? 99) - (b.calendarSectionOrder ?? 99);
    if (so !== 0) return so;
    const gk = capacityGroupKey(a, capacityScopedByGroup).localeCompare(
      capacityGroupKey(b, capacityScopedByGroup),
      "pt-BR",
    );
    if (gk !== 0) return gk;
    return (a.user.name ?? "").localeCompare(b.user.name ?? "", "pt-BR", { sensitivity: "base" });
  });

  const memberSegments = sortedMembers.map((member) => ({
    member,
    segments: getVacationSegments(member, monthStart, monthEnd),
  }));

  /** Só listamos quem tem férias aprovadas ou pendentes no período visível. */
  const visibleMemberSegments = memberSegments.filter(({ segments }) => segments.length > 0);

  function countGroupOnMonthDay(member: TeamMemberInfoSerialized, dayIdx: number): number {
    const day = dayIdx + 1;
    const dayDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const dms = atMidnight(dayDate).getTime();
    const gk = capacityGroupKey(member, capacityScopedByGroup);
    return memberSegments.reduce((sum, row) => {
      if (capacityGroupKey(row.member, capacityScopedByGroup) !== gk) return sum;
      const on = row.segments.some(
        (s) => atMidnight(s.start).getTime() <= dms && dms <= atMidnight(s.end).getTime(),
      );
      return sum + (on ? 1 : 0);
    }, 0);
  }

  const year = currentMonth.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const totalDaysInYear = daysInYear(year);
  const yearDayWidth = 3;
  const yearTimelineWidth = totalDaysInYear * yearDayWidth;

  const yearMemberSegments = sortedMembers
    .map((member) => ({
      member,
      segments: getVacationSegments(member, yearStart, yearEnd),
    }))
    .filter(({ segments }) => segments.length > 0);

  function countGroupOnYearDay(member: TeamMemberInfoSerialized, dayIdx: number): number {
    const dms = atMidnight(new Date(atMidnight(yearStart).getTime() + dayIdx * ONE_DAY_MS)).getTime();
    const gk = capacityGroupKey(member, capacityScopedByGroup);
    return sortedMembers.reduce((sum, m) => {
      if (capacityGroupKey(m, capacityScopedByGroup) !== gk) return sum;
      const segs = getVacationSegments(m, yearStart, yearEnd);
      const on = segs.some(
        (s) => atMidnight(s.start).getTime() <= dms && dms <= atMidnight(s.end).getTime(),
      );
      return sum + (on ? 1 : 0);
    }, 0);
  }

  const dayMeta = Array.from({ length: daysInMonth }, (_, idx) => {
    const day = idx + 1;
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const weekDay = d.getDay(); // 0 dom, 6 sab
    const isWeekend = weekDay === 0 || weekDay === 6;
    const weekLabel = ["D", "S", "T", "Q", "Q", "S", "S"][weekDay];
    return { day, isWeekend, weekLabel };
  });

  return (
    <section className="rounded-lg border border-[#e2e8f0] bg-white p-5 dark:border-[#252a35] dark:bg-[#1a1d23]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-[#1a1d23] dark:text-white">
            {viewMode === "month"
              ? "Calendário consolidado do mês (aprovadas e pendentes)"
              : "Calendário consolidado do ano (aprovadas e pendentes)"}
          </h4>
          <p className="mt-1 text-xs text-[#64748b] dark:text-slate-400">
            {viewMode === "month"
              ? visibleMemberSegments.length === 0
                ? "Nenhuma linha: só aparecem colaboradores com férias pendentes ou aprovadas neste mês."
                : `Uma linha por colaborador — ${visibleMemberSegments.length} com férias neste mês.`
              : yearMemberSegments.length === 0
                ? "Nenhuma linha: só aparecem colaboradores com férias pendentes ou aprovadas neste ano."
                : `Uma linha por colaborador — ${yearMemberSegments.length} com férias em ${year}.`}
          </p>
        </div>
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
        <span>Pendente aprovação</span>
        <span className="ml-3 inline-block h-2.5 w-2.5 rounded-full bg-red-300 dark:bg-red-700/70" />
        <span>
          {capacityScopedByGroup
            ? "Capacidade afetada (2+ no mesmo dia no mesmo time)"
            : "Capacidade afetada (2+ no mesmo dia)"}
        </span>
      </div>

      {viewMode === "year" ? (
        yearMemberSegments.length === 0 ? (
          <p className="rounded-md border border-dashed border-[#e2e8f0] bg-[#f8fafc] px-4 py-6 text-center text-sm text-[#64748b] dark:border-[#252a35] dark:bg-[#141720] dark:text-slate-400">
            Nenhum colaborador com férias pendentes ou aprovadas em {year}.
          </p>
        ) : (
          <div className="max-h-[min(72vh,56rem)] overflow-x-auto overflow-y-auto rounded-md border border-[#e2e8f0] dark:border-[#252a35]">
            <div className="min-w-max">
              <div className="sticky top-0 z-[45] mb-2 flex bg-white shadow-[0_4px_6px_-1px_rgba(15,23,42,0.08)] dark:bg-[#1a1d23] dark:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.35)]">
                <div
                  className="sticky left-0 top-0 z-[50] shrink-0 border-b border-[#e2e8f0] bg-white px-2 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-[#64748b] dark:border-[#252a35] dark:bg-[#1a1d23] dark:text-slate-400"
                  style={{ width: nameColWidth }}
                >
                  Colaborador
                </div>
                <div
                  className="flex border-b border-[#e2e8f0] bg-[#f8fafc] pt-1 dark:border-[#252a35] dark:bg-[#1a1d23]"
                  style={{ width: yearTimelineWidth }}
                >
                  {Array.from({ length: 12 }, (_, mi) => {
                    const dim = new Date(year, mi + 1, 0).getDate();
                    const pct = (dim / totalDaysInYear) * 100;
                    return (
                      <div
                        key={mi}
                        style={{ width: `${pct}%` }}
                        className="border-l border-[#e2e8f0] bg-[#f8fafc] py-1 text-center text-[10px] font-semibold capitalize text-[#64748b] first:border-l-0 dark:border-[#252a35] dark:bg-[#141720] dark:text-slate-400"
                      >
                        {new Date(year, mi, 1).toLocaleDateString("pt-BR", { month: "short" })}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                {yearMemberSegments.map(({ member, segments }, rowIdx) => {
                  const prevMember =
                    rowIdx > 0 ? yearMemberSegments[rowIdx - 1]?.member : undefined;
                  const showSectionHeader =
                    Boolean(member.calendarSectionTitle) &&
                    (!prevMember || prevMember.calendarSectionTitle !== member.calendarSectionTitle);
                  const showSubsectionHeader =
                    Boolean(member.calendarSubsectionTitle) &&
                    (!prevMember ||
                      prevMember.calendarSubsectionTitle !== member.calendarSubsectionTitle);
                  const displayName = member.calendarDisplayName ?? member.user.name;
                  const rowKey = `${member.user.id}-year-${capacityGroupKey(member, capacityScopedByGroup)}-${rowIdx}`;
                  const todayYearLine = today.getFullYear() === year ? dayIndexInRange(today, yearStart, yearEnd) * yearDayWidth + yearDayWidth / 2 : null;
                  return (
                    <Fragment key={rowKey}>
                      {showSectionHeader && member.calendarSectionTitle && (
                        <div className="flex min-w-max">
                          <div
                            className="sticky left-0 z-30 shrink-0 border-y border-[#e2e8f0] bg-slate-100 px-2 py-2 text-[11px] font-bold uppercase tracking-wide text-[#475569] dark:border-[#252a35] dark:bg-[#1e2330] dark:text-slate-300"
                            style={{ width: nameColWidth }}
                          >
                            {member.calendarSectionTitle}
                          </div>
                          <div
                            className="border-y border-[#e2e8f0] bg-slate-100 dark:border-[#252a35] dark:bg-[#1e2330]"
                            style={{ width: yearTimelineWidth }}
                          />
                        </div>
                      )}
                      {showSubsectionHeader && member.calendarSubsectionTitle && (
                        <div className="flex min-w-max">
                          <div
                            className="sticky left-0 z-30 shrink-0 border-b border-[#e2e8f0] bg-[#f1f5f9] px-2 py-1.5 text-xs font-semibold text-[#64748b] dark:border-[#252a35] dark:bg-[#141720] dark:text-slate-400"
                            style={{ width: nameColWidth }}
                          >
                            {member.calendarSubsectionTitle}
                          </div>
                          <div
                            className="border-b border-[#e2e8f0] bg-[#f1f5f9] dark:border-[#252a35] dark:bg-[#141720]"
                            style={{ width: yearTimelineWidth }}
                          />
                        </div>
                      )}
                    <div className="group flex items-center py-0.5">
                      <div
                        className={[
                          "sticky left-0 z-10 shrink-0 truncate px-2 text-sm text-[#475569] dark:text-slate-300",
                          rowIdx % 2 === 0 ? "bg-white dark:bg-[#1a1d23]" : "bg-[#fafbfc] dark:bg-[#161922]",
                        ].join(" ")}
                        style={{ width: nameColWidth }}
                        title={displayName}
                      >
                        {displayName}
                      </div>
                      <div
                        className={[
                          "relative h-9 overflow-hidden rounded-md border border-[#e2e8f0] dark:border-[#252a35]",
                          rowIdx % 2 === 0 ? "bg-[#f8fafc] dark:bg-[#020617]" : "bg-[#f1f5f9] dark:bg-[#0b1020]",
                          "group-hover:ring-1 group-hover:ring-blue-200/70 dark:group-hover:ring-blue-900/40",
                        ].join(" ")}
                        style={{ width: yearTimelineWidth }}
                      >
                        {todayYearLine !== null && (
                          <div
                            className="pointer-events-none absolute inset-y-0 z-10 w-px bg-blue-500/80 dark:bg-blue-400/80"
                            style={{ left: todayYearLine }}
                          />
                        )}
                        <div
                          className="pointer-events-none absolute inset-0 grid gap-0"
                          style={{ gridTemplateColumns: `repeat(${totalDaysInYear}, minmax(0, 1fr))` }}
                        >
                          {Array.from({ length: totalDaysInYear }, (_, idx) => {
                            const count = countGroupOnYearDay(member, idx);
                            return (
                            <div
                              key={`ybg-${idx}`}
                              className={[
                                "border-r last:border-r-0",
                                count >= 2
                                  ? "bg-red-50/80 border-red-100/80 dark:bg-red-900/15 dark:border-red-800/30"
                                  : "border-[#e2e8f0]/40 dark:border-[#252a35]/40",
                              ].join(" ")}
                              title={`Dia ${idx + 1}: ${count} pessoa(s) de férias no grupo`}
                            />
                            );
                          })}
                        </div>

                        {segments.map((s, segIdx) => {
                          const startIdx = dayIndexInRange(s.start, yearStart, yearEnd);
                          const endIdx = dayIndexInRange(s.end, yearStart, yearEnd);
                          return (
                            <Fragment key={`${member.user.id}-yseg-${segIdx}`}>
                              {Array.from({ length: endIdx - startIdx + 1 }, (_, i) => {
                                const dayIdx = startIdx + i;
                                const conflict = countGroupOnYearDay(member, dayIdx) >= 2;
                                const dayLeft = dayIdx * yearDayWidth + 1;
                                const w = Math.max(1, yearDayWidth - 2);
                                const isFirst = i === 0;
                                const isLast = i === endIdx - startIdx;
                                return (
                                  <div
                                    key={`${member.user.id}-yseg-${segIdx}-d${dayIdx}`}
                                    className={[
                                      "absolute top-2 h-5 border shadow-sm",
                                      isFirst ? "rounded-l-sm" : "",
                                      isLast ? "rounded-r-sm" : "",
                                      conflict
                                        ? "border-red-600/50 bg-red-500/95 dark:bg-red-600/90"
                                        : s.status === "PENDENTE"
                                          ? "border-amber-500/40 bg-amber-400/90"
                                          : "border-emerald-600/40 bg-emerald-500/90",
                                    ]
                                      .filter(Boolean)
                                      .join(" ")}
                                    style={{ left: dayLeft, width: w }}
                                    title={`${displayName}: ${s.start.toLocaleDateString("pt-BR")} a ${s.end.toLocaleDateString("pt-BR")} (${s.status === "PENDENTE" ? "Pendente" : "Aprovado"})${conflict ? " — capacidade afetada no dia" : ""}`}
                                  />
                                );
                              })}
                            </Fragment>
                          );
                        })}
                      </div>
                    </div>
                    </Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="max-h-[min(72vh,56rem)] overflow-x-auto overflow-y-auto rounded-md border border-[#e2e8f0] dark:border-[#252a35]">
        <div className="min-w-max">
          <div className="sticky top-0 z-[45] mb-2 flex bg-white shadow-[0_4px_6px_-1px_rgba(15,23,42,0.08)] dark:bg-[#1a1d23] dark:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.35)]">
            <div
              className="sticky left-0 top-0 z-[50] shrink-0 border-b border-[#e2e8f0] bg-white px-2 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-[#64748b] dark:border-[#252a35] dark:bg-[#1a1d23] dark:text-slate-400"
              style={{ width: nameColWidth }}
            >
              Colaborador
            </div>
            <div
              className="grid gap-0.5 border-b border-[#e2e8f0] bg-white pt-1 dark:border-[#252a35] dark:bg-[#1a1d23]"
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
            {visibleMemberSegments.length === 0 ? (
              <p className="rounded-md border border-dashed border-[#e2e8f0] bg-[#f8fafc] px-4 py-6 text-center text-sm text-[#64748b] dark:border-[#252a35] dark:bg-[#141720] dark:text-slate-400">
                Nenhum colaborador com férias pendentes ou aprovadas neste mês.
              </p>
            ) : (
            visibleMemberSegments.map(({ member, segments }, rowIdx) => {
              const prevMember =
                rowIdx > 0 ? visibleMemberSegments[rowIdx - 1]?.member : undefined;
              const showSectionHeader =
                Boolean(member.calendarSectionTitle) &&
                (!prevMember || prevMember.calendarSectionTitle !== member.calendarSectionTitle);
              const showSubsectionHeader =
                Boolean(member.calendarSubsectionTitle) &&
                (!prevMember || prevMember.calendarSubsectionTitle !== member.calendarSubsectionTitle);
              const displayName = member.calendarDisplayName ?? member.user.name;
              const rowKey = `${member.user.id}-mo-${capacityGroupKey(member, capacityScopedByGroup)}-${rowIdx}`;
              return (
                <Fragment key={rowKey}>
                  {showSectionHeader && member.calendarSectionTitle && (
                    <div className="flex min-w-max">
                      <div
                        className="sticky left-0 z-30 shrink-0 border-y border-[#e2e8f0] bg-slate-100 px-2 py-2 text-[11px] font-bold uppercase tracking-wide text-[#475569] dark:border-[#252a35] dark:bg-[#1e2330] dark:text-slate-300"
                        style={{ width: nameColWidth }}
                      >
                        {member.calendarSectionTitle}
                      </div>
                      <div
                        className="border-y border-[#e2e8f0] bg-slate-100 dark:border-[#252a35] dark:bg-[#1e2330]"
                        style={{ width: timelineWidth }}
                      />
                    </div>
                  )}
                  {showSubsectionHeader && member.calendarSubsectionTitle && (
                    <div className="flex min-w-max">
                      <div
                        className="sticky left-0 z-30 shrink-0 border-b border-[#e2e8f0] bg-[#f1f5f9] px-2 py-1.5 text-xs font-semibold text-[#64748b] dark:border-[#252a35] dark:bg-[#141720] dark:text-slate-400"
                        style={{ width: nameColWidth }}
                      >
                        {member.calendarSubsectionTitle}
                      </div>
                      <div
                        className="border-b border-[#e2e8f0] bg-[#f1f5f9] dark:border-[#252a35] dark:bg-[#141720]"
                        style={{ width: timelineWidth }}
                      />
                    </div>
                  )}
                <div className="group flex items-center py-0.5">
                  <div
                    className={[
                      "sticky left-0 z-10 shrink-0 truncate px-2 text-sm text-[#475569] dark:text-slate-300",
                      rowIdx % 2 === 0 ? "bg-white dark:bg-[#1a1d23]" : "bg-[#fafbfc] dark:bg-[#161922]",
                    ].join(" ")}
                    style={{ width: nameColWidth }}
                    title={displayName}
                  >
                    {displayName}
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
                        const count = countGroupOnMonthDay(member, idx);
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

                    {segments.map((s, segIdx) => {
                      const startDay = Math.max(1, s.start.getDate());
                      const endDay = Math.min(daysInMonth, s.end.getDate());
                      return (
                        <Fragment key={`${member.user.id}-seg-${segIdx}`}>
                          {Array.from({ length: endDay - startDay + 1 }, (_, i) => {
                            const day = startDay + i;
                            const conflict = countGroupOnMonthDay(member, day - 1) >= 2;
                            const left = (day - 1) * dayWidth + 1;
                            const w = Math.max(1, dayWidth - 2);
                            const isFirst = day === startDay;
                            const isLast = day === endDay;
                            return (
                              <div
                                key={`${member.user.id}-seg-${segIdx}-d${day}`}
                                className={[
                                  "absolute top-2 h-5 border shadow-sm",
                                  isFirst ? "rounded-l-sm" : "",
                                  isLast ? "rounded-r-sm" : "",
                                  conflict
                                    ? "border-red-600/50 bg-red-500/95 dark:bg-red-600/90"
                                    : s.status === "PENDENTE"
                                      ? "border-amber-500/40 bg-amber-400/90"
                                      : "border-emerald-600/40 bg-emerald-500/90",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                style={{ left, width: w }}
                                title={`${displayName}: ${s.start.toLocaleDateString("pt-BR")} a ${s.end.toLocaleDateString("pt-BR")} (${s.status === "PENDENTE" ? "Pendente" : "Aprovado"})${conflict ? " — capacidade afetada neste dia" : ""}`}
                              />
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </div>
                </div>
                </Fragment>
              );
            })
            )}
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
        {viewMode === "month"
          ? "Dica: role dentro da grade para ver mais linhas; o cabeçalho (colaborador e dias) permanece fixo. Role também na horizontal para o mês completo."
          : capacityScopedByGroup
            ? "Dica: role dentro da grade para mais linhas; o cabeçalho fica fixo. Na horizontal vê o ano; capacidade considera só o mesmo grupo (time ou coordenadores)."
            : "Dica: role dentro da grade para mais linhas; o cabeçalho fica fixo. Na horizontal vê o ano; capacidade considera todo o time listado."}
      </p>
    </section>
  );
}

