import Link from "next/link";

const VIEW_LABELS: Record<string, string> = {
  minhas: "Minhas Férias",
  inbox: "Caixa de entrada",
  historico: "Histórico",
  times: "Times",
};

export function DashboardBreadcrumb({ currentView }: { currentView: string }) {
  const label = VIEW_LABELS[currentView] ?? "Dashboard";
  return (
    <nav aria-label="Navegação" className="mb-2 text-sm">
      <ol className="flex flex-wrap items-center gap-1.5 text-[#64748b] dark:text-slate-400">
        <li>
          <Link
            href="/dashboard"
            className="hover:text-[#1a1d23] hover:underline focus:rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:text-white"
          >
            Dashboard
          </Link>
        </li>
        <li aria-hidden className="select-none">/</li>
        <li className="font-medium text-[#1a1d23] dark:text-white" aria-current="page">
          {label}
        </li>
      </ol>
    </nav>
  );
}
