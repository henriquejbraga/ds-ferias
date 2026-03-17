import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getRoleLevel } from "@/lib/vacationRules";
import { findAllUsersForAdmin, findManagersForAdmin } from "@/repositories/userRepository";
import Link from "next/link";
import { BackofficeClient } from "./backoffice-client";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (getRoleLevel(user.role) < 4) redirect("/dashboard");

  const [users, managers] = await Promise.all([
    findAllUsersForAdmin(),
    findManagersForAdmin(),
  ]);

  return (
    <div className="min-h-screen bg-[#f5f6f8] dark:bg-[#0f1117]">
      <header className="border-b border-[#e2e8f0] bg-white dark:border-[#252a35] dark:bg-[#1a1d23]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-md border border-transparent px-2 py-1 text-sm font-medium text-[#64748b] transition hover:border-[#e2e8f0] hover:bg-[#f5f6f8] hover:text-[#1a1d23] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:text-slate-300 dark:hover:border-[#252a35] dark:hover:bg-[#111827] dark:hover:text-white"
              aria-label="Voltar ao dashboard"
            >
              ← Voltar
            </Link>
            <h1 className="text-xl font-bold text-[#1a1d23] dark:text-white">Backoffice · Usuários</h1>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8" tabIndex={-1}>
        <BackofficeClient users={users} managers={managers} />
      </main>
    </div>
  );
}
