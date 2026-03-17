"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { VacationBalance } from "@/lib/vacationRules";
import type { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/ui/date-range-picker";

type Props = {
  canRequest?: boolean;
  /** Saldo completo do ciclo (entitledDays, availableDays, pendingDays, usedDays). Deve vir do dashboard. */
  balance?: VacationBalance | null;
};

type Period = {
  start: string;
  end: string;
};

export function NewRequestCardClient({ canRequest = true, balance }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState("");
  const [abono, setAbono] = useState(false);
  const [thirteenth, setThirteenth] = useState(false);

  const [periods, setPeriods] = useState<Period[]>([
    { start: "", end: "" },
    { start: "", end: "" },
    { start: "", end: "" },
  ]);

  const stats = calculatePeriodStats(periods);
  const existingDaysInCycle = balance ? balance.pendingDays + balance.usedDays : 0;
  const entitledDays = balance?.entitledDays ?? 30;
  const availableDays = balance?.availableDays ?? Math.max(0, (balance?.entitledDays ?? 30) - existingDaysInCycle);
  const maxDaysThisRequest = Math.max(0, availableDays);
  const totalOk = maxDaysThisRequest === 0 ? stats.totalDays === 0 : stats.totalDays > 0 && stats.totalDays <= maxDaysThisRequest;
  const hasPeriod14OrMore = stats.periods.some((p) => p.days >= 14);
  const needsPeriod14 = existingDaysInCycle < 14 && !hasPeriod14OrMore;
  const totalWithExisting = existingDaysInCycle + stats.totalDays;
  const cycleTotalOk = totalWithExisting <= entitledDays;

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
        body: JSON.stringify({
          periods: validPeriods,
          notes: notes.trim() || undefined,
          abono,
          thirteenth,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(data?.error ?? "Não foi possível criar a solicitação", { duration: 8000 });
        setSubmitting(false);
        return;
      }

      toast.success("Solicitação enviada!", { description: "Aguardando aprovação do gestor", duration: 5000 });
      setPeriods([{ start: "", end: "" }, { start: "", end: "" }, { start: "", end: "" }]);
      setNotes("");
      setAbono(false);
      setThirteenth(false);
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
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-3xl space-y-8 text-[15px] md:text-[16px]"
    >
      {/* REGRAS */}
      <section className="rounded-lg border border-[#e2e8f0] bg-[#f5f6f8] p-6 dark:border-[#252a35] dark:bg-[#0f1117]">
        <h2 className="mb-4 text-xl font-bold text-[#1a1d23] dark:text-white">
          Regras CLT
        </h2>

        <ul className="space-y-2 text-[15px] leading-relaxed text-[#475569] dark:text-slate-300">
          {[
            "Cada período: 5–30 dias corridos",
            "Um período de 14+ dias (ou já ter no ciclo)",
            "Início não pode ser sexta nem sábado; término não pode ser sábado nem domingo",
            "Aviso prévio mínimo de 30 dias",
            existingDaysInCycle > 0
              ? `Máximo de 3 períodos; total do ciclo 30 dias (você já tem ${existingDaysInCycle} no ciclo)`
              : "Máximo de 3 períodos, totalizando 30 dias",
          ].map((rule, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1 text-blue-500">•</span>
              <span>{rule}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* PERÍODOS */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-[#1a1d23] dark:text-white">
          Períodos de férias
        </h2>

        <PeriodBlock
          index={0}
          label="Período 1"
          required
          period={periods[0]}
          stat={stats.periods[0]}
          onChange={(f, v) => updatePeriod(0, f, v)}
        />

        {/* período 2 */}
        <details className="group rounded-lg border border-[#e2e8f0] dark:border-[#252a35]">
          <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-lg font-medium text-[#475569] hover:bg-[#f5f6f8] dark:text-slate-300 dark:hover:bg-[#1e2330]">
            <span className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold">
                2
              </span>
              Adicionar 2º período
            </span>

            <svg
              className="h-4 w-4 transition-transform group-open:rotate-180"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>

          <div className="border-t border-[#e2e8f0] p-4 dark:border-[#252a35]">
            <PeriodBlock
              index={1}
              period={periods[1]}
              stat={stats.periods[1]}
              onChange={(f, v) => updatePeriod(1, f, v)}
            />
          </div>
        </details>

        {/* período 3 */}
        <details className="group rounded-lg border border-[#e2e8f0] dark:border-[#252a35]">
          <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-lg font-medium text-[#475569] hover:bg-[#f5f6f8] dark:text-slate-300 dark:hover:bg-[#1e2330]">
            <span className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold">
                3
              </span>
              Adicionar 3º período
            </span>

            <svg
              className="h-4 w-4 transition-transform group-open:rotate-180"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>

          <div className="border-t border-[#e2e8f0] p-4 dark:border-[#252a35]">
            <PeriodBlock
              index={2}
              period={periods[2]}
              stat={stats.periods[2]}
              onChange={(f, v) => updatePeriod(2, f, v)}
            />
          </div>
        </details>
      </section>

      {/* JUSTIFICATIVA */}
      <section className="space-y-3">
        <label className="text-lg font-medium text-[#475569] dark:text-slate-300">
          Justificativa (opcional)
        </label>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Ex.: Ajuste de férias por demanda do projeto, alinhado com o gestor."
          className="w-full rounded-md border border-[#e2e8f0] bg-white px-4 py-3 text-lg outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#1a1d23] dark:text-white"
        />

        <p className="text-sm text-[#64748b] dark:text-slate-400">
          Visível para gestor e RH.
        </p>
      </section>

      {/* OPÇÕES */}
      <section className="space-y-4 rounded-lg border border-[#e2e8f0] bg-white p-5 dark:border-[#252a35] dark:bg-[#1a1d23]">
        <h3 className="text-lg font-semibold text-[#1a1d23] dark:text-white">
          Opções financeiras
        </h3>

        <label className="flex gap-3 text-[15px] leading-relaxed text-[#475569] dark:text-slate-300">
          <input
            type="checkbox"
            checked={abono}
            onChange={(e) => setAbono(e.target.checked)}
            className="mt-1 h-5 w-5"
          />
          <span>
            Conversão de <strong>1/3 das férias em abono (10 dias)</strong>.
          </span>
        </label>

        <label className="flex gap-3 text-[15px] leading-relaxed text-[#475569] dark:text-slate-300">
          <input
            type="checkbox"
            checked={thirteenth}
            onChange={(e) => setThirteenth(e.target.checked)}
            className="mt-1 h-5 w-5"
          />
          <span>
            Adiantamento de <strong>13º salário</strong> junto com as férias.
          </span>
        </label>
      </section>

      {/* RESUMO */}
      {stats.totalDays > 0 && (
        <section className="rounded-lg border border-[#e2e8f0] bg-[#f5f6f8] p-6 dark:border-[#252a35] dark:bg-[#0f1117]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold text-[#1a1d23] dark:text-white">
              Resumo
            </h3>
            <span className="text-base text-[#64748b]">
              {stats.validPeriods} período(s)
            </span>
          </div>

          <div className="space-y-2">
            {stats.periods.map(
              (p, i) =>
                p.days > 0 && (
                  <div key={i} className="flex justify-between text-lg">
                    <span className="text-[#64748b] dark:text-slate-400">
                      Período {i + 1}
                    </span>

                    <span className="font-semibold text-[#1a1d23] dark:text-white">
                      {p.days} dias
                    </span>
                  </div>
                ),
            )}
          </div>

          <div className="mt-4 flex justify-between border-t pt-3 text-xl font-bold">
            <span>Total</span>
            <span
              className={
                totalOk ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
              }
            >
              {stats.totalDays} dias
            </span>
          </div>
        </section>
      )}

      {/* BOTÃO */}
      <button
        type="submit"
        disabled={
          isPending ||
          submitting ||
          !periods[0].start ||
          !periods[0].end ||
          stats.totalDays <= 0 ||
          !totalOk ||
          needsPeriod14 ||
          !cycleTotalOk
        }
        className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-md bg-blue-600 text-xl font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending || submitting ? "Enviando..." : "Enviar solicitação"}
      </button>
    </form>
  );

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
          <p className="text-base font-semibold text-[#1a1d23] dark:text-white">
            {label} {required && <span className="text-red-500">*</span>}
          </p>
        )}
        <div>
          <DateRangePicker
            value={{
              from: period.start ? new Date(period.start) : undefined,
              to: period.end ? new Date(period.end) : undefined,
            } as DateRange}
            onChange={(range) => {
              const fromStr =
                range.from instanceof Date ? range.from.toISOString().split("T")[0] : "";
              const toStr =
                range.to instanceof Date ? range.to.toISOString().split("T")[0] : "";
              onChange("start", fromStr);
              onChange("end", toStr);
            }}
            placeholder={
              label
                ? `${label} — selecione início e término`
                : `Período ${index + 1} — selecione início e término`
            }
          />
        </div>
        {stat.days > 0 && (
          <div className="flex items-center justify-between rounded-md bg-[#f5f6f8] px-3 py-2 dark:bg-[#0f1117]">
            <span className="text-base font-medium text-[#64748b] dark:text-slate-400">Duração</span>
            <span
              className={`text-base font-bold ${stat.isValid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
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

}