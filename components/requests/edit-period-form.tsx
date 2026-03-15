"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type RequestLike = { id: string; startDate: Date | string; endDate: Date | string };

export function EditPeriodFormClient({ request }: { request: RequestLike }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const startDefault = new Date(request.startDate).toISOString().split("T")[0];
  const endDefault = new Date(request.endDate).toISOString().split("T")[0];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    const startDate = formData.get("startDate") as string;
    const endDate = formData.get("endDate") as string;
    if (!startDate || !endDate) {
      toast.error("Preencha início e término.");
      return;
    }

    setIsPending(true);
    try {
      const res = await fetch(`/api/vacation-requests/${request.id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(data?.error ?? "Não foi possível atualizar o período.");
      } else {
        toast.success("Período atualizado.");
        router.refresh();
      }
    } catch {
      toast.error("Erro de rede. Tente novamente.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <details className="w-full">
      <summary className="flex min-h-[44px] cursor-pointer items-center justify-between rounded-md border border-[#e2e8f0] bg-[#f5f6f8] px-3 py-2 text-sm font-semibold text-[#475569] hover:bg-[#e2e8f0] dark:border-[#252a35] dark:bg-[#1e2330] dark:text-slate-300 hover:dark:bg-[#252a35]">
        <span className="flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Editar período
        </span>
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <form
        onSubmit={handleSubmit}
        className="mt-3 space-y-3 rounded-md border border-[#e2e8f0] bg-[#f5f6f8] p-4 dark:border-[#252a35] dark:bg-[#0f1117]"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`edit-start-${request.id}`} className="mb-1 block text-sm font-medium text-[#475569] dark:text-slate-400">
              Início
            </label>
            <input
              id={`edit-start-${request.id}`}
              type="date"
              name="startDate"
              required
              defaultValue={startDefault}
              disabled={isPending}
              className="min-h-[44px] w-full rounded-md border border-[#e2e8f0] bg-white px-3 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#1a1d23] dark:text-white"
              aria-describedby={`edit-start-desc-${request.id}`}
            />
            <span id={`edit-start-desc-${request.id}`} className="sr-only">Data de início do período de férias</span>
          </div>
          <div>
            <label htmlFor={`edit-end-${request.id}`} className="mb-1 block text-sm font-medium text-[#475569] dark:text-slate-400">
              Término
            </label>
            <input
              id={`edit-end-${request.id}`}
              type="date"
              name="endDate"
              required
              defaultValue={endDefault}
              disabled={isPending}
              className="min-h-[44px] w-full rounded-md border border-[#e2e8f0] bg-white px-3 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#1a1d23] dark:text-white"
              aria-describedby={`edit-end-desc-${request.id}`}
            />
            <span id={`edit-end-desc-${request.id}`} className="sr-only">Data de término do período de férias</span>
          </div>
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={isPending}
          className="min-h-[44px] w-full bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
      </form>
    </details>
  );
}
