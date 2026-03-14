import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getRoleLevel } from "@/lib/vacationRules";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { BackofficeClient } from "./backoffice-client";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (getRoleLevel(user.role) < 4) redirect("/dashboard");

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      hireDate: true,
      managerId: true,
      manager: { select: { id: true, name: true } },
      _count: { select: { reports: true } },
    },
  });

  const managers = await prisma.user.findMany({
    where: { role: { in: ["COORDENADOR", "GERENTE", "GESTOR"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen bg-[#f5f6f8] dark:bg-[#0f1117]">
      <header className="border-b border-[#e2e8f0] bg-white dark:border-[#252a35] dark:bg-[#1a1d23]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-[#64748b] transition hover:text-[#1a1d23] dark:hover:text-white"
            >
              ← Voltar
            </Link>
            <h1 className="text-xl font-bold text-[#1a1d23] dark:text-white">Backoffice · Usuários</h1>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <BackofficeClient users={users} managers={managers} />
      </main>
    </div>
  );
}
