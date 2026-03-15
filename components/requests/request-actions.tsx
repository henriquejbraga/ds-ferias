import { Button } from "@/components/ui/button";
import { ActionButtonForm } from "@/components/action-button-form";

type RequestLike = { id: string; status: string; startDate: Date | string; endDate: Date | string };

export function RequestActions({
  request,
  isOwner,
  hasApprovePermission = false,
}: {
  request: RequestLike;
  isOwner: boolean;
  hasApprovePermission?: boolean;
}) {
  const isPending = request.status === "PENDENTE";
  const isPendingRH =
    request.status === "APROVADO_COORDENADOR" || request.status === "APROVADO_GESTOR";

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

function EditPeriodForm({ request }: { request: RequestLike }) {
  const startDefault = new Date(request.startDate).toISOString().split("T")[0];
  const endDefault = new Date(request.endDate).toISOString().split("T")[0];

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
      <form
        action={`/api/vacation-requests/${request.id}/update`}
        method="post"
        className="mt-3 space-y-3 rounded-md border border-[#e2e8f0] bg-[#f5f6f8] p-4 dark:border-[#252a35] dark:bg-[#0f1117]"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#475569] dark:text-slate-400">Início</label>
            <input
              type="date"
              name="startDate"
              required
              defaultValue={startDefault}
              className="h-9 w-full rounded-md border border-[#e2e8f0] bg-white px-3 text-base focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#1a1d23] dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#475569] dark:text-slate-400">Término</label>
            <input
              type="date"
              name="endDate"
              required
              defaultValue={endDefault}
              className="h-9 w-full rounded-md border border-[#e2e8f0] bg-white px-3 text-base focus:border-blue-500 focus:outline-none dark:border-[#252a35] dark:bg-[#1a1d23] dark:text-white"
            />
          </div>
        </div>
        <Button type="submit" size="sm" className="w-full bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700">
          Salvar
        </Button>
      </form>
    </details>
  );
}
