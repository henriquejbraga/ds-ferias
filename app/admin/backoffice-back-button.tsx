"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function BackofficeBackButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (isPending) return;
    startTransition(() => {
      router.push("/dashboard");
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isPending ? "Voltando para o dashboard" : "Voltar ao dashboard"}
      aria-busy={isPending}
      className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-md border border-transparent px-2 py-1 text-sm font-medium text-[#64748b] transition hover:border-[#e2e8f0] hover:bg-[#f5f6f8] hover:text-[#1a1d23] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 dark:text-slate-300 dark:hover:border-[#252a35] dark:hover:bg-[#111827] dark:hover:text-white"
      disabled={isPending}
    >
      {isPending ? "Voltando..." : "← Voltar"}
    </button>
  );
}

