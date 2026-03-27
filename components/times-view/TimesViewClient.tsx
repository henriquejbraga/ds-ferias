"use client";

import { useState } from "react";
import type { TeamDataSerialized, TeamMemberInfoSerialized } from "./types";
import { matchesFilter } from "./filters";
import { TimesViewFilterBar } from "./TimesViewFilterBar";
import { TimesViewCoordTeamsList } from "./TimesViewCoordTeamsList";
import { TimesViewRhTeamsList } from "./TimesViewRhTeamsList";

type Props = {
  teamData: TeamDataSerialized;
  userId: string;
  userRole: string;
  level: number;
};

export function TimesViewClient({ teamData, level }: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("TODOS");
  const [managerFilter, setManagerFilter] = useState<string>("ALL");
  const [coordinatorFilter, setCoordinatorFilter] = useState<string>("ALL");
  const [teamFilter, setTeamFilter] = useState<string>("ALL");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filterMembers = (members: TeamMemberInfoSerialized[]) => members.filter((m) => matchesFilter(m, query, statusFilter));

  function hasFutureVacation(member: TeamMemberInfoSerialized): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return member.requests.some((r) => {
      const start = new Date(r.startDate);
      start.setHours(0, 0, 0, 0);
      return start > today;
    });
  }

  function exportRowsToCsv(rows: Array<{
    gerente: string;
    coordenador: string;
    time: string;
    colaborador: string;
    papel: string;
    departamento: string;
    status: string;
    saldoDisponivel: number;
    pendente: number;
  }>) {
    const lines = [
      [
        "Gerente",
        "Coordenador",
        "Time",
        "Colaborador",
        "Papel",
        "Departamento",
        "StatusFerias",
        "SaldoDisponivel",
        "DiasPendentes",
      ].join(";"),
      ...rows.map((r) =>
        [
          r.gerente,
          r.coordenador,
          r.time,
          r.colaborador,
          r.papel,
          r.departamento,
          r.status,
          String(r.saldoDisponivel),
          String(r.pendente),
        ].join(";"),
      ),
    ];
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `times-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (teamData.kind === "coord") {
    const teamsFiltered = teamData.teams
      .filter((team) => teamFilter === "ALL" || team.teamKey === teamFilter)
      .map((team) => ({ ...team, members: filterMembers(team.members) }))
      .filter((t) => t.members.length > 0);

    const teamOptions = [
      { value: "ALL", label: "Todos os times" },
      ...teamData.teams.map((t) => ({ value: t.teamKey, label: t.teamName })),
    ];

    return (
      <div className="space-y-6">
        <TimesViewFilterBar
          query={query}
          setQuery={setQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          teamFilter={teamFilter}
          setTeamFilter={setTeamFilter}
          teamOptions={teamOptions}
          onExportCsv={() => {
            const rows = teamsFiltered.flatMap((team) =>
              team.members.map((m) => ({
                gerente: "-",
                coordenador: team.coordinatorName,
                time: team.teamName,
                colaborador: m.user.name,
                papel: m.user.role,
                departamento: m.user.department ?? "",
                status: m.isOnVacationNow
                  ? "EM_FERIAS"
                  : hasFutureVacation(m)
                    ? "FERIAS_MARCADAS"
                    : "FERIAS_A_TIRAR",
                saldoDisponivel: m.balance.availableDays,
                pendente: m.balance.pendingDays,
              })),
            );
            exportRowsToCsv(rows);
          }}
        />
        <TimesViewCoordTeamsList teams={teamsFiltered} expanded={expanded} toggle={toggle} />
      </div>
    );
  }

  const managerOptions = [
    { value: "ALL", label: "Todas as gerências" },
    ...teamData.gerentes.map((g) => ({ value: g.gerenteId, label: g.gerenteName })),
  ];
  const coordinatorMap = new Map<string, string>();
  teamData.gerentes.forEach((g) => {
    if (managerFilter !== "ALL" && g.gerenteId !== managerFilter) return;
    g.teams.forEach((t) => coordinatorMap.set(t.coordinatorId, t.coordinatorName));
  });
  const coordinatorOptions = [
    { value: "ALL", label: "Todos os coordenadores" },
    ...Array.from(coordinatorMap.entries()).map(([value, label]) => ({ value, label })),
  ];
  const teamMap = new Map<string, string>();
  teamData.gerentes.forEach((g) => {
    if (managerFilter !== "ALL" && g.gerenteId !== managerFilter) return;
    g.teams.forEach((t) => {
      if (coordinatorFilter !== "ALL" && t.coordinatorId !== coordinatorFilter) return;
      teamMap.set(t.teamKey, t.teamName);
    });
  });
  const teamOptions = [
    { value: "ALL", label: "Todos os times" },
    ...Array.from(teamMap.entries()).map(([value, label]) => ({ value, label })),
  ];

  const gerentesFiltered = teamData.gerentes
    .filter((g) => managerFilter === "ALL" || g.gerenteId === managerFilter)
    .map((g) => ({
      ...g,
      coordinatorMembers: g.coordinatorMembers
        ? filterMembers(g.coordinatorMembers)
        : undefined,
      teams: g.teams
        .filter((team) => coordinatorFilter === "ALL" || team.coordinatorId === coordinatorFilter)
        .filter((team) => teamFilter === "ALL" || team.teamKey === teamFilter)
        .map((team) => ({ ...team, members: filterMembers(team.members) }))
        .filter((t) => t.members.length > 0),
    }))
    .filter(
      (g) =>
        g.teams.length > 0 ||
        (g.coordinatorMembers !== undefined && g.coordinatorMembers.length > 0),
    );

  return (
    <div className="space-y-6">
      <TimesViewFilterBar
        query={query}
        setQuery={setQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        managerFilter={managerFilter}
        setManagerFilter={setManagerFilter}
        managerOptions={managerOptions}
        coordinatorFilter={coordinatorFilter}
        setCoordinatorFilter={setCoordinatorFilter}
        coordinatorOptions={coordinatorOptions}
        teamFilter={teamFilter}
        setTeamFilter={setTeamFilter}
        teamOptions={teamOptions}
        onExportCsv={() => {
          const rows = gerentesFiltered.flatMap((g) =>
            g.teams.flatMap((team) =>
              team.members.map((m) => ({
                gerente: g.gerenteName,
                coordenador: team.coordinatorName,
                time: team.teamName,
                colaborador: m.user.name,
                papel: m.user.role,
                departamento: m.user.department ?? "",
                status: m.isOnVacationNow
                  ? "EM_FERIAS"
                  : hasFutureVacation(m)
                    ? "FERIAS_MARCADAS"
                    : "FERIAS_A_TIRAR",
                saldoDisponivel: m.balance.availableDays,
                pendente: m.balance.pendingDays,
              })),
            ),
          );
          exportRowsToCsv(rows);
        }}
      />
      <TimesViewRhTeamsList
        gerentes={gerentesFiltered}
        expanded={expanded}
        toggle={toggle}
        showConsolidatedOverview={level >= 3}
      />
    </div>
  );
}

