import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { NewRequestCardClient } from "@/components/dashboard/new-request-card";
import { ActionButtonForm } from "@/components/action-button-form";
import { type VacationStatus } from "../../generated/prisma/enums";

async function getData(
  userId: string,
  role: string,
  q?: string,
  status?: string,
) {
  // Busca solicitações do próprio usuário (independente do role)
  const myRequests = await prisma.vacationRequest.findMany({
    where: { userId },
    include: {
      history: {
        orderBy: { changedAt: "asc" },
      },
    },
    orderBy: { startDate: "asc" },
  });

  // Se for colaborador, retorna apenas suas solicitações
  if (role === "COLABORADOR") {
    return { myRequests, managedRequests: [] };
  }

  // Para gestores e RH, busca solicitações gerenciadas
  const where: any = {};

  if (q) {
    where.user = {
      name: { contains: q, mode: "insensitive" },
    };
  }

  if (status && status !== "TODOS") {
    where.status = status as VacationStatus;
  }

  const managedRequests = await prisma.vacationRequest.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          managerId: true,
          manager: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      history: {
        orderBy: { changedAt: "asc" },
      },
    },
    orderBy: { startDate: "asc" },
  });

  return { myRequests, managedRequests };
}

type DashboardSearchParams = {
  [key: string]: string | string[] | undefined;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await searchParams;

  // Extrai e normaliza parâmetros da URL
  const q = normalizeParam(params.q);
  const statusFilter = normalizeParam(params.status, "TODOS");
  const view = normalizeParam(params.view, "inbox");
  const managerFilter = normalizeParam(params.managerId);
  const fromFilter = normalizeParam(params.from);
  const toFilter = normalizeParam(params.to);

  const { myRequests, managedRequests } = await getData(
    user.id,
    user.role,
    q,
    statusFilter,
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header fixo */}
      <Header user={user} />

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Área principal de conteúdo */}
          <section className="space-y-6 lg:col-span-8">
            <SectionHeader role={user.role} />
            
            {user.role === "COLABORADOR" ? (
              <MyRequestsList requests={myRequests} />
            ) : (
              <ManagerView
                userRole={user.role}
                userId={user.id}
                requests={managedRequests}
                filters={{
                  query: q,
                  status: statusFilter,
                  view,
                  managerId: managerFilter,
                  from: fromFilter,
                  to: toFilter,
                }}
              />
            )}
          </section>

          {/* Sidebar */}
          <Sidebar
            role={user.role}
            requestCount={managedRequests.length}
            pendingCount={managedRequests.filter(r => 
              user.role === "GESTOR" 
                ? r.status === "PENDENTE"
                : r.status === "APROVADO_GESTOR"
            ).length}
            approvedCount={managedRequests.filter(r => r.status === "APROVADO_RH").length}
          />
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// COMPONENTES DO HEADER
// ============================================================================

