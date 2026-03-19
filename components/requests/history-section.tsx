"use client";

import { useMemo, useState } from "react";
import { getRoleLabel } from "@/lib/vacationRules";

type HistoryEntry = {
  changedAt: Date | string;
  previousStatus: string;
  newStatus: string;
  changedByUser?: { name?: string; role?: string };
};

function formatStatus(status: string): string {
  if (status === "APROVADO_COORDENADOR" || status === "APROVADO_GESTOR") return "Aprovado coordenador";
  if (status === "APROVADO_GERENTE") return "Aprovado";
  return status.replace(/_/g, " ");
}

function formatNewStatus(status: string, changedByRole?: string): string {
  if (status !== "APROVADO_GERENTE") return formatStatus(status);
  if (changedByRole === "COORDENADOR" || changedByRole === "GESTOR") return "Aprovado coordenador";
  if (changedByRole === "GERENTE") return "Aprovado gerente";
  if (changedByRole === "DIRETOR") return "Aprovado diretor";
  return "Aprovado";
}

export function HistorySection({ history }: { history: HistoryEntry[] }) {
  const [openByIndex, setOpenByIndex] = useState<Record<number, boolean>>({});

  return (
    <div className="mt-4 rounded-md border border-[#e2e8f0] bg-[#f5f6f8] p-3 dark:border-[#252a35] dark:bg-[#0f1117]">
      <p className="mb-2 text-base font-semibold uppercase tracking-wide text-[#64748b] dark:text-slate-400">Histórico</p>
      <div className="space-y-1.5">
        {history.map((h, idx) => {
          const isOpen = openByIndex[idx] ?? false;
          const dateLabel = new Date(h.changedAt).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div key={idx} className="rounded-md bg-white/30 p-2 dark:bg-[#0b1220]/30">
              <button
                type="button"
                className="flex w-full items-start gap-2 text-left"
                onClick={() => setOpenByIndex((m) => ({ ...m, [idx]: !isOpen }))}
                aria-expanded={isOpen}
              >
                <span className="mt-0.5 shrink-0 text-[#94a3b8]">→</span>

                <span className="shrink-0 font-medium text-[#475569] dark:text-slate-400">{dateLabel}</span>

                <span className="flex-1 break-all">
                  <span className="font-normal text-[#64748b] dark:text-slate-400">
                    {formatStatus(h.previousStatus)}
                  </span>{" "}
                  <span className="text-[#94a3b8]">→</span>{" "}
                  <span className="font-semibold text-[#0f172a] dark:text-slate-100">
                    {formatNewStatus(h.newStatus, h.changedByUser?.role)}
                  </span>
                </span>

                <span className="ml-2 inline-flex shrink-0 items-center text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {isOpen ? "Ocultar" : "Expandir"}
                </span>
              </button>

              {isOpen && (
                h.changedByUser?.name ? (
                  <div className="mt-2 text-xs text-[#94a3b8]">
                    Responsável: {h.changedByUser.name} ({getRoleLabel(h.changedByUser.role ?? "")})
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-[#94a3b8]">Sem responsável</div>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
