"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type Props = {
  action: string;
  method?: "post" | "get";
  label: string;
  loadingLabel?: string;
  /** Mensagem de sucesso no toast (ex.: "Solicitação aprovada") */
  successMessage?: string;
  /** Mensagem de confirmação antes de executar a ação (opcional) */
  confirmMessage?: string;
  /** Segunda confirmação em sequência (ex.: exclusão irreversível) */
  secondConfirmMessage?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
};

function toggleGlobalLoading(active: boolean) {
  if (typeof document === "undefined") return;
  const id = "ds-ferias-global-loading";
  let el = document.getElementById(id);

  if (active) {
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      el.style.position = "fixed";
      el.style.inset = "0";
      el.style.zIndex = "9999";
      el.style.background = "rgba(15,17,23,0.35)";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.backdropFilter = "blur(2px)";
      el.innerHTML = `
        <div style="padding:16px 20px;border-radius:999px;background:#0f172a;border:1px solid rgba(148,163,184,0.4);display:flex;align-items:center;gap:8px;color:white;font-size:14px;font-weight:600;box-shadow:0 10px 30px rgba(15,23,42,0.6);">
          <svg style="width:18px;height:18px;animation:ds-spinner 0.8s linear infinite;" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="9" stroke="rgba(148,163,184,0.5)" stroke-width="3" />
            <path d="M21 12a9 9 0 00-9-9" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" />
          </svg>
          Processando, aguarde...
        </div>
        <style>
          @keyframes ds-spinner { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        </style>
      `;
      document.body.appendChild(el);
    }
  } else if (el) {
    el.remove();
  }
}

export function ActionButtonForm({
  action,
  method = "post",
  label,
  loadingLabel,
  successMessage,
  confirmMessage,
  secondConfirmMessage,
  variant = "outline",
  size = "xs",
  className,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<boolean>(false);

  function handleClick() {
    if (isPending) return;

    if (confirmMessage && typeof window !== "undefined") {
      const ok = window.confirm(confirmMessage);
      if (!ok) return;
    }
    if (secondConfirmMessage && typeof window !== "undefined") {
      const ok2 = window.confirm(secondConfirmMessage);
      if (!ok2) return;
    }

    toggleGlobalLoading(true);

    startTransition(async () => {
      const upperMethod = method.toUpperCase();

      async function doRequest(body?: unknown) {
        const res = await fetch(action, {
          method: upperMethod,
          headers: {
            "Content-Type": "application/json",
          },
          body: upperMethod === "POST" ? JSON.stringify(body ?? {}) : undefined,
        });
        const data = await res.json().catch(() => null);
        return { res, data };
      }

      try {
        // Primeira tentativa
        let { res, data } = await doRequest();

        if (!res.ok && data?.requiresConfirmation && typeof data.error === "string") {
          // Guarda mensagem e espera o usuário decidir no modal
          setConflictMessage(data.error);
          setPendingConfirm(true);
          toggleGlobalLoading(false);
          return;
        }

        if (!res.ok) {
          toast.error(data?.error ?? "Não foi possível concluir esta ação.");
        } else {
          toast.success(successMessage ?? "Ação realizada com sucesso.");
          if (typeof data?.cltWarning === "string") {
            toast.warning(data.cltWarning, { duration: 8000 });
          }
        }
      } catch {
        toast.error("Erro de rede ao comunicar com o servidor.");
      } finally {
        if (!pendingConfirm) {
          toggleGlobalLoading(false);
        }
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        onClick={handleClick}
        variant={variant}
        size={size}
        disabled={isPending}
        className={cn("inline-flex items-center gap-1", className)}
      >
        {isPending ? loadingLabel ?? label : label}
      </Button>

      {conflictMessage && pendingConfirm && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-2xl dark:bg-[#020617]">
            <Alert className="mb-4 border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-400/40 dark:bg-amber-950/40 dark:text-amber-100">
              <AlertTitle>Conflito de férias no time</AlertTitle>
              <AlertDescription>{conflictMessage}</AlertDescription>
            </Alert>
            <div className="mt-3 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setPendingConfirm(false);
                  setConflictMessage(null);
                }}
              >
                Voltar
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400"
                onClick={() => {
                  setPendingConfirm(false);
                  toggleGlobalLoading(true);
                  startTransition(async () => {
                    try {
                      const upperMethod = method.toUpperCase();
                      const res = await fetch(action, {
                        method: upperMethod,
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body:
                          upperMethod === "POST"
                            ? JSON.stringify({ confirmConflict: true })
                            : undefined,
                      });
                      const data = await res.json().catch(() => null);

                      if (!res.ok) {
                        toast.error(data?.error ?? "Não foi possível concluir esta ação.");
                      } else {
                        toast.success(successMessage ?? "Ação realizada com sucesso.");
                      }
                    } catch {
                      toast.error("Erro de rede ao comunicar com o servidor.");
                    } finally {
                      toggleGlobalLoading(false);
                      router.refresh();
                    }
                  });
                }}
              >
                Aprovar assim mesmo
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


