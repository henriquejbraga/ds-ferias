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
  const [error, setError] = useState<string | null>(null); // mantido só para lógica interna, não exibido
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [localToast, setLocalToast] = useState(false);

  useEffect(() => {
    if (!localToast) return;
    const id = setTimeout(() => setLocalToast(false), 4000);
    return () => clearTimeout(id);
  }, [localToast]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || isPending) return;

    setError(null);

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
      toast.error(msg, { duration: 8000 });
      setSubmitting(false);
      return;
    }

    const okMsg = "Solicitação de férias criada com sucesso.";
    toast.success(okMsg, { duration: 8000 });
    setStartDate("");
    setEndDate("");

    startTransition(() => {
      router.refresh();
      setSubmitting(false);
    });
  }

  return (
    <form
      className="space-y-5 rounded-2xl border border-white/10 bg-card/95 p-5 text-base shadow-lg shadow-black/20"
      onSubmit={handleSubmit}
    >
      <p className="text-sm font-medium text-muted-foreground">
        Informe o período desejado de férias. As regras de CLT (SP) são
        validadas automaticamente pelo sistema.
      </p>

      {/* Erros agora aparecem apenas via toast do Sonner */}
      <div className="space-y-3">
        <label className="block text-base font-semibold text-primary-foreground">
          Período de férias
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1 space-y-2">
            <span className="block text-sm font-semibold text-muted-foreground">
              Início
            </span>
            <input
              type="date"
              name="startDate"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-input bg-background/80 px-3 py-3 text-base text-foreground outline-none ring-0 transition focus:border-primary focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="flex-1 space-y-2">
            <span className="block text-sm font-semibold text-muted-foreground">
              Término
            </span>
            <input
              type="date"
              name="endDate"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-input bg-background/80 px-3 py-3 text-base text-foreground outline-none ring-0 transition focus:border-primary focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
      </div>

      <Button
        type="submit"
        className="mt-3 h-11 w-full text-base font-semibold"
        disabled={isPending || submitting}
      >
        {isPending || submitting ? "Enviando..." : "Solicitar férias"}
      </Button>
    </form>
  );
}

