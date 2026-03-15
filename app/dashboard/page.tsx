import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { NewRequestCardClient } from "@/components/dashboard/new-request-card";
import { ActionButtonForm } from "@/components/action-button-form";
import { type VacationStatus } from "../../generated/prisma/enums";
import {
  type VacationBalance,
  getRoleLabel,
  getRoleLevel,
  getApprovalSteps,
  getApprovalProgress,
  getNextApprover,
  canApproveRequest,
  hasTeamVisibility,
  calculateVacationBalance,
} from "@/lib/vacationRules";
import { buildManagedRequestsWhere } from "@/lib/requestVisibility";
import { DashboardSidebarItem } from "@/components/dashboard-sidebar-item";
import { TimesViewClient } from "@/components/times-view-client";

// ============================================================================
// DATA FETCHING
// ============================================================================

async function getData(userId: string, role: string, q?: string, status?: string) { 
  // Sempre busca minhas solicitações
  const myRequestsPromise = prisma.vacationRequest.findMany({
    where: { userId },
    include: {
      history: {
        orderBy: { changedAt: "asc" },
        include: { changedByUser: { select: { name: true, role: true } } },
      },
    },
    orderBy: { startDate: "asc" },
  });

  // Para colaborador, não precisa das outras queries
  if (role === "COLABORADOR" || role === "FUNCIONARIO") {
    const myRequests = await myRequestsPromise;
    return { myRequests, managedRequests: [], blackouts: [], teamRequests: [] };
  }

  const where = buildManagedRequestsWhere(userId, role, {
    query: q,
    status: status && status !== "TODOS" ? status : undefined,
  }) as { [key: string]: unknown };

  const managedRequestsPromise = prisma.vacationRequest.findMany({
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
          manager: { select: { id: true, name: true, managerId: true, manager: { select: { id: true, name: true } } } },
        },
      },
      history: {
        orderBy: { changedAt: "asc" },
        include: { changedByUser: { select: { name: true, role: true } } },
      },
    },
    orderBy: { startDate: "asc" },
  });

  const blackoutsPromise = prisma.blackoutPeriod.findMany({
    include: { createdBy: { select: { name: true } } },
    orderBy: { startDate: "asc" },
  });

  const [myRequests, managedRequests, blackouts] = await Promise.all([
    myRequestsPromise,
    managedRequestsPromise,
    blackoutsPromise,
  ]);

  const teamRequests = managedRequests.filter((r) =>
    ["APROVADO_GERENTE", "APROVADO_RH"].includes(r.status),
  );

  return { myRequests, managedRequests, blackouts, teamRequests };
}

// Estrutura para a aba Times: todos os membros do time com status explícito
export type TeamMemberInfo = {
  user: { id: string; name: string; department?: string | null; hireDate?: Date | null; role: string };
  balance: VacationBalance;
  isOnVacationNow: boolean;
  requests: any[];
};

function isOnVacationNow(requests: { status: string; startDate: Date; endDate: Date }[]): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return requests.some((r) => {
    if (r.status !== "APROVADO_RH") return false;
    const start = new Date(r.startDate);
    const end = new Date(r.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return today >= start && today <= end;
  });
}

async function getTeamMembersForTimes(
  userId: string,
  role: string,
): Promise<
  | { kind: "coord"; teams: { coordinatorId: string; coordinatorName: string; members: TeamMemberInfo[] }[] }
  | { kind: "rh"; gerentes: { gerenteId: string; gerenteName: string; teams: { coordinatorId: string; coordinatorName: string; members: TeamMemberInfo[] }[] }[] }
