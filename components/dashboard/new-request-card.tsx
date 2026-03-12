"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Props = {
  canRequest: boolean;
};

export function NewRequestCardClient({ canRequest }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  if (!canRequest) {
    return (
      <div className="space-y-3 rounded-2xl border border-white/10 bg-card/90 p-4 text-sm text-muted-foreground">
        <p>
          Apenas colaboradores podem abrir novas solicitações de férias. Use a
          visão geral ao lado para aprovar ou reprovar pedidos.
        </p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || isPending) return;

    setError(null);
    setSuccess(null);
    setToast(null);

    setSubmitting(true);

    const res = await fetch("/api/vacation-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ startDate, endDate }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg = data?.error ?? "Não foi possível solicitar férias.";
      setError(msg);
      setToast({ type: "error", message: msg });
      setSubmitting(false);
      return;
    }

    const okMsg = "Solicitação de férias criada com sucesso.";
    setSuccess(okMsg);
    setToast({ type: "success", message: okMsg });
    setStartDate("");
    setEndDate("");

    startTransition(() => {
      router.refresh();
      setSubmitting(false);
    });
  }

  return (
    <>
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <div
            className={`pointer-events-auto max-w-md rounded-2xl border px-4 py-3 shadow-lg shadow-black/30 backdrop-blur-md ${
              toast.type === "success"
                ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-50"
                : "border-destructive/70 bg-destructive/15 text-destructive"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide">
              {toast.type === "success" ? "Tudo certo" : "Algo deu errado"}
            </p>
            <p className="mt-1 text-sm">{toast.message}</p>
          </div>
        </div>
      )}

    <form
      className="space-y-4 rounded-2xl border border-white/10 bg-card/95 p-4 text-sm shadow-lg shadow-black/20"
      onSubmit={handleSubmit}
    >
      <p className="text-xs text-muted-foreground">
        Informe o período desejado de férias. As regras de CLT (SP) são
        validadas automaticamente pelo sistema.
      </p>

      {error && !toast && (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível solicitar férias</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <label className="block text-xs font-medium text-primary-foreground">
          Período de férias
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1 space-y-1">
            <span className="block text-[11px] text-muted-foreground">
              Início
            </span>
            <input
              type="date"
              name="startDate"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-input bg-background/80 px-3 py-2 text-sm text-foreground outline-none ring-0 transition focus:border-primary focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="flex-1 space-y-1">
            <span className="block text-[11px] text-muted-foreground">
              Término
            </span>
            <input
              type="date"
              name="endDate"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-input bg-background/80 px-3 py-2 text-sm text-foreground outline-none ring-0 transition focus:border-primary focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
      </div>

      <Button
        type="submit"
        className="mt-2 h-9 w-full text-sm font-semibold"
        disabled={isPending || submitting}
      >
        {isPending || submitting ? "Enviando..." : "Solicitar férias"}
      </Button>
    </form>
    </>
  );
}

