"use client";

import { STATUS_FILTER_OPTIONS } from "./filters";

export function TimesViewFilterBar({
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
}: {
  query: string;
  setQuery: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
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
      </div>
    </div>
  );
}

