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
    <div className="flex min-h-screen bg-[#f5f6f8] dark:bg-[#0f1117]">
      {/* Painel esquerdo — decorativo */}
      <div className="hidden w-1/2 flex-col justify-between bg-blue-600 p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-lg font-bold text-white">DS-Férias</span>
        </div>

        <div>
          <h2 className="text-3xl font-bold leading-snug text-white">
            Gestão de férias<br />simples e eficiente.
          </h2>
          <p className="mt-4 text-base text-blue-100">
            Solicitações, aprovações e histórico completo em um só lugar.
            Todas as regras CLT aplicadas automaticamente.
          </p>

          <div className="mt-10 space-y-3">
            {[
              { icon: "✓", text: "Regras CLT de São Paulo aplicadas automaticamente" },
              { icon: "✓", text: "Fluxo de aprovação Gestor → RH" },
              { icon: "✓", text: "Fracionamento em até 3 períodos" },
              { icon: "✓", text: "Histórico completo com auditoria" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold text-white">
                  {item.icon}
                </span>
                <span className="text-base text-blue-100">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-blue-200">© 2026 DS-Férias. Todos os direitos reservados.</p>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex flex-1 flex-col">
        {/* Topbar */}
        <div className="flex items-center justify-between px-8 py-6">
          {/* Logo só aparece no mobile */}
          <div className="flex items-center gap-2 lg:invisible">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600">
              <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-base font-bold text-[#1a1d23] dark:text-white">DS-Férias</span>
          </div>
          <ThemeToggle />
        </div>

        {/* Formulário centralizado */}
        <div className="flex flex-1 items-center justify-center px-8 pb-12">
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
                  className="h-10 w-full rounded-md border border-[#e2e8f0] bg-white px-3 text-base text-[#1a1d23] placeholder:text-[#94a3b8] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#1a1d23] dark:text-white dark:placeholder:text-slate-500"
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
                  className="h-10 w-full rounded-md border border-[#e2e8f0] bg-white px-3 text-base text-[#1a1d23] placeholder:text-[#94a3b8] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#1a1d23] dark:text-white dark:placeholder:text-slate-500"
                />
              </div>

              {/* Botão */}
              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex h-10 w-full items-center justify-center rounded-md bg-blue-600 px-4 text-base font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
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
          <div key={u.email} className="flex items-baseline justify-between rounded-md px-2 py-1 hover:bg-[#f5f6f8] dark:hover:bg-[#0f1117]">
            <span className="mr-3 text-sm font-medium text-[#475569] dark:text-slate-300">{u.role}</span>
            <span className="font-mono text-base">{u.email}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
