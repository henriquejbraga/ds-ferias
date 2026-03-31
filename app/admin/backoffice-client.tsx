"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getRoleLabel } from "@/lib/vacationRules";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  registration: string;
  department: string | null;
  hireDate: Date | null;
  team: string | null;
  managerId: string | null;
  manager: { id: string; name: string } | null;
  _count: { reports: number };
  tookVacationInCurrentCycle: boolean | null;
  acquisitionPeriods?: AcquisitionPeriodRow[];
};

type AcquisitionPeriodRow = {
  id: string;
  startDate: string;
  endDate: string;
  accruedDays: number;
  usedDays: number;
};

type Manager = { id: string; name: string };
type SortKey =
  | "name"
  | "email"
  | "registration"
  | "role"
  | "department"
  | "team"
  | "hireDate"
  | "tookVacationInCurrentCycle"
  | "manager";
type SortDir = "asc" | "desc";
const FIXED_DEPARTMENT = "Estratégia Digital";
const TEAM_OPTIONS = ["Design System", "Plataformas", "APPs", "Inovação IA", "Agile", "Jornais", "SGR", "Fasttrack"] as const;
const TEAM_DATALIST_ID = "team-options-list";

export function BackofficeClient({
  users,
  managers,
}: {
  users: UserRow[];
  managers: Manager[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<UserRow>>({});
  const [loadingPeriods, setLoadingPeriods] = useState<string | null>(null);
  const [editingPeriods, setEditingPeriods] = useState<AcquisitionPeriodRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<{
    name: string;
    email: string;
    registration: string;
    role: "" | "FUNCIONARIO" | "COORDENADOR" | "GERENTE" | "DIRETOR" | "RH";
    department: string;
    hireDate: string; // yyyy-mm-dd
    team: string;
    managerId: string;
  }>({
    name: "",
    email: "",
    registration: "",
    role: "",
    department: FIXED_DEPARTMENT,
    hireDate: "",
    team: "",
    managerId: "",
  });
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | "FUNCIONARIO" | "COORDENADOR" | "GERENTE" | "DIRETOR" | "RH">("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  async function handleSave(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          role: form.role,
          department: form.department ?? FIXED_DEPARTMENT,
          hireDate: form.hireDate ? new Date(form.hireDate).toISOString().slice(0, 10) : null,
          team: form.team ?? "",
          managerId: form.managerId ?? null,
          acquisitionPeriods: editingPeriods, // Envia ajustes de ciclos
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = typeof data?.error === "string" ? data.error : "Erro ao salvar usuário.";
        toast.error(message);
        return;
      }
      toast.success("Usuário atualizado com sucesso.");
      setEditingId(null);
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(u: UserRow) {
    if (!window.confirm(`Tem certeza que deseja excluir o usuário "${u.name}"?`)) return;
    setDeletingId(u.id);
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data?.error === "string" ? data.error : "Erro ao excluir usuário.");
        return;
      }
      toast.success("Usuário excluído com sucesso.");
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setDeletingId(null);
    }
  }

  async function startEdit(u: UserRow) {
    setEditingId(u.id);
    setForm({
      name: u.name,
      email: u.email,
      role: u.role,
      department: u.department ?? FIXED_DEPARTMENT,
      hireDate: u.hireDate,
      team: u.team,
      managerId: u.managerId,
    });

    // Se o usuário tem hireDate, carregamos os ciclos aquisitivos
    if (u.hireDate) {
      setLoadingPeriods(u.id);
      try {
        const res = await fetch(`/api/reports/acquisition-periods?userId=${u.id}`);
        const data = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(data.periods)) {
          setEditingPeriods(data.periods.map((p: any) => ({
            id: p.id,
            startDate: p.startDate,
            endDate: p.endDate,
            accruedDays: p.accruedDays,
            usedDays: p.usedDays
          })));
        }
      } catch (err) {
        console.error("Erro ao carregar ciclos:", err);
      } finally {
        setLoadingPeriods(null);
      }
    } else {
      setEditingPeriods([]);
    }
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filteredUsers = users.filter((u) => {
    if (normalizedSearch) {
      const haystack = `${u.name} ${u.email} ${u.department ?? ""}`.toLowerCase();
      if (!haystack.includes(normalizedSearch)) return false;
    }
    if (roleFilter && u.role !== roleFilter) return false;
    return true;
  });
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const normalize = (v: unknown): string | number => {
      if (v instanceof Date) return v.getTime();
      if (typeof v === "boolean") return v ? 1 : 0;
      if (v === null || v === undefined) return "";
      return String(v).toLowerCase();
    };
    const pick = (u: UserRow): unknown => {
      switch (sortKey) {
        case "manager":
          return u.manager?.name ?? "";
        default:
          return (u as any)[sortKey];
      }
    };
    const av = normalize(pick(a));
    const bv = normalize(pick(b));
    let cmp = 0;
    if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
    else cmp = String(av).localeCompare(String(bv), "pt-BR");
    return sortDir === "asc" ? cmp : -cmp;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  function SortHeader({ label, col }: { label: string; col: SortKey }) {
    const active = sortKey === col;
    return (
      <button
        type="button"
        onClick={() => toggleSort(col)}
        className="inline-flex items-center gap-1 font-semibold text-[#1a1d23] hover:text-blue-700 dark:text-white dark:hover:text-blue-300"
        aria-label={`Ordenar por ${label}`}
      >
        {label}
        <span className="text-[10px] text-[#64748b] dark:text-slate-400">
          {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-white dark:border-[#252a35] dark:bg-[#1a1d23]">
      <div className="flex flex-col gap-3 border-b border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 dark:border-[#252a35] dark:bg-[#141720] sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-sm text-[#475569] dark:text-slate-300">
          <p className="font-medium">
            {users.length} usuário(s) ·{" "}
            {filteredUsers.length !== users.length ? `${filteredUsers.length} filtrado(s)` : "sem filtro aplicado"}
          </p>
          {roleFilter && (
            <p className="text-xs text-[#64748b] dark:text-slate-400">
              Filtro: papel = {getRoleLabel(roleFilter)}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail ou departamento..."
            className="w-full max-w-xs rounded-md border border-[#e2e8f0] bg-white px-3 py-1.5 text-sm text-[#1a1d23] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
            aria-label="Buscar usuários"
          />
          <select
            value={roleFilter}
            onChange={(e) =>
              setRoleFilter((e.target.value || "") as "" | "FUNCIONARIO" | "COORDENADOR" | "GERENTE" | "DIRETOR" | "RH")
            }
            aria-label="Filtrar por papel"
            className="w-40 rounded-md border border-[#e2e8f0] bg-white px-2 py-1.5 text-sm text-[#1a1d23] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
          >
            <option value="">Todos os papéis</option>
            <option value="FUNCIONARIO">Funcionário(a)</option>
            <option value="COORDENADOR">Coordenador(a)</option>
            <option value="GERENTE">Gerente</option>
            <option value="DIRETOR">Diretor(a)</option>
            <option value="RH">RH</option>
          </select>
        </div>
      </div>
      <div className="border-b border-[#e2e8f0] bg-white px-4 py-3 text-sm text-[#475569] dark:border-[#252a35] dark:bg-[#1a1d23] dark:text-slate-300">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8] dark:text-slate-500">
              Novo usuário
            </span>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="Nome completo"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                className="w-40 rounded-md border border-[#e2e8f0] bg-white px-2 py-1.5 text-sm text-[#1a1d23] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
              />
              <input
                type="email"
                placeholder="email@empresa.com"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                className="w-52 rounded-md border border-[#e2e8f0] bg-white px-2 py-1.5 text-sm text-[#1a1d23] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
              />
              <input
                type="text"
                placeholder="Matrícula"
                value={createForm.registration}
                onChange={(e) => setCreateForm((f) => ({ ...f, registration: e.target.value }))}
                className="w-32 rounded-md border border-[#e2e8f0] bg-white px-2 py-1.5 text-sm text-[#1a1d23] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
              />
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value as any }))}
                className="w-40 rounded-md border border-[#e2e8f0] bg-white px-2 py-1.5 text-sm text-[#1a1d23] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
              >
                <option value="">Papel</option>
                <option value="FUNCIONARIO">Funcionário(a)</option>
                <option value="COORDENADOR">Coordenador(a)</option>
                <option value="GERENTE">Gerente</option>
                <option value="DIRETOR">Diretor(a)</option>
                <option value="RH">RH</option>
              </select>
              <select
                value={createForm.department}
                onChange={(e) => setCreateForm((f) => ({ ...f, department: e.target.value }))}
                className="w-44 rounded-md border border-[#e2e8f0] bg-white px-2 py-1.5 text-sm text-[#1a1d23] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
              >
                <option value={FIXED_DEPARTMENT}>{FIXED_DEPARTMENT}</option>
              </select>
              <input
                type="date"
                aria-label="Data de admissão"
                value={createForm.hireDate}
                onChange={(e) => setCreateForm((f) => ({ ...f, hireDate: e.target.value }))}
                className="w-40 rounded-md border border-[#e2e8f0] bg-white px-2 py-1.5 text-sm text-[#1a1d23] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
              />
              <input
                type="text"
                value={createForm.team}
                onChange={(e) => setCreateForm((f) => ({ ...f, team: e.target.value }))}
                placeholder="Time(s): ex. Design System / Plataformas"
                list={TEAM_DATALIST_ID}
                className="w-56 rounded-md border border-[#e2e8f0] bg-white px-2 py-1.5 text-sm text-[#1a1d23] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
              />
              <select
                value={createForm.managerId}
                onChange={(e) => setCreateForm((f) => ({ ...f, managerId: e.target.value }))}
                className="w-48 rounded-md border border-[#e2e8f0] bg-white px-2 py-1.5 text-sm text-[#1a1d23] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
              >
                <option value="">Coordenador/Gerente (opcional)</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
          <Button
            size="sm"
            disabled={creating || (isPending && !editingId && !deletingId)}
            onClick={async () => {
              setCreating(true);
              try {
                const res = await fetch("/api/users", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(createForm),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  const message = typeof data?.error === "string" ? data.error : "Erro ao criar usuário.";
                  toast.error(message);
                  return;
                }
                toast.success("Usuário criado com sucesso. Senha padrão: senha123");
                setCreateForm({
                  name: "",
                  email: "",
                  registration: "",
                  role: "",
                  department: FIXED_DEPARTMENT,
                  hireDate: "",
                  team: "",
                  managerId: "",
                });
                startTransition(() => {
                  router.refresh();
                });
              } finally {
                setCreating(false);
              }
            }}
          >
            {creating || (isPending && !editingId && !deletingId) ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Criando…
              </span>
            ) : "Adicionar usuário"}
          </Button>
        </div>
      </div>
      <div className="max-h-[65vh] overflow-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] dark:border-[#252a35] dark:bg-[#141720]">
              <th
                scope="col"
                className="sticky left-0 top-0 z-50 w-[220px] min-w-[220px] border-r border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 dark:border-[#252a35] dark:bg-[#141720]"
              >
                <SortHeader label="Nome" col="name" />
              </th>
              <th scope="col" className="sticky top-0 z-40 bg-[#f8fafc] px-4 py-3 dark:bg-[#141720]"><SortHeader label="E-mail" col="email" /></th>
              <th scope="col" className="sticky top-0 z-40 bg-[#f8fafc] px-4 py-3 dark:bg-[#141720]"><SortHeader label="Matrícula" col="registration" /></th>
              <th scope="col" className="sticky top-0 z-40 bg-[#f8fafc] px-4 py-3 dark:bg-[#141720]"><SortHeader label="Papel" col="role" /></th>
              <th scope="col" className="sticky top-0 z-40 bg-[#f8fafc] px-4 py-3 dark:bg-[#141720]"><SortHeader label="Departamento" col="department" /></th>
              <th scope="col" className="sticky top-0 z-40 bg-[#f8fafc] px-4 py-3 dark:bg-[#141720]"><SortHeader label="Time" col="team" /></th>
              <th scope="col" className="sticky top-0 z-40 bg-[#f8fafc] px-4 py-3 dark:bg-[#141720]"><SortHeader label="Admissão" col="hireDate" /></th>
              <th scope="col" className="sticky top-0 z-40 bg-[#f8fafc] px-4 py-3 dark:bg-[#141720]"><SortHeader label="Férias no ciclo" col="tookVacationInCurrentCycle" /></th>
              <th scope="col" className="sticky top-0 z-40 bg-[#f8fafc] px-4 py-3 dark:bg-[#141720]"><SortHeader label="Coordenador/Gerente" col="manager" /></th>
              <th scope="col" className="sticky top-0 z-40 bg-[#f8fafc] px-4 py-3 font-semibold text-[#1a1d23] dark:bg-[#141720] dark:text-white">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((u) => (
              <tr key={u.id} className="border-b border-[#e2e8f0] dark:border-[#252a35]">
                <td className="sticky left-0 z-20 w-[220px] min-w-[220px] border-r border-[#e2e8f0] bg-white px-4 py-3 dark:border-[#252a35] dark:bg-[#1a1d23]">
                  {editingId === u.id ? (
                    <input
                      value={form.name ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      aria-label="Nome do usuário"
                      className="w-full rounded border border-[#e2e8f0] bg-white px-2 py-1.5 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
                    />
                  ) : (
                    <span className="block break-words font-medium text-[#1a1d23] dark:text-white">{u.name}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[#64748b] dark:text-slate-400">
                  {editingId === u.id ? (
                    <input
                      type="email"
                      value={form.email ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      aria-label="E-mail do usuário"
                      className="w-full rounded border border-[#e2e8f0] bg-white px-2 py-1.5 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
                    />
                  ) : (
                    u.email
                  )}
                </td>
                <td className="px-4 py-3">
                  {u.registration ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {editingId === u.id ? (
                    <select
                      value={form.role ?? u.role}
                      onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                      aria-label="Papel do usuário"
                      className="rounded border border-[#e2e8f0] bg-white px-2 py-1.5 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
                    >
                      <option value="FUNCIONARIO">Funcionário(a)</option>
                      <option value="COORDENADOR">Coordenador(a)</option>
                      <option value="GERENTE">Gerente</option>
                      <option value="DIRETOR">Diretor(a)</option>
                      <option value="RH">RH</option>
                    </select>
                  ) : (
                    getRoleLabel(u.role)
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === u.id ? (
                    <select
                      value={form.department ?? FIXED_DEPARTMENT}
                      onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                      aria-label="Departamento"
                      className="w-44 rounded border border-[#e2e8f0] bg-white px-2 py-1.5 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
                    >
                      <option value={FIXED_DEPARTMENT}>{FIXED_DEPARTMENT}</option>
                    </select>
                  ) : (
                    u.department ?? "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === u.id ? (
                    <input
                      type="text"
                      value={form.team ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, team: e.target.value || null }))}
                      placeholder="Time(s)"
                      list={TEAM_DATALIST_ID}
                      aria-label="Time"
                      className="w-56 rounded border border-[#e2e8f0] bg-white px-2 py-1.5 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
                    />
                  ) : (
                    u.team ?? "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === u.id ? (
                    <input
                      type="date"
                      value={form.hireDate ? new Date(form.hireDate).toISOString().slice(0, 10) : ""}
                      onChange={(e) => setForm((f) => ({ ...f, hireDate: e.target.value ? new Date(e.target.value) : null }))}
                      aria-label="Data de admissão"
                      className="rounded border border-[#e2e8f0] bg-white px-2 py-1.5 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
                    />
                  ) : (
                    u.hireDate ? new Date(u.hireDate).toLocaleDateString("pt-BR") : "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  {u.tookVacationInCurrentCycle === null ? (
                    "—"
                  ) : u.tookVacationInCurrentCycle ? (
                    <span className="text-emerald-700 dark:text-emerald-300 font-semibold">Sim</span>
                  ) : (
                    <span className="text-slate-600 dark:text-slate-300 font-semibold">Não</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === u.id ? (
                    <select
                      value={form.managerId ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, managerId: e.target.value || null }))}
                      aria-label="Coordenador ou gerente"
                      className="rounded border border-[#e2e8f0] bg-white px-2 py-1.5 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
                    >
                      <option value="">— Nenhum —</option>
                      {managers.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  ) : (
                    u.manager?.name ?? "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === u.id ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSave(u.id)} disabled={saving || isPending} aria-label={saving ? "Salvando" : "Salvar alterações"}>
                          {saving || isPending ? (
                            <span className="flex items-center gap-2">
                              <svg className="h-3.5 w-3.5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Salvando…
                            </span>
                          ) : "Salvar"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)} aria-label="Cancelar edição">
                          Cancelar
                        </Button>
                      </div>

                      {/* --- Gestão de Ciclos (Carga Inicial) --- */}
                      {u.hireDate && (
                        <div className="rounded-md border border-blue-100 bg-blue-50/30 p-3 dark:border-blue-900/20 dark:bg-blue-950/10">
                          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Ajuste de Saldo (Ciclos)</p>
                          {loadingPeriods === u.id ? (
                            <p className="text-[10px] text-slate-500 italic">Carregando ciclos...</p>
                          ) : editingPeriods.length > 0 ? (
                            <div className="space-y-2">
                              {editingPeriods.map((ap, idx) => (
                                <div key={ap.id} className="flex items-center justify-between gap-2 border-b border-blue-100/50 pb-1 last:border-0 dark:border-blue-900/30">
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                      {new Date(ap.startDate).toLocaleDateString("pt-BR")} – {new Date(ap.endDate).toLocaleDateString("pt-BR")}
                                    </span>
                                    <span className="text-[9px] text-slate-400">Total: {ap.accruedDays} dias</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[9px] font-medium text-slate-500">Gozados:</span>
                                    <input
                                      type="number"
                                      min={0}
                                      max={ap.accruedDays}
                                      value={ap.usedDays}
                                      onChange={(e) => {
                                        const val = Math.max(0, Math.min(ap.accruedDays, parseInt(e.target.value) || 0));
                                        setEditingPeriods(prev => prev.map((p, i) => i === idx ? { ...p, usedDays: val } : p));
                                      }}
                                      className="h-7 w-12 rounded border border-blue-200 bg-white px-1 text-center text-xs font-bold text-blue-700 outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-blue-800 dark:bg-[#0f1117] dark:text-blue-300"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-500">Nenhum ciclo encontrado.</p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEdit(u)} aria-label={`Editar usuário ${u.name}`}>
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(u)}
                        disabled={deletingId === u.id || isPending}
                        aria-label={`Excluir usuário ${u.name}`}
                      >
                        {deletingId === u.id || (isPending && deletingId === u.id) ? (
                          <span className="flex items-center gap-2">
                            <svg className="h-3.5 w-3.5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Excluindo…
                          </span>
                        ) : "Excluir"}
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <datalist id={TEAM_DATALIST_ID}>
        {TEAM_OPTIONS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </div>
  );
}
