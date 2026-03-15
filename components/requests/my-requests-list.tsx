import type { VacationBalance } from "@/lib/vacationRules";
import { EmptyState } from "@/components/layout/empty-state";
import { ExportButton } from "@/components/layout/export-button";
import { RequestCard } from "@/components/requests/request-card";

type RequestLike = {
  id: string;
  userId: string;
  status: string;
  startDate: Date | string;
  endDate: Date | string;
  notes?: string | null;
  user?: { name?: string; role?: string; department?: string | null };
  history?: unknown[];
};

export function MyRequestsList({
  requests,
  balance,
}: {
  requests: RequestLike[];
  balance: VacationBalance;
}) {
  if (!requests.length) {
    return <EmptyState message="Você ainda não criou nenhuma solicitação de férias." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#1a1d23] dark:text-white">
          Histórico de solicitações
        </h3>
        <ExportButton href="/api/vacation-requests/export" />
      </div>
      {requests.map((r) => (
        <RequestCard key={r.id} request={r} isOwner />
      ))}
    </div>
  );
}
