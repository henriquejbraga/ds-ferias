"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getRoleLevel } from "@/lib/vacationRules";
import { Button } from "@/components/ui/button";
import type { DashboardFilters } from "@/types/dashboard";

type Props = {
  userRole: string;
  filters: DashboardFilters;
  managerOptions: Array<{ id: string; name: string }>;
  deptOptions: string[];
  teamOptions: string[];
  view: string;
};

export function FilterForm({
  userRole,
  filters,
  managerOptions,
  deptOptions,
  teamOptions,
  view,
}: Props) {
  const userLevel = getRoleLevel(userRole);

  // ---- Caixa de Aprovação (inbox): tudo é `PENDENTE`, então remove status + botão Filtrar
  // e aplica filtros automaticamente quando o usuário digita/seleciona.
  const router = useRouter();

  const initialManagerId =
    userLevel >= 4 && filters.managerId && filters.managerId !== "ALL" ? filters.managerId : "ALL";

  const [q, setQ] = useState(filters.query ?? "");
  const [managerId, setManagerId] = useState(initialManagerId);
  const [department, setDepartment] = useState(filters.department ?? "");
  const [team, setTeam] = useState(filters.team ?? "");
  const qDebounceRef = useRef<number | null>(null);

  useEffect(() => {
    // Sincroniza quando o server re-renderizar por mudança de query.
    setQ(filters.query ?? "");
    setManagerId(
      userLevel >= 4 && filters.managerId && filters.managerId !== "ALL" ? filters.managerId : "ALL",
    );
    setDepartment(filters.department ?? "");
    setTeam(filters.team ?? "");
  }, [filters.query, filters.managerId, filters.department, filters.team, userLevel]);

  const pushInbox = (next: {
    q?: string;
    managerId?: string;
    department?: string;
    team?: string;
  } = {}) => {
    const nextQ = typeof next.q === "string" ? next.q : q;
    const nextManagerId = typeof next.managerId === "string" ? next.managerId : managerId;
    const nextDepartment = typeof next.department === "string" ? next.department : department;
    const nextTeam = typeof next.team === "string" ? next.team : team;

    const params = new URLSearchParams();
    params.set("view", "inbox");
    const trimmed = nextQ.trim();
    if (trimmed.length >= 2) params.set("q", trimmed);
    if (userLevel >= 4 && nextManagerId && nextManagerId !== "ALL") params.set("managerId", nextManagerId);
    if (nextDepartment) params.set("department", nextDepartment);
    if (nextTeam) params.set("team", nextTeam);

    router.push(`/dashboard?${params.toString()}`);
  };

  const handleQChange = (next: string) => {
    setQ(next);

    const trimmed = next.trim();

    // Regra: só busca a partir da 2ª letra (ou limpa quando vazio).
    if (trimmed.length === 0) {
      if (qDebounceRef.current) window.clearTimeout(qDebounceRef.current);
      pushInbox({ q: "" });
      return;
    }

    if (trimmed.length === 1) return;

    if (qDebounceRef.current) window.clearTimeout(qDebounceRef.current);
    qDebounceRef.current = window.setTimeout(() => {
      pushInbox({ q: next });
    }, 300);
  };

  if (view === "inbox") {
    return (
      <div
        className="rounded-lg border border-[#e2e8f0] bg-white p-4 dark:border-[#252a35] dark:bg-[#1a1d23]"
        aria-label="Filtros da Caixa de Aprovação"
      >
        <div className="space-y-3">
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <input
              type="search"
              name="q"
              placeholder="Buscar colaborador..."
              value={q}
              onChange={(e) => handleQChange(e.target.value)}
              aria-label="Buscar por nome do colaborador"
              className="min-h-[44px] w-full rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-base text-[#1a1d23] placeholder:text-[#94a3b8] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white sm:w-auto sm:min-w-[180px]"
            />

            {userLevel >= 4 && managerOptions.length > 0 && (
              <select
                name="managerId"
                value={managerId}
                onChange={(e) => {
                  const next = e.target.value;
                  setManagerId(next);
                  pushInbox({ managerId: next });
                }}
                aria-label="Filtrar por coordenador"
                className="min-h-[44px] w-full rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-base text-[#1a1d23] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white sm:w-auto"
              >
                <option value="ALL">Todos os coordenadores</option>
                {managerOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}

            {deptOptions.length > 0 && (
              <select
                name="department"
                value={department}
                onChange={(e) => {
                  const next = e.target.value;
                  setDepartment(next);
                  pushInbox({ department: next });
                }}
                aria-label="Filtrar por departamento"
                className="min-h-[44px] w-full rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-base text-[#1a1d23] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white sm:w-auto"
              >
                <option value="">Todos os departamentos</option>
                {deptOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}

            {teamOptions.length > 0 && (
              <select
                name="team"
                value={team}
                onChange={(e) => {
                  const next = e.target.value;
                  setTeam(next);
                  pushInbox({ team: next });
                }}
                aria-label="Filtrar por time"
                className="min-h-[44px] w-full rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-base text-[#1a1d23] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white sm:w-auto"
              >
                <option value="">Todos os times</option>
                {teamOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- Histórico: mantém formulário tradicional com botão Filtrar
  return (
    <form
      method="get"
      className="rounded-lg border border-[#e2e8f0] bg-white p-4 dark:border-[#252a35] dark:bg-[#1a1d23]"
      aria-label="Filtros da listagem de solicitações"
    >
      <input type="hidden" name="view" value={view} />
      {view === "historico" && <input type="hidden" name="page" value="1" />}
      <div className="space-y-3">
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <input
            type="search"
            name="q"
            placeholder="Buscar colaborador..."
            defaultValue={filters.query}
            aria-label="Buscar por nome do colaborador"
            className="min-h-[44px] w-full rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-base text-[#1a1d23] placeholder:text-[#94a3b8] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white sm:w-auto sm:min-w-[180px]"
          />
          <select
            name="status"
            defaultValue={filters.status}
            aria-label="Filtrar por status"
            className="min-h-[44px] w-full rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-base text-[#1a1d23] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white sm:w-auto"
          >
            <option value="TODOS">Todos os status</option>
            <option value="PENDENTE">Pendente aprovação</option>
            <option value="APROVADO_COORDENADOR">Aprovado (coordenador)</option>
            <option value="APROVADO_GERENTE">Aprovado (gerente)</option>
            <option value="APROVADO_DIRETOR">Aprovado (diretoria)</option>
            <option value="APROVADO_RH">Aprovado (RH)</option>
            <option value="REPROVADO">Reprovado</option>
          </select>

          {userLevel >= 4 && managerOptions.length > 0 && (
            <select
              name="managerId"
              defaultValue={filters.managerId}
              aria-label="Filtrar por coordenador"
              className="min-h-[44px] w-full rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-base text-[#1a1d23] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white sm:w-auto"
            >
              <option value="ALL">Todos os coordenadores</option>
              {managerOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}

          {deptOptions.length > 0 && (
            <select
              name="department"
              defaultValue={filters.department}
              aria-label="Filtrar por departamento"
              className="min-h-[44px] w-full rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-base text-[#1a1d23] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white sm:w-auto"
            >
              <option value="">Todos os departamentos</option>
              {deptOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}

          {teamOptions.length > 0 && (
            <select
              name="team"
              defaultValue={filters.team ?? ""}
              aria-label="Filtrar por time"
              className="min-h-[44px] w-full rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-base text-[#1a1d23] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white sm:w-auto"
            >
              <option value="">Todos os times</option>
              {teamOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </div>

        {userLevel >= 4 && (
          <div className="flex flex-wrap gap-2">
            <div className="min-w-0 flex-1 sm:min-w-[140px]">
              <label
                htmlFor="filter-from"
                className="mb-1 block text-sm text-[#64748b] dark:text-slate-400"
              >
                Início a partir de
              </label>
              <input
                id="filter-from"
                type="date"
                name="from"
                defaultValue={filters.from}
                className="min-h-[44px] w-full rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
              />
            </div>
            <div className="min-w-0 flex-1 sm:min-w-[140px]">
              <label
                htmlFor="filter-to"
                className="mb-1 block text-sm text-[#64748b] dark:text-slate-400"
              >
                Fim até
              </label>
              <input
                id="filter-to"
                type="date"
                name="to"
                defaultValue={filters.to}
                className="min-h-[44px] w-full rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            className="min-h-[44px] bg-blue-600 px-4 text-base font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Aplicar filtros"
          >
            Filtrar
          </Button>
        </div>
      </div>
    </form>
  );
}
