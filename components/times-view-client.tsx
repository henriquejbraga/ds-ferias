"use client";

import { useState } from "react";

// Período de férias (datas podem vir como string do server)
export type VacationRequestSummary = {
  id?: string;
  status: string;
  startDate: Date | string;
  endDate: Date | string;
};

// Tipos serializáveis (datas vêm como string do server)
export type TeamMemberInfoSerialized = {
  user: { id: string; name: string; department?: string | null; hireDate?: string | null; role: string };
  balance: { availableDays: number; pendingDays: number; isOnVacationNow?: boolean };
  isOnVacationNow: boolean;
  requests: VacationRequestSummary[];
};

type TeamDataCoord = {
  kind: "coord";
  teams: { coordinatorId: string; coordinatorName: string; members: TeamMemberInfoSerialized[] }[];
};

type TeamDataRH = {
  kind: "rh";
  gerentes: {
    gerenteId: string;
    gerenteName: string;
    teams: { coordinatorId: string; coordinatorName: string; members: TeamMemberInfoSerialized[] }[];
  }[];
};

type TeamDataSerialized = TeamDataCoord | TeamDataRH;

const STATUS_FILTER_OPTIONS = [
  { value: "TODOS", label: "Todos" },
  { value: "EM_FERIAS", label: "Em férias" },
  { value: "FERIAS_A_TIRAR", label: "Férias a tirar" },
  { value: "SEM_FERIAS", label: "Sem férias no momento" },
] as const;

function matchesFilter(
  member: TeamMemberInfoSerialized,
  query: string,
  statusFilter: string
): boolean {
  const nameMatch =
    !query.trim() ||
    member.user.name.toLowerCase().includes(query.trim().toLowerCase()) ||
    (member.user.department?.toLowerCase().includes(query.trim().toLowerCase()) ?? false);
  if (!nameMatch) return false;
  if (statusFilter === "TODOS") return true;
  if (statusFilter === "EM_FERIAS") return member.isOnVacationNow;
  if (statusFilter === "FERIAS_A_TIRAR")
    return !member.isOnVacationNow && (member.balance.availableDays > 0 || member.balance.pendingDays > 0);
  if (statusFilter === "SEM_FERIAS")
    return !member.isOnVacationNow && member.balance.availableDays === 0 && member.balance.pendingDays === 0;
  return true;
}

function TeamMemberStatusBadge({ member }: { member: TeamMemberInfoSerialized }) {
  const { isOnVacationNow, balance } = member;
  if (isOnVacationNow) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
        Em férias
      </span>
    );
  }
  if (balance.availableDays > 0 || balance.pendingDays > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden />
        Férias a tirar
        {balance.availableDays > 0 && (
          <span className="font-normal opacity-90">({balance.availableDays} dias)</span>
        )}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
      Não está de férias e não tem férias a tirar
    </span>
  );
}

function formatDateRange(start: string | Date, end: string | Date) {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })} – ${e.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDENTE: "Pendente",
    APROVADO_COORDENADOR: "Aprovado Coord.",
    APROVADO_GESTOR: "Aprovado Coord.",
    APROVADO_GERENTE: "Aprovado Gerente",
    APROVADO_RH: "Aprovado RH",
    REPROVADO: "Reprovado",
    CANCELADO: "Cancelado",
  };
  return map[status] ?? status.replace(/_/g, " ");
}

