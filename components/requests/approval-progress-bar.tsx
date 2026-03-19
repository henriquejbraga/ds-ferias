import { getApprovalSteps, getApprovalProgress, getNextApprover } from "@/lib/vacationRules";

type RequestLike = { status: string; user?: { role?: string } | null };

export function ApprovalProgressBar({ request }: { request: RequestLike }) {
  const steps = getApprovalSteps(request.user?.role ?? "FUNCIONARIO");
  const progress = getApprovalProgress(request.status);
  const isRejected = request.status === "REPROVADO" || request.status === "CANCELADO";
  const isCompleted = request.status === "APROVADO_GERENTE" || request.status === "APROVADO_RH";
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
      <div className="mt-1.5 flex items-start gap-1">
        {steps.map((step, i) => (
          <div key={i} className="flex flex-1 items-start">
            <span
              className={`block w-full text-center text-xs leading-tight ${
                i < progress
                  ? "text-blue-600 dark:text-blue-400"
                  : i === progress && !isCompleted
                    ? "font-semibold text-amber-600 dark:text-amber-400"
                    : "text-[#94a3b8]"
              }`}
            >
              {step}
            </span>
          </div>
        ))}
      </div>
</div>
  );
}
