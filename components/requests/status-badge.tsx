import { getRoleLabel } from "@/lib/vacationRules";

type ChipColor = "amber" | "green" | "red" | "blue" | "indigo" | "purple" | "slate";

const chipStyles: Record<ChipColor, string> = {
  amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/50",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50",
  red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/50",
  blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/50",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800/50",
  purple: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800/50",
  slate: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
};

export function StatusChip({ color, label }: { color: ChipColor; label: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-semibold ${chipStyles[color]}`}>
      {label}
    </span>
  );
}

export function StatusBadge({
  status,
  approvedByRole,
}: {
  status: string;
  approvedByRole?: string | null;
}) {
  if (status === "APROVADO_COORDENADOR" || status === "APROVADO_GESTOR") {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusChip color="indigo" label="Aprovado Coord." />
        <StatusChip color="amber" label="Pend. líder direto" />
      </div>
    );
  }
  if (status === "APROVADO_GERENTE") {
    if (approvedByRole === "COORDENADOR" || approvedByRole === "GESTOR") {
      return <StatusChip color="green" label="Aprovado Coordenador" />;
    }
    if (approvedByRole === "GERENTE") {
      return <StatusChip color="green" label="Aprovado Gerente" />;
    }
    if (approvedByRole === "DIRETOR") {
      return <StatusChip color="green" label="Aprovado Diretor" />;
    }
    return <StatusChip color="green" label="Aprovado" />;
  }
  const config: Record<string, { color: ChipColor; label: string }> = {
    PENDENTE: { color: "amber", label: "Pendente aprovação" },
    REPROVADO: { color: "red", label: "Reprovado" },
    CANCELADO: { color: "slate", label: "Cancelado" },
  };
  const c = config[status] ?? { color: "slate" as ChipColor, label: status.replace(/_/g, " ") };
  return <StatusChip color={c.color} label={c.label} />;
}

export function RoleChip({ role }: { role: string }) {
  const colors: Record<string, string> = {
    FUNCIONARIO: "bg-blue-50 text-blue-600",
    COLABORADOR: "bg-blue-50 text-blue-600",
    COORDENADOR: "bg-indigo-50 text-indigo-600",
    GESTOR: "bg-indigo-50 text-indigo-600",
    GERENTE: "bg-purple-50 text-purple-600",
    RH: "bg-emerald-50 text-emerald-600",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors[role] ?? "bg-slate-100 text-slate-600"}`}>
      {getRoleLabel(role)}
    </span>
  );
}
