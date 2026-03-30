"use client";

import { Fragment, useState, useMemo } from "react";
import type { TeamMemberInfoSerialized } from "@/components/times-view/types";
import { isVacationApprovedStatus } from "@/lib/vacationRules";

const GLOBAL_CAPACITY_KEY = "__global_capacity__";

type Props = {
  members: TeamMemberInfoSerialized[];
  capacityScopedByGroup?: boolean;
  showExportCsv?: boolean;
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
      const end = r.abono && !Number.isNaN(rawEnd.getTime()) ? atMidnight(new Date(rawEnd.getTime() - 10 * 24 * 60 * 60 * 1000)) : rawEnd;
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

export function TeamCalendar({
  members,
  capacityScopedByGroup = false,
}: Props) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [viewMode, setViewMode] = useState<"month" | "year">("year");
  
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());

  const toggleCollapse = (key: string) => {
    setCollapsedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const visibleMembers = useMemo(() => {
    const visible: TeamMemberInfoSerialized[] = [];
    const isParentCollapsed = (m: TeamMemberInfoSerialized): boolean => {
        let curParent = m.calendarParentRowKey;
        while (curParent) {
            if (collapsedKeys.has(curParent)) return true;
            const parentMember = members.find(x => x.calendarRowKey === curParent);
            curParent = parentMember?.calendarParentRowKey;
        }
        return false;
    };

    members.forEach(m => {
        if (!isParentCollapsed(m)) {
            visible.push(m);
        }
    });
    return visible;
  }, [members, collapsedKeys]);

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), daysInMonth);
  const dayWidth = 28;
  const nameColWidth = 360;
  const timelineWidth = daysInMonth * dayWidth;
  const isCurrentMonth = currentMonth.getFullYear() === today.getFullYear() && currentMonth.getMonth() === today.getMonth();
  const todayDay = isCurrentMonth ? today.getDate() : null;
  const todayLineLeft = todayDay ? (todayDay - 1) * dayWidth : null;

  const monthLabel = currentMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const year = currentMonth.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const totalDaysInYear = daysInYear(year);
  const yearDayWidth = 3;
  const yearTimelineWidth = totalDaysInYear * yearDayWidth;

  const memberSegments = visibleMembers.map((member) => ({
    member,
    segments: getVacationSegments(member, monthStart, monthEnd),
  }));

  const yearMemberSegments = visibleMembers.map((member) => ({
    member,
    segments: getVacationSegments(member, yearStart, yearEnd),
  }));

  function countGroupOnYearDay(member: TeamMemberInfoSerialized, dayIdx: number): number {
    const dms = atMidnight(new Date(atMidnight(yearStart).getTime() + dayIdx * ONE_DAY_MS)).getTime();
    const gk = capacityGroupKey(member, capacityScopedByGroup);
    return visibleMembers.reduce((sum: number, m: any) => {
      if (capacityGroupKey(m, capacityScopedByGroup) !== gk || m.calendarIsBranch) return sum;
      const segs = getVacationSegments(m, yearStart, yearEnd);
      return sum + (segs.some((s: any) => atMidnight(s.start).getTime() <= dms && dms <= atMidnight(s.end).getTime()) ? 1 : 0);
    }, 0);
  }

  function countGroupOnMonthDay(member: TeamMemberInfoSerialized, dayIdx: number): number {
    const dms = atMidnight(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayIdx + 1)).getTime();
    const gk = capacityGroupKey(member, capacityScopedByGroup);
    return memberSegments.reduce((sum: number, row: any) => {
      if (capacityGroupKey(row.member, capacityScopedByGroup) !== gk || row.member.calendarIsBranch) return sum;
      return sum + (row.segments.some((s: any) => atMidnight(s.start).getTime() <= dms && dms <= atMidnight(s.end).getTime()) ? 1 : 0);
    }, 0);
  }

  const dayMeta = Array.from({ length: daysInMonth }, (_, idx) => {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), idx + 1);
    const weekDay = d.getDay();
    return { day: idx + 1, isWeekend: weekDay === 0 || weekDay === 6, weekLabel: ["D", "S", "T", "Q", "Q", "S", "S"][weekDay] };
  });

  return (
    <section className="rounded-lg border border-[#e2e8f0] bg-white p-5 dark:border-[#252a35] dark:bg-[#1a1d23]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-[#1a1d23] dark:text-white">
            {viewMode === "month" ? "Calendário Mensal" : "Calendário Anual"}
          </h4>
          <p className="mt-1 text-xs text-[#64748b] dark:text-slate-400">
            Use as setas (↳) para navegar. Títulos em negrito são apenas organizadores.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" className="rounded-md border border-[#e2e8f0] px-2.5 py-1 text-sm font-semibold text-[#475569] hover:bg-[#f5f6f8] dark:border-[#252a35] dark:text-slate-200 dark:hover:bg-[#1e2330]" onClick={() => setViewMode((v) => (v === "month" ? "year" : "month"))}>
            {viewMode === "month" ? "Ver ano" : "Ver mês"}
          </button>
          <button type="button" className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e2e8f0] text-xs text-[#64748b] hover:bg-[#f5f6f8] dark:border-[#252a35] dark:text-slate-300 dark:hover:bg-[#1e2330]" onClick={() => setCurrentMonth((prev) => viewMode === "year" ? new Date(prev.getFullYear() - 1, prev.getMonth(), 1) : new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>‹</button>
          <span className="min-w-[140px] text-center text-base font-semibold text-[#475569] dark:text-slate-300 capitalize">{viewMode === "month" ? monthLabel : currentMonth.getFullYear()}</span>
          <button type="button" className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e2e8f0] text-xs text-[#64748b] hover:bg-[#f5f6f8] dark:border-[#252a35] dark:text-slate-300 dark:hover:bg-[#1e2330]" onClick={() => setCurrentMonth((prev) => viewMode === "year" ? new Date(prev.getFullYear() + 1, prev.getMonth(), 1) : new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>›</button>
        </div>
      </div>

      <div className="max-h-[min(75vh,60rem)] overflow-x-auto overflow-y-auto rounded-md border border-[#e2e8f0] dark:border-[#252a35]">
        <div className="min-w-max">
          <div className="sticky top-0 z-[45] mb-2 flex bg-white shadow-sm dark:bg-[#1a1d23]">
            <div className="sticky left-0 top-0 z-[50] shrink-0 border-b border-[#e2e8f0] bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#64748b] dark:border-[#252a35] dark:bg-[#1a1d23]" style={{ width: nameColWidth }}>Hierarquia / Integrante</div>
            {viewMode === "year" ? (
              <div className="flex border-b border-[#e2e8f0] bg-[#f8fafc] dark:border-[#252a35] dark:bg-[#1a1d23]" style={{ width: yearTimelineWidth }}>
                {Array.from({ length: 12 }, (_, mi) => {
                  const dim = new Date(year, mi + 1, 0).getDate();
                  const pct = (dim / totalDaysInYear) * 100;
                  return <div key={mi} style={{ width: `${pct}%` }} className="border-l border-[#e2e8f0] bg-[#f8fafc] py-1 text-center text-[9px] font-black uppercase text-[#64748b] first:border-l-0 dark:border-[#252a35] dark:bg-[#141720]">{new Date(year, mi, 1).toLocaleDateString("pt-BR", { month: "short" })}</div>;
                })}
              </div>
            ) : (
              <div className="grid gap-0.5 border-b border-[#e2e8f0] bg-white dark:border-[#252a35] dark:bg-[#1a1d23]" style={{ width: timelineWidth, gridTemplateColumns: `repeat(${daysInMonth}, minmax(0, 1fr))` }}>
                {dayMeta.map((d) => (
                  <div key={d.day} className={["flex min-h-[30px] flex-col items-center justify-center pt-1 pb-1 text-[10px] leading-none", d.isWeekend ? "bg-slate-50 text-slate-400 dark:bg-slate-800/30" : "text-[#64748b]", todayDay === d.day ? "bg-blue-50 text-blue-600 ring-1 ring-blue-200" : ""].join(" ")}>
                    <span className="text-[9px] font-bold">{d.weekLabel}</span>
                    <span className="mt-0.5 font-black">{d.day}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            {viewMode === "year" ? (
              yearMemberSegments.map(({ member, segments }, rowIdx) => {
                const todayLine = today.getFullYear() === year ? dayIndexInRange(today, yearStart, yearEnd) * yearDayWidth + yearDayWidth / 2 : null;
                const isCollapsed = member.calendarRowKey && collapsedKeys.has(member.calendarRowKey);
                const hasChildren = member.calendarIsBranch;

                return (
                  <div key={member.calendarRowKey ?? rowIdx} className="group flex items-center">
                    <div className={["sticky left-0 z-10 shrink-0 truncate px-4 text-[11px] font-semibold text-[#475569] dark:text-slate-300", rowIdx % 2 === 0 ? "bg-white dark:bg-[#1a1d23]" : "bg-[#fafbfc] dark:bg-[#161922]"].join(" ")} style={{ width: nameColWidth, paddingLeft: member.calendarLevel ? `${(member.calendarLevel * 20) + 12}px` : "12px" }}>
                        <div className="flex items-center gap-1">
                            {hasChildren && (
                                <button 
                                    onClick={() => toggleCollapse(member.calendarRowKey!)}
                                    className="flex h-4 w-4 items-center justify-center rounded-sm bg-slate-100 text-[10px] font-black hover:bg-blue-100 hover:text-blue-600 dark:bg-slate-800 dark:hover:bg-blue-900/40"
                                >
                                    {isCollapsed ? "+" : "-"}
                                </button>
                            )}
                            <span className={["truncate", member.calendarIsBranch ? "font-black text-[#1e3a8a] dark:text-blue-300 uppercase tracking-tight" : ""].join(" ")}>
                                {member.calendarDisplayName ?? member.user.name}
                            </span>
                        </div>
                    </div>
                    {member.calendarIsBranch && (!member.requests || member.requests.length === 0) ? (
                        <div className="h-8 border-b border-blue-50/50 bg-blue-50/5 dark:border-blue-900/10 dark:bg-blue-900/5" style={{ width: yearTimelineWidth }} />
                    ) : (
                        <div className={["relative h-8 overflow-hidden rounded-sm border border-[#e2e8f0] dark:border-[#252a35]", rowIdx % 2 === 0 ? "bg-[#f8fafc] dark:bg-[#020617]" : "bg-[#f1f5f9] dark:bg-[#0b1020]", "group-hover:ring-1 group-hover:ring-blue-200/70"].join(" ")} style={{ width: yearTimelineWidth }}>
                        {todayLine !== null && <div className="pointer-events-none absolute inset-y-0 z-10 w-px bg-blue-500/50" style={{ left: todayLine }} />}
                        <div className="pointer-events-none absolute inset-0 grid gap-0" style={{ gridTemplateColumns: `repeat(${totalDaysInYear}, minmax(0, 1fr))` }}>
                            {Array.from({ length: totalDaysInYear }, (_, idx) => countGroupOnYearDay(member, idx) >= 2 && <div key={idx} className="bg-red-500/10 border-r border-red-500/20" />)}
                        </div>
                        {segments.map((s, segIdx) => {
                            const sIdx = dayIndexInRange(s.start, yearStart, yearEnd);
                            const eIdx = dayIndexInRange(s.end, yearStart, yearEnd);
                            const dayLeft = sIdx * yearDayWidth;
                            const w = (eIdx - sIdx + 1) * yearDayWidth;
                            const dateLabel = `${s.start.toLocaleDateString("pt-BR")} a ${s.end.toLocaleDateString("pt-BR")}`;
                            return <div key={segIdx} className={["absolute top-1.5 h-4 border shadow-xs rounded-sm transition-transform hover:scale-y-110", s.status === "PENDENTE" ? "border-amber-400 bg-amber-300/80" : "border-emerald-500 bg-emerald-400/80"].join(" ")} style={{ left: dayLeft, width: w }} title={`Período: ${dateLabel} (${s.status === "PENDENTE" ? "Pendente" : "Aprovado"})`} />;
                        })}
                        </div>
                    )}
                  </div>
                );
              })
            ) : (
              memberSegments.map(({ member, segments }, rowIdx) => {
                const isCollapsed = member.calendarRowKey && collapsedKeys.has(member.calendarRowKey);
                const hasChildren = member.calendarIsBranch;

                return (
                  <div key={member.calendarRowKey ?? rowIdx} className="group flex items-center">
                    <div className={["sticky left-0 z-10 shrink-0 truncate px-4 text-[11px] font-semibold text-[#475569] dark:text-slate-300", rowIdx % 2 === 0 ? "bg-white dark:bg-[#1a1d23]" : "bg-[#fafbfc] dark:bg-[#161922]"].join(" ")} style={{ width: nameColWidth, paddingLeft: member.calendarLevel ? `${(member.calendarLevel * 20) + 12}px` : "12px" }}>
                        <div className="flex items-center gap-1">
                            {hasChildren && (
                                <button 
                                    onClick={() => toggleCollapse(member.calendarRowKey!)}
                                    className="flex h-4 w-4 items-center justify-center rounded-sm bg-slate-100 text-[10px] font-black hover:bg-blue-100 hover:text-blue-600 dark:bg-slate-800 dark:hover:bg-blue-900/40"
                                >
                                    {isCollapsed ? "+" : "-"}
                                </button>
                            )}
                            <span className={["truncate", member.calendarIsBranch ? "font-black text-[#1e3a8a] dark:text-blue-300 uppercase tracking-tight" : ""].join(" ")}>
                                {member.calendarDisplayName ?? member.user.name}
                            </span>
                        </div>
                    </div>
                    {member.calendarIsBranch && (!member.requests || member.requests.length === 0) ? (
                        <div className="h-8 border-b border-blue-50/50 bg-blue-50/5 dark:border-blue-900/10 dark:bg-blue-900/5" style={{ width: timelineWidth }} />
                    ) : (
                        <div className={["relative h-8 overflow-hidden rounded-sm border border-[#e2e8f0] dark:border-[#252a35]", rowIdx % 2 === 0 ? "bg-[#f8fafc] dark:bg-[#020617]" : "bg-[#f1f5f9] dark:bg-[#0b1020]", "group-hover:ring-1 group-hover:ring-blue-200/70"].join(" ")} style={{ width: timelineWidth }}>
                        {todayLineLeft !== null && <div className="pointer-events-none absolute inset-y-0 z-10 w-px bg-blue-500/50" style={{ left: todayLineLeft + dayWidth / 2 }} />}
                        <div className="pointer-events-none absolute inset-0 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${daysInMonth}, minmax(0, 1fr))` }}>
                            {dayMeta.map((d, idx) => countGroupOnMonthDay(member, idx) >= 2 && <div key={idx} className="bg-red-500/10 border-r border-red-500/20" />)}
                        </div>
                        {segments.map((s, segIdx) => {
                            const start = Math.max(1, s.start.getDate());
                            const end = Math.min(daysInMonth, s.end.getDate());
                            const left = (start - 1) * dayWidth;
                            const w = (end - start + 1) * dayWidth;
                            const dateLabel = `${s.start.toLocaleDateString("pt-BR")} a ${s.end.toLocaleDateString("pt-BR")}`;
                            return <div key={segIdx} className={["absolute top-1.5 h-4 border shadow-xs rounded-sm transition-transform hover:scale-y-110", s.status === "PENDENTE" ? "border-amber-400 bg-amber-300/80" : "border-emerald-500 bg-emerald-400/80"].join(" ")} style={{ left, width: w }} title={`Período: ${dateLabel} (${s.status === "PENDENTE" ? "Pendente" : "Aprovado"})`} />;
                        })}
                        </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
