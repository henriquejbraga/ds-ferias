"use client";

import * as React from "react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

type Props = {
  value: DateRange;
  onChange: (value: DateRange) => void;
  placeholder?: string;
};

export function DateRangePicker({ value, onChange, placeholder }: Props) {
  const label =
    value.from && value.to
      ? `${value.from.toLocaleDateString("pt-BR")} – ${value.to.toLocaleDateString("pt-BR")}`
      : placeholder ?? "Selecione o período";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between text-left font-normal min-h-[44px]"
        >
          <span className={value.from && value.to ? "" : "text-[#94a3b8]"}>{label}</span>
          <span className="ml-2 text-xs text-[#64748b] dark:text-slate-400">
            Abrir calendário
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Calendar
          mode="range"
          selected={value}
          onSelect={(range) => range && onChange(range)}
          numberOfMonths={1}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

