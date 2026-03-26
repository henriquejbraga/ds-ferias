import { redirect } from "next/navigation";
import { getSessionUser, shouldForcePasswordChange } from "@/lib/auth";
import { getRoleLevel } from "@/lib/vacationRules";
import { findAllUsersForAdmin, findManagersForAdmin } from "@/repositories/userRepository";
import { BackofficeClient } from "./backoffice-client";
import { BackofficeBackButton } from "./backoffice-back-button";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (shouldForcePasswordChange(user)) redirect("/change-password");
  if (getRoleLevel(user.role) < 5) redirect("/dashboard");

  const [users, managers] = await Promise.all([
    findAllUsersForAdmin(),
    findManagersForAdmin(),
  ]);

  return (
    <div className="min-h-screen bg-[#f5f6f8] dark:bg-[#0f1117]">
      <header className="border-b border-[#e2e8f0] bg-white dark:border-[#252a35] dark:bg-[#1a1d23]">
        <div className="flex w-full items-center justify-between px-3 py-4 sm:px-4 lg:px-6 xl:px-8">
          <div className="flex items-center gap-4">
            <BackofficeBackButton />
            <h1 className="text-xl font-bold text-[#1a1d23] dark:text-white">Backoffice · Usuários</h1>
          </div>
        </div>
      </header>
      <main id="main" className="w-full px-3 py-4 pb-16 sm:px-4 sm:py-6 lg:px-6 xl:px-8" tabIndex={-1}>
        <BackofficeClient users={users} managers={managers} />
      </main>
    </div>
  );
}
