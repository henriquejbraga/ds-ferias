"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type DashboardNavContextValue = {
  startNavigation: () => void;
};

const DashboardNavContext = createContext<DashboardNavContextValue | null>(null);

export function useDashboardNav() {
  const ctx = useContext(DashboardNavContext);
  return ctx;
}

export function DashboardNavProvider({ children }: { children: React.ReactNode }) {
  const [isNavigating, setIsNavigating] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const startNavigation = useCallback(() => {
    setIsNavigating(true);
  }, []);

  useEffect(() => {
    setIsNavigating(false);
  }, [pathname, searchParams]);

  return (
    <DashboardNavContext.Provider value={{ startNavigation }}>
      {children}
      {isNavigating && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#f5f6f8]/90 dark:bg-[#0f1117]/90"
          aria-hidden="true"
        >
          <div className="flex flex-col items-center gap-3 rounded-xl border border-[#e2e8f0] bg-white px-8 py-6 shadow-lg dark:border-[#252a35] dark:bg-[#1a1d23]">
            <svg
              className="h-10 w-10 animate-spin text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm font-semibold text-[#1a1d23] dark:text-white">Carregando...</p>
          </div>
        </div>
      )}
    </DashboardNavContext.Provider>
  );
}
