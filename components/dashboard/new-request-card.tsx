"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type Props = {
  canRequest?: boolean;
};

export function NewRequestCardClient({ canRequest = true }: Props) {
  const router = useRouter();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);

  // Calcula duração das férias
  const duration = startDate && endDate ? calculateDuration(startDate, endDate) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || isPending) return;

    setSubmitting(true);

    try {
      const res = await fetch("/api/vacation-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ startDate, endDate }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = data?.error ?? "Não foi possível criar a solicitação.";
        toast.error(msg, { 
          duration: 6000,
          description: "Verifique as datas e tente novamente"
        });
        setSubmitting(false);
        return;
      }

      toast.success("Solicitação criada com sucesso!", { 
        duration: 4000,
        description: "Aguarde a aprovação do seu gestor"
      });
      
      // Limpa o formulário
      setStartDate("");
      setEndDate("");

      // Atualiza a página
      startTransition(() => {
        router.refresh();
        setSubmitting(false);
      });
    } catch (error) {
      toast.error("Erro ao criar solicitação", {
        duration: 6000,
        description: "Tente novamente mais tarde"
      });
      setSubmitting(false);
    }
  }

  if (!canRequest) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
            <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-base font-semibold text-slate-900 dark:text-white">
              Apenas colaboradores podem solicitar férias
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Seu perfil tem permissões de aprovação
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Informação sobre regras CLT */}
      <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950/30">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
            <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              Regras de férias (CLT)
            </p>
            <ul className="mt-2 space-y-1 text-xs text-blue-800 dark:text-blue-200">
              <li className="flex items-center gap-1.5">
                <span className="text-blue-500">•</span>
                <span>Mínimo de 5 dias corridos</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-blue-500">•</span>
                <span>Máximo de 30 dias corridos</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-blue-500">•</span>
                <span>Antecedência mínima de 30 dias</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Campos de data */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label 
            htmlFor="start-date" 
            className="block text-sm font-bold text-slate-900 dark:text-white"
          >
            📅 Data de início
          </label>
          <input
            id="start-date"
            type="date"
            name="startDate"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div className="space-y-2">
          <label 
            htmlFor="end-date" 
            className="block text-sm font-bold text-slate-900 dark:text-white"
          >
            📅 Data de término
          </label>
          <input
            id="end-date"
            type="date"
            name="endDate"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />
        </div>
      </div>

      {/* Duração calculada */}
      {duration !== null && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Duração total
            </span>
            <span className={`text-base font-bold ${
              duration.isValid 
                ? 'text-emerald-600 dark:text-emerald-400' 
                : 'text-amber-600 dark:text-amber-400'
            }`}>
              {duration.days} {duration.days === 1 ? 'dia' : 'dias'}
            </span>
          </div>
          {!duration.isValid && duration.message && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              ⚠️ {duration.message}
            </p>
          )}
        </div>
      )}

      {/* Botão de envio */}
      <Button
        type="submit"
        size="lg"
        className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-base font-bold text-white shadow-lg shadow-blue-500/30 transition-all hover:from-blue-600 hover:to-indigo-700 hover:shadow-xl hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed dark:shadow-blue-500/20 dark:hover:shadow-blue-500/30"
        disabled={isPending || submitting || !startDate || !endDate}
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Solicitar férias
          </span>
        )}
      </Button>
    </form>
  );
}

/**
 * Calcula a duração e valida o período de férias
 */
function calculateDuration(startDateStr: string, endDateStr: string) {
  if (!startDateStr || !endDateStr) return null;

  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T00:00:00');

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { days: 0, isValid: false, message: 'Datas inválidas' };
  }

  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

  // Validações básicas
  if (diffDays < 0) {
    return { days: 0, isValid: false, message: 'A data final deve ser posterior à inicial' };
  }

  if (diffDays < 5) {
    return { days: diffDays, isValid: false, message: 'Período mínimo é de 5 dias' };
  }

  if (diffDays > 30) {
    return { days: diffDays, isValid: false, message: 'Período máximo é de 30 dias' };
  }

  // Verifica antecedência
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntilStart = Math.floor((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilStart < 0) {
    return { days: diffDays, isValid: false, message: 'A data de início não pode ser no passado' };
  }

  if (daysUntilStart < 30) {
    return { days: diffDays, isValid: false, message: `Necessário ${30 - daysUntilStart} dias a mais de antecedência` };
  }

  return { days: diffDays, isValid: true, message: null };
}