> {
  const level = getRoleLevel(role);
  const baseInclude = {
    manager: { select: { id: true, name: true, managerId: true, manager: { select: { id: true, name: true } } } },
    vacationRequests: {
      orderBy: { startDate: "asc" as const },
      include: {
        history: { orderBy: { changedAt: "asc" as const }, include: { changedByUser: { select: { name: true, role: true } } } },
      },
    },
  };

  if (level === 2) {
    const users = await prisma.user.findMany({
      where: { managerId: userId },
      include: baseInclude,
    });
    const members: TeamMemberInfo[] = users.map((u) => ({
      user: { id: u.id, name: u.name, department: u.department, hireDate: u.hireDate, role: u.role },
      balance: calculateVacationBalance(u.hireDate ?? null, u.vacationRequests ?? []),
      isOnVacationNow: isOnVacationNow(u.vacationRequests ?? []),
      requests: u.vacationRequests ?? [],
    }));
    return {
      kind: "coord",
      teams: [{ coordinatorId: userId, coordinatorName: "Meu time", members }],
    };
  }

  if (level === 3) {
    const users = await prisma.user.findMany({
      where: { manager: { managerId: userId } },
      include: baseInclude,
    });
    const members: TeamMemberInfo[] = users.map((u) => ({
      user: { id: u.id, name: u.name, department: u.department, hireDate: u.hireDate, role: u.role },
      balance: calculateVacationBalance(u.hireDate ?? null, u.vacationRequests ?? []),
      isOnVacationNow: isOnVacationNow(u.vacationRequests ?? []),
      requests: u.vacationRequests ?? [],
    }));
    const byCoord = members.reduce((acc: Record<string, TeamMemberInfo[]>, m) => {
      const coordId = (users.find((u) => u.id === m.user.id) as any)?.managerId ?? "sem-coord";
      if (!acc[coordId]) acc[coordId] = [];
      acc[coordId].push(m);
      return acc;
    }, {});
    const coordNames = new Map<string, string>();
    users.forEach((u) => {
      if (u.managerId && u.manager) coordNames.set(u.managerId, u.manager.name);
    });
    const teams = Object.entries(byCoord).map(([coordId, mems]) => ({
      coordinatorId: coordId,
      coordinatorName: coordNames.get(coordId) ?? "Sem coordenador",
      members: mems.sort((a, b) => a.user.name.localeCompare(b.user.name)),
    }));
    return { kind: "coord", teams };
  }

  // RH: todos os funcionários/colaboradores, agrupados por gerente e coordenador
  const users = await prisma.user.findMany({
    where: { role: { in: ["FUNCIONARIO", "COLABORADOR"] } },
    include: baseInclude,
  });
  const members: TeamMemberInfo[] = users.map((u) => ({
    user: { id: u.id, name: u.name, department: u.department, hireDate: u.hireDate, role: u.role },
    balance: calculateVacationBalance(u.hireDate ?? null, u.vacationRequests ?? []),
    isOnVacationNow: isOnVacationNow(u.vacationRequests ?? []),
    requests: u.vacationRequests ?? [],
  }));
  const byGerente = new Map<string, Map<string, TeamMemberInfo[]>>();
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const m = members[i];
    const gerenteId = (u as any).manager?.manager?.id ?? "sem-gerente";
    const gerenteName = (u as any).manager?.manager?.name ?? "Sem gerente";
    const coordId = (u as any).manager?.id ?? "sem-coord";
    const coordName = (u as any).manager?.name ?? "Sem coordenador";
    if (!byGerente.has(gerenteId)) byGerente.set(gerenteId, new Map());
    const byCoord = byGerente.get(gerenteId)!;
    if (!byCoord.has(coordId)) byCoord.set(coordId, []);
    byCoord.get(coordId)!.push(m);
  }
  const gerentes: { gerenteId: string; gerenteName: string; teams: { coordinatorId: string; coordinatorName: string; members: TeamMemberInfo[] }[] }[] = [];
  byGerente.forEach((byCoord, gerenteId) => {
    const firstUser = users.find((u) => ((u as any).manager?.manager?.id ?? "sem-gerente") === gerenteId);
    const gerenteName = (firstUser as any)?.manager?.manager?.name ?? "Sem gerente";
    const teams = Array.from(byCoord.entries()).map(([coordId, mems]) => {
      const firstInCoord = mems[0];
      const u = users.find((x) => x.id === firstInCoord.user.id) as any;
      return {
        coordinatorId: coordId,
        coordinatorName: u?.manager?.name ?? "Sem coordenador",
        members: mems.sort((a, b) => a.user.name.localeCompare(b.user.name)),
      };
    });
    gerentes.push({ gerenteId, gerenteName, teams });
  });
  gerentes.sort((a, b) => a.gerenteName.localeCompare(b.gerenteName));
  return { kind: "rh", gerentes };
}

