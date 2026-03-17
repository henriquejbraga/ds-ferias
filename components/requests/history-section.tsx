import { getRoleLabel } from "@/lib/vacationRules";

type HistoryEntry = {
  changedAt: Date | string;
  previousStatus: string;
  newStatus: string;
  changedByUser?: { name?: string; role?: string };
};

function formatStatus(status: string): string {
  if (status === "APROVADO_COORDENADOR" || status === "APROVADO_GESTOR") return "Aprovado coordenador";
  if (status === "APROVADO_GERENTE") return "Aprovado gerente";
  if (status === "APROVADO_RH") return "Aprovado RH";
  return status.replace(/_/g, " ");
}

export function HistorySection({ history }: { history: HistoryEntry[] }) {
  return (
    <div className="mt-4 rounded-md border border-[#e2e8f0] bg-[#f5f6f8] p-3 dark:border-[#252a35] dark:bg-[#0f1117]">
      <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#64748b] dark:text-slate-400">Histórico</p>
      <div className="space-y-1.5">
        {history.map((h, idx) => (
          <div
            key={idx}
            className="flex items-start gap-2 text-sm text-[#475569] dark:text-slate-400"
          >
            <span className="mt-0.5 shrink-0 text-[#94a3b8]">→</span>
            <span className="shrink-0 font-medium">
              {new Date(h.changedAt).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span className="flex-1 break-all">
              <span className="font-normal text-[#64748b]"> {formatStatus(h.previousStatus)}</span>{" "}
              <span className="text-[#94a3b8]">→</span>{" "}
              <span className="font-semibold text-[#0f172a] dark:text-slate-100">
                {formatStatus(h.newStatus)}
              </span>
              {h.changedByUser?.name && (
                <span className="block text-xs text-[#94a3b8]">
                  · {h.changedByUser.name} ({getRoleLabel(h.changedByUser.role ?? "")})
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
