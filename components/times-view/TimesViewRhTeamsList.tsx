"use client";

import { TeamCalendar } from "@/components/calendar/TeamCalendar";
import type { TeamDataRH, TeamMemberInfoSerialized, VacationRequestSummary } from "./types";
import { TeamMemberRow } from "./TeamMemberRow";
import { Chevron } from "./Chevron";

export function TimesViewRhTeamsList({
  gerentes,
  expanded,
  toggle,
}: {
  gerentes: TeamDataRH["gerentes"];
  expanded: Record<string, boolean>;
  toggle: (key: string) => void;
}) {
  if (gerentes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#e2e8f0] bg-white py-10 text-center dark:border-[#252a35] dark:bg-[#1a1d23]">
        <p className="text-[#64748b] dark:text-slate-400">Nenhum colaborador encontrado com os filtros aplicados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {gerentes.map((g) => {
        const gerenteKey = `gerente-${g.gerenteId}`;
        const gerenteOpen = expanded[gerenteKey] !== false;
        const totalMembers = g.teams.reduce((s, t) => s + t.members.length, 0);

        return (
          <div key={g.gerenteId} className="space-y-0">
            <button
              type="button"
              onClick={() => toggle(gerenteKey)}
              className="flex w-full items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-4 py-3 text-left transition-colors hover:bg-[#f8fafc] dark:border-[#252a35] dark:bg-[#1a1d23] dark:hover:bg-[#141720]"
              aria-expanded={gerenteOpen}
              aria-label={gerenteOpen ? `Recolher gerente ${g.gerenteName}` : `Expandir gerente ${g.gerenteName}`}
            >
              <Chevron open={gerenteOpen} />
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                {g.gerenteName.charAt(0).toUpperCase()}
              </span>
              <div>
                <h2 className="text-lg font-semibold text-[#1a1d23] dark:text-white">Gerente: {g.gerenteName}</h2>
                <p className="text-sm text-[#64748b] dark:text-slate-400">
                  {g.teams.length} time(s) · {totalMembers} colaborador(es)
                </p>
              </div>
            </button>

            {gerenteOpen && (
              <div className="space-y-4 border-l-2 border-[#e2e8f0] pl-4 pt-3 dark:border-[#252a35]">
                {g.teams.map((team) => {
                  const teamKey = `${gerenteKey}-team-${team.coordinatorId}`;
                  const teamOpen = expanded[teamKey] !== false;

                  return (
                    <div key={team.coordinatorId} className="space-y-0">
                      <button
                        type="button"
                        onClick={() => toggle(teamKey)}
                        className="flex w-full items-center gap-2 rounded-md bg-[#f5f6f8] px-3 py-2.5 text-left transition-colors hover:bg-[#e2e8f0] dark:bg-[#1e2330] dark:hover:bg-[#252a35]"
                        aria-expanded={teamOpen}
                        aria-label={teamOpen ? `Recolher time de ${team.coordinatorName}` : `Expandir time de ${team.coordinatorName}`}
                      >
                        <Chevron open={teamOpen} />
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                          {team.coordinatorName.charAt(0).toUpperCase()}
                        </span>
                        <h3 className="text-sm font-semibold text-[#1a1d23] dark:text-white">Time de {team.coordinatorName}</h3>
                        <span className="ml-auto text-xs text-[#64748b] dark:text-slate-400">{team.members.length} colaborador(es)</span>
                      </button>

                      {teamOpen && (
                        <div className="space-y-3 pl-4 pt-2">
                          {team.members.length > 0 && <TeamCalendar members={team.members as TeamMemberInfoSerialized[]} />}
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
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

