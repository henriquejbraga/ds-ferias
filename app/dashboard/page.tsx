import { redirect } from "next/navigation";
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
  // Sempre buscar as solicitações do próprio usuário, independente do papel.
  const myRequests = await prisma.vacationRequest.findMany({
    where: { userId },
    include: {
      history: {
        orderBy: { changedAt: "asc" },
      },
    },
    orderBy: { startDate: "asc" },
  });

  if (role === "COLABORADOR") {
    return { myRequests, managedRequests: [] };
  }

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
      // precisamos do id aqui para, no futuro, distinguir "meu time" de outras áreas
      user: { select: { id: true, name: true, email: true } },
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

  const qParam = params.q;
  const statusParam = params.status;

  const q =
    typeof qParam === "string"
      ? qParam
      : Array.isArray(qParam)
        ? qParam[0]
        : "";
  const statusFilter =
    typeof statusParam === "string"
      ? statusParam
      : Array.isArray(statusParam)
        ? statusParam[0]
        : "TODOS";

  const { myRequests, managedRequests } = await getData(
    user.id,
    user.role,
    q,
    statusFilter,
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header moderno e clean */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">Dashboard de Férias</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {user.name} • <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{user.role}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <form action="/api/logout" method="post">
              <Button 
                type="submit" 
                variant="outline" 
                size="sm"
                className="border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Sair
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Coluna principal - Lista de solicitações */}
          <section className="space-y-6 lg:col-span-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {user.role === "COLABORADOR" ? "Minhas Solicitações" : "Solicitações da Equipe"}
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {user.role === "COLABORADOR" 
                    ? "Acompanhe o status das suas férias" 
                    : "Gerencie as solicitações de férias"}
                </p>
              </div>
            </div>
            
            {user.role === "COLABORADOR" ? (
              <RequestsList requests={myRequests} isManager={false} />
            ) : (
              <ManagerView
                userRole={user.role}
                userId={user.id}
                requests={managedRequests}
                currentQuery={q}
                currentStatus={statusFilter}
              />
            )}
          </section>

          {/* Sidebar - Nova solicitação e info */}
          <aside className="space-y-6 lg:col-span-4">
            {/* Card de nova solicitação */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 dark:border-slate-800 dark:from-slate-800 dark:to-slate-800">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                  <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Nova Solicitação
                </h3>
              </div>
              <div className="p-6">
                <NewRequestCardClient />
              </div>
            </div>

            {/* Card informativo */}
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 dark:border-slate-700 dark:from-slate-800/50 dark:to-slate-800/50">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 dark:bg-blue-500/20">
                  <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {user.role === "COLABORADOR" ? "Como Funciona" : "Dicas"}
                </h3>
              </div>
              <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                {user.role === "COLABORADOR" ? (
                  <>
                    <p className="flex items-start gap-2">
                      <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-600 dark:text-blue-400">1</span>
                      <span>Suas solicitações passam por aprovação do gestor</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-600 dark:text-blue-400">2</span>
                      <span>Após aprovação do gestor, o RH faz a aprovação final</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-600 dark:text-blue-400">3</span>
                      <span>Você pode editar ou excluir solicitações pendentes</span>
                    </p>
                  </>
                ) : (
                  <>
                    <p className="flex items-start gap-2">
                      <span className="mt-0.5 text-blue-500">•</span>
                      <span>Priorize solicitações mais antigas</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="mt-0.5 text-blue-500">•</span>
                      <span>Verifique conflitos de datas na equipe</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="mt-0.5 text-blue-500">•</span>
                      <span>Histórico completo fica registrado</span>
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Estatísticas rápidas para gestores */}
            {user.role !== "COLABORADOR" && managedRequests.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {managedRequests.filter((r) =>
                      user.role === "GESTOR"
                        ? r.status === "PENDENTE"
                        : r.status === "APROVADO_GESTOR",
                    ).length}
                  </div>
                  <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">Pendentes</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {managedRequests.filter(r => r.status === "APROVADO_RH").length}
                  </div>
                  <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">Aprovadas</div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { bg: string; text: string; border: string; icon: string }> = {
    PENDENTE: { 
      bg: "bg-amber-50 dark:bg-amber-950/30", 
      text: "text-amber-700 dark:text-amber-400", 
      border: "border-amber-200 dark:border-amber-800",
      icon: "⏳"
    },
    APROVADO_GESTOR: { 
      bg: "bg-blue-50 dark:bg-blue-950/30", 
      text: "text-blue-700 dark:text-blue-400", 
      border: "border-blue-200 dark:border-blue-800",
      icon: "👍"
    },
    APROVADO_RH: { 
      bg: "bg-emerald-50 dark:bg-emerald-950/30", 
      text: "text-emerald-700 dark:text-emerald-400", 
      border: "border-emerald-200 dark:border-emerald-800",
      icon: "✅"
    },
    REPROVADO: { 
      bg: "bg-red-50 dark:bg-red-950/30", 
      text: "text-red-700 dark:text-red-400", 
      border: "border-red-200 dark:border-red-800",
      icon: "❌"
    },
  };

  const variant = variants[status] || variants.PENDENTE;
  const label = status.replace("_", " ");

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${variant.bg} ${variant.text} ${variant.border}`}>
      <span>{variant.icon}</span>
      <span>{label}</span>
    </span>
  );
}

function RequestsList({
  requests,
  isManager,
}: {
  requests: any[];
  isManager: boolean;
}) {
  if (!requests.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white/50 p-12 text-center dark:border-slate-700 dark:bg-slate-900/50">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
          <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-base font-medium text-slate-900 dark:text-white">Nenhuma solicitação</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Você ainda não criou nenhuma solicitação de férias
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((r) => (
        <div
          key={r.id}
          className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="p-6">
            {/* Header do card */}
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-bold text-white shadow-lg shadow-blue-500/30">
                  {new Date(r.startDate).getDate()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {new Date(r.startDate).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                    {new Date(r.startDate).toLocaleDateString("pt-BR")} → {new Date(r.endDate).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
              <StatusBadge status={r.status} />
            </div>

            {/* Histórico */}
            {Array.isArray(r.history) && r.history.length > 0 && (
              <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                  Histórico
                </p>
                <div className="space-y-1.5">
                  {r.history.map((h: any, idx: number) => {
                    const changedAt = new Date(h.changedAt).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <div key={idx} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <span className="text-slate-400">→</span>
                        <span className="font-medium">{changedAt}</span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {h.previousStatus} → {h.newStatus}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ações */}
            {r.status === "PENDENTE" && (
              <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
                <details className="w-full group/edit">
                  <summary className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Editar período
                    </span>
                    <svg className="h-4 w-4 transition-transform group-open/edit:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <form
                    action={`/api/vacation-requests/${r.id}/update`}
                    method="post"
                    className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                          Data de início
                        </label>
                        <input
                          type="date"
                          name="startDate"
                          required
                          defaultValue={new Date(r.startDate).toISOString().split('T')[0]}
                          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                          Data de término
                        </label>
                        <input
                          type="date"
                          name="endDate"
                          required
                          defaultValue={new Date(r.endDate).toISOString().split('T')[0]}
                          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      className="w-full bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                    >
                      Salvar alterações
                    </Button>
                  </form>
                </details>
                
                <ActionButtonForm
                  action={`/api/vacation-requests/${r.id}/delete`}
                  variant="outline"
                  size="sm"
                  label="Excluir solicitação"
                  loadingLabel="Excluindo..."
                  className="w-full border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ManagerView({
  userRole,
  userId,
  requests,
  currentQuery,
  currentStatus,
}: {
  userRole: string;
  userId: string;
  requests: any[];
  currentQuery: string;
  currentStatus: string;
}) {
  const isManager = userRole === "GESTOR" || userRole === "RH";

  if (!isManager) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white/50 p-12 text-center dark:border-slate-700 dark:bg-slate-900/50">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
          <svg className="h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-base font-medium text-slate-900 dark:text-white">Nenhuma solicitação</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Você ainda não criou nenhuma solicitação de férias
        </p>
      </div>
    );
  }

  const normalizedQuery = currentQuery.trim().toLowerCase();
  const normalizedStatus = currentStatus || "TODOS";

  const filteredRequests = requests.filter((r) => {
    // Gestor só vê o próprio time; RH vê tudo
    const inManagerTeam =
      userRole === "GESTOR" ? r.user?.managerId === userId : true;

    if (!inManagerTeam) return false;

    const matchesName = normalizedQuery
      ? r.user?.name?.toLowerCase().includes(normalizedQuery)
      : true;

    const matchesStatus =
      normalizedStatus === "TODOS" ? true : r.status === normalizedStatus;

    return matchesName && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Filtros - enviam q e status via query string */}
      <form
        className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        method="get"
      >
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <input
              type="search"
              name="q"
              placeholder="Buscar por colaborador..."
              defaultValue={currentQuery}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
            />
          </div>
          <select
            name="status"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            defaultValue={currentStatus || "TODOS"}
          >
            <option value="TODOS">Todos os status</option>
            <option value="PENDENTE">Pendentes</option>
            <option value="APROVADO_GESTOR">Aprovado pelo gestor</option>
            <option value="APROVADO_RH">Aprovado pelo RH</option>
            <option value="REPROVADO">Reprovado</option>
          </select>
          <Button
            type="submit"
            size="sm"
            className="px-4"
          >
            Filtrar
          </Button>
        </div>
      </form>

      {/* Lista de solicitações */}
      {filteredRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white/50 p-12 text-center dark:border-slate-700 dark:bg-slate-900/50">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-base font-medium text-slate-900 dark:text-white">Nenhuma solicitação encontrada</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Ajuste os filtros de busca para visualizar outras solicitações.
          </p>
        </div>
      ) : (
        filteredRequests.map((r) => (
          <div
            key={r.id}
            className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="p-6">
              {/* Header */}
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 font-bold text-white shadow-lg shadow-blue-500/30">
                    {r.user?.name?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-900 dark:text-white">
                      {r.user?.name ?? "Colaborador"}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                      {r.user?.email}
                    </p>
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </div>

              {/* Período */}
              <div className="mb-4 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="font-medium">
                  {new Date(r.startDate).toLocaleDateString("pt-BR")} → {new Date(r.endDate).toLocaleDateString("pt-BR")}
                </span>
              </div>

              {/* Histórico */}
              {Array.isArray(r.history) && r.history.length > 0 && (
                <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    Histórico
                  </p>
                  <div className="space-y-1.5">
                    {r.history.map((h: any, idx: number) => {
                      const changedAt = new Date(h.changedAt).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                      return (
                        <div key={idx} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                          <span className="text-slate-400">→</span>
                          <span className="font-medium">{changedAt}</span>
                          <span className="text-slate-500 dark:text-slate-400">
                            {h.previousStatus} → {h.newStatus}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Ações */}
              <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
                {/* Gestor aprova PENDENTE, RH aprova APROVADO_GESTOR */}
                {((userRole === "GESTOR" && r.status === "PENDENTE") ||
                  (userRole === "RH" && r.status === "APROVADO_GESTOR")) && (
                  <>
                    {/* Nunca aprovar/reprovar a própria solicitação */}
                    {r.user?.id !== userId && (
                      <>
                        <ActionButtonForm
                          action={`/api/vacation-requests/${r.id}/approve`}
                          variant="outline"
                          size="sm"
                          label="✅ Aprovar"
                          loadingLabel="Aprovando..."
                          className="flex-1 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                        />
                        <ActionButtonForm
                          action={`/api/vacation-requests/${r.id}/reject`}
                          variant="outline"
                          size="sm"
                          label="❌ Reprovar"
                          loadingLabel="Reprovando..."
                          className="flex-1 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
                        />
                      </>
                    )}
                  </>
                )}

                {/* Excluir disponível sempre para gestor/RH */}
                <ActionButtonForm
                  action={`/api/vacation-requests/${r.id}/delete`}
                  variant="outline"
                  size="sm"
                  label="🗑️ Excluir"
                  loadingLabel="Excluindo..."
                  className="border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                />
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}