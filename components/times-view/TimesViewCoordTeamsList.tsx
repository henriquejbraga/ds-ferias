"use client";

import { TeamCalendar } from "@/components/calendar/TeamCalendar";
import type { TeamDataCoord, TeamMemberInfoSerialized, VacationRequestSummary } from "./types";
import { TeamMemberRow } from "./TeamMemberRow";
import { Chevron } from "./Chevron";

export function TimesViewCoordTeamsList({
  teams,
  expanded,
  toggle,
}: {
  teams: TeamDataCoord["teams"];
  expanded: Record<string, boolean>;
  toggle: (key: string) => void;
}) {
  if (teams.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#e2e8f0] bg-white py-10 text-center dark:border-[#252a35] dark:bg-[#1a1d23]">
        <p className="text-[#64748b] dark:text-slate-400">Nenhum colaborador encontrado com os filtros aplicados.</p>
      </div>
    );
  }

  return (
    <>
      {teams.map((team) => {
        const key = `team-${team.teamKey}`;
        const isOpen = expanded[key] !== false;

        return (
          <section key={team.teamKey} className="space-y-0">
            <button
              type="button"
              onClick={() => toggle(key)}
              className="flex w-full items-center gap-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-left transition-colors hover:bg-[#f1f5f9] dark:border-[#252a35] dark:bg-[#141720] dark:hover:bg-[#1e2330]"
              aria-expanded={isOpen}
              aria-label={isOpen ? `Recolher time de ${team.coordinatorName}` : `Expandir time de ${team.coordinatorName}`}
            >
              <Chevron open={isOpen} />
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                {team.coordinatorName.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-[#1a1d23] dark:text-white">
                  {team.teamName}
                </h3>
                <p className="text-sm text-[#64748b] dark:text-slate-400">{team.members.length} colaborador(es)</p>
              </div>
            </button>

            {isOpen && (
              <div className="space-y-3 border-l-2 border-[#e2e8f0] pl-4 pt-3 dark:border-[#252a35]">
                <TeamCalendar members={team.members as TeamMemberInfoSerialized[]} />
                {team.members.map((member) => (
                  <TeamMemberRow
                    key={member.user.id}
                    member={member}
                    requestsSummary={(member.requests as VacationRequestSummary[]).map((r) => ({
                      startDate: r.startDate,
                      endDate: r.endDate,
                      status: r.status,
                      abono: r.abono,
                    }))}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}

