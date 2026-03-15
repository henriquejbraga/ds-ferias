type BlackoutLike = { startDate: Date | string; endDate: Date | string; reason: string };

export function BlackoutAlert({ blackouts }: { blackouts: BlackoutLike[] }) {
  const active = blackouts.filter((b) => new Date(b.endDate) >= new Date());
  if (!active.length) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-950/20">
      <div className="flex items-start gap-2">
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            Períodos bloqueados pela empresa
          </p>
          {active.slice(0, 2).map((b, i) => (
            <p key={i} className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              {new Date(b.startDate).toLocaleDateString("pt-BR")} – {new Date(b.endDate).toLocaleDateString("pt-BR")}: {b.reason}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
