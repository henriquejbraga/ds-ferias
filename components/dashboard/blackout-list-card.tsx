type BlackoutLike = {
  id: string;
  startDate: Date | string;
  endDate: Date | string;
  reason: string;
  department?: string | null;
};

export function BlackoutListCard({ blackouts }: { blackouts: BlackoutLike[] }) {
  const active = blackouts.filter((b) => new Date(b.endDate) >= new Date());
  if (!active.length) return null;

  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white dark:border-[#252a35] dark:bg-[#1a1d23]">
      <div className="border-b border-[#e2e8f0] px-5 py-3 dark:border-[#252a35]">
        <h4 className="text-sm font-semibold text-[#1a1d23] dark:text-white">Períodos bloqueados</h4>
        <p className="mt-0.5 text-xs text-[#64748b] dark:text-slate-400">
          Datas em que a empresa não permite férias (ex.: fechamento, auditoria)
        </p>
      </div>
      <div className="divide-y divide-[#f1f5f9] dark:divide-[#252a35]">
        {active.map((b) => (
          <div key={b.id} className="px-4 py-3">
            <p className="text-sm font-medium text-[#1a1d23] dark:text-white">{b.reason}</p>
            <p className="mt-0.5 text-[10px] text-[#64748b] dark:text-slate-400">
              {new Date(b.startDate).toLocaleDateString("pt-BR")} – {new Date(b.endDate).toLocaleDateString("pt-BR")}
              {b.department ? ` · ${b.department}` : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
