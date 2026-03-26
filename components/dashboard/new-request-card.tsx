"use client";

import { useState, useTransition, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { VacationBalance } from "@/lib/vacationRules";
import { validateVacationConcessiveFifo } from "@/lib/concessivePeriod";
import type { ConcessiveClientContext } from "@/services/dashboardDataService";
import { DatePicker } from "@/components/ui/date-picker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type Props = {
  canRequest?: boolean;
  /** Saldo completo do ciclo (entitledDays, availableDays, pendingDays, usedDays). Deve vir do dashboard. */
  balance?: VacationBalance | null;
  userRole?: string;
  firstEntitlementDate?: Date | string | null;
  /** Dados para validar período concessivo no cliente (mesma regra da API). */
  concessiveContext?: ConcessiveClientContext | null;
};

type Period = {
  start: string;
  end: string;
};

function formatYmdLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseYmdLocal(value: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return undefined;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

export function NewRequestCardClient({
  canRequest = true,
  balance,
  userRole,
  firstEntitlementDate,
  concessiveContext,
}: Props) {
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

  const isBusinessDaysRole = userRole === "GERENTE" || userRole === "DIRETOR";
  const stats = calculatePeriodStats(periods);
  const [showOver30Dialog, setShowOver30Dialog] = useState(false);
  const [over30Days, setOver30Days] = useState(0);
  const [wasOver30, setWasOver30] = useState(false);
  const [showConcessiveDialog, setShowConcessiveDialog] = useState(false);
  const prevHadConcessiveError = useRef(false);
  const MAX_DAYS_PER_REQUEST = isBusinessDaysRole ? 22 : 30;
  const existingDaysInCycle = balance ? balance.pendingDays + balance.usedDays : 0;
  const isPreEntitlement = !isBusinessDaysRole && (balance?.hasEntitlement === false);
  const entitlementLabel = firstEntitlementDate
    ? new Date(firstEntitlementDate).toLocaleDateString("pt-BR")
    : null;
  const availableDays = balance?.availableDays ?? Math.max(0, MAX_DAYS_PER_REQUEST - existingDaysInCycle);
  const maxDaysThisRequest = Math.min(Math.max(0, availableDays), MAX_DAYS_PER_REQUEST);
  const effectiveMaxDaysThisRequest = isPreEntitlement ? MAX_DAYS_PER_REQUEST : maxDaysThisRequest;
  const selectedDays = isBusinessDaysRole ? stats.totalBusinessDays : stats.totalDays;
  const requireExact30WhenNoAbono = !isBusinessDaysRole && abono === false;
  const totalOk =
    effectiveMaxDaysThisRequest === 0
      ? selectedDays === 0
      : requireExact30WhenNoAbono
        ? selectedDays === 30
        : selectedDays > 0 && selectedDays <= effectiveMaxDaysThisRequest;
  const hasPeriod14OrMore = stats.periods.some((p) => p.days >= 14);
  const needsPeriod14 = isBusinessDaysRole ? false : existingDaysInCycle < 14 && !hasPeriod14OrMore;
  const totalWithExisting = existingDaysInCycle + selectedDays;
  /** Teto do “ciclo” na janela de saldo: até 60 dias (2 períodos aquisitivos), não só 30 — senão o botão fica bloqueado com saldo disponível. */
  const cycleCapForTotal = isPreEntitlement
    ? MAX_DAYS_PER_REQUEST
    : (balance?.entitledDays ?? MAX_DAYS_PER_REQUEST);
  const cycleTotalOk = totalWithExisting <= cycleCapForTotal;

  const concessiveError = useMemo(() => {
    if (!concessiveContext?.hireDateIso) return null;
    const filled: { start: Date; end: Date }[] = [];
    for (const p of periods) {
      if (!p.start || !p.end) continue;
      const s = parseYmdLocal(p.start);
      const e = parseYmdLocal(p.end);
      if (!s || !e || e < s) continue;
      filled.push({ start: s, end: e });
    }
    if (filled.length === 0) return null;
    return validateVacationConcessiveFifo({
      hireDate: new Date(concessiveContext.hireDateIso),
      acquisitionPeriods: concessiveContext.acquisitionPeriods.map((p) => ({
        id: p.id,
        startDate: new Date(p.startDate),
        endDate: new Date(p.endDate),
        accruedDays: p.accruedDays,
        usedDays: p.usedDays,
      })),
      pendingVacations: concessiveContext.pendingVacations.map((p) => ({
        startDate: new Date(p.startDate),
        endDate: new Date(p.endDate),
      })),
      newVacationPeriods: filled,
    });
  }, [concessiveContext, periods]);

  useEffect(() => {
    if (concessiveError && !prevHadConcessiveError.current) {
      setShowConcessiveDialog(true);
    }
    prevHadConcessiveError.current = Boolean(concessiveError);
  }, [concessiveError]);

  function resetForm() {
    setPeriods([
      { start: "", end: "" },
      { start: "", end: "" },
      { start: "", end: "" },
    ]);
    setNotes("");
    setAbono(false);
    setThirteenth(false);
    setShowOver30Dialog(false);
    setWasOver30(false);
    setOver30Days(0);
    setShowConcessiveDialog(false);
    prevHadConcessiveError.current = false;
  }

  // Popup quando excede o limite do perfil na soma dos períodos desta solicitação.
  // O backend também valida, mas o popup melhora a UX antes do envio.
  useEffect(() => {
    const shouldBeOver = selectedDays > MAX_DAYS_PER_REQUEST;
    if (shouldBeOver) {
      setOver30Days(selectedDays);
    }

    if (shouldBeOver && !wasOver30) {
      setWasOver30(true);
      setShowOver30Dialog(true);
    }

    if (!shouldBeOver && wasOver30) {
      setWasOver30(false);
      setShowOver30Dialog(false);
    }
  }, [selectedDays, wasOver30, MAX_DAYS_PER_REQUEST]);

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
      resetForm();
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
      {showOver30Dialog && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-2xl dark:bg-[#020617]">
            <Alert className="mb-4 border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-400/40 dark:bg-amber-950/40 dark:text-amber-100">
              <AlertTitle>Total acima do permitido</AlertTitle>
              <AlertDescription>
                Você selecionou <strong>{over30Days}</strong>{" "}
                {isBusinessDaysRole ? "dias úteis" : "dias"} na solicitação. O máximo por solicitação é{" "}
                <strong>{MAX_DAYS_PER_REQUEST}</strong> {isBusinessDaysRole ? "dias úteis" : "dias"}.
                Ajuste os períodos para continuar.
              </AlertDescription>
            </Alert>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowOver30Dialog(false);
                }}
              >
                Ok
              </Button>
            </div>
          </div>
        </div>
      )}

      {showConcessiveDialog && concessiveError && (
        <div
          className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/45 backdrop-blur-sm"
          role="presentation"
          onClick={() => setShowConcessiveDialog(false)}
        >
          <div
            className="mx-4 w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl dark:bg-[#020617]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="concessive-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <Alert className="border-red-200 bg-red-50/95 text-red-950 dark:border-red-800/50 dark:bg-red-950/50 dark:text-red-50">
              <AlertTitle id="concessive-dialog-title">Período concessivo</AlertTitle>
              <AlertDescription className="mt-2 text-[15px] leading-relaxed text-red-900 dark:text-red-100">
                {concessiveError}
              </AlertDescription>
            </Alert>
            <p className="mt-4 text-sm text-[#64748b] dark:text-slate-400">
              Escolha datas de gozo dentro da janela indicada (12 meses após o fim do período aquisitivo correspondente ao
              saldo utilizado).
            </p>
            <div className="mt-5 flex justify-end">
              <Button type="button" size="sm" onClick={() => setShowConcessiveDialog(false)}>
                Entendi
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* REGRAS */}
      <section className="rounded-lg border border-[#e2e8f0] bg-[#f5f6f8] p-6 dark:border-[#252a35] dark:bg-[#0f1117]">
        <h2 className="mb-4 text-xl font-bold text-[#1a1d23] dark:text-white">
          Regras CLT
        </h2>

        <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-[#475569] marker:text-blue-500 dark:text-slate-300">
          {[
            isBusinessDaysRole ? "Cada período: 5–22 dias úteis" : "Cada período: 5–30 dias corridos",
            isBusinessDaysRole
              ? "Limite para gerente/diretor: 22 dias úteis por ciclo (segunda a sexta)"
              : "Um período de 14+ dias (ou já ter no ciclo)",
            "Início não pode ser sexta nem sábado; término não pode ser sábado nem domingo",
            "Aviso prévio mínimo de 30 dias",
            isBusinessDaysRole
              ? "Dias úteis consideram apenas segunda a sexta (sem sábado/domingo)"
              : existingDaysInCycle > 0
                ? `Máximo de 3 períodos; total na janela de saldo até ${balance?.entitledDays ?? 30} dias (você já tem ${existingDaysInCycle} utilizados ou pendentes)`
                : `Máximo de 3 períodos, até ${balance?.entitledDays ?? 30} dias na janela de saldo`,
            isPreEntitlement
              ? "Pré-agendamento: permitido se o início das férias for após completar 12 meses de empresa"
              : null,
            concessiveContext
              ? "Gozo dentro do período concessivo: até 12 meses após o fim de cada período aquisitivo (validado automaticamente)"
              : null,
          ].map((rule, i) => (
            rule ? <li key={i}>{rule}</li> : null
          ))}
        </ul>
        {requireExact30WhenNoAbono && selectedDays !== 30 && selectedDays > 0 && (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-900 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-50">
            Pela CLT, a sua solicitação precisa totalizar <strong>30 dias</strong> (pode fracionar em até 3 períodos).
            Atualmente você selecionou <strong>{selectedDays}</strong> dia(s). Para continuar, selecione mais <strong>{Math.max(0, 30 - selectedDays)}</strong> dia(s).
          </p>
        )}
        {isPreEntitlement && entitlementLabel && (
          <p className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900 dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-200">
            Seu 1º período aquisitivo completa em {entitlementLabel}. Você pode solicitar agora, mas o início das férias deve ser a partir dessa data.
          </p>
        )}
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
          isBusinessDaysRole={isBusinessDaysRole}
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
              isBusinessDaysRole={isBusinessDaysRole}
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
              isBusinessDaysRole={isBusinessDaysRole}
            />
          </div>
        </details>

        {/* Botão Limpar — discreto, abaixo do 3° período */}
        <div className="flex justify-start">
          <button
            type="button"
            onClick={resetForm}
            disabled={isPending || submitting}
            className="text-sm text-[#94a3b8] underline-offset-2 hover:text-[#475569] hover:underline disabled:opacity-40 dark:text-slate-500 dark:hover:text-slate-300"
          >
            Limpar formulário
          </button>
        </div>
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
          className="w-full rounded-md border border-[#e2e8f0] bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#1a1d23] dark:text-white"
        />

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
                      {isBusinessDaysRole ? `${p.businessDays} dias úteis` : `${p.days} dias`}
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
              {selectedDays} {isBusinessDaysRole ? "dias úteis" : "dias"}
            </span>
          </div>
        </section>
      )}

      {/* BOTÕES */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={isPending || submitting}
          className="min-h-[56px] w-full sm:w-40"
          onClick={resetForm}
        >
          Limpar formulário
        </Button>

        <button
          type="submit"
          disabled={
            isPending ||
            submitting ||
            !periods[0].start ||
            !periods[0].end ||
            selectedDays <= 0 ||
            !totalOk ||
            needsPeriod14 ||
            !cycleTotalOk ||
            !!concessiveError
          }
          className="flex min-h-[56px] w-full flex-1 items-center justify-center gap-2 rounded-md bg-blue-600 text-xl font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending || submitting ? "Enviando..." : "Enviar solicitação"}
        </button>
      </div>

      {concessiveError && !showConcessiveDialog && (
        <div className="flex justify-center">
          <button
            type="button"
            className="text-sm font-medium text-red-600 underline underline-offset-2 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            onClick={() => setShowConcessiveDialog(true)}
          >
            Ver aviso do período concessivo
          </button>
        </div>
      )}
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
    isBusinessDaysRole,
  }: {
    index: number;
    label?: string;
    required?: boolean;
    period: Period;
    stat: { days: number; businessDays: number; isValid: boolean; range: { start: string; end: string } | null };
    onChange: (field: "start" | "end", value: string) => void;
    isBusinessDaysRole: boolean;
  }) {
    return (
      <div className="space-y-2">
        {label && (
          <p className="text-base font-semibold text-[#1a1d23] dark:text-white">
            {label} {required && <span className="text-red-500">*</span>}
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-base font-medium text-[#475569] dark:text-slate-300">
              Início
            </label>
            <DatePicker
              value={period.start ? parseYmdLocal(period.start) : undefined}
              onChange={(d) => onChange("start", d ? formatYmdLocal(d) : "")}
              placeholder="Selecionar início"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-base font-medium text-[#475569] dark:text-slate-300">
              Término
            </label>
            <DatePicker
              value={period.end ? parseYmdLocal(period.end) : undefined}
              onChange={(d) => onChange("end", d ? formatYmdLocal(d) : "")}
              placeholder="Selecionar término"
            />
          </div>
        </div>
        {stat.days > 0 && (
          <div className="flex items-center justify-between rounded-md bg-[#f5f6f8] px-3 py-2 dark:bg-[#0f1117]">
            <span className="text-base font-medium text-[#64748b] dark:text-slate-400">Duração</span>
            <span
              className={`text-base font-bold ${stat.isValid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                }`}
            >
              {isBusinessDaysRole
                ? `${stat.businessDays} ${stat.businessDays === 1 ? "dia útil" : "dias úteis"}`
                : `${stat.days} ${stat.days === 1 ? "dia" : "dias"}`}
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
      if (!p.start || !p.end) return { days: 0, businessDays: 0, isValid: false, range: null };

      const start = new Date(p.start + "T00:00:00");
      const end = new Date(p.end + "T00:00:00");

      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
        return { days: 0, businessDays: 0, isValid: false, range: null };
      }

      const days = Math.round((end.getTime() - start.getTime()) / ONE_DAY_MS) + 1;
      let businessDays = 0;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const weekday = d.getDay();
        if (weekday !== 0 && weekday !== 6) businessDays += 1;
      }
      return {
        days,
        businessDays,
        isValid: isBusinessDaysRole ? businessDays >= 5 && businessDays <= 22 : days >= 5 && days <= 30,
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
      totalBusinessDays: periodStats.reduce((sum, p) => sum + p.businessDays, 0),
    };
  }

}