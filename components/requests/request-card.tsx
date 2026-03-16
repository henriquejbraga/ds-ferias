import { canApproveRequest } from "@/lib/vacationRules";
import { StatusBadge, RoleChip } from "@/components/requests/status-badge";
import { ApprovalProgressBar } from "@/components/requests/approval-progress-bar";
import { HistorySection } from "@/components/requests/history-section";
import { RequestActions } from "@/components/requests/request-actions";

function formatDateRange(start: Date | string, end: Date | string): string {
  return `${new Date(start).toLocaleDateString("pt-BR")} → ${new Date(end).toLocaleDateString("pt-BR")}`;
}

export type RequestWithUser = {
  id: string;
  userId: string;
  status: string;
  startDate: Date | string;
  endDate: Date | string;
  notes?: string | null;
  user?: {
    name?: string;
    role?: string;
    department?: string | null;
  } | null;
  history?: unknown[];
};

export function RequestCard({
  request,
  userId,
  userRole,
  isOwner = false,
}: {
  request: RequestWithUser;
  userId?: string;
  userRole?: string;
  isOwner?: boolean;
}) {
  const approverRole = userRole ?? request.user?.role ?? "FUNCIONARIO";
  const canApprove = userId
    ? canApproveRequest(approverRole, userId, {
        userId: request.userId,
        status: request.status,
        user: { role: request.user?.role ?? "FUNCIONARIO" },
      })
    : false;
  const showActions = isOwner || (!!userId && request.userId !== userId);
  const start = new Date(request.startDate);
  const end = new Date(request.endDate);
  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonth = start.toLocaleDateString("pt-BR", { month: "short" });
  const endMonth = end.toLocaleDateString("pt-BR", { month: "short" });
  const monthLabel = startMonth === endMonth ? startMonth : `${startMonth}/${endMonth}`;

  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white transition-shadow hover:shadow-sm dark:border-[#252a35] dark:bg-[#1a1d23]">
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-blue-50 text-xs leading-tight dark:bg-blue-900/20">
              <span className="text-base font-bold text-blue-700 dark:text-blue-400">
                {startDay}-{endDay}
              </span>
              <span className="uppercase font-semibold text-blue-500 dark:text-blue-400">
                {monthLabel}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              {!isOwner && request.user && (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-lg font-semibold text-[#1a1d23] dark:text-white">
                    {request.user.name}
                  </p>
                  <RoleChip role={request.user.role ?? "FUNCIONARIO"} />
                </div>
              )}
              <p className="truncate text-base font-medium text-[#475569] dark:text-slate-300">
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

        {request.notes && (
          <div className="mt-3 rounded-md bg-[#f5f6f8] px-3 py-2 dark:bg-[#0f1117]">
            <p className="text-sm text-[#64748b] dark:text-slate-400">
              <span className="font-medium text-[#475569] dark:text-slate-300">Obs.: </span>
              {request.notes}
            </p>
          </div>
        )}

        {request.user && <ApprovalProgressBar request={request} />}

        {request.history?.length ? <HistorySection history={request.history as Parameters<typeof HistorySection>[0]["history"]} /> : null}

        {showActions && (
          <RequestActions
            request={request}
            isOwner={isOwner}
            hasApprovePermission={!!userId && request.userId !== userId && canApprove}
          />
        )}
      </div>
    </div>
  );
}
