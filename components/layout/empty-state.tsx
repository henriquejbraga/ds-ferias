export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#e2e8f0] bg-white px-8 py-12 text-center dark:border-[#252a35] dark:bg-[#1a1d23]">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f6f8] dark:bg-[#252a35]">
        <svg className="h-7 w-7 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <p className="text-xl font-semibold text-[#1a1d23] dark:text-white">Nenhuma solicitação</p>
      <p className="mt-2 max-w-md text-base leading-relaxed text-[#64748b] dark:text-slate-400">{message}</p>
    </div>
  );
}
