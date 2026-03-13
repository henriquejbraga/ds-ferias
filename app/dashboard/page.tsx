import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { NewRequestCardClient } from "@/components/dashboard/new-request-card";
import { ActionButtonForm } from "@/components/action-button-form";
import { type VacationStatus } from "../../generated/prisma/enums";
import {
  getRoleLabel,
  getRoleLevel,
  getApprovalSteps,
  getApprovalProgress,
  getNextApprover,
  canApproveRequest,
  hasTeamVisibility,
  calculateVacationBalance,
} from "@/lib/vacationRules";

// ============================================================================
// DATA FETCHING
// ============================================================================

async function getData(userId: string, role: string, q?: string, status?: string) {
  const myRequests = await prisma.vacationRequest.findMany({
    where: { userId },
    include: { history: { orderBy: { changedAt: "asc" }, include: { changedByUser: { select: { name: true, role: true } } } } },
    orderBy: { startDate: "asc" },
  });

  if (role === "COLABORADOR" || role === "FUNCIONARIO") {
    return { myRequests, managedRequests: [], blackouts: [], teamRequests: [] };
  }

  const where: any = {};
  if (q) where.user = { name: { contains: q, mode: "insensitive" } };
  if (status && status !== "TODOS") where.status = status as VacationStatus;

  const managedRequests = await prisma.vacationRequest.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: true,
          hireDate: true,
          managerId: true,
          manager: { select: { id: true, name: true, managerId: true } },
        },
      },
      history: {
        orderBy: { changedAt: "asc" },
        include: { changedByUser: { select: { name: true, role: true } } },
      },
    },
    orderBy: { startDate: "asc" },
  });

  const blackouts = await prisma.blackoutPeriod.findMany({
    include: { createdBy: { select: { name: true } } },
    orderBy: { startDate: "asc" },
  });

  // Solicitações para mostrar no calendário de equipe
  const teamRequests = managedRequests.filter((r) =>
    ["APROVADO_GERENTE", "APROVADO_RH"].includes(r.status),
  );

  return { myRequests, managedRequests, blackouts, teamRequests };
}

