import { getRoleLevel } from "@/lib/vacationRules";
import { getManagerOptions, getDepartmentOptions, filterRequests, buildExportQuery } from "@/lib/dashboardFilters";
import { EmptyState } from "@/components/layout/empty-state";
import { ExportButton } from "@/components/layout/export-button";
import { FilterForm } from "@/components/requests/filter-form";
import { RequestCard } from "@/components/requests/request-card";
import { RequestsGroupedByManager } from "@/components/requests/requests-grouped-by-manager";
import type { DashboardFilters } from "@/types/dashboard";

type RequestLike = {
  id: string;
  userId: string;
  status: string;
  startDate: Date | string;
  endDate: Date | string;
  notes?: string | null;
  abono?: boolean;
  thirteenth?: boolean;
  user?: { name?: string; role?: string; department?: string | null; manager?: { id: string; name: string } | null };
  history?: unknown[];
};

export function ManagerView({
  userRole,
  userId,
  requests,
  visibleCount,
  blackouts,
  filters,
}: {
  userRole: string;
  userId: string;
  requests: RequestLike[];
  visibleCount: number;
  blackouts: unknown[];
  filters: DashboardFilters;
}) {
  const view = filters.view === "historico" ? "historico" : "inbox";
  const managerOptions = getManagerOptions(userRole, requests);
  const deptOptions = getDepartmentOptions(requests);
  const filteredRequests = filterRequests(userRole, userId, requests, filters);
  const userLevel = getRoleLevel(userRole);

  const emptyMessage =
    view === "historico"
      ? "No Histórico aparecem apenas solicitações já processadas (aprovadas ou reprovadas). Pedidos pendentes de aprovação aparecem na aba Caixa de Aprovação."
      : visibleCount === 0
      ? "Nenhuma solicitação da sua equipe no momento. Se colaboradores deveriam aparecer aqui, verifique no Backoffice se eles têm você como Coordenador(a)/Gerente."
      : "Nenhuma solicitação encontrada com os filtros aplicados.";

  return (
    <div className="space-y-4">
      <FilterForm
        userRole={userRole}
        filters={filters}
        managerOptions={managerOptions}
        deptOptions={deptOptions}
        view={view}
      />
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ExportButton href={`/api/vacation-requests/export?${buildExportQuery(filters)}`} />
        {userLevel >= 4 && (
          <a
            href="/api/reports/balance"
            download
            aria-label="Baixar relatório de saldo em CSV"
            className="inline-flex items-center gap-2 rounded-md border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-medium text-[#1a1d23] hover:bg-[#f5f6f8] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-[#252a35] dark:bg-[#1a1d23] dark:text-white dark:hover:bg-[#252a35]"
          >
            Relatório de saldo (CSV)
          </a>
        )}
      </div>
      {filteredRequests.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : userLevel >= 4 ? (
        <RequestsGroupedByManager requests={filteredRequests} userId={userId} userRole={userRole} />
      ) : (
        <div className="mx-auto max-w-4xl space-y-5">
          <p className="text-xs text-[#64748b] dark:text-slate-400">
            Ao aprovar solicitações marcadas com <span className="font-semibold">Abono 1/3</span> e/ou{" "}
            <span className="font-semibold">Adiantamento 13º</span>, você também estará aprovando esses pedidos
            financeiros vinculados às férias.
          </p>
          {filteredRequests.map((r) => (
            <RequestCard key={r.id} request={r} userId={userId} userRole={userRole} />
          ))}
        </div>
      )}
    </div>
  );
}
