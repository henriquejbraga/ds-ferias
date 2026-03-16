import { ActionButtonForm } from "@/components/action-button-form";
import { EditPeriodFormClient } from "@/components/requests/edit-period-form";

type RequestLike = {
  id: string;
  status: string;
  startDate: Date | string;
  endDate: Date | string;
  abono?: boolean;
  thirteenth?: boolean;
};

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

  const deleteLabel = isOwner
    ? "Cancelar solicitação"
    : isPendingRH
      ? "Excluir solicitação (pend. Gerente)"
      : "Excluir solicitação";

  const deleteSuccessMessage = isOwner ? "Solicitação cancelada." : "Solicitação excluída.";

  return (
    <div className="mt-4 space-y-2 border-t border-[#e2e8f0] pt-4 dark:border-[#252a35]">
      {hasApprovePermission && (request.abono || request.thirteenth) && (
        <p className="text-xs text-[#0f172a] dark:text-slate-200">
          Esta solicitação inclui{" "}
          {request.abono && request.thirteenth
            ? "pedido de conversão de 1/3 das férias em abono e pedido de adiantamento de 13º salário"
            : request.abono
              ? "pedido de conversão de 1/3 das férias em abono"
              : "pedido de adiantamento de 13º salário"}
          . A decisão financeira final é de responsabilidade do RH.
        </p>
      )}
      <div className="flex flex-wrap gap-2 [&_button]:min-h-[44px] [&_a]:inline-flex [&_a]:min-h-[44px] [&_a]:items-center">
        {hasApprovePermission && (
          <>
            <ActionButtonForm
              action={`/api/vacation-requests/${request.id}/approve`}
              variant="outline"
              size="sm"
              label="Aprovar"
              loadingLabel="Aprovando..."
              successMessage="Solicitação aprovada."
              className="border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
            />
            <ActionButtonForm
              action={`/api/vacation-requests/${request.id}/reject`}
              variant="outline"
              size="sm"
              label="Reprovar"
              loadingLabel="Reprovando..."
              successMessage="Solicitação reprovada."
              className="border-red-200 bg-red-50 text-sm font-semibold text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
            />
            {isPending && <EditPeriodFormClient request={request} />}
          </>
        )}
        <ActionButtonForm
          action={`/api/vacation-requests/${request.id}/delete`}
          variant="outline"
          size="sm"
          label={deleteLabel}
          loadingLabel={isOwner ? "Cancelando..." : "Excluindo..."}
          successMessage={deleteSuccessMessage}
          confirmMessage={
            isOwner
              ? "Tem certeza de que deseja cancelar esta solicitação de férias?"
              : "Tem certeza de que deseja excluir esta solicitação de férias?"
          }
          className="ml-auto border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
        />
      </div>
    </div>
  );
}

