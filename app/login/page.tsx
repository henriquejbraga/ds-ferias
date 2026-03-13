"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "Erro ao fazer login");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Padrão decorativo de fundo */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-4 top-0 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl dark:bg-blue-600/20"></div>
        <div className="absolute -right-4 bottom-0 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-600/20"></div>
      </div>

      {/* Toggle de tema */}
      <div className="absolute right-6 top-6 z-10">
        <ThemeToggle />
      </div>

      {/* Container principal */}
      <div className="relative z-10 w-full max-w-md space-y-8 px-6">
        {/* Logo e título */}
        <div className="flex flex-col items-center space-y-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-2xl shadow-blue-500/40 ring-4 ring-blue-500/20 dark:ring-blue-400/10">
            <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              DS-Férias
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Gerencie suas solicitações de férias de forma simples
            </p>
          </div>
        </div>

        {/* Card de login */}
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-8 shadow-xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Campo de e-mail */}
            <div className="space-y-2">
              <label 
                htmlFor="email" 
                className="block text-sm font-semibold text-slate-900 dark:text-white"
              >
                E-mail corporativo
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/10"
                  placeholder="seu.nome@empresa.com"
                />
              </div>
            </div>

            {/* Campo de senha */}
            <div className="space-y-2">
              <label 
                htmlFor="password" 
                className="block text-sm font-semibold text-slate-900 dark:text-white"
              >
                Senha
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/10"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Botão de login */}
            <Button
              type="submit"
              className="h-12 w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-base font-semibold text-white shadow-lg shadow-blue-500/30 transition-all hover:from-blue-600 hover:to-indigo-700 hover:shadow-xl hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed dark:shadow-blue-500/20 dark:hover:shadow-blue-500/30"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Entrando...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Entrar
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
              )}
            </Button>
          </form>
        </div>

        {/* Informação adicional */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-blue-50/50 p-4 dark:border-slate-800 dark:bg-blue-950/20">
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-500/20">
                <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Precisa de ajuda?
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Entre em contato com o RH para criação de usuário ou recuperação de senha
                </p>
              </div>
            </div>
          </div>

          {/* Credenciais de teste (remover em produção) */}
          <details className="group rounded-xl border border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
            <summary className="flex cursor-pointer items-center justify-between p-4 text-sm font-medium text-slate-700 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Usuários de teste
              </span>
              <svg className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="space-y-3 border-t border-slate-200 p-4 dark:border-slate-700">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">COLABORADOR1</p>
                <p className="font-mono text-xs text-slate-700 dark:text-slate-300">
                  colaborador1@empresa.com
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">GESTOR1</p>
                <p className="font-mono text-xs text-slate-700 dark:text-slate-300">
                  gestor1@empresa.com
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">RH1</p>
                <p className="font-mono text-xs text-slate-700 dark:text-slate-300">
                  rh1@empresa.com
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">COLABORADOR2</p>
                <p className="font-mono text-xs text-slate-700 dark:text-slate-300">
                  colaborador2@empresa.com
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">GESTOR2</p>
                <p className="font-mono text-xs text-slate-700 dark:text-slate-300">
                  gestor2@empresa.com
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">RH2</p>
                <p className="font-mono text-xs text-slate-700 dark:text-slate-300">
                  rh2@empresa.com
                </p>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Senha padrão: senha123
              </p>
            </div>
          </details>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-500 dark:text-slate-500">
          © 2026 DS-Férias. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}