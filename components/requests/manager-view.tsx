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
    <div className="space-y-5 lg:space-y-6">
      <FilterForm
        userRole={userRole}
        filters={filters}
        managerOptions={managerOptions}
        deptOptions={deptOptions}
        view={view}
      />
      <div className="flex flex-wrap items-center justify-end gap-3">
        <ExportButton href={`/api/vacation-requests/export?${buildExportQuery(filters)}`} />
        {userLevel >= 4 && (
          <a
            href="/api/reports/balance"
            download
            aria-label="Baixar relatório de saldo em CSV"
            className="inline-flex items-center gap-1.5 rounded-md border border-[#e2e8f0] bg-white px-3 py-1.5 text-sm font-semibold text-[#475569] transition hover:bg-[#f5f6f8] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-[#252a35] dark:bg-[#1a1d23] dark:text-slate-300 dark:hover:bg-[#252a35]"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
            </svg>
            Relatório de saldo (CSV)
          </a>
        )}
      </div>
      {filteredRequests.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : userLevel >= 4 ? (
        <RequestsGroupedByManager requests={filteredRequests} userId={userId} userRole={userRole} />
      ) : (
        <div className="space-y-4 lg:space-y-5">
          <p className="text-sm text-[#64748b] dark:text-slate-400">
            Esta visão mostra as solicitações da sua equipe, incluindo marcações de{" "}
            <span className="font-semibold">Abono 1/3</span> e{" "}
            <span className="font-semibold">Adiantamento 13º</span>, quando houver.
          </p>
          {filteredRequests.map((r) => (
            <RequestCard key={r.id} request={r} userId={userId} userRole={userRole} />
          ))}
        </div>
      )}
    </div>
  );
}
