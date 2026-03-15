import { getRoleLevel } from "@/lib/vacationRules";
import { Button } from "@/components/ui/button";
import type { DashboardFilters } from "@/types/dashboard";

type Props = {
  userRole: string;
  filters: DashboardFilters;
  managerOptions: Array<{ id: string; name: string }>;
  deptOptions: string[];
  view: string;
};

export function FilterForm({
  userRole,
  filters,
  managerOptions,
  deptOptions,
  view,
}: Props) {
  const userLevel = getRoleLevel(userRole);

  return (
    <form method="get" className="rounded-lg border border-[#e2e8f0] bg-white p-4 dark:border-[#252a35] dark:bg-[#1a1d23]">
      <input type="hidden" name="view" value={view} />
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            name="q"
            placeholder="Buscar colaborador..."
            defaultValue={filters.query}
            className="min-h-[44px] min-w-0 flex-1 rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-base text-[#1a1d23] placeholder:text-[#94a3b8] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white sm:min-w-[180px]"
          />
          <select
            name="status"
            defaultValue={filters.status}
            className="min-h-[44px] min-w-0 flex-1 rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-base text-[#1a1d23] focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white sm:flex-initial"
          >
            <option value="TODOS">Todos os status</option>
            <option value="PENDENTE">Pendente aprovação</option>
            <option value="APROVADO_COORDENADOR">Aprovado Coord.</option>
            <option value="APROVADO_GERENTE">Aprovado Gerente</option>
            <option value="APROVADO_RH">Aprovado RH</option>
            <option value="REPROVADO">Reprovado</option>
          </select>

          {userLevel >= 4 && managerOptions.length > 0 && (
            <select
              name="managerId"
              defaultValue={filters.managerId}
              className="min-h-[44px] min-w-0 flex-1 rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-base text-[#1a1d23] focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white sm:flex-initial"
            >
              <option value="ALL">Todos os coordenadores</option>
              {managerOptions.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}

          {deptOptions.length > 0 && (
            <select
              name="department"
              defaultValue={filters.department}
              className="min-h-[44px] min-w-0 flex-1 rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-base text-[#1a1d23] focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white sm:flex-initial"
            >
              <option value="">Todos os departamentos</option>
              {deptOptions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}
        </div>

        {userLevel >= 4 && (
          <div className="flex flex-wrap gap-2">
            <div className="min-w-0 flex-1 sm:min-w-[140px]">
              <label className="mb-1 block text-sm text-[#64748b] dark:text-slate-400">Início a partir de</label>
              <input
                type="date"
                name="from"
                defaultValue={filters.from}
                className="min-h-[44px] w-full rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-base focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
              />
            </div>
            <div className="min-w-0 flex-1 sm:min-w-[140px]">
              <label className="mb-1 block text-sm text-[#64748b] dark:text-slate-400">Fim até</label>
              <input
                type="date"
                name="to"
                defaultValue={filters.to}
                className="min-h-[44px] w-full rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-base focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" size="sm" className="min-h-[44px] bg-blue-600 px-4 text-base font-medium text-white hover:bg-blue-700">
            Filtrar
          </Button>
        </div>
      </div>
    </form>
  );
}
