import type { VacationBalance } from "@/lib/vacationRules";
import { getVacationStatusDisplayLabel, isVacationApprovedStatus } from "@/lib/vacationRules";
import { getConcessivePeriodInclusive } from "@/lib/concessivePeriod";
import { EmptyState } from "@/components/layout/empty-state";
import { ExportButton } from "@/components/layout/export-button";
import { RequestCard } from "@/components/requests/request-card";
import { MonthlyCalendar } from "@/components/calendar/MonthlyCalendar";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

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
  history?: Array<{
    newStatus?: string;
    changedByUser?: { role?: string | null } | null;
  }>;
};

function formatUpcomingStatus(status: string): string {
  if (status === "PENDENTE") return "Pendente aprovação";
  if (isVacationApprovedStatus(status)) return getVacationStatusDisplayLabel(status);
  return status.replace(/_/g, " ").toLowerCase();
}

export function MyRequestsList({
  requests,
  balance,
  acquisitionPeriods,
  firstEntitlementDate,
}: {
  requests: RequestLike[];
  balance: VacationBalance;
  acquisitionPeriods?: Array<{
    id: string;
    startDate: Date | string;
    endDate: Date | string;
    accruedDays: number;
    usedDays: number;
  }>;
  firstEntitlementDate?: Date | string | null;
}) {
  const entitlementLabel = firstEntitlementDate
    ? new Date(firstEntitlementDate).toLocaleDateString("pt-BR")
    : null;

  const today = new Date();
  const hasRequests = requests.length > 0;
  const upcoming = requests
    .filter((r) => {
      const start = new Date(r.startDate);
      return start >= today && (r.status === "PENDENTE" || isVacationApprovedStatus(r.status));
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 3);

  const periods = (acquisitionPeriods ?? []).map((p) => ({
    ...p,
    start: new Date(p.startDate),
    end: new Date(p.endDate),
  }));

  const endOfTodayLocal = new Date(today);
  endOfTodayLocal.setHours(23, 59, 59, 999);

  function utcMidnight(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  function addMonthsPreservingDayUtc(date: Date, months: number): Date {
    const d = new Date(date);
    const day = d.getUTCDate();
    d.setUTCMonth(d.getUTCMonth() + months);
    if (d.getUTCDate() < day) d.setUTCDate(0);
    return d;
  }

  // Ciclo atual (UI):
  // 1) Se existe um período armazenado que contém "hoje", mostramos ele.
  // 2) Se não existe (ex.: só há ciclos encerrados), calculamos o próximo ciclo em andamento
  //    para não deixar o usuário sem referência de "ciclo atual".
  const endOfTodayMs = endOfTodayLocal.getTime();
  const currentIndex = periods.findIndex((p) => p.start.getTime() <= endOfTodayMs && p.end.getTime() >= endOfTodayMs);

  const derivedCurrent =
    currentIndex !== -1
      ? {
          start: periods[currentIndex].start,
          end: periods[currentIndex].end,
          index: currentIndex,
        }
      : periods.length > 0
        ? (() => {
            const last = periods[periods.length - 1];
            // Próximo ciclo inicia no dia seguinte ao fim do último período.
            const nextStart = new Date(utcMidnight(last.end));
            nextStart.setUTCDate(nextStart.getUTCDate() + 1);
            const endExclusive = addMonthsPreservingDayUtc(nextStart, 12);
            const nextEnd = new Date(endExclusive.getTime() - 1);
            return { start: nextStart, end: nextEnd, index: periods.length };
          })()
        : null;
  // Exibe os 2 ciclos mais recentes (excluindo o atual que já tem bloco próprio).
  // Periods está ordenado por startDate ASC; slice(-2) pega os mais novos.
  const periodsExcludingCurrent = periods.filter((_, i) => currentIndex === -1 || i !== currentIndex);
  const periodsToShow = periodsExcludingCurrent.slice(-2);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#1a1d23] dark:text-white">
          Histórico de solicitações
        </h3>
        <ExportButton href="/api/vacation-requests/export" />
      </div>

      <section className="rounded-lg border border-[#e2e8f0] bg-white p-4 text-sm dark:border-[#252a35] dark:bg-[#1a1d23]">
        <div className="flex items-center gap-1.5">
          <h4 className="text-base font-semibold text-[#1a1d23] dark:text-white">
            Períodos aquisitivos
          </h4>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Entenda os períodos aquisitivos"
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#cbd5e1] text-[9px] font-bold text-[#64748b] transition hover:bg-[#e2e8f0] dark:border-[#334155] dark:text-slate-300 dark:hover:bg-[#252a35]"
              >
                ?
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80">
              <PopoverHeader>
                <PopoverTitle>Ciclos de Férias</PopoverTitle>
                <PopoverDescription>
                  Cada card representa um <strong>ciclo de 12 meses</strong> de trabalho.
                  <br /><br />
                  O sistema prioriza o consumo dos ciclos mais antigos (FIFO) para evitar a perda do direito por prescrição. Quando um ciclo esgota, o próximo passa a ser utilizado.
                </PopoverDescription>
              </PopoverHeader>
            </PopoverContent>
          </Popover>
        </div>
        <p className="mt-1 text-xs text-[#64748b] dark:text-slate-400">
          Cada card mostra um ciclo de aquisição (12 meses). Quando os dias do ciclo acabarem (usados + pendentes), novas férias passam a consumir o próximo ciclo.
        </p>

        {(() => {
          const ONE_DAY_MS = 24 * 60 * 60 * 1000;
          const todayMs = endOfTodayLocal.getTime();

          // Estima dias já comprometidos pelas férias aprovadas/pendentes
          const committedDays = requests
            .filter((r) => r.status === "PENDENTE" || isVacationApprovedStatus(r.status))
            .reduce((sum, r) => {
              return sum + Math.round((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / ONE_DAY_MS + 1);
            }, 0);

          // Períodos aquisitivos já encerrados com saldo não utilizado
          const expiredWithRemaining = periods.filter(
            (p) => p.end.getTime() < todayMs && p.usedDays < p.accruedDays,
          );

          if (!expiredWithRemaining.length) return null;

          const totalExpiredRemaining = expiredWithRemaining.reduce(
            (sum, p) => sum + (p.accruedDays - p.usedDays),
            0,
          );
          if (committedDays >= totalExpiredRemaining) return null;

          // Classifica cada período vencido pelo prazo do período concessivo
          const URGENT_DAYS = 60;
          const urgentPeriods = expiredWithRemaining.filter((p) => {
            const { end: concessiveEnd } = getConcessivePeriodInclusive(p.end);
            const daysLeft = Math.floor((concessiveEnd.getTime() - todayMs) / ONE_DAY_MS);
            return daysLeft >= 0 && daysLeft <= URGENT_DAYS;
          });

          const expiredConcessivePeriods = expiredWithRemaining.filter((p) => {
            const { end: concessiveEnd } = getConcessivePeriodInclusive(p.end);
            return concessiveEnd.getTime() < todayMs;
          });

          if (urgentPeriods.length > 0) {
            const minDaysLeft = urgentPeriods.reduce((min, p) => {
              const { end: concessiveEnd } = getConcessivePeriodInclusive(p.end);
              const d = Math.floor((concessiveEnd.getTime() - todayMs) / ONE_DAY_MS);
              return Math.min(min, d);
            }, Infinity);
            return (
              <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-700/50 dark:bg-red-950/30 dark:text-red-200">
                <p className="font-bold">Férias vencendo em breve!</p>
                <p className="mt-0.5">
                  Você tem {urgentPeriods.length} período(s) aquisitivo(s) cujo prazo para gozo vence
                  {minDaysLeft === 0 ? " hoje" : ` em ${minDaysLeft} dia(s)`}. Solicite férias imediatamente para não perder o direito.
                </p>
              </div>
            );
          }

          if (expiredConcessivePeriods.length > 0) {
            return (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-300">
                <p className="font-semibold">Atenção: direito de férias expirado</p>
                <p className="mt-0.5">
                  {expiredConcessivePeriods.length} período(s) aquisitivo(s) ultrapassaram o prazo concessivo de 12 meses. Contate o RH.
                </p>
              </div>
            );
          }

          return (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-200">
              <p className="font-semibold">Atenção</p>
              <p className="mt-0.5">
                Você tem {expiredWithRemaining.length} período(s) aquisitivo(s) encerrado(s) com saldo não utilizado.
                Solicite férias antes do prazo concessivo para não perder o direito.
              </p>
            </div>
          );
        })()}

        {periods.length > 0 ? (
          <div className="mt-3 space-y-2">
            {derivedCurrent && (() => {
              const currentPeriodData = currentIndex !== -1 ? periods[currentIndex] : null;
              const usedDays = currentPeriodData?.usedDays ?? 0;
              const accruedDays = currentPeriodData?.accruedDays ?? 30;
              const isInProgress = derivedCurrent.index >= Math.min(Math.floor(balance.monthsWorked / 12), 2);
              const statusLabel = usedDays >= accruedDays
                ? "Completo"
                : usedDays > 0
                  ? "Parcial"
                  : "Ainda não utilizado";
              return (
                <div className="flex items-start justify-between rounded-md bg-[#f1f5f9] px-3 py-2 text-xs dark:bg-[#020617]">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[#0f172a] dark:text-slate-100">Ciclo atual</p>
                    <p className="mt-0.5 text-[11px] text-[#64748b] dark:text-slate-400">
                      {derivedCurrent.start.toLocaleDateString("pt-BR")} – {derivedCurrent.end.toLocaleDateString("pt-BR")}
                    </p>
                    {currentPeriodData && (
                      <p className="text-[11px] text-[#64748b] dark:text-slate-400">
                        {usedDays}/{accruedDays} dias usados · {statusLabel}
                      </p>
                    )}
                    {isInProgress && (
                      <p className="mt-0.5 text-[10px] text-[#94a3b8] dark:text-slate-500">
                        Aguardando completar 12 meses
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}
            {periodsToShow.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {periodsToShow.map((p) => {
                  const isExpired = p.end.getTime() < endOfTodayLocal.getTime();
                  const label = `${p.start.toLocaleDateString("pt-BR")} – ${p.end.toLocaleDateString("pt-BR")}`;
                  const status =
                    p.usedDays >= p.accruedDays
                      ? "Completo"
                      : p.usedDays > 0
                        ? "Parcial"
                        : "Ainda não utilizado";
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-md bg-[#f8fafc] px-3 py-2 text-xs dark:bg-[#020617]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-[#0f172a] dark:text-slate-100">{label}</p>
                        <p className="text-[11px] text-[#64748b] dark:text-slate-400">
                          {p.usedDays}/{p.accruedDays} dias usados · {status}
                        </p>
                        {isExpired && (
                          <p className="mt-0.5 text-[10px] text-[#94a3b8] dark:text-slate-500">
                            Ciclo encerrado
                          </p>
                        )}
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="ml-2 inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border border-[#cbd5e1] text-[10px] font-bold text-[#64748b] transition hover:bg-[#e2e8f0] dark:border-[#334155] dark:text-slate-300 dark:hover:bg-[#252a35]"
                          >
                            ?
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-64">
                          <PopoverHeader>
                            <PopoverTitle>Detalhes do Ciclo</PopoverTitle>
                            <PopoverDescription>
                              <strong>Período:</strong> {label}
                              <br />
                              <strong>Saldo do ciclo:</strong> {p.accruedDays} dias
                              <br />
                              <strong>Consumido:</strong> {p.usedDays} dias
                              <br /><br />
                              {p.usedDays >= p.accruedDays 
                                ? "Este ciclo foi totalmente utilizado." 
                                : `Você ainda possui ${p.accruedDays - p.usedDays} dias disponíveis neste ciclo.`}
                            </PopoverDescription>
                          </PopoverHeader>
                        </PopoverContent>
                      </Popover>
                    </div>
                  );
                })}
              </div>
            )}
            {periodsToShow.length === 0 && periods.length > 0 && (
              <p className="text-xs text-[#64748b] dark:text-slate-400">
                Apenas o ciclo atual está em andamento.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-[#64748b] dark:text-slate-400">
              Aguardando completar 12 meses para exibir os períodos aquisitivos.
            </p>
            {balance.hasEntitlement === false && entitlementLabel && (
              <p className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-900 dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-200">
                Seu 1º período aquisitivo completa em {entitlementLabel}.
              </p>
            )}
          </div>
        )}
      </section>

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
        <section className="rounded-lg border border-[#e2e8f0] bg-white p-4 text-base dark:border-[#252a35] dark:bg-[#1a1d23]">
          <h4 className="text-base font-semibold text-[#1a1d23] dark:text-white">
            Próximas férias
          </h4>
          <p className="mt-1 text-sm text-[#64748b] dark:text-slate-400">
            Próximos períodos aprovados ou pendentes, em ordem de data de início.
          </p>
          <ul className="mt-3 space-y-3 text-sm text-[#475569] dark:text-slate-300">
            {upcoming.map((r) => {
              const start = new Date(r.startDate);
              const end = new Date(r.endDate);
              const backWithAbono = r.abono ? new Date(end.getTime()) : null;
              if (backWithAbono) {
                backWithAbono.setDate(backWithAbono.getDate() - 10);
              }
              const diffDays = Math.round(
                (start.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
              );
              const label =
                diffDays === 0
                  ? "Começa hoje"
                  : diffDays === 1
                    ? "Começa amanhã"
                    : `Começa em ${diffDays} dias`;
              return (
                <li key={r.id} className="flex flex-col gap-1 rounded-md bg-[#f8fafc] px-3 py-2 dark:bg-[#020617]">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="inline-flex items-center whitespace-nowrap font-medium leading-none">
                      <span>{start.toLocaleDateString("pt-BR")}</span>
                      <span className="mx-1.5 inline-flex items-center justify-center leading-none text-[#64748b] dark:text-slate-400">
                        →
                      </span>
                      <span>{end.toLocaleDateString("pt-BR")}</span>
                    </span>
                    <span className="text-xs text-[#64748b] dark:text-slate-400">
                      {label} · {formatUpcomingStatus(r.status)}
                    </span>
                  </div>
                  {backWithAbono && (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Retorno: {backWithAbono.toLocaleDateString("pt-BR")}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                        Abono estimado: 10 dias
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {hasRequests ? (
        requests.map((r) => <RequestCard key={r.id} request={r} isOwner />)
      ) : (
        <EmptyState message="Você ainda não criou nenhuma solicitação de férias." />
      )}
    </div>
  );
}
