"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  action: string;
  method?: "post" | "get";
  label: string;
  loadingLabel?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
};

export function ActionButtonForm({
  action,
  method = "post",
  label,
  loadingLabel,
  variant = "outline",
  size = "xs",
  className,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (isPending) return;

    startTransition(async () => {
      try {
        const res = await fetch(action, {
          method: method.toUpperCase(),
          headers: {
            "Content-Type": "application/json",
          },
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          toast.error(
            data?.error ?? "Não foi possível concluir esta ação.",
          );
        } else {
          toast.success("Ação realizada com sucesso.");
        }
      } catch {
        toast.error("Erro de rede ao comunicar com o servidor.");
      }

      router.refresh();
    });
  }

  return (
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
  );
}