type DashboardSearchParams = { [key: string]: string | string[] | undefined };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<DashboardSearchParams> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const userRoleLevel = getRoleLevel(user.role);
  const isApprover = userRoleLevel >= 2;
  const defaultView = isApprover ? "inbox" : "minhas";

  const q = normalizeParam(params.q);
  const statusFilter = normalizeParam(params.status, "TODOS");
  const rawView = normalizeParam(params.view, defaultView);
  const view = ["inbox", "historico", "minhas", "times"].includes(rawView) ? rawView : defaultView;
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
  const balance: VacationBalance = calculateVacationBalance(userFull?.hireDate ?? null, userFull?.vacationRequests ?? [] as any);

  const visibleRequests = managedRequests.filter((r) => hasTeamVisibility(user.role, user.id, r as any));
  const pendingCount = visibleRequests.filter((r) => {
    if (userRoleLevel === 2) return r.status === "PENDENTE";
    if (userRoleLevel === 3) return r.status === "PENDENTE" || r.status === "APROVADO_COORDENADOR" || r.status === "APROVADO_GESTOR";
    if (userRoleLevel === 4) return r.status === "APROVADO_GERENTE";
    return false;
  }).length;

  const approvedCount = visibleRequests.filter((r) => r.status === "APROVADO_RH").length;

  const isMyView = !isApprover || view === "minhas";
  const isTimesView = isApprover && view === "times";
  const teamData = isTimesView ? await getTeamMembersForTimes(user.id, user.role) : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f6f8] dark:bg-[#0f1117] lg:flex-row">
        <AppSidebar
        user={user}
        activeView={isTimesView ? "times" : isMyView ? "minhas" : view}
        pendingCount={pendingCount}
        balance={balance}
        department={userFull?.department}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Cabeçalho da página */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#1a1d23] dark:text-white">
              {isTimesView ? "Times" : isMyView ? "Minhas Férias" : "Gestão de Férias"}
            </h1>
            <p className="mt-1 text-base text-[#64748b] dark:text-slate-400">
              Bem-vindo(a), {user.name} · {getRoleLabel(user.role)}
              {userFull?.department && (
                <span className="ml-2 rounded-full bg-[#eff6ff] px-2 py-0.5 text-sm font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                  {userFull.department}
                </span>
              )}
            </p>
          </div>

          {/* Cards de estatísticas (aprovadores) — não exibir na aba Times */}
          {!isMyView && isApprover && !isTimesView && (
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Total" value={visibleRequests.length} sublabel="Solicitações (sua equipe)" />
              <StatCard label="Pendentes" value={pendingCount} sublabel="Aguardando você" alert={pendingCount > 0} />
              <StatCard label="Aprovadas" value={approvedCount} sublabel="Aprovadas pelo RH" />
            </div>
          )}

          {/* Alerta de períodos de bloqueio ativos */}
          {blackouts.filter(b => new Date(b.endDate) >= new Date()).length > 0 && !isApprover && (
            <BlackoutAlert blackouts={blackouts} />
          )}

          <div className="grid gap-6 lg:grid-cols-12">
            <section className="min-w-0 lg:col-span-6">
              {isTimesView ? (
                <TimesView
                  userRole={user.role}
                  userId={user.id}
                  teamData={teamData}
                />
              ) : isApprover && (view === "inbox" || view === "historico") ? (
                <ManagerView
                  userRole={user.role}
                  userId={user.id}
                  requests={managedRequests}
                  visibleCount={visibleRequests.length}
                  blackouts={blackouts}
                  filters={{ query: q, status: statusFilter, view, managerId: managerFilter, from: fromFilter, to: toFilter, department: deptFilter }}
                />
              ) : (
                <MyRequestsList requests={myRequests} balance={balance} />
              )}
            </section>

            <aside className="min-w-0 space-y-4 lg:col-span-6">
              {/* Nova solicitação — apenas em Minhas Férias */}
              {isMyView && (
                <div className="min-w-0 rounded-lg border-2 border-blue-200 bg-white dark:border-blue-800/50 dark:bg-[#1a1d23]">
                  <div className="border-b border-[#e2e8f0] bg-blue-50/80 px-5 py-4 dark:border-[#252a35] dark:bg-blue-950/20">
                    <h3 className="text-xl font-bold text-[#1a1d23] dark:text-white">Nova Solicitação</h3>
                    <p className="mt-1 text-base font-medium text-[#475569] dark:text-slate-300">
                      Informe as datas de cada período de férias
                    </p>
                  </div>
                  <div className="min-w-0 p-5">
                    <NewRequestCardClient canRequest balance={balance} />
                  </div>
                </div>
              )}

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
  balance: VacationBalance;
  department?: string | null;
}) {
  const level = getRoleLevel(user.role);

  return (
    <aside className="flex w-full flex-col border-b border-[#e2e8f0] bg-white lg:w-72 lg:border-b-0 lg:border-r dark:border-[#252a35] dark:bg-[#141720]">
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[#e2e8f0] px-3 dark:border-[#252a35] sm:h-16 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="truncate text-base font-bold text-[#1a1d23] dark:text-white sm:text-lg">Editora Globo - Férias</span>
        </div>
      </div>

      {/* Navegação compacta no mobile */}
      <nav className="flex flex-wrap items-center gap-1.5 px-3 py-2 lg:hidden" aria-label="Menu principal">
        <DashboardSidebarItem
          href="/dashboard?view=minhas"
          icon={<IconCalendar />}
          label="Minhas Férias"
          active={activeView === "minhas"}
        />
        {level >= 2 && (
          <>
            <DashboardSidebarItem
              href="/dashboard?view=inbox"
              icon={<IconInbox />} 
              label="Caixa de Aprovação"
              active={activeView === "inbox"}
              badge={pendingCount > 0 ? pendingCount : undefined}
              badgeAlert
            />
            <DashboardSidebarItem
              href="/dashboard?view=historico"
              icon={<IconHistory />} 
              label="Histórico"
              active={activeView === "historico"}
            />
            <DashboardSidebarItem
              href="/dashboard?view=times"
              icon={<IconTeams />}
              label="Times"
              active={activeView === "times"}
            />
            {level >= 4 && (
              <DashboardSidebarItem
                href="/admin"
                icon={<IconSettings />}
                label="Backoffice"
              />
            )}
          </>
        )}
      </nav>

      {/* Navegação completa no desktop */}
      <nav className="hidden flex-1 flex-col gap-1 px-3 py-4 lg:flex">
        <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">Menu</p>
        <DashboardSidebarItem
          href="/dashboard?view=minhas"
          icon={<IconCalendar />}
          label="Minhas Férias"
          active={activeView === "minhas"}
        />
        {level >= 2 && (
          <>
            <DashboardSidebarItem
              href="/dashboard?view=inbox"
              icon={<IconInbox />} 
              label="Caixa de Aprovação"
              active={activeView === "inbox"}
              badge={pendingCount > 0 ? pendingCount : undefined}
              badgeAlert
            />
            <DashboardSidebarItem
              href="/dashboard?view=historico"
              icon={<IconHistory />} 
              label="Histórico"
              active={activeView === "historico"}
            />
            <DashboardSidebarItem
              href="/dashboard?view=times"
              icon={<IconTeams />}
              label="Times"
              active={activeView === "times"}
            />
            {level >= 4 && (
              <DashboardSidebarItem href="/admin" icon={<IconSettings />} label="Backoffice" />
            )}
          </>
        )}

        <div className="my-2 border-t border-[#e2e8f0] dark:border-[#252a35]" />
        <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-[#64748b] dark:text-slate-400">Saldo de Férias</p>

        <SidebarBalance balance={balance} />
      </nav>

      {/* Usuário (em baixo) */}
      <div className="shrink-0 border-t border-[#e2e8f0] px-3 py-3 dark:border-[#252a35] sm:px-4 sm:py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-base font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="truncate text-base font-semibold text-[#1a1d23] dark:text-white">{user.name}</p>
            <p className="truncate text-sm text-[#64748b] dark:text-slate-400">{getRoleLabel(user.role)}</p>
          </div>
        </div>
        <form action="/api/logout" method="post" className="mt-3">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-base text-[#64748b] transition hover:bg-[#f5f6f8] hover:text-[#1a1d23] dark:hover:bg-[#1e2330] dark:hover:text-white"
          >
            <IconLogout />
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}

function SidebarBalance({ balance }: { balance: VacationBalance }) {
  const usedPct = balance.entitledDays > 0
    ? Math.min(100, Math.round((balance.usedDays / balance.entitledDays) * 100))
    : 0;
  const pendingPct = balance.entitledDays > 0
    ? Math.min(100 - usedPct, Math.round((balance.pendingDays / balance.entitledDays) * 100))
    : 0;

  if (!balance.hasEntitlement) {
    return (
      <div className="rounded-md bg-[#f5f6f8] px-3 py-3 dark:bg-[#1e2330]">
        <p className="text-center text-xl font-bold text-amber-500">{Math.max(0, 12 - balance.monthsWorked)} meses</p>
        <p className="mt-1 text-center text-sm text-[#64748b] dark:text-slate-400">para direito a férias</p>
        <p className="mt-1.5 text-center text-xs text-[#94a3b8]">{balance.monthsWorked} meses de empresa</p>
      </div>
    );
  }

  return (
    <div className="rounded-md bg-[#f5f6f8] px-3 py-3 dark:bg-[#1e2330]">
      <p className="text-center text-sm font-semibold text-[#64748b] dark:text-slate-400">{balance.entitledDays} dias/ciclo</p>
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

function TopBar() {
  return (
    <header className="flex h-14 sm:h-16 items-center justify-end border-b border-[#e2e8f0] bg-white px-4 sm:px-6 dark:border-[#252a35] dark:bg-[#141720]">
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
      <p className="text-sm font-medium uppercase tracking-wide text-[#64748b] dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${alert && value > 0 ? "text-red-500" : "text-[#1a1d23] dark:text-white"}`}>{value}</p>
      <p className="mt-1 text-sm text-[#64748b] dark:text-slate-500">{sublabel}</p>
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
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Períodos bloqueados pela empresa</p>
          {active.slice(0, 2).map((b: any, i) => (
            <p key={i} className="mt-1 text-sm text-amber-700 dark:text-amber-300">
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
        <h4 className="text-sm font-semibold text-[#1a1d23] dark:text-white">Períodos bloqueados</h4>
        <p className="mt-0.5 text-xs text-[#64748b] dark:text-slate-400">Datas em que a empresa não permite férias (ex.: fechamento, auditoria)</p>
      </div>
      <div className="divide-y divide-[#f1f5f9] dark:divide-[#252a35]">
        {active.map((b: any) => (
          <div key={b.id} className="px-4 py-3">
            <p className="text-sm font-medium text-[#1a1d23] dark:text-white">{b.reason}</p>
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
    PENDENTE: { color: "amber", label: "Pendente aprovação" },
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
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-semibold ${styles[color]}`}>
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

// ============================================================================
// VISÃO POR TIMES (COORDENADOR / GERENTE / RH)
// ============================================================================

function TimesView({
  userRole,
  userId,
  teamData,
}: {
  userRole: string;
  userId: string;
  teamData: Awaited<ReturnType<typeof getTeamMembersForTimes>> | null;
}) {
  const level = getRoleLevel(userRole);

  if (!teamData) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#e2e8f0] bg-white px-8 py-12 text-center dark:border-[#252a35] dark:bg-[#1a1d23]">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f6f8] dark:bg-[#252a35]">
          <IconTeams />
        </div>
        <p className="text-lg font-semibold text-[#1a1d23] dark:text-white">Carregando times...</p>
      </div>
    );
  }

  const totalMembers =
    teamData.kind === "coord"
      ? teamData.teams.reduce((s, t) => s + t.members.length, 0)
      : teamData.gerentes.reduce((s, g) => s + g.teams.reduce((s2, t) => s2 + t.members.length, 0), 0);

  if (totalMembers === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#e2e8f0] bg-white px-8 py-12 text-center dark:border-[#252a35] dark:bg-[#1a1d23]">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f6f8] dark:bg-[#252a35]">
          <IconTeams />
        </div>
        <p className="text-lg font-semibold text-[#1a1d23] dark:text-white">Nenhum colaborador no time</p>
        <p className="mt-2 max-w-md text-base text-[#64748b] dark:text-slate-400">
          {level === 2
            ? "Você ainda não tem reportes diretos. Colaboradores aparecerão aqui quando estiverem vinculados a você no Backoffice."
            : "Não há colaboradores nos times sob sua visão no momento."}
        </p>
      </div>
    );
  }

  // Coordenador, Gerente ou RH: lista com filtro e expandir/colapsar (client)
  return (
    <div className="space-y-6">
      {level === 2 && (
        <p className="text-sm text-[#64748b] dark:text-slate-400">
          Todos os colaboradores do seu time, com status de férias explícito. Use o filtro e expanda ou recolha cada time.
        </p>
      )}
      {level === 3 && (
        <p className="text-sm text-[#64748b] dark:text-slate-400">
          Férias dos times sob sua gestão, organizadas por coordenador(a). Filtre por nome ou status e expanda os times para ver os colaboradores.
        </p>
      )}
      {teamData.kind === "rh" && (
        <p className="text-sm text-[#64748b] dark:text-slate-400">
          Todos os times por gerente e coordenador(a). Filtre e expanda cada gerente ou time para facilitar a navegação.
        </p>
      )}
      <TimesViewClient
        teamData={teamData as any}
        userId={userId}
        userRole={userRole}
        level={level}
      />
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
  visibleCount,
  blackouts,
  filters,
}: {
  userRole: string;
  userId: string;
  requests: any[];
  visibleCount: number;
  blackouts: any[];
  filters: Filters;
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
            className="inline-flex items-center gap-2 rounded-md border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-medium text-[#1a1d23] hover:bg-[#f5f6f8] dark:border-[#252a35] dark:bg-[#1a1d23] dark:text-white dark:hover:bg-[#252a35]"
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
        <div className="space-y-4">
          {filteredRequests.map((r) => (
            <RequestCard key={r.id} request={r} userId={userId} userRole={userRole} />
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
            className="h-10 min-w-0 flex-1 rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-base text-[#1a1d23] placeholder:text-[#94a3b8] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white sm:min-w-[180px]"
          />
          <select
            name="status"
            defaultValue={filters.status}
            className="h-10 min-w-0 flex-1 rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-base text-[#1a1d23] focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white sm:flex-initial"
          >
            <option value="TODOS">Todos os status</option>
            <option value="PENDENTE">Pendente aprovação</option>
            <option value="APROVADO_COORDENADOR">Aprovado Coord.</option>
            <option value="APROVADO_GERENTE">Aprovado Gerente</option>
            <option value="APROVADO_RH">Aprovado RH</option>
            <option value="REPROVADO">Reprovado</option>
          </select>

          {userLevel >= 4 && managerOptions.length > 0 && (
            <select
              name="managerId"
              defaultValue={filters.managerId}
              className="h-10 min-w-0 flex-1 rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-base text-[#1a1d23] focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white sm:flex-initial"
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
              className="h-10 min-w-0 flex-1 rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-base text-[#1a1d23] focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white sm:flex-initial"
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
            <div className="min-w-0 flex-1 sm:min-w-[140px]">
              <label className="mb-1 block text-sm text-[#64748b] dark:text-slate-400">Início a partir de</label>
              <input type="date" name="from" defaultValue={filters.from}
                className="h-10 w-full rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-base focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white" />
            </div>
            <div className="min-w-0 flex-1 sm:min-w-[140px]">
              <label className="mb-1 block text-sm text-[#64748b] dark:text-slate-400">Fim até</label>
              <input type="date" name="to" defaultValue={filters.to}
                className="h-10 w-full rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 text-base focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white" />
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" size="sm" className="bg-blue-600 px-4 text-base font-medium text-white hover:bg-blue-700">
            Filtrar
          </Button>
        </div>
      </div>
    </form>
  );
}

function RequestsGroupedByManager({ requests, userId, userRole }: { requests: any[]; userId: string; userRole: string }) {
  const groups = groupByManager(requests);
  return (
    <div className="space-y-5">
      {Object.entries(groups).map(([managerName, groupReqs]) => (
        <section key={managerName} className="space-y-3">
          <div className="flex items-center gap-2 rounded-md bg-[#f5f6f8] px-4 py-2.5 dark:bg-[#1e2330]">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
              {managerName.charAt(0).toUpperCase()}
            </span>
            <h3 className="text-base font-semibold text-[#1a1d23] dark:text-white">
              Coordenador(a): {managerName}
            </h3>
            <span className="ml-auto text-sm text-[#64748b]">{(groupReqs as any[]).length} solicitação(ões)</span>
          </div>
          {(groupReqs as any[]).map((r: any) => (
            <RequestCard key={r.id} request={r} userId={userId} userRole={userRole} />
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
  userRole,
  isOwner = false,
}: {
  request: any;
  userId?: string;
  userRole?: string;
  isOwner?: boolean;
}) {
  const approverRole = userRole ?? request.user?.role ?? "FUNCIONARIO";
  const canApprove = userId
    ? canApproveRequest(
        approverRole,
        userId,
        { userId: request.userId, status: request.status, user: { role: request.user?.role ?? "FUNCIONARIO" } },
      )
    : false;
  
  // Simplified: if userId provided and it's not own request, allow actions
  const showActions = isOwner || (!!userId && request.userId !== userId);

  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white transition-shadow hover:shadow-sm dark:border-[#252a35] dark:bg-[#1a1d23]">
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <span className="text-lg font-bold leading-none text-blue-700 dark:text-blue-400">
                {new Date(request.startDate).getDate()}
              </span>
              <span className="text-[9px] uppercase text-blue-500 dark:text-blue-400">
                {new Date(request.startDate).toLocaleDateString("pt-BR", { month: "short" })}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              {!isOwner && request.user && (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-base font-semibold text-[#1a1d23] dark:text-white">{request.user.name}</p>
                  <RoleChip role={request.user.role} />
                </div>
              )}
              <p className="truncate text-base text-[#64748b] dark:text-slate-400">
                {formatDateRange(request.startDate, request.endDate)}
              </p>
              {request.user?.department && (
                <p className="truncate text-sm text-[#94a3b8]">{request.user.department}</p>
              )}
            </div>
          </div>
          <div className="w-full shrink-0 sm:w-auto">
            <StatusBadge status={request.status} />
          </div>
        </div>

        {/* Nota do solicitante */}
        {request.notes && (
          <div className="mt-3 rounded-md bg-[#f5f6f8] px-3 py-2 dark:bg-[#0f1117]">
            <p className="text-sm text-[#64748b] dark:text-slate-400">
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
      <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#64748b] dark:text-slate-400">Histórico</p>
      <div className="space-y-1.5">
        {history.map((h, idx) => (
          <div key={idx} className="flex items-start gap-2 text-sm text-[#475569] dark:text-slate-400">
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
    <div className="mt-4 flex flex-wrap gap-2 border-t border-[#e2e8f0] pt-4 dark:border-[#252a35] [&_button]:min-h-[44px] [&_a]:inline-flex [&_a]:min-h-[44px] [&_a]:items-center">
      {hasApprovePermission && (
        <>
          <ActionButtonForm
            action={`/api/vacation-requests/${request.id}/approve`}
            variant="outline"
            size="sm"
            label="Aprovar"
            loadingLabel="Aprovando..."
            className="border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
          />
          <ActionButtonForm
            action={`/api/vacation-requests/${request.id}/reject`}
            variant="outline"
            size="sm"
            label="Reprovar"
            loadingLabel="Reprovando..."
            className="border-red-200 bg-red-50 text-sm font-semibold text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
          />
        </>
      )}
      {isOwner && isPending && <EditPeriodForm request={request} />}
      <ActionButtonForm
        action={`/api/vacation-requests/${request.id}/delete`}
        variant="outline"
        size="sm"
        label={isPendingRH ? "Excluir solicitação (pend. Gerente)" : "Excluir solicitação"}
        loadingLabel="Excluindo..."
        className="ml-auto border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
      />
    </div>
  );
}

function EditPeriodForm({ request }: { request: any }) {
  return (
    <details className="w-full">
      <summary className="flex cursor-pointer items-center justify-between rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 py-2 text-sm font-semibold text-[#475569] hover:bg-[#e2e8f0] dark:border-[#252a35] dark:bg-[#1e2330] dark:text-slate-300">
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
            <label className="mb-1 block text-sm font-medium text-[#475569] dark:text-slate-400">Início</label>
            <input type="date" name="startDate" required defaultValue={new Date(request.startDate).toISOString().split("T")[0]}
              className="h-9 w-full rounded-md border border-[#e2e8f0] bg-white px-3 text-base focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#1a1d23] dark:text-white" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#475569] dark:text-slate-400">Término</label>
            <input type="date" name="endDate" required defaultValue={new Date(request.endDate).toISOString().split("T")[0]}
              className="h-9 w-full rounded-md border border-[#e2e8f0] bg-white px-3 text-base focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#1a1d23] dark:text-white" />
          </div>
        </div>
        <Button type="submit" size="sm" className="w-full bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700">
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
    <div className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#e2e8f0] bg-white px-8 py-12 text-center dark:border-[#252a35] dark:bg-[#1a1d23]">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f6f8] dark:bg-[#252a35]">
        <svg className="h-7 w-7 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <p className="text-xl font-semibold text-[#1a1d23] dark:text-white">Nenhuma solicitação</p>
      <p className="mt-2 max-w-md text-base leading-relaxed text-[#64748b] dark:text-slate-400">{message}</p>
    </div>
  );
}

function ExportButton({ href }: { href: string }) {
  return (
    <a href={href} className="inline-flex items-center gap-1.5 rounded-md border border-[#e2e8f0] bg-white px-3 py-1.5 text-sm font-semibold text-[#475569] transition hover:bg-[#f5f6f8] dark:border-[#252a35] dark:bg-[#1a1d23] dark:text-slate-300 dark:hover:bg-[#252a35]">
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

function IconCalendar() {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
}
function IconInbox() {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>;
}
function IconHistory() {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}
function IconTeams() {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
}
function IconSettings() {
  return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
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
  const params: Record<string, string> = {
    q: filters.query,
    status: filters.status || "TODOS",
    view: filters.view,
  };
  if (filters.managerId) params.managerId = filters.managerId;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.department) params.department = filters.department;
  return new URLSearchParams(params).toString();
}
