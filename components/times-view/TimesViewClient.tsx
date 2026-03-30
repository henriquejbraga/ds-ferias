"use client";

import { useState } from "react";
import type { TeamDataRH, TeamDataSerialized, TeamMemberInfoSerialized } from "./types";
import { matchesFilter } from "./filters";
import { TimesViewFilterBar } from "./TimesViewFilterBar";
import { TimesViewHierarchy } from "./TimesViewHierarchy";
import { getRoleLabel } from "@/lib/vacationRules";

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

  function getFormattedPeriods(requests: TeamMemberInfoSerialized["requests"]): string {
    const valid = requests
      .filter((r) => r.status === "PENDENTE" || r.status.startsWith("APROVADO") || r.status === "APROVADO_GESTOR")
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    if (valid.length === 0) return "—";

    return valid
      .map((r) => {
        const s = new Date(r.startDate).toLocaleDateString("pt-BR");
        const e = new Date(r.endDate).toLocaleDateString("pt-BR");
        const status = r.status === "PENDENTE" ? "Pendente" : "Aprovado";
        return `${s} a ${e} (${status})`;
      })
      .join(" | ");
  }

  function getMemberStatusLabel(member: TeamMemberInfoSerialized): string {
    if (member.isOnVacationNow) return "Em Férias";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const hasFuture = member.requests.some((r) => {
      const start = new Date(r.startDate);
      return (
        start >= today &&
        (r.status === "PENDENTE" || r.status.startsWith("APROVADO") || r.status === "APROVADO_GESTOR")
      );
    });
    return hasFuture ? "Férias Marcadas" : "Sem agendamento";
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
      periodos: string;
    }>,
  ) {
    const headers = [
      "Diretoria",
      "Gerente",
      "Coordenador",
      "Time/Squad",
      "Colaborador",
      "Papel/Cargo",
      "Departamento",
      "Situação Atual",
      "Saldo Disponível (Dias)",
      "Dias em Aprovação",
      "Períodos Agendados",
    ];

    const csvContent = [
      headers.join(";"),
      ...rows.map((r) =>
        [
          r.diretoria,
          r.gerente,
          r.coordenador,
          r.time,
          r.colaborador,
          r.papel,
          r.departamento,
          r.status,
          String(r.saldoDisponivel),
          String(r.pendente),
          r.periodos,
        ]
          .map((val) => `"${String(val).replace(/"/g, '""')}"`)
          .join(";"),
      ),
    ].join("\n");

    const blob = new Blob([`\uFEFF${csvContent}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-ferias-times-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Normalizar dados: agora Coordenador e Gerente também vem como "rh" para ter a árvore completa
  const isCoordOnly = teamData.kind === "coord";
  const gerentesBase: TeamDataRH["gerentes"] = isCoordOnly 
    ? [{
        gerenteId: "coord-root",
        gerenteName: "Minha Coordenação",
        diretorName: "Meu Time",
        gerenteSelf: (teamData as any).coordinatorSelf,
        coordinatorMembers: [], 
        teams: (teamData as any).teams
      }]
    : (teamData as TeamDataRH).gerentes;

  // Se houver apenas 1 gerente e o nome dele for amigável (ou logado), consideramos visão simplificada para a UI (não para o CSV)
  const isSimplifiedView = teamData.kind === "coord" || (teamData.kind === "rh" && teamData.gerentes.length === 1);

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
        directorateFilter={isSimplifiedView ? undefined : directorateFilter}
        setDirectorateFilter={isSimplifiedView ? undefined : setDirectorateFilter}
        directorateOptions={directorateOptions}
        managerFilter={isSimplifiedView ? undefined : managerFilter}
        setManagerFilter={isSimplifiedView ? undefined : setManagerFilter}
        managerOptions={managerOptions}
        coordinatorFilter={coordinatorFilter}
        setCoordinatorFilter={setCoordinatorFilter}
        coordinatorOptions={coordinatorOptions}
        teamFilter={teamFilter}
        setTeamFilter={setTeamFilter}
        teamOptions={teamOptions}
        onExportCsv={() => {
          const rows = gerentesFiltered.flatMap((g) => {
            const dName = g.diretorName || "—";
            const gName = g.gerenteName;
            
            // 1. Linha do Próprio Gerente
            const fromGerente = g.gerenteSelf ? [{
              diretoria: dName,
              gerente: gName,
              coordenador: "—",
              time: `Time de ${gName}`,
              colaborador: g.gerenteSelf.user.name,
              papel: getRoleLabel(g.gerenteSelf.user.role),
              departamento: g.gerenteSelf.user.department ?? "",
              status: getMemberStatusLabel(g.gerenteSelf),
              saldoDisponivel: g.gerenteSelf.balance.availableDays,
              pendente: g.gerenteSelf.balance.pendingDays,
              periodos: getFormattedPeriods(g.gerenteSelf.requests)
            }] : [];

            // 2. Linhas dos Coordenadores
            const fromCoords = (g.coordinatorMembers ?? []).map((m) => ({
              diretoria: dName,
              gerente: gName,
              coordenador: m.user.name,
              time: `Gestão de ${m.user.name}`,
              colaborador: m.user.name,
              papel: getRoleLabel(m.user.role),
              departamento: m.user.department ?? "",
              status: getMemberStatusLabel(m),
              saldoDisponivel: m.balance.availableDays,
              pendente: m.balance.pendingDays,
              periodos: getFormattedPeriods(m.requests)
            }));

            // 3. Linhas dos Colaboradores nos Squads
            const fromTeams = g.teams.flatMap((team) => team.members.map((m) => ({
              diretoria: dName,
              gerente: gName,
              coordenador: team.coordinatorName,
              time: team.teamName,
              colaborador: m.user.name,
              papel: getRoleLabel(m.user.role),
              departamento: m.user.department ?? "",
              status: getMemberStatusLabel(m),
              saldoDisponivel: m.balance.availableDays,
              pendente: m.balance.pendingDays,
              periodos: getFormattedPeriods(m.requests)
            })));

            return [...fromGerente, ...fromCoords, ...fromTeams];
          });
          exportRowsToCsv(rows);
        }}
      />
      
      {gerentesFiltered.length > 0 ? (
        <TimesViewHierarchy gerentesFiltered={gerentesFiltered} isCoordView={isSimplifiedView} />
      ) : (
        <div className="rounded-xl border border-dashed border-[#e2e8f0] bg-white py-12 text-center dark:border-[#252a35] dark:bg-[#1a1d23]">
          <p className="text-[#64748b] dark:text-slate-400">Nenhum colaborador ou liderança no filtro atual.</p>
        </div>
      )}
    </div>
  );
}
