import type { VacationBalance } from "@/lib/vacationRules";

export function SidebarBalance({ balance }: { balance: VacationBalance }) {
  const usedPct =
    balance.entitledDays > 0
      ? Math.min(100, Math.round((balance.usedDays / balance.entitledDays) * 100))
      : 0;
  const pendingPct =
    balance.entitledDays > 0
      ? Math.min(100 - usedPct, Math.round((balance.pendingDays / balance.entitledDays) * 100))
      : 0;

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
      <p className="text-center text-sm font-semibold text-[#64748b] dark:text-slate-400">
        {balance.entitledDays} dias/ciclo
      </p>
      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#e2e8f0] dark:bg-[#252a35]">
        <div className="flex h-full">
          <div className="bg-blue-500 transition-all" style={{ width: `${usedPct}%` }} />
          <div className="bg-amber-400 transition-all" style={{ width: `${pendingPct}%` }} />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-base font-bold text-blue-600 dark:text-blue-400">{balance.usedDays}</p>
          <p className="mt-0.5 text-xs font-medium text-[#64748b] dark:text-slate-400">Usados</p>
        </div>
        <div>
          <p className="text-base font-bold text-amber-600 dark:text-amber-400">{balance.pendingDays}</p>
          <p className="mt-0.5 text-xs font-medium text-[#64748b] dark:text-slate-400">Pendente</p>
        </div>
        <div>
          <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{balance.availableDays}</p>
          <p className="mt-0.5 text-xs font-medium text-[#64748b] dark:text-slate-400">Disponível</p>
        </div>
      </div>
    </div>
  );
}
