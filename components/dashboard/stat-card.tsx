export function StatCard({
  label,
  value,
  sublabel,
  alert = false,
}: {
  label: string;
  value: number;
  sublabel: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white p-5 dark:border-[#252a35] dark:bg-[#1a1d23]">
      <p className="text-sm font-medium uppercase tracking-wide text-[#64748b] dark:text-slate-400">{label}</p>
      <p
        className={`mt-1 text-3xl font-bold ${
          alert && value > 0 ? "text-red-500" : "text-[#1a1d23] dark:text-white"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-sm text-[#64748b] dark:text-slate-500">{sublabel}</p>
    </div>
  );
}
