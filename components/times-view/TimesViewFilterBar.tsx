"use client";

import { STATUS_FILTER_OPTIONS } from "./filters";

export function TimesViewFilterBar({
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
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
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {setManagerFilter && managerOptions.length > 0 && (
          <select
            value={managerFilter ?? "ALL"}
            onChange={(e) => setManagerFilter(e.target.value)}
            className="h-10 rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-sm text-[#1a1d23] focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
            aria-label="Filtrar por gerência"
          >
            {managerOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
        {setCoordinatorFilter && coordinatorOptions.length > 0 && (
          <select
            value={coordinatorFilter ?? "ALL"}
            onChange={(e) => setCoordinatorFilter(e.target.value)}
            className="h-10 rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-sm text-[#1a1d23] focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
            aria-label="Filtrar por coordenador"
          >
            {coordinatorOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
        {setTeamFilter && teamOptions.length > 0 && (
          <select
            value={teamFilter ?? "ALL"}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="h-10 rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-sm text-[#1a1d23] focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
            aria-label="Filtrar por time"
          >
            {teamOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
        {onExportCsv && (
          <button
            type="button"
            onClick={onExportCsv}
            className="h-10 rounded-md border border-[#cbd5e1] bg-white px-3 text-sm font-semibold text-[#334155] hover:bg-[#f8fafc] dark:border-[#334155] dark:bg-[#0f1117] dark:text-slate-200 dark:hover:bg-[#1e2330]"
          >
            Exportar times (CSV)
          </button>
        )}
      </div>
    </div>
  );
}