function TeamMemberRow({
  member,
  requestsSummary,
}: {
  member: TeamMemberInfoSerialized;
  requestsSummary: { startDate: string | Date; endDate: string | Date; status: string }[];
}) {
  const { user } = member;

  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white dark:border-[#252a35] dark:bg-[#1a1d23]">
      <div className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-[#1a1d23] dark:text-white">{user.name}</p>
          {user.department && (
            <p className="truncate text-sm text-[#64748b] dark:text-slate-400">{user.department}</p>
          )}
        </div>
        <div className="w-full shrink-0 sm:w-auto">
          <TeamMemberStatusBadge member={member} />
        </div>
      </div>
      {requestsSummary.length > 0 && (
        <div className="border-t border-[#e2e8f0] dark:border-[#252a35]">
          <div className="space-y-2 p-4 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8] dark:text-slate-500">
              Solicitações
            </p>
            <ul className="space-y-1.5">
              {requestsSummary.map((r: VacationRequestSummary, i: number) => (
                <li
                  key={i}
                  className="flex flex-wrap items-center gap-2 rounded-md bg-[#f5f6f8] px-3 py-2 text-sm dark:bg-[#0f1117]"
                >
                  <span className="text-[#475569] dark:text-slate-400">
                    {formatDateRange(r.startDate, r.endDate)}
                  </span>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                    {statusLabel(r.status)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-5 w-5 shrink-0 text-[#64748b] transition-transform dark:text-slate-400 ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

type Props = {
  teamData: TeamDataSerialized;
  userId: string;
  userRole: string;
  level: number;
};

export function TimesViewClient({ teamData, userId, userRole, level }: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("TODOS");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filterMembers = (members: TeamMemberInfoSerialized[]) =>
    members.filter((m) => matchesFilter(m, query, statusFilter));

  if (teamData.kind === "coord") {
    const teamsFiltered = teamData.teams.map((team) => ({
      ...team,
      members: filterMembers(team.members),
    })).filter((t) => t.members.length > 0);

    return (
      <div className="space-y-6">
        {/* Filtro */}
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-4 dark:border-[#252a35] dark:bg-[#1a1d23]">
          <p className="mb-3 text-sm font-medium text-[#475569] dark:text-slate-400">Filtrar times</p>
          <div className="flex flex-wrap gap-3">
            <input
              type="search"
              placeholder="Buscar por nome ou departamento..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 min-w-0 flex-1 rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-sm text-[#1a1d23] placeholder:text-[#94a3b8] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white sm:min-w-[200px]"
              aria-label="Buscar colaborador"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-sm text-[#1a1d23] focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
              aria-label="Filtrar por status"
            >
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {teamsFiltered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#e2e8f0] bg-white py-10 text-center dark:border-[#252a35] dark:bg-[#1a1d23]">
            <p className="text-[#64748b] dark:text-slate-400">Nenhum colaborador encontrado com os filtros aplicados.</p>
          </div>
        ) : (
          teamsFiltered.map((team) => {
            const key = `team-${team.coordinatorId}`;
            const isOpen = expanded[key] !== false;
            return (
              <section key={team.coordinatorId} className="space-y-0">
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
                      {team.coordinatorName === "Meu time" ? "Meu time" : `Time de ${team.coordinatorName}`}
                    </h3>
                    <p className="text-sm text-[#64748b] dark:text-slate-400">
                      {team.members.length} colaborador(es)
                    </p>
                  </div>
                </button>
                {isOpen && (
                  <div className="space-y-3 border-l-2 border-[#e2e8f0] pl-4 pt-3 dark:border-[#252a35]">
                    {team.members.map((member) => (
                      <TeamMemberRow
                        key={member.user.id}
                        member={member}
                        requestsSummary={member.requests.map((r: VacationRequestSummary) => ({
                          startDate: r.startDate,
                          endDate: r.endDate,
                          status: r.status,
                        }))}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    );
  }

  // RH: gerentes expansíveis, dentro de cada um os times (coords) também expansíveis
  const gerentesFiltered = teamData.gerentes.map((g) => ({
    ...g,
    teams: g.teams.map((team) => ({
      ...team,
      members: filterMembers(team.members),
    })).filter((t) => t.members.length > 0),
  })).filter((g) => g.teams.length > 0);

  return (
    <div className="space-y-6">
      {/* Filtro */}
      <div className="rounded-lg border border-[#e2e8f0] bg-white p-4 dark:border-[#252a35] dark:bg-[#1a1d23]">
        <p className="mb-3 text-sm font-medium text-[#475569] dark:text-slate-400">Filtrar times</p>
        <div className="flex flex-wrap gap-3">
          <input
            type="search"
            placeholder="Buscar por nome ou departamento..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 min-w-0 flex-1 rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-sm text-[#1a1d23] placeholder:text-[#94a3b8] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white sm:min-w-[200px]"
            aria-label="Buscar colaborador"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-sm text-[#1a1d23] focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
            aria-label="Filtrar por status"
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {gerentesFiltered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e2e8f0] bg-white py-10 text-center dark:border-[#252a35] dark:bg-[#1a1d23]">
          <p className="text-[#64748b] dark:text-slate-400">Nenhum colaborador encontrado com os filtros aplicados.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {gerentesFiltered.map((g) => {
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
                  <div className="space-y-3 border-l-2 border-[#e2e8f0] pl-4 pt-3 dark:border-[#252a35]">
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
                            <h3 className="text-sm font-semibold text-[#1a1d23] dark:text-white">
                              Time de {team.coordinatorName}
                            </h3>
                            <span className="ml-auto text-xs text-[#64748b] dark:text-slate-400">
                              {team.members.length} colaborador(es)
                            </span>
                          </button>
                          {teamOpen && (
                            <div className="space-y-3 pl-4 pt-2">
                              {team.members.map((member) => (
                                <TeamMemberRow
                                  key={member.user.id}
                                  member={member}
                                  requestsSummary={member.requests.map((r: VacationRequestSummary) => ({
                                    startDate: r.startDate,
                                    endDate: r.endDate,
                                    status: r.status,
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
      )}
    </div>
  );
}
