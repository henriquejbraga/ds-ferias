"use client";

import { useMemo } from "react";
import type { TeamDataRH } from "./types";
import { TeamCalendar } from "@/components/calendar/TeamCalendar";
import { buildRhDirectorateCalendarMembers } from "./buildRhCalendarMembers";

type GerenteData = TeamDataRH["gerentes"][0];

interface Props {
  gerentesFiltered: GerenteData[];
}

export function TimesViewHierarchy({ gerentesFiltered }: Props) {
  // Visão TOTAL Unificada em um único grande calendário mestre
  const calendarMembers = useMemo(
    () => buildRhDirectorateCalendarMembers(gerentesFiltered),
    [gerentesFiltered]
  );

  if (calendarMembers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#e2e8f0] bg-white py-12 text-center dark:border-[#252a35] dark:bg-[#1a1d23]">
        <p className="text-[#64748b] dark:text-slate-400">
          Nenhum integrante encontrado no filtro atual para o calendário unificado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 border-b-2 border-blue-500/20 pb-4">
        <h2 className="text-2xl font-black text-[#1e3a8a] dark:text-blue-200 uppercase tracking-tighter">
          Calendário Mestre — Visão Geral do Time
        </h2>
        <p className="text-xs font-bold text-[#1e40af]/70 dark:text-blue-300/60 uppercase tracking-widest">
          Consolidado: Diretoria &gt; Gerência &gt; Coordenação
        </p>
      </div>

      <div className="rounded-3xl border border-[#e2e8f0] bg-white p-8 shadow-xl dark:border-[#252a35] dark:bg-[#1a1d23]">
        <TeamCalendar members={calendarMembers} capacityScopedByGroup showExportCsv />
      </div>
    </div>
  );
}
