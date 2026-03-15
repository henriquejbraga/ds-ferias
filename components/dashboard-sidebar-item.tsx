"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDashboardNav } from "@/components/dashboard-nav-provider";

type Props = {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
  badgeAlert?: boolean;
};

export function DashboardSidebarItem({
  href,
  icon,
  label,
  active = false,
  badge,
  badgeAlert = false,
}: Props) {
  const router = useRouter();
  const nav = useDashboardNav();

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    const target = e.currentTarget;
    if (!target.href) return;
    try {
      const url = new URL(target.href);
      if (window.location.pathname === url.pathname && window.location.search === url.search) return;
    } catch {
      return;
    }
    e.preventDefault();
    nav?.startNavigation();
    router.push(href);
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={`flex min-h-[44px] items-center gap-2 rounded-md px-3 py-2 text-base font-medium transition-colors sm:min-h-0 sm:gap-3 ${
        active
          ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
          : "text-[#64748b] hover:bg-[#f5f6f8] hover:text-[#1a1d23] dark:text-slate-400 dark:hover:bg-[#1e2330] dark:hover:text-white"
      }`}
    >
      <span className="h-4 w-4 shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge !== undefined && (
        <span
          className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-sm font-bold ${
            badgeAlert ? "bg-red-500 text-white" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
          }`}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
