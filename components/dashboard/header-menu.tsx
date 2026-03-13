"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Props = {
  role: string;
};

export function HeaderMenu({ role }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isGestor = role === "GESTOR";
  const isRh = role === "RH";

  // Fecha o menu ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  // Fecha ao pressionar ESC
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [open]);

  if (!isGestor && !isRh) {
    return null;
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition-all hover:bg-slate-100 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        aria-expanded={open}
      >
        <span className="sr-only">{open ? "Fechar" : "Abrir"} menu de ajuda</span>
        <span className="flex flex-col gap-[3px]">
          <span 
            className={cn(
              "h-[2px] w-4 rounded-full bg-current transition-all duration-200",
              open && "translate-y-[5px] rotate-45"
            )} 
          />
          <span 
            className={cn(
              "h-[2px] w-4 rounded-full bg-current transition-all duration-200",
              open && "opacity-0"
            )} 
          />
          <span 
            className={cn(
              "h-[2px] w-4 rounded-full bg-current transition-all duration-200",
              open && "-translate-y-[5px] -rotate-45"
            )} 
          />
        </span>
      </button>

      {open && (
        <>
          {/* Backdrop para mobile */}
          <div 
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
            onClick={() => setOpen(false)}
          />

          {/* Menu dropdown */}
          <div className="absolute right-0 top-full z-50 mt-2 w-80 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
              {/* Header do menu */}
              <div className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4 dark:border-slate-700 dark:from-slate-800 dark:to-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-500/20">
                    <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Informações do Sistema
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Como funciona o seu perfil
                    </p>
                  </div>
                </div>
              </div>

              {/* Conteúdo do menu */}
              <div className="p-5 space-y-4">
                {isGestor && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                        <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Perfil: Gestor
                      </h4>
                    </div>

                    <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950/30">
                      <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                        O que você vê:
                      </p>
                      <ul className="mt-2 space-y-2 text-xs text-blue-800 dark:text-blue-200">
                        <li className="flex items-start gap-2">
                          <span className="mt-0.5 text-blue-500">•</span>
                          <span>Apenas solicitações do <strong>seu time direto</strong></span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="mt-0.5 text-blue-500">•</span>
                          <span>Pedidos ordenados por <strong>data mais próxima</strong></span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="mt-0.5 text-blue-500">•</span>
                          <span>Caixa de aprovação com <strong>pedidos pendentes</strong></span>
                        </li>
                      </ul>
                    </div>

                    <div className="rounded-lg bg-slate-100 p-4 dark:bg-slate-800">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        📌 Importante:
                      </p>
                      <p className="mt-2 text-xs text-slate-700 dark:text-slate-300">
                        Suas próprias solicitações de férias aparecem no card <strong>"Nova Solicitação"</strong> na barra lateral.
                      </p>
                    </div>

                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
                      <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                        ✅ Seu fluxo de aprovação:
                      </p>
                      <ol className="mt-2 space-y-1.5 text-xs text-emerald-800 dark:text-emerald-200">
                        <li className="flex items-start gap-2">
                          <span className="font-bold">1.</span>
                          <span>Você aprova o pedido do colaborador</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="font-bold">2.</span>
                          <span>Pedido vai para aprovação final do RH</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="font-bold">3.</span>
                          <span>RH aprova e férias são confirmadas</span>
                        </li>
                      </ol>
                    </div>
                  </div>
                )}

                {isRh && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                        <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Perfil: RH
                      </h4>
                    </div>

                    <div className="rounded-lg bg-indigo-50 p-4 dark:bg-indigo-950/30">
                      <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
                        O que você vê:
                      </p>
                      <ul className="mt-2 space-y-2 text-xs text-indigo-800 dark:text-indigo-200">
                        <li className="flex items-start gap-2">
                          <span className="mt-0.5 text-indigo-500">•</span>
                          <span><strong>Todas as solicitações</strong> de todos os times</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="mt-0.5 text-indigo-500">•</span>
                          <span>Solicitações <strong>agrupadas por gestor</strong></span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="mt-0.5 text-indigo-500">•</span>
                          <span>Filtros avançados por <strong>período e status</strong></span>
                        </li>
                      </ul>
                    </div>

                    <div className="rounded-lg bg-slate-100 p-4 dark:bg-slate-800">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        🔍 Ferramentas disponíveis:
                      </p>
                      <ul className="mt-2 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                        <li className="flex items-center gap-2">
                          <span>✓</span>
                          <span>Busca por colaborador</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span>✓</span>
                          <span>Filtro por gestor responsável</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span>✓</span>
                          <span>Filtro por período das férias</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span>✓</span>
                          <span>Exportação para CSV</span>
                        </li>
                      </ul>
                    </div>

                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                        ⚠️ Importante:
                      </p>
                      <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                        Você só aprova pedidos que <strong>já foram aprovados pelo gestor</strong>. Pedidos pendentes do gestor não aparecem na sua caixa de aprovação.
                      </p>
                    </div>
                  </div>
                )}

                {/* Dica de atalho */}
                <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
                  <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] dark:border-slate-600 dark:bg-slate-800">
                      ESC
                    </kbd>
                    <span>Pressione ESC para fechar este menu</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}