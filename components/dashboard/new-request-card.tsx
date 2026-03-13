"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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
  
  // Estado para os 3 períodos possíveis
  const [periods, setPeriods] = useState<Period[]>([
    { start: "", end: "" },
    { start: "", end: "" },
    { start: "", end: "" },
  ]);

  // Calcula estatísticas dos períodos
  const stats = calculatePeriodStats(periods);

  function updatePeriod(index: number, field: 'start' | 'end', value: string) {
    const newPeriods = [...periods];
    newPeriods[index][field] = value;
    setPeriods(newPeriods);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || isPending) return;

    // Filtra apenas períodos completos (com início e fim preenchidos)
    const validPeriods = periods
      .filter(p => p.start && p.end)
      .map(p => ({ startDate: p.start, endDate: p.end }));

    if (validPeriods.length === 0) {
      toast.error("Preencha pelo menos um período", {
        description: "Informe a data de início e término das férias",
        duration: 5000,
      });
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
        const msg = data?.error ?? "Não foi possível criar a solicitação";
        toast.error(msg, { 
          duration: 8000,
          description: "Verifique os períodos e tente novamente"
        });
        setSubmitting(false);
        return;
      }

      toast.success("Solicitação enviada com sucesso!", { 
        duration: 5000,
        description: "Aguardando aprovação do gestor"
      });
      
      // Limpa todos os períodos
      setPeriods([
        { start: "", end: "" },
        { start: "", end: "" },
        { start: "", end: "" },
      ]);

      // Atualiza a página
      startTransition(() => {
        router.refresh();
        setSubmitting(false);
      });
    } catch (error) {
      toast.error("Erro ao enviar solicitação", {
        duration: 6000,
        description: "Tente novamente em alguns instantes"
      });
      setSubmitting(false);
    }
  }

  if (!canRequest) {
    return (
      <div className="rounded-xl border-2 border-dashed border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/30">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
            <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-amber-900 dark:text-amber-100">
              Apenas colaboradores podem solicitar férias
            </p>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              Seu perfil possui permissões de aprovação
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Card informativo com regras CLT */}
      <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 dark:border-blue-800 dark:from-blue-950/30 dark:to-indigo-950/30">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-500/20">
            <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-blue-900 dark:text-blue-100">
              Regras de férias (CLT)
            </p>
            <ul className="mt-2 space-y-1.5 text-xs text-blue-800 dark:text-blue-200">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-blue-500">•</span>
                <span>Cada período deve ter entre 5 e 30 dias corridos</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-blue-500">•</span>
                <span>Pelo menos um período com 14 dias ou mais</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-blue-500">•</span>
                <span>Aviso prévio mínimo de 30 dias</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-blue-500">•</span>
                <span>Máximo de 3 períodos distintos</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Instrução */}
      <div>
        <h4 className="text-base font-bold text-slate-900 dark:text-white">
          Períodos de férias
        </h4>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Preencha até 3 períodos. Apenas o primeiro é obrigatório.
        </p>
      </div>

      {/* Período 1 - Obrigatório */}
      <div className="space-y-3 rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white dark:bg-blue-500">
            1
          </span>
          <span className="text-sm font-bold text-slate-900 dark:text-white">
            Período principal <span className="text-xs text-slate-600 dark:text-slate-400">(obrigatório)</span>
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="start-1" className="block text-sm font-bold text-slate-900 dark:text-white">
              📅 Data de início
            </label>
            <input
              id="start-1"
              type="date"
              required
              value={periods[0].start}
              onChange={(e) => updatePeriod(0, 'start', e.target.value)}
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="end-1" className="block text-sm font-bold text-slate-900 dark:text-white">
              📅 Data de término
            </label>
            <input
              id="end-1"
              type="date"
              required
              value={periods[0].end}
              onChange={(e) => updatePeriod(0, 'end', e.target.value)}
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>
        {stats.periods[0]?.days > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 dark:bg-slate-800">
            <span className="text-sm text-slate-600 dark:text-slate-400">Duração</span>
            <span className={`text-sm font-bold ${
              stats.periods[0].isValid 
                ? 'text-emerald-600 dark:text-emerald-400' 
                : 'text-amber-600 dark:text-amber-400'
            }`}>
              {stats.periods[0].days} {stats.periods[0].days === 1 ? 'dia' : 'dias'}
            </span>
          </div>
        )}
      </div>

      {/* Período 2 - Opcional */}
      <details className="group rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
          <span className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-300 text-xs font-bold dark:border-slate-600">
              2
            </span>
            Adicionar 2º período (opcional)
          </span>
          <svg className="h-5 w-5 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="border-t border-slate-200 p-4 dark:border-slate-700">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="start-2" className="block text-sm font-semibold text-slate-900 dark:text-white">
                Data de início
              </label>
              <input
                id="start-2"
                type="date"
                value={periods[1].start}
                onChange={(e) => updatePeriod(1, 'start', e.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="end-2" className="block text-sm font-semibold text-slate-900 dark:text-white">
                Data de término
              </label>
              <input
                id="end-2"
                type="date"
                value={periods[1].end}
                onChange={(e) => updatePeriod(1, 'end', e.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
          {stats.periods[1]?.days > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
              <span className="text-sm text-slate-600 dark:text-slate-400">Duração</span>
              <span className={`text-sm font-bold ${
                stats.periods[1].isValid 
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : 'text-amber-600 dark:text-amber-400'
              }`}>
                {stats.periods[1].days} {stats.periods[1].days === 1 ? 'dia' : 'dias'}
              </span>
            </div>
          )}
        </div>
      </details>

      {/* Período 3 - Opcional */}
      <details className="group rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
          <span className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-300 text-xs font-bold dark:border-slate-600">
              3
            </span>
            Adicionar 3º período (opcional)
          </span>
          <svg className="h-5 w-5 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="border-t border-slate-200 p-4 dark:border-slate-700">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="start-3" className="block text-sm font-semibold text-slate-900 dark:text-white">
                Data de início
              </label>
              <input
                id="start-3"
                type="date"
                value={periods[2].start}
                onChange={(e) => updatePeriod(2, 'start', e.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="end-3" className="block text-sm font-semibold text-slate-900 dark:text-white">
                Data de término
              </label>
              <input
                id="end-3"
                type="date"
                value={periods[2].end}
                onChange={(e) => updatePeriod(2, 'end', e.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
          {stats.periods[2]?.days > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
              <span className="text-sm text-slate-600 dark:text-slate-400">Duração</span>
              <span className={`text-sm font-bold ${
                stats.periods[2].isValid 
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : 'text-amber-600 dark:text-amber-400'
              }`}>
                {stats.periods[2].days} {stats.periods[2].days === 1 ? 'dia' : 'dias'}
              </span>
            </div>
          )}
        </div>
      </details>

      {/* Resumo total */}
      {stats.totalDays > 0 && (
        <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              Resumo da solicitação
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {stats.validPeriods} {stats.validPeriods === 1 ? 'período' : 'períodos'}
            </span>
          </div>
          
          <div className="space-y-2">
            {stats.periods.map((p, i) => p.days > 0 && (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-slate-700 dark:text-slate-300">
                  Período {i + 1}
                  {p.range && ` (${p.range.start} → ${p.range.end})`}
                </span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {p.days} {p.days === 1 ? 'dia' : 'dias'}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between border-t-2 border-slate-200 pt-3 dark:border-slate-600">
            <span className="text-base font-bold text-slate-900 dark:text-white">
              Total de dias
            </span>
            <span className={`text-xl font-bold ${
              stats.totalDays === 30
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}>
              {stats.totalDays} dias
            </span>
          </div>

          {stats.totalDays !== 30 && (
            <p className="mt-3 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
              <span className="mt-0.5">⚠️</span>
              <span>O total deve ser de 30 dias. Ajuste os períodos antes de enviar.</span>
            </p>
          )}
        </div>
      )}

      {/* Botão de envio */}
      <Button
        type="submit"
        size="lg"
        className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-base font-bold text-white shadow-lg shadow-blue-500/30 transition-all hover:from-blue-600 hover:to-indigo-700 hover:shadow-xl hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed dark:shadow-blue-500/20"
        disabled={isPending || submitting || !periods[0].start || !periods[0].end}
      >
        {isPending || submitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Enviando solicitação...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Enviar solicitação de férias
          </span>
        )}
      </Button>
    </form>
  );
}

/**
 * Calcula estatísticas dos períodos selecionados
 */
function calculatePeriodStats(periods: Period[]) {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const periodStats = periods.map((p) => {
    if (!p.start || !p.end) {
      return { days: 0, isValid: false, range: null };
    }

    const start = new Date(p.start + 'T00:00:00');
    const end = new Date(p.end + 'T00:00:00');

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      return { days: 0, isValid: false, range: null };
    }

    const days = Math.round((end.getTime() - start.getTime()) / ONE_DAY_MS) + 1;
    const isValid = days >= 5 && days <= 30;

    return {
      days,
      isValid,
      range: {
        start: start.toLocaleDateString('pt-BR'),
        end: end.toLocaleDateString('pt-BR'),
      },
    };
  });

  const validPeriods = periodStats.filter(p => p.days > 0).length;
  const totalDays = periodStats.reduce((sum, p) => sum + p.days, 0);

  return {
    periods: periodStats,
    validPeriods,
    totalDays,
  };
}