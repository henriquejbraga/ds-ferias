import { redirect } from "next/navigation";
import { getSessionUser, shouldForcePasswordChange } from "@/lib/auth";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!shouldForcePasswordChange(user)) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f6f8] dark:bg-[#0f1117]">
      <div className="flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-md">
          <h1 className="text-2xl font-bold text-[#1a1d23] dark:text-white">Trocar senha</h1>
          <p className="mt-1 text-base text-[#64748b] dark:text-slate-400">
            Sua senha inicial precisa ser alterada para continuar usando o sistema.
          </p>

          <div className="mt-6 rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-lg dark:border-[#252a35] dark:bg-[#1a1d23]">
            <ChangePasswordForm />
          </div>
        </div>
      </div>
    </div>
  );
}

