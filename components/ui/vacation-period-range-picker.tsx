"use client";

import * as React from "react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

function formatYmdLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseYmdLocal(value: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return undefined;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function atMidnight(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Inclusive entre duas datas (só calendário local). */
function isBetweenInclusive(date: Date, a: Date, b: Date): boolean {
  const t = atMidnight(date);
  const t1 = atMidnight(a);
  const t2 = atMidnight(b);
  const lo = Math.min(t1, t2);
  const hi = Math.max(t1, t2);
  return t >= lo && t <= hi;
}

type Props = {
  start: string;
  end: string;
  onRangeChange: (start: string, end: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

/**
 * Um único calendário em modo intervalo: ao escolher só o início, passar o mouse
 * sobre outras datas preenche o intervalo em pré-visualização antes do clique.
 */
export function VacationPeriodRangePicker({
  start,
  end,
  onRangeChange,
  disabled,
  placeholder = "Selecione início e fim",
}: Props) {
  const startD = start ? parseYmdLocal(start) : undefined;
  const endD = end ? parseYmdLocal(end) : undefined;

  const [displayMonth, setDisplayMonth] = React.useState<Date>(() => startD ?? endD ?? new Date());
  const [hoverDate, setHoverDate] = React.useState<Date | undefined>();

  React.useEffect(() => {
    if (startD) setDisplayMonth(startD);
    else if (endD) setDisplayMonth(endD);
  }, [start, end]);

  const selected: DateRange | undefined =
    startD || endD ? { from: startD, to: endD } : undefined;

  const label =
    startD && endD
      ? `${startD.toLocaleDateString("pt-BR")} – ${endD.toLocaleDateString("pt-BR")}`
      : startD
        ? `${startD.toLocaleDateString("pt-BR")} – …`
        : placeholder;

  const hasOnlyStart = Boolean(startD) && !endD;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              className="flex-1 justify-between text-left font-normal min-h-[44px]"
            >
              <span className={startD && endD ? "" : "text-[#94a3b8]"}>{label}</span>
              <span className="ml-2 text-xs text-[#64748b] dark:text-slate-400">Abrir</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              month={displayMonth}
              onMonthChange={setDisplayMonth}
              selected={selected}
              onSelect={(range) => {
                if (!range) {
                  onRangeChange("", "");
                  return;
                }
                const from = range.from ? formatYmdLocal(range.from) : "";
                const to = range.to ? formatYmdLocal(range.to) : "";
                onRangeChange(from, to);
              }}
              onDayMouseEnter={(date) => setHoverDate(date)}
              onDayMouseLeave={() => setHoverDate(undefined)}
              modifiers={{
                hoverFill: (date) => {
                  if (!hoverDate) return false;
                  if (startD && endD) return false;
                  if (!startD) {
                    return atMidnight(date) === atMidnight(hoverDate);
                  }
                  if (hasOnlyStart) {
                    return isBetweenInclusive(date, startD, hoverDate);
                  }
                  return false;
                },
              }}
              modifiersClassNames={{
                hoverFill:
                  "bg-blue-100/90 text-[#0f172a] dark:bg-blue-900/50 dark:text-blue-50 [&]:z-[5] data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground",
              }}
              numberOfMonths={1}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {(startD || endD) && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRangeChange("", "")}
            aria-label="Limpar período"
            className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-md border border-[#e2e8f0] bg-white text-[#94a3b8] transition hover:border-red-300 hover:bg-red-50 hover:text-red-500 dark:border-[#252a35] dark:bg-[#1a1d23] dark:hover:border-red-800 dark:hover:bg-red-950/30 dark:hover:text-red-400"
          >
            ✕
          </button>
        )}
      </div>
      <p className="text-xs text-[#64748b] dark:text-slate-500">
        Depois de escolher o primeiro dia, passe o mouse no calendário para ver o intervalo até o dia do término; clique para confirmar.
      </p>
    </div>
  );
}
