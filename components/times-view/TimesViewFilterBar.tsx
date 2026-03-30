"use client";

import { STATUS_FILTER_OPTIONS, ROLE_FILTER_OPTIONS } from "./filters";

export function TimesViewFilterBar({
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
  roleFilter,
  setRoleFilter,
  directorateFilter,
  setDirectorateFilter,
  directorateOptions = [],
  managerFilter,
  setManagerFilter,
  managerOptions = [],
  coordinatorFilter,
  setCoordinatorFilter,
  coordinatorOptions = [],
  teamFilter,
  setTeamFilter,
  teamOptions = [],
  onExportCsv,
}: {
  query: string;
  setQuery: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  roleFilter?: string;
  setRoleFilter?: (v: string) => void;
  directorateFilter?: string;
  setDirectorateFilter?: (v: string) => void;
  directorateOptions?: Array<{ value: string; label: string }>;
  managerFilter?: string;
  setManagerFilter?: (v: string) => void;
  managerOptions?: Array<{ value: string; label: string }>;
  coordinatorFilter?: string;
  setCoordinatorFilter?: (v: string) => void;
  coordinatorOptions?: Array<{ value: string; label: string }>;
  teamFilter?: string;
  setTeamFilter?: (v: string) => void;
  teamOptions?: Array<{ value: string; label: string }>;
  onExportCsv?: () => void;
}) {
  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm dark:border-[#252a35] dark:bg-[#1a1d23]">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-bold text-[#1a1d23] dark:text-white">Explorar Times e Férias</h3>
        <p className="text-xs font-medium text-[#64748b] dark:text-slate-500 uppercase tracking-widest">
            Filtros avançados
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Busca por Texto */}
        <div className="lg:col-span-2">
            <input
                type="search"
                placeholder="Buscar por nome ou departamento..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-11 w-full rounded-lg border border-[#e2e8f0] bg-[#f5f6f8] px-4 text-sm text-[#1a1d23] placeholder:text-[#94a3b8] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
                aria-label="Buscar por colaborador ou departamento"
            />
        </div>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-11 w-full rounded-lg border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-sm text-[#1a1d23] focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
          aria-label="Filtrar por status"
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Cargos / Roles */}
        {setRoleFilter && (
            <select
                value={roleFilter ?? "ALL"}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-11 w-full rounded-lg border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-sm text-[#1a1d23] focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
                aria-label="Filtrar por cargo"
            >
                {ROLE_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        {/* Diretorias */}
        {setDirectorateFilter && directorateOptions.length > 0 && (
          <select
            value={directorateFilter ?? "ALL"}
            onChange={(e) => setDirectorateFilter(e.target.value)}
            className="h-11 w-full rounded-lg border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-sm text-[#1a1d23] focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
            aria-label="Filtrar por diretoria"
          >
            <option value="ALL">Diretorias: Todas</option>
            {directorateOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {/* Gerências */}
        {setManagerFilter && managerOptions.length > 0 && (
          <select
            value={managerFilter ?? "ALL"}
            onChange={(e) => setManagerFilter(e.target.value)}
            className="h-11 w-full rounded-lg border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-sm text-[#1a1d23] focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
            aria-label="Filtrar por gerência"
          >
            <option value="ALL">Gerências: Todas</option>
            {managerOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {/* Coordenações */}
        {setCoordinatorFilter && coordinatorOptions.length > 0 && (
          <select
            value={coordinatorFilter ?? "ALL"}
            onChange={(e) => setCoordinatorFilter(e.target.value)}
            className="h-11 w-full rounded-lg border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-sm text-[#1a1d23] focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
            aria-label="Filtrar por coordenador"
          >
            <option value="ALL">Coordenações: Todas</option>
            {coordinatorOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {/* Times */}
        {setTeamFilter && teamOptions.length > 0 && (
          <select
            value={teamFilter ?? "ALL"}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="h-11 w-full rounded-lg border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-sm text-[#1a1d23] focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
            aria-label="Filtrar por time"
          >
            <option value="ALL">Times: Todos</option>
            {teamOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {onExportCsv && (
        <div className="mt-6 flex justify-end">
            <button
                type="button"
                onClick={onExportCsv}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-5 text-sm font-bold text-emerald-900 transition-colors hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/70"
            >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Exportar lista (CSV)
            </button>
        </div>
      )}
    </div>
  );
}
