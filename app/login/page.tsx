"use client";

import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import { getRoleLabel } from "@/lib/vacationRules";
import { encryptPasswordForLogin } from "@/lib/login-encrypt-password";

type LoginUserPreview = {
  name: string;
  email: string;
  role: string;
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testUsers, setTestUsers] = useState<LoginUserPreview[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  /** undefined = ainda não carregou; string = SPKI para RSA-OAEP; null = dev sem chave (senha em texto) */
  const [loginSpkiBase64Url, setLoginSpkiBase64Url] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    async function loadPublicKey() {
      try {
        const r = await fetch("/api/login/public-key", { cache: "no-store" });
        if (!active) return;
        if (r.ok) {
          const d = (await r.json().catch(() => null)) as { spkiBase64Url?: string } | null;
          setLoginSpkiBase64Url(d?.spkiBase64Url ?? null);
        } else {
          setLoginSpkiBase64Url(null);
        }
      } catch {
        if (active) setLoginSpkiBase64Url(null);
      }
    }
    void loadPublicKey();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadUsers() {
      try {
        const res = await fetch("/api/login/users", { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as { users?: LoginUserPreview[] } | null;
        if (!res.ok || !data?.users) return;
        if (active) setTestUsers(data.users);
      } finally {
        if (active) setLoadingUsers(false);
      }
    }
    void loadUsers();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      let spki = loginSpkiBase64Url;
      if (spki === undefined) {
        const r = await fetch("/api/login/public-key", { cache: "no-store" });
        spki = r.ok ? ((await r.json().catch(() => null)) as { spkiBase64Url?: string } | null)?.spkiBase64Url ?? null : null;
        setLoginSpkiBase64Url(spki);
      }

      const payload =
        spki != null && spki.length > 0
          ? { email, encryptedPassword: await encryptPasswordForLogin(spki, password) }
          : { email, password };

      const res = await fetch("/api/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "Erro ao fazer login");
        setLoading(false);
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (data.mustChangePassword) {
        window.location.assign("/change-password");
      } else {
        window.location.assign("/dashboard");
      }
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#f5f6f8] dark:bg-[#0f1117]">
      {/* Painel esquerdo — decorativo */}
      <div className="hidden w-1/2 flex-col justify-between bg-blue-600 p-12 lg:flex">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-3xl font-extrabold tracking-tight text-white">Editora Globo - Estratégia Digital</span>
            <span className="text-2xl font-semibold text-white/90">Férias</span>
          </div>
        </div>

        <p className="text-2xl font-medium text-white/90">Sistema de férias da Editora Globo - Estratégia Digital.</p>

        <p className="text-sm text-blue-200">© 2026 Editora Globo - Estratégia Digital</p>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex flex-1 flex-col">
        {/* Topbar */}
        <div className="flex items-center justify-between gap-2 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-6">
          {/* Logo só aparece no mobile */}
          <div className="flex min-w-0 flex-1 items-center gap-2 pr-2 lg:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600">
              <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="truncate text-base font-bold text-[#1a1d23] dark:text-white">Editora Globo - Férias</span>
          </div>
          <div className="ml-auto shrink-0">
            <ThemeToggle />
          </div>
        </div>

        {/* Formulário centralizado */}
        <div className="relative flex flex-1 items-start justify-center px-4 pb-8 pt-2 sm:px-6 sm:pb-12 sm:pt-4 lg:items-center lg:px-8 lg:pb-12 lg:pt-0">
          {loading && (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center bg-[#f5f6f8]/90 dark:bg-[#0f1117]/90"
              role="status"
              aria-live="polite"
              aria-label="Entrando na conta, aguarde"
            >
              <div className="flex flex-col items-center gap-3 rounded-xl border border-[#e2e8f0] bg-white px-8 py-6 shadow-lg dark:border-[#252a35] dark:bg-[#1a1d23]">
                <svg className="h-10 w-10 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm font-semibold text-[#1a1d23] dark:text-white">Entrando...</p>
                <p className="text-xs text-[#64748b] dark:text-slate-400">Aguarde o redirecionamento</p>
              </div>
            </div>
          )}
          <div id="main" className="w-full max-w-sm" tabIndex={-1}>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-[#1a1d23] dark:text-white">Entrar na conta</h1>
              <p className="mt-1 text-base text-[#64748b] dark:text-slate-400">
                Use o seu e-mail corporativo para acessar.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" aria-label="Formulário de login">
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
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    disabled={loading}
                    className="min-h-[44px] w-full rounded-md border border-[#e2e8f0] bg-white px-3 pr-10 text-base text-[#1a1d23] placeholder:text-[#94a3b8] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-70 dark:border-[#252a35] dark:bg-[#1a1d23] dark:text-white dark:placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-2 flex items-center rounded-md px-2 text-xs font-medium text-[#64748b] hover:bg-[#e2e8f0] dark:text-slate-300 dark:hover:bg-[#252a35]"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    disabled={loading}
                  >
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>

              {/* Botão */}
              <button
                type="submit"
                disabled={loading}
                aria-label={loading ? "Entrando na conta" : "Entrar na conta"}
                aria-busy={loading}
                className="mt-2 flex min-h-[44px] w-full items-center justify-center rounded-md bg-blue-600 px-4 text-base font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
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

            {/* <TestUsersPanel users={testUsers} loading={loadingUsers} /> */}
          </div>
        </div>
      </div>
    </div>
  );
}

/*
function TestUsersPanel({ users, loading }: { users: LoginUserPreview[]; loading: boolean }) {
  return (
    <div className="mt-8 rounded-lg border border-[#e2e8f0] bg-white p-4 text-sm text-[#1a1d23] shadow-sm dark:border-[#252a35] dark:bg-[#1a1d23] dark:text-slate-100">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-base font-semibold">Usuários de teste</p>
          <p className="text-sm text-[#64748b] dark:text-slate-400">Todos usam a senha <span className="font-mono font-semibold">senha123</span></p>
        </div>
      </div>
      <div className="grid gap-1 text-base">
        {loading && (
          <div className="rounded-md px-3 py-2 text-sm text-[#64748b] dark:text-slate-400">
            Carregando usuários...
          </div>
        )}
        {!loading && users.length === 0 && (
          <div className="rounded-md px-3 py-2 text-sm text-[#64748b] dark:text-slate-400">
            Nenhum usuário disponível.
          </div>
        )}
        {users.map((u) => (
          <div key={u.email} className="flex min-h-[44px] min-w-0 items-center justify-between gap-2 rounded-md px-3 py-2 hover:bg-[#f5f6f8] dark:hover:bg-[#0f1117]">
            <span className="shrink-0 text-sm font-medium text-[#475569] dark:text-slate-300">{getRoleLabel(u.role)}</span>
            <span className="min-w-0 truncate font-mono text-sm sm:text-base" title={u.email}>{u.email}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
*/