function Header({ user }: { user: any }) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Sistema de Férias
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-400">
              {user.name} • <RoleBadge role={user.role} />
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <form action="/api/logout" method="post">
            <Button 
              type="submit" 
              variant="outline" 
              size="default"
              className="border-slate-300 text-base hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Sair
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles = {
    COLABORADOR: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    GESTOR: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    RH: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  }[role] || "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400";

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold ${styles}`}>
      {role}
    </span>
  );
}

function SectionHeader({ role }: { role: string }) {
  return (
    <div>
      <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
        {role === "COLABORADOR" ? "Minhas Solicitações" : "Gestão de Férias"}
      </h2>
      <p className="mt-2 text-base text-slate-600 dark:text-slate-400">
        {role === "COLABORADOR"
          ? "Acompanhe e gerencie suas solicitações de férias"
          : role === "GESTOR"
            ? "Aprove solicitações da sua equipe"
            : "Gerencie férias de todos os colaboradores"}
      </p>
    </div>
  );
}

// ============================================================================
// SIDEBAR E COMPONENTES INFORMATIVOS
// ============================================================================

function Sidebar({ 
  role, 
  requestCount,
  pendingCount,
  approvedCount 
}: { 
  role: string;
  requestCount: number;
  pendingCount: number;
  approvedCount: number;
}) {
  return (
    <aside className="space-y-6 lg:col-span-4">
      {/* Card de nova solicitação */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-5 dark:border-slate-800 dark:from-slate-800 dark:to-slate-800">
          <h3 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
            <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Nova Solicitação
          </h3>
        </div>
        <div className="p-6">
          <NewRequestCardClient canRequest />
        </div>
      </div>

      {/* Card informativo */}
      <InfoCard role={role} />

      {/* Estatísticas para gestores/RH */}
      {role !== "COLABORADOR" && requestCount > 0 && (
        <StatsCards pendingCount={pendingCount} approvedCount={approvedCount} />
      )}
    </aside>
  );
}

function InfoCard({ role }: { role: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 dark:border-slate-700 dark:from-slate-800/50 dark:to-slate-800/50">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 dark:bg-blue-500/20">
          <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
          {role === "COLABORADOR" ? "Fluxo de Aprovação" : "Informações"}
        </h3>
      </div>
      <div className="space-y-3 text-base text-slate-700 dark:text-slate-300">
        {role === "COLABORADOR" ? (
          <>
            <InfoItem number="1" text="Solicitação passa pela aprovação do gestor" />
            <InfoItem number="2" text="Após o gestor, o RH faz a aprovação final" />
            <InfoItem number="3" text="Você pode editar solicitações pendentes" />
          </>
        ) : (
          <>
            <BulletItem text="Priorize solicitações mais antigas" />
            <BulletItem text="Verifique conflitos de datas na equipe" />
            <BulletItem text="Todo histórico fica registrado" />
          </>
        )}
      </div>
    </div>
  );
}

function InfoItem({ number, text }: { number: string; text: string }) {
  return (
    <p className="flex items-start gap-3">
      <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-600 dark:text-blue-400">
        {number}
      </span>
      <span>{text}</span>
    </p>
  );
}

function BulletItem({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2">
      <span className="mt-1 text-blue-500">•</span>
      <span>{text}</span>
    </p>
  );
}

function StatsCards({ pendingCount, approvedCount }: { pendingCount: number; approvedCount: number }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <StatCard value={pendingCount} label="Pendentes" />
      <StatCard value={approvedCount} label="Aprovadas" />
    </div>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-3xl font-bold text-slate-900 dark:text-white">{value}</div>
      <div className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-400">{label}</div>
    </div>
  );
}

// ============================================================================
// STATUS BADGES
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  if (status === "APROVADO_GESTOR") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="gestor-approved" text="Aprovado Gestor" icon="👍" />
        <Badge variant="pending-rh" text="Pendente RH" icon="⏳" />
      </div>
    );
  }

  const config = {
    PENDENTE: { variant: "pending" as const, text: "Pendente", icon: "⏳" },
    APROVADO_RH: { variant: "approved" as const, text: "Aprovado RH", icon: "✅" },
    REPROVADO: { variant: "rejected" as const, text: "Reprovado", icon: "❌" },
  }[status] || { variant: "pending" as const, text: status.replace("_", " "), icon: "⏳" };

  return <Badge {...config} />;
}

function Badge({ 
  variant, 
  text, 
  icon 
}: { 
  variant: "pending" | "gestor-approved" | "approved" | "rejected" | "pending-rh";
  text: string;
  icon: string;
}) {
  const styles = {
    pending: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
    "gestor-approved": "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
    rejected: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800",
    "pending-rh": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  }[variant];

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-bold ${styles}`}>
      <span className="text-base">{icon}</span>
      <span>{text}</span>
    </span>
  );
}

// ============================================================================
// LISTA DE SOLICITAÇÕES DO COLABORADOR
// ============================================================================

