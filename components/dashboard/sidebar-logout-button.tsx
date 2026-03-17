"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconLogout } from "@/components/layout/icons";

export function SidebarLogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (isPending) return;

    startTransition(async () => {
      try {
        await fetch("/api/logout", { method: "POST", headers: { "Content-Type": "application/json" } });
      } catch {
        // mesmo em caso de erro, tenta mandar para a tela de login
      } finally {
        router.push("/login");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isPending ? "Saindo da conta" : "Sair da conta"}
      aria-busy={isPending}
      className="inline-flex items-center gap-1.5 rounded-md border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-100 hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-inset disabled:cursor-not-allowed disabled:opacity-70 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-900/40"
      disabled={isPending}
    >
      <span className="inline-flex h-3.5 w-3.5 items-center justify-center">
        {isPending ? (
          <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
        ) : (
          <IconLogout />
        )}
      </span>
      <span>{isPending ? "Saindo..." : "Sair"}</span>
    </button>
  );
}