type DashboardSearchParams = { [key: string]: string | string[] | undefined };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<DashboardSearchParams> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const q = normalizeParam(params.q);
  const statusFilter = normalizeParam(params.status, "TODOS");
  const view = normalizeParam(params.view, "inbox");
  const managerFilter = normalizeParam(params.managerId);
  const fromFilter = normalizeParam(params.from);
  const toFilter = normalizeParam(params.to);
  const deptFilter = normalizeParam(params.department);

  const { myRequests, managedRequests, blackouts, teamRequests } = await getData(
    user.id, user.role, q, statusFilter,
  );

  // Saldo de férias do usuário atual
  const userFull = await prisma.user.findUnique({
    where: { id: user.id },
    select: { hireDate: true, department: true, vacationRequests: { select: { startDate: true, endDate: true, status: true } } },
  });
  const balance = calculateVacationBalance(userFull?.hireDate ?? null, userFull?.vacationRequests ?? [] as any);

  const userRoleLevel = getRoleLevel(user.role);

  const pendingCount = managedRequests.filter((r) => {
    if (!hasTeamVisibility(user.role, user.id, r as any)) return false;
    if (userRoleLevel === 2) return r.status === "PENDENTE";
    if (userRoleLevel === 3) return r.status === "PENDENTE" || r.status === "APROVADO_COORDENADOR" || r.status === "APROVADO_GESTOR";
    if (userRoleLevel === 4) return r.status === "APROVADO_GERENTE";
    return false;
  }).length;

  const approvedCount = managedRequests.filter((r) => r.status === "APROVADO_RH").length;

  const isApprover = userRoleLevel >= 2;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f6f8] dark:bg-[#0f1117]">
      <AppSidebar
        user={user}
        activeView={view}
        pendingCount={pendingCount}
        balance={balance}
        department={userFull?.department}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {/* Cabeçalho da página */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#1a1d23] dark:text-white">
              {isApprover ? "Gestão de Férias" : "Minhas Férias"}
            </h1>
            <p className="mt-1 text-sm text-[#64748b] dark:text-slate-400">
              Bem-vindo(a), {user.name} · {getRoleLabel(user.role)}
              {userFull?.department && (
                <span className="ml-2 rounded-full bg-[#eff6ff] px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                  {userFull.department}
                </span>
              )}
            </p>
          </div>

          {/* Cards de estatísticas (aprovadores) */}
          {isApprover && (
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Total" value={managedRequests.length} sublabel="Solicitações" />
              <StatCard label="Pendentes" value={pendingCount} sublabel="Aguardando você" alert={pendingCount > 0} />
              <StatCard label="Aprovadas" value={approvedCount} sublabel="Aprovadas pelo RH" />
              <StatCard label="Bloqueios" value={blackouts.filter(b => new Date(b.endDate) >= new Date()).length} sublabel="Períodos ativos" />
            </div>
          )}

          {/* Alerta de períodos de bloqueio ativos */}
          {blackouts.filter(b => new Date(b.endDate) >= new Date()).length > 0 && !isApprover && (
            <BlackoutAlert blackouts={blackouts} />
          )}

          <div className="grid gap-6 lg:grid-cols-12">
            <section className="lg:col-span-8">
              {!isApprover ? (
                <MyRequestsList requests={myRequests} balance={balance} />
              ) : (
                <ManagerView
                  userRole={user.role}
                  userId={user.id}
                  requests={managedRequests}
                  blackouts={blackouts}
                  filters={{ query: q, status: statusFilter, view, managerId: managerFilter, from: fromFilter, to: toFilter, department: deptFilter }}
                />
              )}
            </section>

            <aside className="space-y-4 lg:col-span-4">
              {/* Saldo de férias */}
              <VacationBalanceCard balance={balance} />

              {/* Nova solicitação */}
              <div className="rounded-lg border border-[#e2e8f0] bg-white dark:border-[#252a35] dark:bg-[#1a1d23]">
                <div className="border-b border-[#e2e8f0] px-5 py-4 dark:border-[#252a35]">
                  <h3 className="text-sm font-semibold text-[#1a1d23] dark:text-white">Nova Solicitação</h3>
                  <p className="mt-0.5 text-xs text-[#64748b] dark:text-slate-400">
                    Informe os períodos desejados
                  </p>
                </div>
                <div className="p-5">
                  <NewRequestCardClient canRequest />
                </div>
              </div>

              {/* Fluxo de aprovação do usuário atual */}
              <ApprovalFlowCard requesterRole={user.role} />

              {/* Períodos de bloqueio (para aprovadores) */}
              {isApprover && blackouts.length > 0 && (
                <BlackoutListCard blackouts={blackouts} />
              )}
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}

// ============================================================================
// SIDEBAR
// ============================================================================

function AppSidebar({
  user,
  activeView,
  pendingCount,
  balance,
  department,
}: {
  user: any;
  activeView: string;
  pendingCount: number;
  balance: ReturnType<typeof calculateVacationBalance>;
  department?: string | null;
}) {
  const level = getRoleLevel(user.role);

  return (
    <aside className="flex w-60 flex-col border-r border-[#e2e8f0] bg-white dark:border-[#252a35] dark:bg-[#141720]">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-[#e2e8f0] px-5 dark:border-[#252a35]">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
          <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <span className="text-base font-bold text-[#1a1d23] dark:text-white">DS-Férias</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">Menu</p>
        <SidebarItem href="/dashboard" icon={<IconDashboard />} label="Dashboard" active={true} />

        {level >= 2 && (
          <>
            <SidebarItem
              href="/dashboard?view=inbox"
              icon={<IconInbox />}
              label="Caixa de Aprovação"
              active={activeView === "inbox"}
              badge={pendingCount > 0 ? pendingCount : undefined}
              badgeAlert
            />
            <SidebarItem
              href="/dashboard?view=historico"
              icon={<IconHistory />}
              label="Histórico"
              active={activeView === "historico"}
            />
          </>
        )}

        {level < 2 && (
          <SidebarItem
            href="/dashboard"
            icon={<IconCalendar />}
            label="Minhas Férias"
          />
        )}

        <div className="my-2 border-t border-[#e2e8f0] dark:border-[#252a35]" />
        <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">Saldo</p>

        {/* Mini saldo na sidebar */}
        <div className="rounded-md bg-[#f5f6f8] px-3 py-2.5 dark:bg-[#1e2330]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#64748b] dark:text-slate-400">Disponível</span>
            <span className={`text-sm font-bold ${balance.availableDays > 0 ? "text-emerald-600" : "text-red-500"}`}>
              {balance.availableDays} dias
            </span>
          </div>
          {balance.hasEntitlement && (
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#e2e8f0] dark:bg-[#252a35]">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${Math.min(100, Math.round((balance.usedDays / 30) * 100))}%` }}
              />
            </div>
          )}
          <p className="mt-1 text-[10px] text-[#94a3b8]">
            {balance.usedDays}/{balance.entitledDays || 30} dias usados
          </p>
        </div>
      </nav>

      {/* Usuário */}
      <div className="border-t border-[#e2e8f0] px-4 py-4 dark:border-[#252a35]">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[#1a1d23] dark:text-white">{user.name}</p>
            <p className="truncate text-xs text-[#64748b] dark:text-slate-400">{getRoleLabel(user.role)}</p>
          </div>
        </div>
        <form action="/api/logout" method="post" className="mt-3">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-[#64748b] transition hover:bg-[#f5f6f8] hover:text-[#1a1d23] dark:hover:bg-[#1e2330] dark:hover:text-white"
          >
            <IconLogout />
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}

function SidebarItem({
  href,
  icon,
  label,
  active = false,
  badge,
  badgeAlert = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
  badgeAlert?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
          : "text-[#64748b] hover:bg-[#f5f6f8] hover:text-[#1a1d23] dark:text-slate-400 dark:hover:bg-[#1e2330] dark:hover:text-white"
      }`}
    >
      <span className="h-4 w-4 shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge !== undefined && (
        <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-bold ${badgeAlert ? "bg-red-500 text-white" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
          {badge}
        </span>
      )}
    </Link>
  );
}

function TopBar() {
  return (
    <header className="flex h-16 items-center justify-end border-b border-[#e2e8f0] bg-white px-6 dark:border-[#252a35] dark:bg-[#141720]">
      <ThemeToggle />
    </header>
  );
}

// ============================================================================
// CARDS DE ESTATÍSTICAS
// ============================================================================

function StatCard({ label, value, sublabel, alert = false }: { label: string; value: number; sublabel: string; alert?: boolean }) {
  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white p-5 dark:border-[#252a35] dark:bg-[#1a1d23]">
      <p className="text-xs font-medium uppercase tracking-wide text-[#64748b] dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${alert && value > 0 ? "text-red-500" : "text-[#1a1d23] dark:text-white"}`}>{value}</p>
      <p className="mt-1 text-xs text-[#64748b] dark:text-slate-500">{sublabel}</p>
    </div>
  );
}

// ============================================================================
// CARD DE SALDO DE FÉRIAS
// ============================================================================

function VacationBalanceCard({ balance }: { balance: ReturnType<typeof calculateVacationBalance> }) {
  const usedPct = balance.entitledDays > 0
    ? Math.min(100, Math.round((balance.usedDays / balance.entitledDays) * 100))
    : 0;
  const pendingPct = balance.entitledDays > 0
    ? Math.min(100 - usedPct, Math.round((balance.pendingDays / balance.entitledDays) * 100))
    : 0;

  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white dark:border-[#252a35] dark:bg-[#1a1d23]">
      <div className="border-b border-[#e2e8f0] px-5 py-4 dark:border-[#252a35]">
        <h3 className="text-sm font-semibold text-[#1a1d23] dark:text-white">Saldo de Férias</h3>
        <p className="mt-0.5 text-xs text-[#64748b]">Ciclo atual</p>
      </div>
      <div className="p-5">
        {!balance.hasEntitlement ? (
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-500">
              {Math.max(0, 12 - balance.monthsWorked)} meses
            </p>
            <p className="mt-1 text-xs text-[#64748b] dark:text-slate-400">para adquirir direito a férias</p>
            <p className="mt-2 text-xs text-[#94a3b8]">{balance.monthsWorked} meses de empresa</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold text-[#1a1d23] dark:text-white">{balance.availableDays}</p>
                <p className="text-xs text-[#64748b] dark:text-slate-400">dias disponíveis</p>
              </div>
              <div className="text-right text-xs text-[#64748b] dark:text-slate-400">
                <p>{balance.entitledDays} dias/ciclo</p>
              </div>
            </div>

            {/* Barra de progresso */}
            <div className="h-2 overflow-hidden rounded-full bg-[#f1f5f9] dark:bg-[#252a35]">
              <div className="flex h-full">
                <div className="bg-blue-500 transition-all" style={{ width: `${usedPct}%` }} />
                <div className="bg-amber-400 transition-all" style={{ width: `${pendingPct}%` }} />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <BalanceStat label="Usados" value={balance.usedDays} color="blue" />
              <BalanceStat label="Pendentes" value={balance.pendingDays} color="amber" />
              <BalanceStat label="Disponíveis" value={balance.availableDays} color="green" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BalanceStat({ label, value, color }: { label: string; value: number; color: "blue" | "amber" | "green" }) {
  const colors = {
    blue: "text-blue-600 dark:text-blue-400",
    amber: "text-amber-600 dark:text-amber-400",
    green: "text-emerald-600 dark:text-emerald-400",
  }[color];
  return (
    <div>
      <p className={`text-base font-bold ${colors}`}>{value}</p>
      <p className="text-[10px] text-[#94a3b8]">{label}</p>
    </div>
  );
}

// ============================================================================
// CARD DE FLUXO DE APROVAÇÃO
// ============================================================================

function ApprovalFlowCard({ requesterRole }: { requesterRole: string }) {
  const steps = getApprovalSteps(requesterRole);
  if (!steps.length) return null;

  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white p-5 dark:border-[#252a35] dark:bg-[#1a1d23]">
      <h4 className="mb-3 text-sm font-semibold text-[#1a1d23] dark:text-white">Fluxo de Aprovação</h4>
      <ol className="relative space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-center gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {i + 1}
            </div>
            <span className="text-xs text-[#475569] dark:text-slate-400">{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[10px] text-[#94a3b8]">
        Solicitações seguem esta cadeia de aprovação para chegar ao status final.
      </p>
    </div>
  );
}

// ============================================================================
// ALERTA DE BLACKOUT
// ============================================================================

function BlackoutAlert({ blackouts }: { blackouts: any[] }) {
  const active = blackouts.filter((b) => new Date(b.endDate) >= new Date());
  if (!active.length) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-950/20">
      <div className="flex items-start gap-2">
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Períodos bloqueados pela empresa</p>
          {active.slice(0, 2).map((b: any, i) => (
            <p key={i} className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              {new Date(b.startDate).toLocaleDateString("pt-BR")} – {new Date(b.endDate).toLocaleDateString("pt-BR")}: {b.reason}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function BlackoutListCard({ blackouts }: { blackouts: any[] }) {
  const active = blackouts.filter((b) => new Date(b.endDate) >= new Date());
  if (!active.length) return null;

  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white dark:border-[#252a35] dark:bg-[#1a1d23]">
      <div className="border-b border-[#e2e8f0] px-5 py-3 dark:border-[#252a35]">
        <h4 className="text-xs font-semibold text-[#1a1d23] dark:text-white">Períodos Bloqueados</h4>
      </div>
      <div className="divide-y divide-[#f1f5f9] dark:divide-[#252a35]">
        {active.map((b: any) => (
          <div key={b.id} className="px-4 py-3">
            <p className="text-xs font-medium text-[#1a1d23] dark:text-white">{b.reason}</p>
            <p className="mt-0.5 text-[10px] text-[#64748b] dark:text-slate-400">
              {new Date(b.startDate).toLocaleDateString("pt-BR")} – {new Date(b.endDate).toLocaleDateString("pt-BR")}
              {b.department && ` · ${b.department}`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// STATUS BADGES
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  if (status === "APROVADO_COORDENADOR" || status === "APROVADO_GESTOR") {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusChip color="indigo" label="Aprovado Coord." />
        <StatusChip color="amber" label="Pend. Gerente" />
      </div>
    );
  }
  if (status === "APROVADO_GERENTE") {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusChip color="purple" label="Aprovado Gerente" />
        <StatusChip color="amber" label="Pend. RH" />
      </div>
    );
  }

  const config: Record<string, { color: ChipColor; label: string }> = {
    PENDENTE: { color: "amber", label: "Pendente" },
    APROVADO_RH: { color: "green", label: "Aprovado RH" },
    REPROVADO: { color: "red", label: "Reprovado" },
    CANCELADO: { color: "slate", label: "Cancelado" },
  };

  const c = config[status] ?? { color: "slate" as ChipColor, label: status.replace(/_/g, " ") };
  return <StatusChip color={c.color} label={c.label} />;
}

type ChipColor = "amber" | "green" | "red" | "blue" | "indigo" | "purple" | "slate";

function StatusChip({ color, label }: { color: ChipColor; label: string }) {
  const styles: Record<ChipColor, string> = {
    amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/50",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50",
    red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/50",
    blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/50",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800/50",
    purple: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800/50",
    slate: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[color]}`}>
      {label}
    </span>
  );
}

// ============================================================================
// INDICADOR DE PROGRESSO NA CADEIA DE APROVAÇÃO
// ============================================================================

function ApprovalProgressBar({ request }: { request: any }) {
  const steps = getApprovalSteps(request.user?.role ?? "FUNCIONARIO");
  const progress = getApprovalProgress(request.status);
  const isRejected = request.status === "REPROVADO" || request.status === "CANCELADO";
  const isCompleted = request.status === "APROVADO_RH";
  const nextApprover = getNextApprover(request.status, request.user?.role ?? "FUNCIONARIO");

  if (!steps.length) return null;

  return (
    <div className="mt-3 rounded-md bg-[#f5f6f8] px-3 py-2.5 dark:bg-[#0f1117]">
      <div className="flex items-center gap-1">
        {steps.map((step, i) => (
          <div key={i} className="flex flex-1 items-center">
            <div
              className={`h-1.5 flex-1 rounded-full transition-all ${
                isRejected
                  ? "bg-red-200 dark:bg-red-900/30"
                  : i < progress
                  ? "bg-blue-500"
                  : i === progress && !isCompleted
                  ? "bg-amber-400"
                  : "bg-[#e2e8f0] dark:bg-[#252a35]"
              }`}
            />
            {i < steps.length - 1 && <div className="mx-0.5" />}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <div className="flex gap-2">
          {steps.map((step, i) => (
            <span key={i} className={`text-[10px] ${i < progress ? "text-blue-600 dark:text-blue-400" : i === progress && !isCompleted ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-[#94a3b8]"}`}>
              {step}
            </span>
          ))}
        </div>
      </div>
      {nextApprover && !isCompleted && !isRejected && (
        <p className="mt-1 text-[10px] text-[#94a3b8]">Aguardando: {nextApprover}</p>
      )}
    </div>
  );
}

// ============================================================================
// LISTA DO COLABORADOR
// ============================================================================

function MyRequestsList({
  requests,
  balance,
}: {
  requests: any[];
  balance: ReturnType<typeof calculateVacationBalance>;
}) {
  if (!requests.length) {
    return <EmptyState message="Você ainda não criou nenhuma solicitação de férias." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#1a1d23] dark:text-white">
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

// ============================================================================
// VISÃO DO APROVADOR (COORDENADOR / GERENTE / RH)
// ============================================================================

type Filters = { query: string; status: string; view: string; managerId: string; from: string; to: string; department: string };

function ManagerView({
  userRole,
  userId,
  requests,
  blackouts,
  filters,
}: {
  userRole: string;
  userId: string;
  requests: any[];
  blackouts: any[];
  filters: Filters;
}) {
  const view = filters.view === "historico" ? "historico" : "inbox";
  const managerOptions = getManagerOptions(userRole, requests);
  const deptOptions = getDepartmentOptions(requests);
  const filteredRequests = filterRequests(userRole, userId, requests, filters);
  const userLevel = getRoleLevel(userRole);

  return (
    <div className="space-y-4">
      <FilterForm
        userRole={userRole}
        filters={filters}
        managerOptions={managerOptions}
        deptOptions={deptOptions}
        view={view}
      />

      <div className="flex justify-end">
        <ExportButton href={`/api/vacation-requests/export?${buildExportQuery(filters)}`} />
      </div>

      {filteredRequests.length === 0 ? (
        <EmptyState message="Nenhuma solicitação encontrada com os filtros aplicados." />
      ) : userLevel >= 4 ? (
        <RequestsGroupedByManager requests={filteredRequests} userId={userId} />
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((r) => (
            <RequestCard key={r.id} request={r} userId={userId} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterForm({
  userRole,
  filters,
  managerOptions,
  deptOptions,
  view,
}: {
  userRole: string;
  filters: Filters;
  managerOptions: Array<{ id: string; name: string }>;
  deptOptions: string[];
  view: string;
}) {
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
            className="h-9 min-w-[180px] flex-1 rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-sm text-[#1a1d23] placeholder:text-[#94a3b8] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
          />
          <select
            name="status"
            defaultValue={filters.status}
            className="h-9 rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-sm text-[#1a1d23] focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
          >
            <option value="TODOS">Todos os status</option>
            <option value="PENDENTE">Pendente</option>
            <option value="APROVADO_COORDENADOR">Aprovado Coord.</option>
            <option value="APROVADO_GERENTE">Aprovado Gerente</option>
            <option value="APROVADO_RH">Aprovado RH</option>
            <option value="REPROVADO">Reprovado</option>
          </select>

          {userLevel >= 4 && managerOptions.length > 0 && (
            <select
              name="managerId"
              defaultValue={filters.managerId}
              className="h-9 rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-sm text-[#1a1d23] focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
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
              className="h-9 rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-sm text-[#1a1d23] focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
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
            <div className="min-w-[140px] flex-1">
              <label className="mb-1 block text-xs text-[#64748b] dark:text-slate-400">Início a partir de</label>
              <input type="date" name="from" defaultValue={filters.from}
                className="h-9 w-full rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-sm focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white" />
            </div>
            <div className="min-w-[140px] flex-1">
              <label className="mb-1 block text-xs text-[#64748b] dark:text-slate-400">Fim até</label>
              <input type="date" name="to" defaultValue={filters.to}
                className="h-9 w-full rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-sm focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white" />
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" size="sm" className="bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">
            Filtrar
          </Button>
        </div>
      </div>
    </form>
  );
}

function RequestsGroupedByManager({ requests, userId }: { requests: any[]; userId: string }) {
  const groups = groupByManager(requests);
  return (
    <div className="space-y-5">
      {Object.entries(groups).map(([managerName, groupReqs]) => (
        <section key={managerName} className="space-y-3">
          <div className="flex items-center gap-2 rounded-md bg-[#f5f6f8] px-4 py-2.5 dark:bg-[#1e2330]">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
              {managerName.charAt(0).toUpperCase()}
            </span>
            <h3 className="text-sm font-semibold text-[#1a1d23] dark:text-white">
              Coordenador(a): {managerName}
            </h3>
            <span className="ml-auto text-xs text-[#64748b]">{(groupReqs as any[]).length} solicitação(ões)</span>
          </div>
          {(groupReqs as any[]).map((r: any) => (
            <RequestCard key={r.id} request={r} userId={userId} />
          ))}
        </section>
      ))}
    </div>
  );
}

// ============================================================================
// CARD DE SOLICITAÇÃO
// ============================================================================

function RequestCard({
  request,
  userId,
  isOwner = false,
}: {
  request: any;
  userId?: string;
  isOwner?: boolean;
}) {
  const canApprove = userId
    ? canApproveRequest(
        /* approverRole */ request.user?.role === undefined ? "FUNCIONARIO" : request._approverRole ?? "RH",
        userId,
        { userId: request.userId, status: request.status, user: { role: request.user?.role ?? "FUNCIONARIO" } },
      )
    : false;
  
  // Simplified: if userId provided and it's not own request, allow actions
  const showActions = isOwner || (!!userId && request.userId !== userId);

  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white transition-shadow hover:shadow-sm dark:border-[#252a35] dark:bg-[#1a1d23]">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <span className="text-lg font-bold leading-none text-blue-700 dark:text-blue-400">
                {new Date(request.startDate).getDate()}
              </span>
              <span className="text-[9px] uppercase text-blue-500 dark:text-blue-400">
                {new Date(request.startDate).toLocaleDateString("pt-BR", { month: "short" })}
              </span>
            </div>
            <div>
              {!isOwner && request.user && (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[#1a1d23] dark:text-white">{request.user.name}</p>
                  <RoleChip role={request.user.role} />
                </div>
              )}
              <p className="text-sm text-[#64748b] dark:text-slate-400">
                {formatDateRange(request.startDate, request.endDate)}
              </p>
              {request.user?.department && (
                <p className="text-xs text-[#94a3b8]">{request.user.department}</p>
              )}
            </div>
          </div>
          <StatusBadge status={request.status} />
        </div>

        {/* Nota do solicitante */}
        {request.notes && (
          <div className="mt-3 rounded-md bg-[#f5f6f8] px-3 py-2 dark:bg-[#0f1117]">
            <p className="text-xs text-[#64748b] dark:text-slate-400">
              <span className="font-medium text-[#475569] dark:text-slate-300">Obs.: </span>
              {request.notes}
            </p>
          </div>
        )}

        {/* Progresso da aprovação */}
        {request.user && <ApprovalProgressBar request={request} />}

        {/* Histórico */}
        {request.history?.length > 0 && <HistorySection history={request.history} />}

        {/* Ações */}
        {showActions && <RequestActions request={request} isOwner={isOwner} hasApprovePermission={!!userId && request.userId !== userId} />}
      </div>
    </div>
  );
}

function RoleChip({ role }: { role: string }) {
  const colors: Record<string, string> = {
    FUNCIONARIO: "bg-blue-50 text-blue-600",
    COLABORADOR: "bg-blue-50 text-blue-600",
    COORDENADOR: "bg-indigo-50 text-indigo-600",
    GESTOR: "bg-indigo-50 text-indigo-600",
    GERENTE: "bg-purple-50 text-purple-600",
    RH: "bg-emerald-50 text-emerald-600",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors[role] ?? "bg-slate-100 text-slate-600"}`}>
      {getRoleLabel(role)}
    </span>
  );
}

function HistorySection({ history }: { history: any[] }) {
  return (
    <div className="mt-4 rounded-md border border-[#e2e8f0] bg-[#f5f6f8] p-3 dark:border-[#252a35] dark:bg-[#0f1117]">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#64748b] dark:text-slate-400">Histórico</p>
      <div className="space-y-1.5">
        {history.map((h, idx) => (
          <div key={idx} className="flex items-start gap-2 text-xs text-[#475569] dark:text-slate-400">
            <span className="mt-0.5 text-[#94a3b8]">→</span>
            <span className="font-medium shrink-0">
              {new Date(h.changedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="flex-1">
              {h.previousStatus} → <span className="font-semibold">{h.newStatus}</span>
              {h.changedByUser?.name && (
                <span className="text-[#94a3b8]"> · {h.changedByUser.name} ({getRoleLabel(h.changedByUser.role)})</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RequestActions({
  request,
  isOwner,
  hasApprovePermission,
}: {
  request: any;
  isOwner: boolean;
  hasApprovePermission?: boolean;
}) {
  const isPending = request.status === "PENDENTE";
  const isPendingRH = request.status === "APROVADO_COORDENADOR" || request.status === "APROVADO_GESTOR";

  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t border-[#e2e8f0] pt-4 dark:border-[#252a35]">
      {hasApprovePermission && (
        <>
          <ActionButtonForm
            action={`/api/vacation-requests/${request.id}/approve`}
            variant="outline"
            size="sm"
            label="Aprovar"
            loadingLabel="Aprovando..."
            className="border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
          />
          <ActionButtonForm
            action={`/api/vacation-requests/${request.id}/reject`}
            variant="outline"
            size="sm"
            label="Reprovar"
            loadingLabel="Reprovando..."
            className="border-red-200 bg-red-50 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
          />
        </>
      )}
      {isOwner && isPending && <EditPeriodForm request={request} />}
      <ActionButtonForm
        action={`/api/vacation-requests/${request.id}/delete`}
        variant="outline"
        size="sm"
        label={isPendingRH ? "Excluir (pend. Gerente)" : "Excluir"}
        loadingLabel="Excluindo..."
        className="ml-auto border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
      />
    </div>
  );
}

function EditPeriodForm({ request }: { request: any }) {
  return (
    <details className="w-full">
      <summary className="flex cursor-pointer items-center justify-between rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 py-2 text-xs font-semibold text-[#475569] hover:bg-[#e2e8f0] dark:border-[#252a35] dark:bg-[#1e2330] dark:text-slate-300">
        <span className="flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Editar período
        </span>
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <form action={`/api/vacation-requests/${request.id}/update`} method="post"
        className="mt-3 space-y-3 rounded-md border border-[#e2e8f0] bg-[#f5f6f8] p-4 dark:border-[#252a35] dark:bg-[#0f1117]">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#475569] dark:text-slate-400">Início</label>
            <input type="date" name="startDate" required defaultValue={new Date(request.startDate).toISOString().split("T")[0]}
              className="h-9 w-full rounded-md border border-[#e2e8f0] bg-white px-3 text-sm focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#1a1d23] dark:text-white" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#475569] dark:text-slate-400">Término</label>
            <input type="date" name="endDate" required defaultValue={new Date(request.endDate).toISOString().split("T")[0]}
              className="h-9 w-full rounded-md border border-[#e2e8f0] bg-white px-3 text-sm focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#1a1d23] dark:text-white" />
          </div>
        </div>
        <Button type="submit" size="sm" className="w-full bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700">
          Salvar
        </Button>
      </form>
    </details>
  );
}

// ============================================================================
// AUXILIARES
// ============================================================================

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#e2e8f0] bg-white py-14 text-center dark:border-[#252a35] dark:bg-[#1a1d23]">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#f5f6f8] dark:bg-[#252a35]">
        <svg className="h-6 w-6 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-[#1a1d23] dark:text-white">Nenhuma solicitação</p>
      <p className="mt-1 text-xs text-[#64748b] dark:text-slate-400">{message}</p>
    </div>
  );
}

function ExportButton({ href }: { href: string }) {
  return (
    <a href={href} className="inline-flex items-center gap-1.5 rounded-md border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-semibold text-[#475569] transition hover:bg-[#f5f6f8] dark:border-[#252a35] dark:bg-[#1a1d23] dark:text-slate-300 dark:hover:bg-[#252a35]">
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
      </svg>
      Exportar CSV
    </a>
  );
}

// ============================================================================
// ÍCONES
// ============================================================================

function IconDashboard() {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM13 7a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2h-3a2 2 0 01-2-2V7zM3 17a2 2 0 012-2h3a2 2 0 012 2v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1zM13 17a2 2 0 012-2h3a2 2 0 012 2v1a2 2 0 01-2 2h-3a2 2 0 01-2-2v-1z" /></svg>;
}
function IconCalendar() {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
}
function IconInbox() {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>;
}
function IconHistory() {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}
function IconLogout() {
  return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>;
}

// ============================================================================
// UTILITÁRIOS
// ============================================================================

function normalizeParam(param: string | string[] | undefined, def = ""): string {
  if (typeof param === "string") return param;
  if (Array.isArray(param)) return param[0] || def;
  return def;
}

function formatDateRange(start: Date, end: Date): string {
  return `${new Date(start).toLocaleDateString("pt-BR")} → ${new Date(end).toLocaleDateString("pt-BR")}`;
}

function getManagerOptions(userRole: string, requests: any[]) {
  if (getRoleLevel(userRole) < 4) return [];
  return Array.from(
    new Map(
      requests.filter((r) => r.user?.manager?.id).map((r) => [r.user.manager.id, r.user.manager.name]),
    ).entries(),
  ).map(([id, name]) => ({ id, name }));
}

function getDepartmentOptions(requests: any[]): string[] {
  const depts = new Set<string>();
  requests.forEach((r) => { if (r.user?.department) depts.add(r.user.department); });
  return Array.from(depts).sort();
}

function filterRequests(userRole: string, userId: string, requests: any[], filters: Filters): any[] {
  return requests.filter((r) => {
    // Visibilidade por equipe
    if (!hasTeamVisibility(userRole, userId, r as any)) return false;

    // Filtro por coordenador (RH)
    if (getRoleLevel(userRole) >= 4 && filters.managerId && filters.managerId !== "ALL") {
      if (r.user?.manager?.id !== filters.managerId) return false;
    }

    // Filtro por departamento
    if (filters.department && r.user?.department !== filters.department) return false;

    // Filtro por período
    if (filters.from && r.startDate < new Date(filters.from)) return false;
    if (filters.to && r.endDate > new Date(filters.to)) return false;

    // Filtro por view (inbox = aguardando ação; historico = já processado)
    const userLevel = getRoleLevel(userRole);
    if (filters.view === "inbox") {
      if (userLevel === 2 && r.status !== "PENDENTE") return false;
      if (userLevel === 3 && !["PENDENTE", "APROVADO_COORDENADOR", "APROVADO_GESTOR"].includes(r.status)) return false;
      if (userLevel >= 4 && r.status !== "APROVADO_GERENTE") return false;
    } else if (filters.view === "historico") {
      const processed = ["APROVADO_COORDENADOR", "APROVADO_GESTOR", "APROVADO_GERENTE", "APROVADO_RH", "REPROVADO", "CANCELADO"];
      if (!processed.includes(r.status)) return false;
    }

    // Filtro por nome
    if (filters.query && !r.user?.name?.toLowerCase().includes(filters.query.toLowerCase())) return false;

    // Filtro por status
    if (filters.status !== "TODOS" && r.status !== filters.status) return false;

    return true;
  });
}

function groupByManager(requests: any[]) {
  return requests.reduce((groups: Record<string, any[]>, r) => {
    const name = r.user?.manager?.name || "Sem coordenador definido";
    if (!groups[name]) groups[name] = [];
    groups[name].push(r);
    return groups;
  }, {});
}

function buildExportQuery(filters: Filters): string {
  return new URLSearchParams({ q: filters.query, status: filters.status || "TODOS", view: filters.view }).toString();
}
