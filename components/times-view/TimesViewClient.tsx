"use client";

import { useMemo, useState } from "react";
import type { TeamDataSerialized, TeamMemberInfoSerialized } from "./types";
import { matchesFilter } from "./filters";
import { TimesViewFilterBar } from "./TimesViewFilterBar";
import { TimesViewCoordTeamsList } from "./TimesViewCoordTeamsList";
import { TeamCalendar } from "@/components/calendar/TeamCalendar";
import { buildRhDirectorateCalendarMembers } from "./buildRhCalendarMembers";

type Props = {
  teamData: TeamDataSerialized;
};

export function TimesViewClient({ teamData }: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("TODOS");
  const [managerFilter, setManagerFilter] = useState<string>("ALL");
  const [coordinatorFilter, setCoordinatorFilter] = useState<string>("ALL");
  const [teamFilter, setTeamFilter] = useState<string>("ALL");

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

  const GERENCIA_LABELS = [
    "Gerência de Plataformas",
    "Gerência de Produtos Digitais",
    "Gerência de Operações Digitais",
    "Gerência de Experiência e Design",
    "Gerência de Dados e Performance",
  ];

  function getGerenciaLabel(index: number): string {
    if (index < GERENCIA_LABELS.length) return GERENCIA_LABELS[index];
    return `Gerência Estratégica ${index + 1}`;
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
        <TimesViewCoordTeamsList teams={teamsFiltered} />
      </div>
    );
  }

  const gerentesComNomesFuncionais = teamData.gerentes.map((g, i) => {
    const originalGerenteName = g.gerenteName;
    const coordenadoresUnicos = Array.from(
      new Set([
        ...g.teams.map((t) => t.coordinatorId),
        ...(g.coordinatorMembers?.map((c) => c.user.id) ?? []),
      ]),
    );
    const coordLabelById = new Map<string, string>();
    coordenadoresUnicos.forEach((id, idx) => {
      coordLabelById.set(id, `Coordenação ${idx + 1}`);
    });
    return {
      ...g,
      gerenteName: getGerenciaLabel(i),
      originalGerenteName,
      teams: g.teams.map((t) => ({
        ...t,
        originalCoordinatorName: t.coordinatorName,
        coordinatorName: coordLabelById.get(t.coordinatorId) ?? "Coordenação",
      })),
      coordinatorMembers: g.coordinatorMembers?.map((c) => ({
        ...c,
        originalCoordinationName: c.user.name,
      })),
    };
  });

  const managerOptions = [
    { value: "ALL", label: "Todas as gerências" },
    ...gerentesComNomesFuncionais.map((g) => ({ value: g.gerenteId, label: g.gerenteName })),
  ];
  const coordinatorMap = new Map<string, string>();
  gerentesComNomesFuncionais.forEach((g) => {
    if (managerFilter !== "ALL" && g.gerenteId !== managerFilter) return;
    g.teams.forEach((t) => coordinatorMap.set(t.coordinatorId, t.coordinatorName));
  });
  const coordinatorOptions = [
    { value: "ALL", label: "Todos os coordenadores" },
    ...Array.from(coordinatorMap.entries()).map(([value, label]) => ({ value, label })),
  ];
  const teamMap = new Map<string, string>();
  gerentesComNomesFuncionais.forEach((g) => {
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

  const diretorNomesDestaque = Array.from(
    new Set(
      gerentesComNomesFuncionais
        .map((g) => g.diretorName)
        .filter((n): n is string => Boolean(n)),
    ),
  );

  const gerentesFiltered = gerentesComNomesFuncionais
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
      <div className="rounded-lg border border-[#dbeafe] bg-[#eff6ff] px-4 py-3 text-sm text-[#1e3a8a] dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
        <div className="font-semibold">Diretoria: Estratégia Digital</div>
        {diretorNomesDestaque.length > 0 && (
          <p className="mt-1 text-xs font-normal text-[#1e40af] dark:text-blue-300/90">
            Diretor(a): {diretorNomesDestaque.join(" · ")}
          </p>
        )}
      </div>
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
          const rows = gerentesFiltered.flatMap((g) => {
            const fromCoords = (g.coordinatorMembers ?? []).map((m) => ({
              gerente: g.gerenteName,
              coordenador: "—",
              time: "Coordenação",
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
            }));
            const fromTeams = g.teams.flatMap((team) =>
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
            );
            return [...fromCoords, ...fromTeams];
          });
          exportRowsToCsv(rows);
        }}
      />
      <RhDirectorateCalendarSection gerentesFiltered={gerentesFiltered} />
    </div>
  );
}

function RhDirectorateCalendarSection({
  gerentesFiltered,
}: {
  gerentesFiltered: Parameters<typeof buildRhDirectorateCalendarMembers>[0];
}) {
  const calendarMembers = useMemo(
    () => buildRhDirectorateCalendarMembers(gerentesFiltered),
    [gerentesFiltered],
  );

  if (calendarMembers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#e2e8f0] bg-white py-12 text-center dark:border-[#252a35] dark:bg-[#1a1d23]">
        <p className="text-[#64748b] dark:text-slate-400">
          Nenhum colaborador ou coordenação no filtro atual.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-[#1a1d23] dark:text-white">
          Visão geral — time completo
        </h2>
        <p className="mt-1 text-sm text-[#64748b] dark:text-slate-400">
          Calendário da diretoria com coordenadores e colaboradores por time. Use os filtros acima (nome,
          gerência, coordenação, time). No calendário, alterne mês/ano e use{" "}
          <span className="font-medium text-[#475569] dark:text-slate-300">Exportar férias (CSV)</span> para
          o período visível.
        </p>
      </div>
      <TeamCalendar members={calendarMembers} capacityScopedByGroup showExportCsv />
    </section>
  );
}

