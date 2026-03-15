"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "Erro ao fazer login");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      // Loading permanece ativo até a troca de tela
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#f5f6f8] dark:bg-[#0f1117]">
      {/* Painel esquerdo — decorativo */}
      <div className="hidden w-1/2 flex-col justify-between bg-blue-600 p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-lg font-bold text-white">Editora Globo - Férias</span>
        </div>

        <p className="text-xl font-medium text-white/90">Sistema de férias da Editora Globo.</p>

        <p className="text-sm text-blue-200">© 2026 Editora Globo - Férias</p>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex flex-1 flex-col">
        {/* Topbar */}
        <div className="flex items-center justify-between px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-6">
          {/* Logo só aparece no mobile */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600">
              <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-base font-bold text-[#1a1d23] dark:text-white">Editora Globo - Férias</span>
          </div>
          <ThemeToggle />
        </div>

        {/* Formulário centralizado */}
        <div className="relative flex flex-1 items-center justify-center px-4 pb-8 sm:px-6 sm:pb-12 lg:px-8 lg:pb-12">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#f5f6f8]/90 dark:bg-[#0f1117]/90" aria-hidden="true">
              <div className="flex flex-col items-center gap-3 rounded-xl border border-[#e2e8f0] bg-white px-8 py-6 shadow-lg dark:border-[#252a35] dark:bg-[#1a1d23]">
                <svg className="h-10 w-10 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm font-semibold text-[#1a1d23] dark:text-white">Entrando...</p>
                <p className="text-xs text-[#64748b] dark:text-slate-400">Aguarde o redirecionamento</p>
              </div>
            </div>
          )}
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-[#1a1d23] dark:text-white">Entrar na conta</h1>
              <p className="mt-1 text-base text-[#64748b] dark:text-slate-400">
                Use o seu e-mail corporativo para acessar.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* E-mail */}
              <div>
                <label htmlFor="email" className="mb-1.5 block text-base font-medium text-[#1a1d23] dark:text-white">
                  E-mail corporativo
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.nome@empresa.com"
                  disabled={loading}
                  className="min-h-[44px] w-full rounded-md border border-[#e2e8f0] bg-white px-3 text-base text-[#1a1d23] placeholder:text-[#94a3b8] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-70 dark:border-[#252a35] dark:bg-[#1a1d23] dark:text-white dark:placeholder:text-slate-500"
                />
              </div>

              {/* Senha */}
              <div>
                <label htmlFor="password" className="mb-1.5 block text-base font-medium text-[#1a1d23] dark:text-white">
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  className="min-h-[44px] w-full rounded-md border border-[#e2e8f0] bg-white px-3 text-base text-[#1a1d23] placeholder:text-[#94a3b8] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-70 dark:border-[#252a35] dark:bg-[#1a1d23] dark:text-white dark:placeholder:text-slate-500"
                />
              </div>

              {/* Botão */}
              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex min-h-[44px] w-full items-center justify-center rounded-md bg-blue-600 px-4 text-base font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Entrando...
                  </span>
                ) : (
                  "Entrar"
                )}
              </button>
            </form>

            <TestUsersPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

function TestUsersPanel() {
  const users = [
    { role: "Funcionária", email: "colaborador1@empresa.com" },
    { role: "Funcionária", email: "colaborador2@empresa.com" },
    { role: "Coordenador", email: "gestor1@empresa.com" },
    { role: "Coordenador", email: "gestor2@empresa.com" },
    { role: "Gerente", email: "gerente1@empresa.com" },
    { role: "Gerente", email: "gerente2@empresa.com" },
    { role: "RH / Admin", email: "rh1@empresa.com" },
    { role: "RH / Admin", email: "rh2@empresa.com" },
  ];

  return (
    <div className="mt-8 rounded-lg border border-[#e2e8f0] bg-white p-4 text-sm text-[#1a1d23] shadow-sm dark:border-[#252a35] dark:bg-[#1a1d23] dark:text-slate-100">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-base font-semibold">Usuários de teste</p>
          <p className="text-sm text-[#64748b] dark:text-slate-400">Todos usam a senha <span className="font-mono font-semibold">senha123</span>.</p>
        </div>
      </div>
      <div className="grid gap-1 text-base">
        {users.map((u) => (
          <div key={u.email} className="flex min-h-[44px] min-w-0 items-center justify-between gap-2 rounded-md px-3 py-2 hover:bg-[#f5f6f8] dark:hover:bg-[#0f1117]">
            <span className="shrink-0 text-sm font-medium text-[#475569] dark:text-slate-300">{u.role}</span>
            <span className="min-w-0 truncate font-mono text-sm sm:text-base" title={u.email}>{u.email}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
