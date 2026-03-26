"use client";

import type { VacationBalance } from "@/lib/vacationRules";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

type AcquisitionLike = { accruedDays: number; usedDays: number };

export function SidebarBalance({
  balance,
  userRole,
  acquisitionPeriods = [],
  hasUpcomingVacation = false,
}: {
  balance: VacationBalance;
  userRole?: string;
  acquisitionPeriods?: AcquisitionLike[];
  hasUpcomingVacation?: boolean;
}) {
  const isBusinessDaysRole = userRole === "GERENTE" || userRole === "DIRETOR";
  const cycleBusinessLimit = 22;
  const periodsWithRemaining = acquisitionPeriods.filter((p) => p.usedDays < p.accruedDays);
  const entitledFromOpenPeriods = periodsWithRemaining.reduce((sum, p) => sum + p.accruedDays, 0);
  const usedFromOpenPeriods = periodsWithRemaining.reduce((sum, p) => sum + p.usedDays, 0);

  const shouldFallbackToBalanceWindow =
    !isBusinessDaysRole && acquisitionPeriods.length > 0 && periodsWithRemaining.length === 0 && hasUpcomingVacation;
  const totalFromAcquisitionPeriods = acquisitionPeriods.length > 0 ? entitledFromOpenPeriods : balance.entitledDays;
  const normalizedTotalFromPeriods = Math.min(balance.entitledDays, totalFromAcquisitionPeriods);
  const totalLimit = isBusinessDaysRole
    ? cycleBusinessLimit
    : shouldFallbackToBalanceWindow
      ? balance.entitledDays
      : normalizedTotalFromPeriods;
  const safeLimit = Math.max(1, totalLimit);
  const rawUsed = isBusinessDaysRole
    ? balance.usedDays
    : shouldFallbackToBalanceWindow
      ? balance.usedDays
    : acquisitionPeriods.length > 0
      ? Math.min(usedFromOpenPeriods, totalLimit)
      : balance.usedDays;
  const normalizedUsed = Math.min(totalLimit, Math.max(0, rawUsed));
  const remainingAfterUsed = isBusinessDaysRole
    ? Math.max(0, cycleBusinessLimit - normalizedUsed)
    : Math.max(0, totalLimit - normalizedUsed);
  const normalizedPending = Math.min(Math.max(0, balance.pendingDays), remainingAfterUsed);
  const normalizedAvailable = Math.max(0, totalLimit - normalizedUsed - normalizedPending);
  const usedPct = Math.min(100, Math.round((normalizedUsed / safeLimit) * 100));
  const pendingPct = Math.min(100 - usedPct, Math.round((normalizedPending / safeLimit) * 100));

  if (!balance.hasEntitlement) {
    return (
      <div className="rounded-md bg-[#f5f6f8] px-3 py-3 dark:bg-[#1e2330]">
        <p className="text-center text-xl font-bold text-amber-500">
          {Math.max(0, 12 - balance.monthsWorked)} meses
        </p>
        <p className="mt-1 text-center text-sm text-[#64748b] dark:text-slate-400">
          para direito a férias
        </p>
        <p className="mt-1.5 text-center text-xs text-[#94a3b8]">
          {balance.monthsWorked} meses de empresa
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md bg-[#f5f6f8] px-3 py-3 dark:bg-[#1e2330]">
      <p className="text-center text-2xl font-bold text-[#334155] dark:text-slate-200">
        {normalizedAvailable} {isBusinessDaysRole ? "dias úteis" : "dias"}
      </p>
      <p className="mt-0.5 text-center text-xs font-semibold text-[#64748b] dark:text-slate-400">
        disponíveis
      </p>
      <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-[#475569] dark:text-slate-300">
        <p>
          Usados {normalizedUsed} de {totalLimit} {isBusinessDaysRole ? "úteis" : "na janela atual"}
        </p>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Entenda o cálculo do saldo"
              className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border border-[#cbd5e1] text-[10px] font-bold text-[#64748b] transition hover:bg-[#e2e8f0] dark:border-[#334155] dark:text-slate-300 dark:hover:bg-[#252a35]"
            >
              ?
            </button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-72">
            <PopoverHeader>
              <PopoverTitle>Como ler este saldo</PopoverTitle>
              <PopoverDescription>
                <strong>Usados:</strong> dias de férias já aprovados.
                <br />
                <strong>Pendente:</strong> dias já solicitados, aguardando aprovação.
                <br />
                <strong>Disponível:</strong> o que ainda pode ser solicitado no ciclo.
                <br />
                <strong>Quando renova:</strong> ao completar um novo ciclo de 12 meses.
              </PopoverDescription>
            </PopoverHeader>
          </PopoverContent>
        </Popover>
      </div>
      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#e2e8f0] dark:bg-[#252a35]">
        <div className="flex h-full">
          <div className="bg-slate-500 transition-all dark:bg-slate-400" style={{ width: `${usedPct}%` }} />
          <div className="bg-amber-400 transition-all" style={{ width: `${pendingPct}%` }} />
        </div>
      </div>
      <p className="mt-2.5 text-center text-xs text-[#64748b] dark:text-slate-400">
        Solicitados aguardando aprovação:{" "}
        <span className="font-semibold text-amber-600 dark:text-amber-400">
          {normalizedPending}
        </span>
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-base font-bold text-slate-600 dark:text-slate-300">{normalizedUsed}</p>
          <p className="mt-0.5 text-xs font-medium text-[#64748b] dark:text-slate-400">Usados</p>
        </div>
        <div>
          <p className="text-base font-bold text-amber-600 dark:text-amber-400">{normalizedPending}</p>
          <p className="mt-0.5 text-xs font-medium text-[#64748b] dark:text-slate-400">Pendente</p>
        </div>
        <div>
          <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{normalizedAvailable}</p>
          <p className="mt-0.5 text-xs font-medium text-[#64748b] dark:text-slate-400">Disponível</p>
        </div>
      </div>
    </div>
  );
}
