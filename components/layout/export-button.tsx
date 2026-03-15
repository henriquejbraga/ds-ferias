export function ExportButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      download
      aria-label="Exportar relatório em CSV"
      className="inline-flex items-center gap-1.5 rounded-md border border-[#e2e8f0] bg-white px-3 py-1.5 text-sm font-semibold text-[#475569] transition hover:bg-[#f5f6f8] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-[#252a35] dark:bg-[#1a1d23] dark:text-slate-300 dark:hover:bg-[#252a35]"
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
      </svg>
      Exportar CSV
    </a>
  );
}
