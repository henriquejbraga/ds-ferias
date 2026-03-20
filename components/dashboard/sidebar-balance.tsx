import type { VacationBalance } from "@/lib/vacationRules";

export function SidebarBalance({ balance, userRole }: { balance: VacationBalance; userRole?: string }) {
  const isBusinessDaysRole = userRole === "GERENTE" || userRole === "DIRETOR";
  const cycleBusinessLimit = 22;
  const normalizedUsed = isBusinessDaysRole
    ? Math.min(cycleBusinessLimit, Math.max(0, balance.usedDays))
    : Math.max(0, balance.usedDays);
  const remainingAfterUsed = isBusinessDaysRole
    ? Math.max(0, cycleBusinessLimit - normalizedUsed)
    : Math.max(0, balance.entitledDays - normalizedUsed);
  const normalizedPending = Math.min(Math.max(0, balance.pendingDays), remainingAfterUsed);
  const totalLimit = isBusinessDaysRole ? cycleBusinessLimit : Math.max(1, balance.entitledDays);
  const normalizedAvailable = Math.max(0, totalLimit - normalizedUsed - normalizedPending);
  const usedPct = Math.min(100, Math.round((normalizedUsed / totalLimit) * 100));
  const pendingPct = Math.min(100 - usedPct, Math.round((normalizedPending / totalLimit) * 100));

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
      <p className="mt-2 text-center text-xs text-[#475569] dark:text-slate-300">
        Usados {normalizedUsed} de {totalLimit} {isBusinessDaysRole ? "úteis" : "do ciclo"}
      </p>
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
