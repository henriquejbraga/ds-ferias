import type { VacationBalance } from "@/lib/vacationRules";
import { getRoleLevel, getRoleLabel } from "@/lib/vacationRules";
import { DashboardSidebarItem } from "@/components/dashboard-sidebar-item";
import { SidebarBalance } from "@/components/dashboard/sidebar-balance";
import {
  IconCalendar,
  IconInbox,
  IconHistory,
  IconTeams,
  IconSettings,
  IconLogout,
} from "@/components/layout/icons";

type UserLike = { id: string; name: string; role: string };

export function AppSidebar({
  user,
  activeView,
  pendingCount,
  balance,
  department,
}: {
  user: UserLike;
  activeView: string;
  pendingCount: number;
  balance: VacationBalance;
  department?: string | null;
}) {
  const level = getRoleLevel(user.role);

  return (
    <aside className="flex w-full flex-col border-b border-[#e2e8f0] bg-white lg:w-60 lg:border-b-0 lg:border-r dark:border-[#252a35] dark:bg-[#141720]">
      <div className="border-b border-[#e2e8f0] px-3 py-2 dark:border-[#252a35] sm:px-5 sm:py-3">
        {/* Linha 1: logo */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-sm font-bold leading-tight text-[#1a1d23] dark:text-white sm:text-base">
            Editora Globo - Férias
          </span>
        </div>
        {/* Linha 2: usuário + sair */}
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[#1a1d23] dark:text-white sm:text-sm">
                {user.name}
              </p>
              <p className="truncate text-[11px] text-[#64748b] dark:text-slate-400 sm:text-xs">
                {getRoleLabel(user.role)}
              </p>
            </div>
          </div>
          <form action="/api/logout" method="post">
            <button
              type="submit"
              aria-label="Sair da conta"
              className="inline-flex items-center gap-1.5 rounded-md border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-100 hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-inset dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-900/40"
            >
              <IconLogout className="h-3.5 w-3.5" />
              <span>Sair</span>
            </button>
          </form>
        </div>
      </div>

      <nav className="flex flex-wrap items-center gap-1.5 px-3 py-2 lg:hidden" aria-label="Menu principal">
        <DashboardSidebarItem href="/dashboard?view=minhas" icon={<IconCalendar />} label="Minhas Férias" active={activeView === "minhas"} />
        {level >= 2 && (
          <>
            <DashboardSidebarItem href="/dashboard?view=inbox" icon={<IconInbox />} label="Caixa de Aprovação" active={activeView === "inbox"} badge={pendingCount > 0 ? pendingCount : undefined} badgeAlert />
            <DashboardSidebarItem href="/dashboard?view=historico" icon={<IconHistory />} label="Histórico" active={activeView === "historico"} />
            <DashboardSidebarItem href="/dashboard?view=times" icon={<IconTeams />} label="Times" active={activeView === "times"} />
            {level >= 4 && <DashboardSidebarItem href="/admin" icon={<IconSettings />} label="Backoffice" />}
          </>
        )}
      </nav>

      {/* Saldo visível no mobile (no desktop fica na nav lateral) */}
      <div className="border-t border-[#e2e8f0] px-3 py-3 lg:hidden dark:border-[#252a35]">
        <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-[#64748b] dark:text-slate-400">Saldo de Férias</p>
        <SidebarBalance balance={balance} />
      </div>

      <nav className="hidden flex-1 flex-col gap-1 px-3 py-4 lg:flex">
        <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">Menu</p>
        <DashboardSidebarItem href="/dashboard?view=minhas" icon={<IconCalendar />} label="Minhas Férias" active={activeView === "minhas"} />
        {level >= 2 && (
          <>
            <DashboardSidebarItem href="/dashboard?view=inbox" icon={<IconInbox />} label="Caixa de Aprovação" active={activeView === "inbox"} badge={pendingCount > 0 ? pendingCount : undefined} badgeAlert />
            <DashboardSidebarItem href="/dashboard?view=historico" icon={<IconHistory />} label="Histórico" active={activeView === "historico"} />
            <DashboardSidebarItem href="/dashboard?view=times" icon={<IconTeams />} label="Times" active={activeView === "times"} />
            {level >= 4 && <DashboardSidebarItem href="/admin" icon={<IconSettings />} label="Backoffice" />}
          </>
        )}
        <div className="my-2 border-t border-[#e2e8f0] dark:border-[#252a35]" />
        <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-[#64748b] dark:text-slate-400">Saldo de Férias</p>
        <SidebarBalance balance={balance} />
      </nav>

      {/* Botão de sair extra removido no mobile para evitar duplicação no meio da tela */}
    </aside>
  );
}
