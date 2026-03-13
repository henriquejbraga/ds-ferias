"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Props = {
  canRequest?: boolean;
};

type Period = {
  start: string;
  end: string;
};

export function NewRequestCardClient({ canRequest = true }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);

  const [periods, setPeriods] = useState<Period[]>([
    { start: "", end: "" },
    { start: "", end: "" },
    { start: "", end: "" },
  ]);

  const stats = calculatePeriodStats(periods);

  function updatePeriod(index: number, field: "start" | "end", value: string) {
    const next = [...periods];
    next[index][field] = value;
    setPeriods(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || isPending) return;

    const validPeriods = periods
      .filter((p) => p.start && p.end)
      .map((p) => ({ startDate: p.start, endDate: p.end }));

    if (validPeriods.length === 0) {
      toast.error("Preencha pelo menos um período", { duration: 5000 });
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/vacation-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periods: validPeriods }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(data?.error ?? "Não foi possível criar a solicitação", { duration: 8000 });
        setSubmitting(false);
        return;
      }

      toast.success("Solicitação enviada!", { description: "Aguardando aprovação do gestor", duration: 5000 });
      setPeriods([{ start: "", end: "" }, { start: "", end: "" }, { start: "", end: "" }]);
      startTransition(() => {
        router.refresh();
        setSubmitting(false);
      });
    } catch {
      toast.error("Erro ao enviar solicitação", { duration: 6000 });
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Regras CLT */}
      <div className="rounded-md border border-[#e2e8f0] bg-[#f5f6f8] p-3 dark:border-[#252a35] dark:bg-[#0f1117]">
        <p className="mb-1.5 text-xs font-semibold text-[#1a1d23] dark:text-white">Regras CLT</p>
        <ul className="space-y-1">
          {[
            "Cada período: 5–30 dias corridos",
            "Um período deve ter 14 dias ou mais",
            "Aviso prévio mínimo de 30 dias",
            "Máximo de 3 períodos, totalizando 30 dias",
          ].map((rule, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-[#64748b] dark:text-slate-400">
              <span className="mt-0.5 text-blue-500">•</span>
              {rule}
            </li>
          ))}
        </ul>
      </div>

      {/* Período 1 – obrigatório */}
      <PeriodBlock
        index={0}
        label="Período 1"
        required
        period={periods[0]}
        stat={stats.periods[0]}
        onChange={(f, v) => updatePeriod(0, f, v)}
      />

      {/* Período 2 – opcional */}
      <details className="group rounded-md border border-[#e2e8f0] dark:border-[#252a35]">
        <summary className="flex cursor-pointer items-center justify-between px-3 py-2.5 text-xs font-medium text-[#64748b] hover:bg-[#f5f6f8] dark:text-slate-400 dark:hover:bg-[#1e2330]">
          <span className="flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[#e2e8f0] text-[10px] font-bold dark:border-[#252a35]">2</span>
            Adicionar 2º período (opcional)
          </span>
          <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="border-t border-[#e2e8f0] p-3 dark:border-[#252a35]">
          <PeriodBlock
            index={1}
            period={periods[1]}
            stat={stats.periods[1]}
            onChange={(f, v) => updatePeriod(1, f, v)}
          />
        </div>
      </details>

      {/* Período 3 – opcional */}
      <details className="group rounded-md border border-[#e2e8f0] dark:border-[#252a35]">
        <summary className="flex cursor-pointer items-center justify-between px-3 py-2.5 text-xs font-medium text-[#64748b] hover:bg-[#f5f6f8] dark:text-slate-400 dark:hover:bg-[#1e2330]">
          <span className="flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[#e2e8f0] text-[10px] font-bold dark:border-[#252a35]">3</span>
            Adicionar 3º período (opcional)
          </span>
          <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="border-t border-[#e2e8f0] p-3 dark:border-[#252a35]">
          <PeriodBlock
            index={2}
            period={periods[2]}
            stat={stats.periods[2]}
            onChange={(f, v) => updatePeriod(2, f, v)}
          />
        </div>
      </details>

      {/* Resumo */}
      {stats.totalDays > 0 && (
        <div className="rounded-md border border-[#e2e8f0] bg-[#f5f6f8] p-3 dark:border-[#252a35] dark:bg-[#0f1117]">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#1a1d23] dark:text-white">Resumo</span>
            <span className="text-xs text-[#64748b]">{stats.validPeriods} período(s)</span>
          </div>
          {stats.periods.map(
            (p, i) =>
              p.days > 0 && (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-[#64748b] dark:text-slate-400">
                    Período {i + 1}{p.range ? ` · ${p.range.start} → ${p.range.end}` : ""}
                  </span>
                  <span className="font-semibold text-[#1a1d23] dark:text-white">{p.days} dias</span>
                </div>
              ),
          )}
          <div className="mt-2 flex items-center justify-between border-t border-[#e2e8f0] pt-2 dark:border-[#252a35]">
            <span className="text-xs font-semibold text-[#1a1d23] dark:text-white">Total</span>
            <span
              className={`text-sm font-bold ${
                stats.totalDays === 30
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {stats.totalDays} dias
            </span>
          </div>
          {stats.totalDays !== 30 && (
            <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
              ⚠ O total deve ser exatamente 30 dias.
            </p>
          )}
        </div>
      )}

      {/* Botão */}
      <button
        type="submit"
        disabled={isPending || submitting || !periods[0].start || !periods[0].end}
        className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending || submitting ? (
          <>
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Enviando...
          </>
        ) : (
          "Enviar solicitação"
        )}
      </button>
    </form>
  );
}

// ============================================================================
// BLOCO DE PERÍODO
// ============================================================================

function PeriodBlock({
  index,
  label,
  required = false,
  period,
  stat,
  onChange,
}: {
  index: number;
  label?: string;
  required?: boolean;
  period: Period;
  stat: { days: number; isValid: boolean; range: { start: string; end: string } | null };
  onChange: (field: "start" | "end", value: string) => void;
}) {
  return (
    <div className="space-y-2">
      {label && (
        <p className="text-xs font-medium text-[#1a1d23] dark:text-white">
          {label} {required && <span className="text-red-500">*</span>}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-[#64748b] dark:text-slate-400">Início</label>
          <input
            type="date"
            required={required}
            value={period.start}
            onChange={(e) => onChange("start", e.target.value)}
            className="h-9 w-full rounded-md border border-[#e2e8f0] bg-white px-3 text-sm text-[#1a1d23] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#1a1d23] dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#64748b] dark:text-slate-400">Término</label>
          <input
            type="date"
            required={required}
            value={period.end}
            onChange={(e) => onChange("end", e.target.value)}
            className="h-9 w-full rounded-md border border-[#e2e8f0] bg-white px-3 text-sm text-[#1a1d23] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#1a1d23] dark:text-white"
          />
        </div>
      </div>
      {stat.days > 0 && (
        <div className="flex items-center justify-between rounded-md bg-[#f5f6f8] px-3 py-1.5 dark:bg-[#0f1117]">
          <span className="text-xs text-[#64748b] dark:text-slate-400">Duração</span>
          <span
            className={`text-xs font-semibold ${
              stat.isValid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
            }`}
          >
            {stat.days} {stat.days === 1 ? "dia" : "dias"}
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// UTILITÁRIOS
// ============================================================================

function calculatePeriodStats(periods: Period[]) {
  const ONE_DAY_MS = 86400000;

  const periodStats = periods.map((p) => {
    if (!p.start || !p.end) return { days: 0, isValid: false, range: null };

    const start = new Date(p.start + "T00:00:00");
    const end = new Date(p.end + "T00:00:00");

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      return { days: 0, isValid: false, range: null };
    }

    const days = Math.round((end.getTime() - start.getTime()) / ONE_DAY_MS) + 1;
    return {
      days,
      isValid: days >= 5 && days <= 30,
      range: {
        start: start.toLocaleDateString("pt-BR"),
        end: end.toLocaleDateString("pt-BR"),
      },
    };
  });

  return {
    periods: periodStats,
    validPeriods: periodStats.filter((p) => p.days > 0).length,
    totalDays: periodStats.reduce((sum, p) => sum + p.days, 0),
  };
}
