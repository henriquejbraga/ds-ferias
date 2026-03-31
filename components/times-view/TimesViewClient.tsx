"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
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

// --- CÁLCULO DOS INDICADORES PARA O DIRETOR ---
const allCurrentMembers = gerentesFiltered.flatMap(g => [
  ...(g.gerenteSelf ? [g.gerenteSelf] : []),
  ...(g.coordinatorMembers ?? []),
  ...g.teams.flatMap(t => t.members)
]);

const stats = {
  total: allCurrentMembers.length,
  onVacation: allCurrentMembers.filter(m => m.isOnVacationNow).length,
  upcoming: allCurrentMembers.filter(m => {
      if (m.isOnVacationNow) return false;
      const today = new Date(); today.setHours(0,0,0,0);
      return m.requests.some(r => new Date(r.startDate) >= today && (r.status === "PENDENTE" || r.status.startsWith("APROVADO")));
  }).length,
};

const vacationPct = stats.total > 0 ? Math.round((stats.onVacation / stats.total) * 100) : 0;
const activePct = 100 - vacationPct;

// --- LISTA DE QUEM ESTÁ DE FÉRIAS HOJE ---
const membersOnVacation = allCurrentMembers
  .filter(m => m.isOnVacationNow)
  .sort((a, b) => a.user.name.localeCompare(b.user.name));

const ListOfVacationers = () => (
  <div className="max-h-64 overflow-y-auto pr-1 custom-scrollbar">
      {membersOnVacation.length > 0 ? (
          <ul className="space-y-2">
              {membersOnVacation.map((m, idx) => (
                  <li key={idx} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900/50">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                          {m.user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-[#1a1d23] dark:text-white">{m.user.name}</p>
                          <p className="truncate text-[10px] text-[#64748b] dark:text-slate-400">{getRoleLabel(m.user.role)}</p>
                      </div>
                  </li>
              ))}
          </ul>
      ) : (
          <p className="text-center text-xs text-[#64748b] py-4">Nenhum colaborador em férias hoje.</p>
      )}
  </div>
);

return (
  <div className="space-y-10">
    {/* PAINEL DE INDICADORES TOTALMENTE RESPONSIVO */}
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
      <div className="lg:col-span-3 rounded-xl border border-[#e2e8f0] bg-white p-5 sm:p-7 shadow-sm dark:border-[#252a35] dark:bg-[#1a1d23]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                  <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-[#64748b] dark:text-slate-500 mb-1">Disponibilidade Atual</h3>
                  <p className="text-2xl sm:text-3xl font-black text-[#1a1d23] dark:text-white leading-none">{activePct}% do time em atividade</p>
              </div>
              <div className="sm:text-right">
                  <p className="text-sm font-bold text-[#1a1d23] dark:text-white">Total: {stats.total} pessoas</p>
                  <div className="flex items-center sm:justify-end gap-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-tight text-[#94a3b8]">
                          {teamData.kind === "coord" ? "Seu time direto" : "Líderes e times (visão consolidada)"}
                      </p>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label="Entenda a abrangência do cálculo"
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#cbd5e1] text-[9px] font-bold text-[#64748b] transition hover:bg-[#e2e8f0] dark:border-[#334155] dark:text-slate-300 dark:hover:bg-[#252a35]"
                          >
                            ?
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-80">
                          <PopoverHeader>
                            <PopoverTitle>Abrangência da Visão</PopoverTitle>
                            <PopoverDescription>
                              {teamData.kind === "coord" ? (
                                <>
                                  <strong>Seu time direto:</strong> Inclui você e todos os colaboradores que se reportam diretamente a você.
                                </>
                              ) : (
                                <>
                                  <strong>Visão Consolidada:</strong> Este painel soma toda a hierarquia sob sua gestão (Diretores, Gerentes, Coordenadores e Colaboradores) para dar um panorama real da força de trabalho atual.
                                </>
                              )}
                            </PopoverDescription>
                          </PopoverHeader>
                        </PopoverContent>
                      </Popover>
                  </div>
              </div>
          </div>

          {/* Gráfico de Barras */}
          <div className="relative h-3 sm:h-4 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50">
              <div 
                  className="absolute inset-y-0 left-0 bg-blue-600 shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] transition-all duration-700" 
                  style={{ width: `${activePct}%` }}
              />
              <div 
                  className="absolute inset-y-0 bg-rose-500 shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] transition-all duration-700" 
                  style={{ left: `${activePct}%`, width: `${vacationPct}%` }}
              />
          </div>

          <div className="mt-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex flex-wrap gap-4 sm:gap-8">
                  <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-blue-100 dark:ring-blue-900/30" />
                      <span className="text-xs sm:text-sm font-bold text-[#475569] dark:text-slate-300">Trabalhando ({stats.total - stats.onVacation})</span>
                  </div>

                  <Popover>
                      <PopoverTrigger asChild>
                          <button type="button" className="flex items-center gap-2 transition-opacity hover:opacity-70 disabled:cursor-default disabled:opacity-100" disabled={stats.onVacation === 0}>
                              <div className="h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-rose-100 dark:ring-rose-900/30" />
                              <span className="text-xs sm:text-sm font-bold text-[#475569] dark:text-slate-300">Em Férias ({stats.onVacation})</span>
                              {stats.onVacation > 0 && <span className="text-[10px] text-rose-500 font-black">ver lista</span>}
                          </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-64">
                          <PopoverHeader>
                              <PopoverTitle>Colaboradores Ausentes</PopoverTitle>
                              <PopoverDescription>
                                  Lista de quem está em férias hoje neste recorte.
                              </PopoverDescription>
                          </PopoverHeader>
                          <div className="mt-3">
                              <ListOfVacationers />
                          </div>
                      </PopoverContent>
                  </Popover>
              </div>

              {stats.upcoming > 0 && (
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-[#64748b] dark:text-slate-400 font-semibold italic">
                      <svg className="h-4 w-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="truncate">{stats.upcoming} com férias agendadas</span>
                  </div>
              )}
          </div>
      </div>

      <Popover>
          <PopoverTrigger asChild>
              <button 
                  type="button" 
                  className="flex flex-col justify-center rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-5 sm:p-7 dark:border-[#252a35] dark:bg-[#141720] shadow-sm text-left transition-all hover:border-rose-200 hover:bg-rose-50/30 group disabled:cursor-default disabled:hover:border-[#e2e8f0] disabled:hover:bg-[#f8fafc]"
                  disabled={stats.onVacation === 0}
              >
                  <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-[#64748b] mb-2 group-hover:text-rose-600 transition-colors">Ausentes Hoje</p>
                  <div className="flex items-baseline gap-2">
                      <p className="text-4xl sm:text-5xl font-black text-rose-600 dark:text-rose-400 leading-none">{stats.onVacation}</p>
                      <p className="text-base sm:text-xl font-bold text-[#94a3b8]">/ {stats.total}</p>
                  </div>
                  {stats.onVacation > 0 && <p className="mt-2 text-[10px] font-bold text-rose-500 uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">Clique para ver lista</p>}
              </button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-72">
              <PopoverHeader>
                  <PopoverTitle>Ausentes Hoje</PopoverTitle>
                  <PopoverDescription>
                      Colaboradores em férias neste momento.
                  </PopoverDescription>
              </PopoverHeader>
              <div className="mt-3">
                  <ListOfVacationers />
              </div>
          </PopoverContent>
      </Popover>
    </section>
    <TimesViewFilterBar        query={query}
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
