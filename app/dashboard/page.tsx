import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getRoleLabel, getRoleLevel } from "@/lib/vacationRules";
import { normalizeParam } from "@/lib/utils";
import {
  getDashboardData,
  getCurrentUserBalanceLight,
  getCurrentUserDepartment,
  getMyVacationSidebarContext,
  getVisibleRequests,
  getPendingCount,
} from "@/services/dashboardDataService";
import { getTeamMembersForTimes } from "@/services/teamMembersService";
import { NewRequestCardClient } from "@/components/dashboard/new-request-card";
import { DashboardSidebarItem } from "@/components/dashboard-sidebar-item";
import { AppSidebar } from "@/components/dashboard/sidebar";
import { TopBar } from "@/components/dashboard/top-bar";
import { StatCard } from "@/components/dashboard/stat-card";
import { BlackoutAlert } from "@/components/dashboard/blackout-alert";
import { BlackoutListCard } from "@/components/dashboard/blackout-list-card";
import { TimesView } from "@/components/dashboard/times-view";
import { ManagerView } from "@/components/requests/manager-view";
import { MyRequestsList } from "@/components/requests/my-requests-list";
import { DashboardBreadcrumb } from "@/components/dashboard/breadcrumb";
import type { DashboardFilters } from "@/types/dashboard";

type DashboardSearchParams = { [key: string]: string | string[] | undefined };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
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

  const isMyView = !isApprover || view === "minhas";
  const isTimesView = isApprover && view === "times";

  /** Inbox/histórico precisam de cards com histórico; minhas/times só de metadados para badge ou não usam. */
  const needsFullManagedInclude = isApprover && (view === "inbox" || view === "historico");
  const skipMyRequests = isApprover && view !== "minhas";
  const leanManaged = isApprover && !needsFullManagedInclude;

  const [{ myRequests, managedRequests, blackouts }, sidebarCtx, teamData] = await Promise.all([
    getDashboardData(
      { userId: user.id, role: user.role, query: q, status: statusFilter },
      { leanManaged, skipMyRequests },
    ),
    isMyView
      ? getMyVacationSidebarContext(user.id)
      : Promise.all([getCurrentUserBalanceLight(user.id), getCurrentUserDepartment(user.id)]).then(
          ([balance, department]) => ({
            balance,
            acquisitionPeriods: [],
            firstEntitlementDate: null,
            department,
          }),
        ),
    isTimesView ? getTeamMembersForTimes(user.id, user.role) : Promise.resolve(null),
  ]);

  const { balance, acquisitionPeriods, firstEntitlementDate, department: userDept } = sidebarCtx;

  const visibleRequests = getVisibleRequests(user.role, user.id, managedRequests);
  const pendingCount = getPendingCount(userRoleLevel, visibleRequests);

  const filters: DashboardFilters = {
    query: q,
    status: statusFilter,
    view,
    managerId: managerFilter,
    from: fromFilter,
    to: toFilter,
    department: deptFilter,
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f6f8] dark:bg-[#0f1117] lg:flex-row">
      <AppSidebar
        user={user}
        activeView={isTimesView ? "times" : isMyView ? "minhas" : view}
        pendingCount={pendingCount}
        balance={balance}
        department={userDept}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />

        <main
          id="main"
          className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8"
          tabIndex={-1}
        >
          <div className="mb-6 lg:mb-7">
            <DashboardBreadcrumb currentView={isTimesView ? "times" : isMyView ? "minhas" : view} />
            <h1 className="text-2xl font-bold text-[#1a1d23] dark:text-white lg:text-3xl">
              {isTimesView ? "Times" : isMyView ? "Minhas Férias" : "Gestão de Férias"}
            </h1>
            <p className="mt-1 text-base text-[#64748b] dark:text-slate-400 lg:text-lg">
              Bem-vindo(a), {user.name} · {getRoleLabel(user.role)}
              {userDept && (
                <span className="ml-2 rounded-full bg-[#eff6ff] px-2 py-0.5 text-sm font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                  {userDept}
                </span>
              )}
            </p>
          </div>

          {!isMyView && isApprover && !isTimesView && (
            <div className="mb-6 flex">
              <div className="w-full max-w-sm">
                <StatCard
                  label="Pendentes"
                  value={pendingCount}
                  sublabel="Aguardando você"
                  alert={pendingCount > 0}
                />
              </div>
            </div>
          )}

          {blackouts.filter((b) => new Date(b.endDate) >= new Date()).length > 0 && !isApprover && (
            <BlackoutAlert blackouts={blackouts} />
          )}

          <div className="grid gap-6 lg:grid-cols-12">
            <section
              className={
                isMyView
                  ? "min-w-0 lg:col-span-5 xl:col-span-6"
                  : "min-w-0 lg:col-span-10 xl:col-span-11"
              }
            >
              {isTimesView ? (
                <TimesView userRole={user.role} userId={user.id} teamData={teamData} />
              ) : isApprover && (view === "inbox" || view === "historico") ? (
                <ManagerView
                  userRole={user.role}
                  userId={user.id}
                  requests={managedRequests}
                  visibleCount={visibleRequests.length}
                  blackouts={blackouts}
                  filters={filters}
                />
              ) : (
                <MyRequestsList
                  requests={myRequests}
                  balance={balance}
                  acquisitionPeriods={acquisitionPeriods as any}
                  firstEntitlementDate={firstEntitlementDate}
                />
              )}
            </section>

            <aside
              className={
                isMyView
                  ? "min-w-0 space-y-4 lg:col-span-7 xl:col-span-6"
                  : "min-w-0 space-y-4 lg:col-span-2 xl:col-span-1"
              }
            >
              {isMyView && (
                <div className="min-w-0 rounded-lg border-2 border-blue-200 bg-white dark:border-blue-800/50 dark:bg-[#1a1d23]">
                  <div className="border-b border-[#e2e8f0] bg-blue-50/80 px-5 py-4 dark:border-[#252a35] dark:bg-blue-950/20">
                    <h3 className="text-xl font-bold text-[#1a1d23] dark:text-white">Nova Solicitação</h3>
                    <p className="mt-1 text-base font-medium text-[#475569] dark:text-slate-300">
                      Informe as datas de cada período de férias
                    </p>
                  </div>
                  <div className="min-w-0 p-5">
                    <NewRequestCardClient
                      canRequest
                      balance={balance}
                      userRole={user.role}
                      firstEntitlementDate={firstEntitlementDate}
                    />
                  </div>
                </div>
              )}

              {isApprover && blackouts.length > 0 && <BlackoutListCard blackouts={blackouts} />}
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
