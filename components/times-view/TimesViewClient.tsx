"use client";

import { useState } from "react";
import type { TeamDataRH, TeamDataSerialized, TeamMemberInfoSerialized } from "./types";
import { matchesFilter } from "./filters";
import { TimesViewFilterBar } from "./TimesViewFilterBar";
import { TimesViewHierarchy } from "./TimesViewHierarchy";

type Props = {
  teamData: TeamDataSerialized;
};

export function TimesViewClient({ teamData }: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("TODOS");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [directorateFilter, setDirectorateFilter] = useState<string>("ALL");
  const [managerFilter, setManagerFilter] = useState<string>("ALL");
  const [coordinatorFilter, setCoordinatorFilter] = useState<string>("ALL");
  const [teamFilter, setTeamFilter] = useState<string>("ALL");

  const filterMembers = (members: TeamMemberInfoSerialized[], directorateName: string = "") =>
    members.filter((m) => matchesFilter(m, query, statusFilter, roleFilter, directorateFilter, directorateName));

  function hasFutureVacation(member: TeamMemberInfoSerialized): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return member.requests.some((r) => {
      const start = new Date(r.startDate);
      start.setHours(0, 0, 0, 0);
      return start > today;
    });
  }

  function exportRowsToCsv(
    rows: Array<{
      diretoria: string;
      gerente: string;
      coordenador: string;
      time: string;
      colaborador: string;
      papel: string;
      departamento: string;
      status: string;
      saldoDisponivel: number;
      pendente: number;
    }>,
  ) {
    const lines = [
      ["Diretoria", "Gerente", "Coordenador", "Time", "Colaborador", "Papel", "Departamento", "StatusFerias", "SaldoDisponivel", "DiasPendentes"].join(";"),
      ...rows.map((r) => [r.diretoria, r.gerente, r.coordenador, r.time, r.colaborador, r.papel, r.departamento, r.status, String(r.saldoDisponivel), String(r.pendente)].join(";")),
    ];
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `times-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Normalizar dados para estrutura de hierarquia
  const isCoordOnly = teamData.kind === "coord";
  const gerentesBase: TeamDataRH["gerentes"] = isCoordOnly 
    ? [{
        gerenteId: "coord-root",
        gerenteName: "Minha Coordenação",
        diretorName: "Meu Time",
        gerenteSelf: teamData.coordinatorSelf, // O coordenador entra como "líder" da seção para ver suas próprias férias
        coordinatorMembers: [], 
        teams: teamData.teams
      }]
    : teamData.gerentes;

  const directorateOptions = Array.from(
    new Set(gerentesBase.map((g) => g.diretorName || "Diretoria Geral"))
  ).map((name) => ({ value: name, label: name }));

  const managerOptions = gerentesBase
    .filter((g) => directorateFilter === "ALL" || (g.diretorName || "Diretoria Geral") === directorateFilter)
    .map((g) => ({ value: g.gerenteId, label: g.gerenteName }));

  const coordinatorMap = new Map<string, string>();
  gerentesBase.forEach((g) => {
    if (directorateFilter !== "ALL" && (g.diretorName || "Diretoria Geral") !== directorateFilter) return;
    if (managerFilter !== "ALL" && g.gerenteId !== managerFilter) return;
    g.teams.forEach((t) => coordinatorMap.set(t.coordinatorId, t.coordinatorName));
  });
  const coordinatorOptions = Array.from(coordinatorMap.entries()).map(([value, label]) => ({ value, label }));

  const teamMap = new Map<string, string>();
  gerentesBase.forEach((g) => {
    if (directorateFilter !== "ALL" && (g.diretorName || "Diretoria Geral") !== directorateFilter) return;
    if (managerFilter !== "ALL" && g.gerenteId !== managerFilter) return;
    g.teams.forEach((t) => {
      if (coordinatorFilter !== "ALL" && t.coordinatorId !== coordinatorFilter) return;
      teamMap.set(t.teamKey, t.teamName);
    });
  });
  const teamOptions = Array.from(teamMap.entries()).map(([value, label]) => ({ value, label }));

  const gerentesFiltered = gerentesBase
    .filter((g) => directorateFilter === "ALL" || (g.diretorName || "Diretoria Geral") === directorateFilter)
    .filter((g) => managerFilter === "ALL" || g.gerenteId === managerFilter)
    .map((g) => {
      const dName = g.diretorName || "Diretoria Geral";
      return {
        ...g,
        coordinatorMembers: g.coordinatorMembers ? filterMembers(g.coordinatorMembers, dName) : undefined,
        teams: g.teams
          .filter((team) => coordinatorFilter === "ALL" || team.coordinatorId === coordinatorFilter)
          .filter((team) => teamFilter === "ALL" || team.teamKey === teamFilter)
          .map((team) => ({ ...team, members: filterMembers(team.members, dName) }))
          .filter((t) => (t.members.length > 0) || (coordinatorFilter !== "ALL")),
      };
    })
    .filter((g) => g.teams.some(t => t.members.length > 0) || (g.coordinatorMembers?.length ?? 0) > 0 || (managerFilter !== "ALL"));

  return (
    <div className="space-y-10">
      <TimesViewFilterBar
        query={query}
        setQuery={setQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        roleFilter={roleFilter}
        setRoleFilter={setRoleFilter}
        directorateFilter={isCoordOnly ? undefined : directorateFilter}
        setDirectorateFilter={isCoordOnly ? undefined : setDirectorateFilter}
        directorateOptions={directorateOptions}
        managerFilter={isCoordOnly ? undefined : managerFilter}
        setManagerFilter={isCoordOnly ? undefined : setManagerFilter}
        managerOptions={managerOptions}
        coordinatorFilter={coordinatorFilter}
        setCoordinatorFilter={setCoordinatorFilter}
        coordinatorOptions={coordinatorOptions}
        teamFilter={teamFilter}
        setTeamFilter={setTeamFilter}
        teamOptions={teamOptions}
        onExportCsv={() => {
          const rows = gerentesFiltered.flatMap((g) => {
            const dName = g.diretorName || "Diretoria Geral";
            const fromGerente = g.gerenteSelf ? [{
              diretoria: dName, gerente: g.gerenteName, coordenador: "—", time: "Gerência", colaborador: g.gerenteSelf.user.name, papel: g.gerenteSelf.user.role, departamento: g.gerenteSelf.user.department ?? "", status: g.gerenteSelf.isOnVacationNow ? "EM_FERIAS" : hasFutureVacation(g.gerenteSelf) ? "FERIAS_MARCADAS" : "FERIAS_A_TIRAR", saldoDisponivel: g.gerenteSelf.balance.availableDays, pendente: g.gerenteSelf.balance.pendingDays,
            }] : [];
            const fromCoords = (g.coordinatorMembers ?? []).map((m) => ({
              diretoria: dName, gerente: g.gerenteName, coordenador: "—", time: "Coordenação", colaborador: m.user.name, papel: m.user.role, departamento: m.user.department ?? "", status: m.isOnVacationNow ? "EM_FERIAS" : hasFutureVacation(m) ? "FERIAS_MARCADAS" : "FERIAS_A_TIRAR", saldoDisponivel: m.balance.availableDays, pendente: m.balance.pendingDays,
            }));
            const fromTeams = g.teams.flatMap((team) => team.members.map((m) => ({
              diretoria: dName, gerente: g.gerenteName, coordenador: team.coordinatorName, time: team.teamName, colaborador: m.user.name, papel: m.user.role, departamento: m.user.department ?? "", status: m.isOnVacationNow ? "EM_FERIAS" : hasFutureVacation(m) ? "FERIAS_MARCADAS" : "FERIAS_A_TIRAR", saldoDisponivel: m.balance.availableDays, pendente: m.balance.pendingDays,
            })));
            return [...fromGerente, ...fromCoords, ...fromTeams];
          });
          exportRowsToCsv(rows);
        }}
      />
      
      {gerentesFiltered.length > 0 ? (
        <TimesViewHierarchy gerentesFiltered={gerentesFiltered} isCoordView={isCoordOnly} />
      ) : (
        <div className="rounded-xl border border-dashed border-[#e2e8f0] bg-white py-12 text-center dark:border-[#252a35] dark:bg-[#1a1d23]">
          <p className="text-[#64748b] dark:text-slate-400">Nenhum colaborador ou liderança no filtro atual.</p>
        </div>
      )}
    </div>
  );
}
