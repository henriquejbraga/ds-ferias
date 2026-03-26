"use client";

import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

type Props = {
  value?: Date;
  onChange: (value: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function DatePicker({ value, onChange, placeholder, disabled }: Props) {
  const label = value
    ? value.toLocaleDateString("pt-BR")
    : placeholder ?? "Selecionar data";

  // Memoriza o mês exibido para não “voltar para hoje” ao fechar/reabrir o Popover.
  const [displayMonth, setDisplayMonth] = React.useState<Date>(() => value ?? new Date());

  React.useEffect(() => {
    if (value) setDisplayMonth(value);
  }, [value]);

  return (
    <div className="flex gap-1">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="flex-1 justify-between text-left font-normal min-h-[44px]"
          >
            <span className={value ? "" : "text-[#94a3b8]"}>{label}</span>
            <span className="ml-2 text-xs text-[#64748b] dark:text-slate-400">
              Abrir
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(d) => onChange(d ?? undefined)}
            month={displayMonth}
            onMonthChange={(m) => setDisplayMonth(m)}
            numberOfMonths={1}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      {value && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(undefined)}
          aria-label="Limpar data"
          className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-md border border-[#e2e8f0] bg-white text-[#94a3b8] transition hover:border-red-300 hover:bg-red-50 hover:text-red-500 dark:border-[#252a35] dark:bg-[#1a1d23] dark:hover:border-red-800 dark:hover:bg-red-950/30 dark:hover:text-red-400"
        >
          ✕
        </button>
      )}
    </div>
  );
}

