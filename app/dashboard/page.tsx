import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { NewRequestCardClient } from "@/components/dashboard/new-request-card";
import { ActionButtonForm } from "@/components/action-button-form";

async function getData(userId: string, role: string) {
  if (role === "COLABORADOR") {
    const myRequests = await prisma.vacationRequest.findMany({
      where: { userId },
      include: {
        history: {
          orderBy: { changedAt: "asc" },
        },
      },
      orderBy: { startDate: "desc" },
    });
    return { myRequests, managedRequests: [] };
  }

  const managedRequests = await prisma.vacationRequest.findMany({
    include: {
      user: { select: { name: true, email: true } },
      history: {
        orderBy: { changedAt: "asc" },
      },
    },
    orderBy: { startDate: "desc" },
  });

  return { myRequests: [], managedRequests };
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { myRequests, managedRequests } = await getData(user.id, user.role);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#021326] via-[#03234a] to-[#005ca9] text-foreground">
      <header className="border-b border-white/10 bg-gradient-to-r from-[#021c3a]/95 via-[#03234a]/95 to-[#005ca9]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 text-primary-foreground">
          <div>
            <h1 className="text-xl font-semibold">Dashboard de Férias</h1>
            <p className="text-xs text-sky-100/80">
              Logado como {user.name} ({user.role})
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action="/api/logout" method="post">
              <Button type="submit" variant="outline" size="sm">
                Sair
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-1">
          <h2 className="text-sm font-semibold text-primary-foreground">
            Nova solicitação
          </h2>
          <NewRequestCardClient canRequest={user.role === "COLABORADOR"} />

          {user.role === "COLABORADOR" && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-primary-foreground">
                Minhas solicitações
              </h2>
              <RequestsList requests={myRequests} isManager={false} />
            </section>
          )}
        </section>

        <section className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-primary-foreground">
              Visão geral
            </h2>
          </div>
          <ManagerView
            userRole={user.role}
            requests={managedRequests}
          />
        </section>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDENTE: "bg-amber-500/10 text-amber-400 border-amber-500/40",
    APROVADO_GESTOR: "bg-sky-500/10 text-sky-400 border-sky-500/40",
    APROVADO_RH: "bg-emerald-500/10 text-emerald-400 border-emerald-500/40",
    REPROVADO: "bg-red-500/10 text-red-400 border-red-500/40",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${map[status] ?? ""}`}
    >
      {status.replace("_", " ")}
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
      <p className="rounded-xl border border-dashed border-white/10 bg-card/80 p-4 text-sm text-muted-foreground">
        Nenhuma solicitação registrada.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {requests.map((r) => (
        <div
          key={r.id}
          className="flex flex-col gap-2 rounded-xl border border-white/10 bg-card/90 p-3 text-xs sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="space-y-1">
            <p className="font-medium text-foreground">
              {isManager ? r.user?.name ?? "Colaborador" : "Período solicitado"}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(r.startDate).toLocaleDateString("pt-BR")} {" → "}
              {new Date(r.endDate).toLocaleDateString("pt-BR")}
            </p>
            {Array.isArray(r.history) && r.history.length > 0 && (
              <p className="text-xs text-muted-foreground/80">
                Histórico:{" "}
                {r.history
                  .map(
                    (h: any) =>
                      `${new Date(h.changedAt).toLocaleDateString("pt-BR")} (${h.previousStatus} → ${h.newStatus})`,
                  )
                  .join(" • ")}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <StatusBadge status={r.status} />
            {!isManager && r.status === "PENDENTE" && (
              <details className="mt-1 w-full rounded-lg bg-background/40 p-2 text-xs shadow-sm">
                <summary className="flex cursor-pointer items-center justify-between gap-2 text-primary">
                  <span className="font-medium">Editar período</span>
                  <span className="text-[11px] text-muted-foreground">
                    Clique para ajustar datas
                  </span>
                </summary>
                <form
                  action={`/api/vacation-requests/${r.id}/update`}
                  method="post"
                  className="mt-3 flex flex-col gap-2"
                >
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="flex-1 space-y-1">
                      <span className="block text-[11px] text-muted-foreground">
                        Início
                      </span>
                      <input
                        type="date"
                        name="startDate"
                        required
                        className="h-9 w-full rounded border border-input bg-background px-2 text-xs text-foreground outline-none ring-0 focus:border-primary focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <span className="block text-[11px] text-muted-foreground">
                        Término
                      </span>
                      <input
                        type="date"
                        name="endDate"
                        required
                        className="h-9 w-full rounded border border-input bg-background px-2 text-xs text-foreground outline-none ring-0 focus:border-primary focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    size="xs"
                    className="self-end border-primary/40 text-primary hover:bg-primary/10"
                  >
                    Salvar alterações
                  </Button>
                </form>
              </details>
            )}
            {!isManager && r.status === "PENDENTE" && (
              <div className="mt-1">
                <ActionButtonForm
                  action={`/api/vacation-requests/${r.id}/delete`}
                  variant="destructive"
                  size="xs"
                  label="Excluir solicitação"
                  loadingLabel="Excluindo..."
                  className="border-destructive/40 bg-destructive/10 text-[11px]"
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
  requests,
}: {
  userRole: string;
  requests: any[];
}) {
  const isManager = userRole === "GESTOR" || userRole === "RH";

  if (!isManager) {
    return (
      <p className="rounded-2xl border border-white/10 bg-card/90 p-4 text-sm text-muted-foreground">
        Aqui você verá, como colaborador, o status das suas férias assim que
        forem aprovadas pelo gestor e RH.
      </p>
    );
  }

  if (!requests.length) {
    return (
      <p className="rounded-2xl border border-dashed border-white/10 bg-card/80 p-4 text-sm text-muted-foreground">
        Nenhuma solicitação para aprovação no momento.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <input
          type="search"
          placeholder="Buscar por colaborador..."
          className="h-9 flex-1 rounded-lg border border-input bg-background/80 px-3 text-xs text-foreground outline-none ring-0 transition focus:border-primary focus:ring-2 focus:ring-primary/40"
        />
        <select
          className="h-9 rounded-lg border border-input bg-background/80 px-2 text-xs text-foreground outline-none ring-0 focus:border-primary focus:ring-2 focus:ring-primary/40"
          defaultValue="TODOS"
        >
          <option value="TODOS">Todos status</option>
          <option value="PENDENTE">Pendentes</option>
          <option value="APROVADO_GESTOR">Aprovado gestor</option>
          <option value="APROVADO_RH">Aprovado RH</option>
          <option value="REPROVADO">Reprovado</option>
        </select>
      </div>

      <div className="space-y-2">
        {requests.map((r) => (
          <div
            key={r.id}
            className="space-y-2 rounded-2xl border border-white/10 bg-card/90 p-3 text-xs"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-100">
                  {r.user?.name ?? "Colaborador"}
                </p>
                <p className="text-[11px] text-zinc-400">
                  {r.user?.email}
                </p>
              </div>
              <StatusBadge status={r.status} />
            </div>

            <p className="text-xs text-muted-foreground">
              {new Date(r.startDate).toLocaleDateString("pt-BR")} {" → "} 
              {new Date(r.endDate).toLocaleDateString("pt-BR")}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <ActionButtonForm
                action={`/api/vacation-requests/${r.id}/approve`}
                variant="outline"
                size="xs"
                label="Aprovar"
                loadingLabel="Aprovando..."
                className="border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
              />
              <ActionButtonForm
                action={`/api/vacation-requests/${r.id}/reject`}
                variant="outline"
                size="xs"
                label="Reprovar"
                loadingLabel="Reprovando..."
                className="border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20"
              />
              {r.status === "PENDENTE" && (
                <ActionButtonForm
                  action={`/api/vacation-requests/${r.id}/delete`}
                  variant="destructive"
                  size="xs"
                  label="Excluir"
                  loadingLabel="Excluindo..."
                  className="border-destructive/60 bg-destructive/10 text-destructive hover:bg-destructive/20"
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