function MyRequestsList({ requests }: { requests: any[] }) {
  if (!requests.length) {
    return <EmptyState message="Você ainda não criou nenhuma solicitação de férias" />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          Histórico de solicitações
        </h3>
        <ExportButton href="/api/vacation-requests/export" />
      </div>

      {requests.map((request) => (
        <RequestCard key={request.id} request={request} isOwner />
      ))}
    </div>
  );
}

// ============================================================================
// VISÃO DO GESTOR/RH
// ============================================================================

type Filters = {
  query: string;
  status: string;
  view: string;
  managerId: string;
  from: string;
  to: string;
};

function ManagerView({
  userRole,
  userId,
  requests,
  filters,
}: {
  userRole: string;
  userId: string;
  requests: any[];
  filters: Filters;
}) {
  const view = filters.view === "historico" ? "historico" : "inbox";
  
  // Opções de gestores para filtro
  const managerOptions = getManagerOptions(userRole, requests);
  
  // Filtra requests
  const filteredRequests = filterRequests(userRole, userId, requests, filters);

  return (
    <div className="space-y-5">
      {/* Navegação Inbox/Histórico */}
      <ViewToggle view={view} />

      {/* Filtros */}
      <FilterForm 
        userRole={userRole} 
        filters={filters}
        managerOptions={managerOptions}
        view={view}
      />

      {/* Botão de exportação */}
      <div className="flex justify-end">
        <ExportButton 
          href={`/api/vacation-requests/export?${buildExportQuery(filters)}`}
        />
      </div>

      {/* Lista de solicitações */}
      {filteredRequests.length === 0 ? (
        <EmptyState message="Nenhuma solicitação encontrada com os filtros aplicados" />
      ) : userRole === "RH" ? (
        <RequestsGroupedByManager requests={filteredRequests} userId={userId} />
      ) : (
        <div className="space-y-5">
          {filteredRequests.map((request) => (
            <RequestCard key={request.id} request={request} userId={userId} />
          ))}
        </div>
      )}
    </div>
  );
}

