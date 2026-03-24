"use client";

import { TeamCalendar } from "@/components/calendar/TeamCalendar";
import type { TeamDataRH, TeamMemberInfoSerialized, VacationRequestSummary } from "./types";
import { TeamMemberRow } from "./TeamMemberRow";
import { Chevron } from "./Chevron";
import { getRoleLabel } from "@/lib/vacationRules";

function approvedByRoleFromRequest(r: any): string | null {
  const h = Array.isArray(r?.history) ? r.history : [];
  const approval = h.slice().reverse().find((x: any) => x?.newStatus === "APROVADO_GERENTE");
  return approval?.changedByUser?.role ?? null;
}

type GerenteTeamRow = TeamDataRH["gerentes"][0]["teams"][number];

/** Vários `teamKey` podem compartilhar o mesmo coordenador — um bloco na UI do gerente. */
function groupTeamsByCoordinator(teams: GerenteTeamRow[]) {
  const map = new Map<string, { coordinatorName: string; teams: GerenteTeamRow[] }>();
  for (const t of teams) {
    const cur = map.get(t.coordinatorId);
    if (cur) cur.teams.push(t);
    else map.set(t.coordinatorId, { coordinatorName: t.coordinatorName, teams: [t] });
  }
  return Array.from(map.entries())
    .map(([coordinatorId, v]) => ({
      coordinatorId,
      coordinatorName: v.coordinatorName,
      teams: v.teams,
    }))
    .sort((a, b) => {
      const byName = a.coordinatorName.localeCompare(b.coordinatorName, "pt-BR", { sensitivity: "base" });
      if (byName !== 0) return byName;
      return a.coordinatorId.localeCompare(b.coordinatorId);
    });
}

const LIDERANCA_DIRETA_CAPACITY_KEY = "__lideranca_direta_gerente__";

/**
 * Lista ordenada para o calendário consolidado do gerente: seções (direta / indireta),
 * cargo no rótulo e capacidade por time (não cruza squads diferentes).
 */
function buildGerenteConsolidatedCalendarMembers(
  teams: TeamDataRH["gerentes"][0]["teams"],
  coordinatorMembers: TeamMemberInfoSerialized[] | undefined,
): TeamMemberInfoSerialized[] {
  const out: TeamMemberInfoSerialized[] = [];

  const coordinators = [...(coordinatorMembers ?? [])].sort((a, b) =>
    (a.user.name ?? "").localeCompare(b.user.name ?? "", "pt-BR", { sensitivity: "base" }),
  );
  coordinators.forEach((c) => {
    out.push({
      ...c,
      calendarCapacityGroupKey: LIDERANCA_DIRETA_CAPACITY_KEY,
      calendarSectionOrder: 0,
      calendarSectionTitle: "Liderança direta — coordenadores (reportam a você)",
      calendarDisplayName: `${c.user.name} · ${getRoleLabel(c.user.role)}`,
    });
  });

  const sortedTeams = [...teams].sort((a, b) => {
    const byC = a.coordinatorName.localeCompare(b.coordinatorName, "pt-BR");
    if (byC !== 0) return byC;
    return a.teamName.localeCompare(b.teamName, "pt-BR");
  });

  sortedTeams.forEach((team) => {
    const mems = [...team.members].sort((a, b) =>
      (a.user.name ?? "").localeCompare(b.user.name ?? "", "pt-BR", { sensitivity: "base" }),
    );
    mems.forEach((m) => {
      out.push({
        ...m,
        calendarCapacityGroupKey: team.teamKey,
        calendarSectionOrder: 1,
        calendarSectionTitle: "Colaboradores — liderança indireta (por time)",
        calendarSubsectionTitle: `${team.coordinatorName} · ${team.teamName}`,
        calendarDisplayName: `${m.user.name} · ${getRoleLabel(m.user.role)}`,
      });
    });
  });

  return out;
}

