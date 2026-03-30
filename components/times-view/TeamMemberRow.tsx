"use client";

import type { TeamMemberInfoSerialized } from "./types";
import { TeamMemberStatusBadge } from "./TeamMemberStatusBadge";

export function TeamMemberRow({
  member,
  compact = false,
}: {
  member: TeamMemberInfoSerialized;
  compact?: boolean;
}) {
  const { user } = member;

  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white p-1.5 dark:border-[#252a35] dark:bg-[#1a1d23] shadow-sm">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <span className="truncate text-[10px] font-black uppercase tracking-tight text-[#1a1d23] dark:text-white">{user.name}</span>
        <div className="ml-auto shrink-0 scale-75 origin-right">
          <TeamMemberStatusBadge member={member} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#e2e8f0] bg-white p-3 shadow-sm transition-all hover:shadow-md dark:border-[#252a35] dark:bg-[#1a1d23]">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-600 dark:bg-slate-700 dark:text-slate-300 shadow-inner">
        {user.name.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black uppercase tracking-tight text-[#1a1d23] dark:text-white">
          {user.name}
        </span>
      </div>
      <div className="shrink-0">
        <TeamMemberStatusBadge member={member} />
      </div>
    </div>
  );
}