function ViewToggle({ view }: { view: string }) {
  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1.5 text-sm font-bold dark:border-slate-700 dark:bg-slate-900">
        <Link
          href="/dashboard?view=inbox"
          className={`rounded-lg px-5 py-2.5 transition ${
            view === "inbox"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          📥 Caixa de Aprovação
        </Link>
        <Link
          href="/dashboard?view=historico"
          className={`rounded-lg px-5 py-2.5 transition ${
            view === "historico"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          📋 Histórico
        </Link>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {view === "inbox"
          ? "📌 Solicitações que precisam da sua aprovação agora"
          : "📚 Histórico completo de solicitações processadas"}
      </p>
    </div>
  );
}

function FilterForm({ 
  userRole, 
  filters,
  managerOptions,
  view 
}: { 
  userRole: string;
  filters: Filters;
  managerOptions: Array<{ id: string; name: string }>;
  view: string;
}) {
  return (
    <form method="get" className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <input type="hidden" name="view" value={view} />
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <input
            type="search"
            name="q"
            placeholder="🔍 Buscar colaborador..."
            defaultValue={filters.query}
            className="h-12 min-w-[200px] flex-1 rounded-lg border border-slate-300 bg-white px-4 text-base placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />
          <select
            name="status"
            defaultValue={filters.status}
            className="h-12 rounded-lg border border-slate-300 bg-white px-4 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          >
            <option value="TODOS">Todos os status</option>
            <option value="PENDENTE">⏳ Pendentes</option>
            <option value="APROVADO_GESTOR">👍 Aprovado Gestor</option>
            <option value="APROVADO_RH">✅ Aprovado RH</option>
            <option value="REPROVADO">❌ Reprovado</option>
          </select>

          {userRole === "RH" && managerOptions.length > 0 && (
            <select
              name="managerId"
              defaultValue={filters.managerId}
              className="h-12 rounded-lg border border-slate-300 bg-white px-4 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              <option value="ALL">Todos os gestores</option>
              {managerOptions.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}
        </div>

        {userRole === "RH" && (
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Início a partir de
              </label>
              <input
                type="date"
                name="from"
                defaultValue={filters.from}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Fim até
              </label>
              <input
                type="date"
                name="to"
                defaultValue={filters.to}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" size="lg" className="px-6 text-base font-semibold">
            Aplicar Filtros
          </Button>
        </div>
      </div>
    </form>
  );
}

function RequestsGroupedByManager({ requests, userId }: { requests: any[]; userId: string }) {
  const groups = groupByManager(requests);

  return (
    <div className="space-y-6">
      {Object.entries(groups).map(([managerName, groupRequests]) => (
        <section key={managerName} className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-blue-50 px-4 py-3 dark:bg-blue-950/30">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-base font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              {managerName.charAt(0).toUpperCase()}
            </span>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Gestor: {managerName}
            </h3>
          </div>
          {groupRequests.map((request: any) => (
            <RequestCard key={request.id} request={request} userId={userId} />
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
  isOwner = false 
}: { 
  request: any;
  userId?: string;
  isOwner?: boolean;
}) {
  const canApprove = !!userId && request.user?.id !== userId;
  const showActions = isOwner || canApprove;

  return (
    <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
      <div className="p-7">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <DateBadge date={new Date(request.startDate)} />
            <div>
              {!isOwner && (
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {request.user?.name ?? "Colaborador"}
                </p>
              )}
              <p className="text-base text-slate-600 dark:text-slate-400">
                {formatDateRange(request.startDate, request.endDate)}
              </p>
            </div>
          </div>
          <StatusBadge status={request.status} />
        </div>

        {/* Histórico */}
        {request.history?.length > 0 && <HistorySection history={request.history} />}

        {/* Ações */}
        {showActions && <RequestActions request={request} isOwner={isOwner} canApprove={canApprove} />}
      </div>
    </div>
  );
}

function DateBadge({ date }: { date: Date }) {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-2xl font-bold text-white shadow-lg shadow-blue-500/30">
      {date.getDate()}
    </div>
  );
}

function HistorySection({ history }: { history: any[] }) {
  return (
    <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
      <p className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
        Histórico de Mudanças
      </p>
      <div className="space-y-2">
        {history.map((h, idx) => (
          <div key={idx} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
            <span className="text-lg text-slate-400">→</span>
            <span className="font-semibold">
              {new Date(h.changedAt).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span className="text-slate-600 dark:text-slate-400">
              {h.previousStatus} → {h.newStatus}
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
  canApprove 
}: { 
  request: any;
  isOwner: boolean;
  canApprove?: boolean;
}) {
  const isPending = request.status === "PENDENTE";
  const isPendingRH = request.status === "APROVADO_GESTOR";

  return (
    <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-5 dark:border-slate-700">
      {canApprove && (
        <>
          <ActionButtonForm
            action={`/api/vacation-requests/${request.id}/approve`}
            variant="outline"
            size="lg"
            label="✅ Aprovar"
            loadingLabel="Aprovando..."
            className="flex-1 border-emerald-200 bg-emerald-50 text-base font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
          />
          <ActionButtonForm
            action={`/api/vacation-requests/${request.id}/reject`}
            variant="outline"
            size="lg"
            label="❌ Reprovar"
            loadingLabel="Reprovando..."
            className="flex-1 border-red-200 bg-red-50 text-base font-semibold text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
          />
        </>
      )}

      {isOwner && isPending && <EditPeriodForm request={request} />}

      <ActionButtonForm
        action={`/api/vacation-requests/${request.id}/delete`}
        variant="outline"
        size="lg"
        label={isPendingRH ? "🗑️ Excluir (pendente RH)" : "🗑️ Excluir"}
        loadingLabel="Excluindo..."
        className="border-red-200 text-base font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
      />
    </div>
  );
}

function EditPeriodForm({ request }: { request: any }) {
  return (
    <details className="w-full group/edit">
      <summary className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-5 py-3 text-base font-semibold transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        <span className="flex items-center gap-2">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Editar período
        </span>
        <svg className="h-5 w-5 transition-transform group-open/edit:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <form
        action={`/api/vacation-requests/${request.id}/update`}
        method="post"
        className="mt-4 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
              Data de início
            </label>
            <input
              type="date"
              name="startDate"
              required
              defaultValue={new Date(request.startDate).toISOString().split('T')[0]}
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
              Data de término
            </label>
            <input
              type="date"
              name="endDate"
              required
              defaultValue={new Date(request.endDate).toISOString().split('T')[0]}
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </div>
        </div>
        <Button type="submit" size="lg" className="w-full">
          Salvar alterações
        </Button>
      </form>
    </details>
  );
}

// ============================================================================
// COMPONENTES AUXILIARES
// ============================================================================

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white/50 p-16 text-center dark:border-slate-700 dark:bg-slate-900/50">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <svg className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <p className="text-xl font-bold text-slate-900 dark:text-white">Nenhuma solicitação</p>
      <p className="mt-2 text-base text-slate-600 dark:text-slate-400">{message}</p>
    </div>
  );
}

function ExportButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
      </svg>
      Exportar CSV
    </a>
  );
}

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================

function normalizeParam(
  param: string | string[] | undefined,
  defaultValue: string = ""
): string {
  if (typeof param === "string") return param;
  if (Array.isArray(param)) return param[0] || defaultValue;
  return defaultValue;
}

function formatDateRange(start: Date, end: Date): string {
  return `${new Date(start).toLocaleDateString("pt-BR")} → ${new Date(end).toLocaleDateString("pt-BR")}`;
}

function getManagerOptions(userRole: string, requests: any[]) {
  if (userRole !== "RH") return [];
  
  return Array.from(
    new Map(
      requests
        .filter(r => r.user?.manager?.id && r.user.manager.name)
        .map(r => [r.user.manager.id, r.user.manager.name])
    ).entries()
  ).map(([id, name]) => ({ id, name }));
}

function filterRequests(
  userRole: string,
  userId: string,
  requests: any[],
  filters: Filters
): any[] {
  return requests.filter(r => {
    // Gestor vê apenas sua equipe + próprias solicitações
    const inTeam = userRole === "GESTOR" 
      ? r.user?.managerId === userId || r.user?.id === userId
      : true;
    
    if (!inTeam) return false;

    // Filtro de gestor (RH)
    if (userRole === "RH" && filters.managerId && filters.managerId !== "ALL") {
      if (r.user?.manager?.id !== filters.managerId) return false;
    }

    // Filtro de período
    if (filters.from && r.startDate < new Date(filters.from)) return false;
    if (filters.to && r.endDate > new Date(filters.to)) return false;

    // Filtro de view
    if (filters.view === "inbox") {
      if (userRole === "GESTOR" && r.status !== "PENDENTE") return false;
      if (userRole === "RH" && r.status !== "APROVADO_GESTOR") return false;
    } else if (filters.view === "historico") {
      const allowed = userRole === "GESTOR"
        ? ["APROVADO_GESTOR", "APROVADO_RH", "REPROVADO"]
        : ["APROVADO_RH", "REPROVADO"];
      if (!allowed.includes(r.status)) return false;
    }

    // Filtro de nome
    if (filters.query && !r.user?.name?.toLowerCase().includes(filters.query.toLowerCase())) {
      return false;
    }

    // Filtro de status
    if (filters.status !== "TODOS" && r.status !== filters.status) {
      return false;
    }

    return true;
  });
}

function groupByManager(requests: any[]) {
  return requests.reduce((groups: Record<string, any[]>, r) => {
    const managerName = r.user?.manager?.name || "Sem gestor definido";
    if (!groups[managerName]) groups[managerName] = [];
    groups[managerName].push(r);
    return groups;
  }, {});
}

function buildExportQuery(filters: Filters): string {
  return new URLSearchParams({
    q: filters.query,
    status: filters.status || "TODOS",
    view: filters.view,
  }).toString();
}