export function TimesViewRhTeamsList({
  gerentes,
  expanded,
  toggle,
  /** Gerente: exibe calendário consolidado + bloco separado por coordenador. RH: só árvore por gerente/time. */
  showConsolidatedOverview = false,
}: {
  gerentes: TeamDataRH["gerentes"];
  expanded: Record<string, boolean>;
  toggle: (key: string) => void;
  showConsolidatedOverview?: boolean;
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
        const coordinatorCount = new Set(g.teams.map((t) => t.coordinatorId)).size;
        const totalPeople = totalMembers + coordinatorCount;
        const consolidatedMembers = showConsolidatedOverview
          ? buildGerenteConsolidatedCalendarMembers(g.teams, g.coordinatorMembers)
          : [];

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
                <h2 className="text-lg font-semibold text-[#1a1d23] dark:text-white">{g.gerenteName}</h2>
                <p className="text-sm text-[#64748b] dark:text-slate-400">
                  {g.teams.length} time(s) · {totalMembers} colaborador(es) + {coordinatorCount}{" "}
                  coordenador(es) distinto{coordinatorCount === 1 ? "" : "s"} ({totalPeople} pessoas)
                </p>
              </div>
            </button>

            {gerenteOpen && (
              <div className="space-y-6 border-l-2 border-[#e2e8f0] pl-4 pt-3 dark:border-[#252a35]">
                {showConsolidatedOverview && g.teams.length > 0 && (
                  <section className="rounded-xl border border-[#c7d2fe] bg-[#eef2ff]/60 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                    <h3 className="text-base font-semibold text-[#1a1d23] dark:text-white">
                      Visão geral — time completo
                    </h3>
                    <p className="mt-1 text-sm text-[#64748b] dark:text-slate-400">
                      Agrupado por <span className="font-medium text-[#475569] dark:text-slate-300">liderança direta</span>{" "}
                      (coordenadores) e <span className="font-medium text-[#475569] dark:text-slate-300">times</span>{" "}
                      (colaboradores). O alerta vermelho de capacidade vale só{" "}
                      <span className="font-medium text-[#475569] dark:text-slate-300">dentro do mesmo time</span> ou entre
                      coordenadores entre si, sem misturar squads.
                    </p>
                    {consolidatedMembers.length > 0 ? (
                      <div className="mt-4">
                        <TeamCalendar members={consolidatedMembers} capacityScopedByGroup />
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-[#64748b] dark:text-slate-400">Nenhum colaborador no filtro atual.</p>
                    )}
                  </section>
                )}

                {showConsolidatedOverview && g.teams.length > 0 && (
                  <div className="border-t border-[#e2e8f0] pt-6 dark:border-[#252a35]">
                    <h3 className="text-base font-semibold text-[#1a1d23] dark:text-white">Por coordenador</h3>
                    <p className="mt-1 text-sm text-[#64748b] dark:text-slate-400">
                      Quem coordena mais de um time entra num único bloco (vários calendários, uma ficha de férias). Só o(a)
                      coordenador(a) tem card com pendentes/saldo; colaboradores ficam no calendário.
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  {showConsolidatedOverview
                    ? groupTeamsByCoordinator(g.teams).map((group) => {
                        const groupKey = `${gerenteKey}-coordgrp-${group.coordinatorId}`;
                        const groupOpen = expanded[groupKey] !== false;
                        const coordMember = g.coordinatorMembers?.find(
                          (m) => m.user.id === group.coordinatorId,
                        );
                        const totalCollab = group.teams.reduce((s, t) => s + t.members.length, 0);
                        const teamNames = group.teams.map((t) => t.teamName).join(" · ");

                        return (
                          <div
                            key={group.coordinatorId}
                            className="space-y-0 overflow-hidden rounded-lg border border-[#e2e8f0] bg-white dark:border-[#252a35] dark:bg-[#1a1d23]"
                          >
                            <button
                              type="button"
                              onClick={() => toggle(groupKey)}
                              className="flex w-full items-center gap-2 bg-[#f5f6f8] px-3 py-2.5 text-left transition-colors hover:bg-[#e2e8f0] dark:bg-[#1e2330] dark:hover:bg-[#252a35]"
                              aria-expanded={groupOpen}
                              aria-label={
                                groupOpen
                                  ? `Recolher equipes de ${group.coordinatorName}`
                                  : `Expandir equipes de ${group.coordinatorName}`
                              }
                            >
                              <Chevron open={groupOpen} />
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                                {group.coordinatorName.charAt(0).toUpperCase()}
                              </span>
                              <div className="min-w-0 flex-1">
                                <h3 className="truncate text-sm font-semibold text-[#1a1d23] dark:text-white">
                                  {group.coordinatorName}
                                </h3>
                                <p className="truncate text-xs text-[#64748b] dark:text-slate-400" title={teamNames}>
                                  {group.teams.length} time(s) · {totalCollab} colaborador(es) · {teamNames}
                                </p>
                              </div>
                            </button>

                            {groupOpen && (
                              <div className="space-y-4 border-t border-[#e2e8f0] p-3 dark:border-[#252a35]">
                                {group.teams.map((team) => {
                                  const teamKey = `${gerenteKey}-team-${team.teamKey}`;
                                  const teamOpen = expanded[teamKey] !== false;
                                  const cm = g.coordinatorMembers?.find((m) => m.user.id === team.coordinatorId);
                                  const calendarMembers: TeamMemberInfoSerialized[] = [];
                                  const seen = new Set<string>();
                                  const push = (m: TeamMemberInfoSerialized) => {
                                    if (seen.has(m.user.id)) return;
                                    seen.add(m.user.id);
                                    calendarMembers.push(m);
                                  };
                                  if (cm) push(cm as TeamMemberInfoSerialized);
                                  for (const m of team.members) push(m as TeamMemberInfoSerialized);

                                  return (
                                    <div key={team.teamKey} className="space-y-0 rounded-md border border-[#e2e8f0] dark:border-[#252a35]">
                                      <button
                                        type="button"
                                        onClick={() => toggle(teamKey)}
                                        className="flex w-full items-center gap-2 bg-[#f8fafc] px-3 py-2 text-left text-sm transition-colors hover:bg-[#f1f5f9] dark:bg-[#141720] dark:hover:bg-[#1e2330]"
                                        aria-expanded={teamOpen}
                                        aria-label={
                                          teamOpen
                                            ? `Recolher calendário do time ${team.teamName}`
                                            : `Expandir calendário do time ${team.teamName}`
                                        }
                                      >
                                        <Chevron open={teamOpen} />
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700 dark:bg-slate-600 dark:text-slate-200">
                                          {team.teamName.charAt(0).toUpperCase()}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <span className="font-semibold text-[#1a1d23] dark:text-white">
                                            Time: {team.teamName}
                                          </span>
                                          <span className="ml-2 text-xs text-[#64748b] dark:text-slate-400">
                                            {team.members.length} colaborador(es) + coordenador no calendário
                                          </span>
                                        </div>
                                      </button>
                                      {teamOpen && (
                                        <div className="border-t border-[#e2e8f0] p-2 pt-3 dark:border-[#252a35]">
                                          {calendarMembers.length > 0 ? (
                                            <TeamCalendar members={calendarMembers} />
                                          ) : null}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                {coordMember && (
                                  <TeamMemberRow
                                    member={coordMember as TeamMemberInfoSerialized}
                                    requestsSummary={(
                                      coordMember.requests as VacationRequestSummary[]
                                    ).map((r) => ({
                                      startDate: r.startDate,
                                      endDate: r.endDate,
                                      status: r.status,
                                      abono: r.abono,
                                      approvedByRole: approvedByRoleFromRequest(r),
                                    }))}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    : g.teams.map((team) => {
                        const teamKey = `${gerenteKey}-team-${team.teamKey}`;
                        const teamOpen = expanded[teamKey] !== false;

                        return (
                          <div key={team.teamKey} className="space-y-0">
                            <button
                              type="button"
                              onClick={() => toggle(teamKey)}
                              className="flex w-full items-center gap-2 rounded-md bg-[#f5f6f8] px-3 py-2.5 text-left transition-colors hover:bg-[#e2e8f0] dark:bg-[#1e2330] dark:hover:bg-[#252a35]"
                              aria-expanded={teamOpen}
                              aria-label={
                                teamOpen
                                  ? `Recolher time de ${team.coordinatorName}`
                                  : `Expandir time de ${team.coordinatorName}`
                              }
                            >
                              <Chevron open={teamOpen} />
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                                {team.coordinatorName.charAt(0).toUpperCase()}
                              </span>
                              <div className="min-w-0">
                                <h3 className="truncate text-sm font-semibold text-[#1a1d23] dark:text-white">
                                  Coordenador: {team.coordinatorName}
                                </h3>
                                <p className="truncate text-xs text-[#64748b] dark:text-slate-400">
                                  Time: {team.teamName}
                                </p>
                              </div>
                              <span className="ml-auto text-xs text-[#64748b] dark:text-slate-400">
                                {team.members.length} colaborador(es) + 1 coordenador
                              </span>
                            </button>

                            {teamOpen && (
                              <div className="space-y-3 pl-4 pt-2">
                                {(() => {
                                  const coordMember = g.coordinatorMembers?.find(
                                    (m) => m.user.id === team.coordinatorId,
                                  );
                                  const calendarMembers: TeamMemberInfoSerialized[] = [];
                                  const seen = new Set<string>();
                                  const push = (m: TeamMemberInfoSerialized) => {
                                    if (seen.has(m.user.id)) return;
                                    seen.add(m.user.id);
                                    calendarMembers.push(m);
                                  };
                                  if (coordMember) push(coordMember as TeamMemberInfoSerialized);
                                  for (const m of team.members) push(m as TeamMemberInfoSerialized);
                                  return (
                                    <>
                                      {calendarMembers.length > 0 && (
                                        <TeamCalendar members={calendarMembers} />
                                      )}
                                      {team.members.map((member) => (
                                        <TeamMemberRow
                                          key={member.user.id}
                                          member={member}
                                          requestsSummary={(
                                            member.requests as VacationRequestSummary[]
                                          ).map((r) => ({
                                            startDate: r.startDate,
                                            endDate: r.endDate,
                                            status: r.status,
                                            abono: r.abono,
                                            approvedByRole: approvedByRoleFromRequest(r),
                                          }))}
                                        />
                                      ))}
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        );
                      })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

