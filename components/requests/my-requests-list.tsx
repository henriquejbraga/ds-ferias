import type { VacationBalance } from "@/lib/vacationRules";
import { EmptyState } from "@/components/layout/empty-state";
import { ExportButton } from "@/components/layout/export-button";
import { RequestCard } from "@/components/requests/request-card";
import { MonthlyCalendar } from "@/components/calendar/MonthlyCalendar";

type RequestLike = {
  id: string;
  userId: string;
  status: string;
  startDate: Date | string;
  endDate: Date | string;
  notes?: string | null;
  abono?: boolean;
  thirteenth?: boolean;
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

  const today = new Date();
  const upcoming = requests
    .filter((r) => {
      const start = new Date(r.startDate);
      return start >= today && ["PENDENTE", "APROVADO_COORDENADOR", "APROVADO_GERENTE", "APROVADO_RH"].includes(r.status);
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#1a1d23] dark:text-white">
          Histórico de solicitações
        </h3>
        <ExportButton href="/api/vacation-requests/export" />
      </div>

      <MonthlyCalendar
        entries={requests.map((r) => ({
          startDate: r.startDate,
          endDate: r.endDate,
          status: r.status,
          abono: r.abono,
          thirteenth: r.thirteenth,
        }))}
      />

      {upcoming.length > 0 && (
        <section className="rounded-lg border border-[#e2e8f0] bg-white p-4 dark:border-[#252a35] dark:bg-[#1a1d23]">
          <h4 className="text-sm font-semibold text-[#1a1d23] dark:text-white">
            Próximas férias
          </h4>
          <p className="mt-1 text-sm text-[#64748b] dark:text-slate-400">
            Próximos períodos aprovados ou pendentes, em ordem de data de início.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-[#475569] dark:text-slate-300">
            {upcoming.map((r) => {
              const start = new Date(r.startDate);
              const end = new Date(r.endDate);
              const diffDays = Math.round(
                (start.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
              );
              const label =
                diffDays === 0
                  ? "começa hoje"
                  : diffDays === 1
                    ? "começa amanhã"
                    : `começa em ${diffDays} dias`;
              return (
                <li key={r.id} className="flex items-center justify-between">
                  <span>
                    {start.toLocaleDateString("pt-BR")} → {end.toLocaleDateString("pt-BR")}
                  </span>
                  <span className="text-xs text-[#64748b] dark:text-slate-400">
                    {label} · {r.status}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {requests.map((r) => (
        <RequestCard key={r.id} request={r} isOwner />
      ))}
    </div>
  );
}
