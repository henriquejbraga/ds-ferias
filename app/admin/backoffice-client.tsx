"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getRoleLabel } from "@/lib/vacationRules";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  hireDate: Date | null;
  managerId: string | null;
  manager: { id: string; name: string } | null;
  _count: { reports: number };
};

type Manager = { id: string; name: string };

export function BackofficeClient({
  users,
  managers,
}: {
  users: UserRow[];
  managers: Manager[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<UserRow>>({});
  const [saving, setSaving] = useState(false);

  async function handleSave(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          role: form.role,
          department: form.department ?? "",
          hireDate: form.hireDate ? new Date(form.hireDate).toISOString().slice(0, 10) : null,
          managerId: form.managerId ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "Erro ao salvar");
        return;
      }
      toast.success("Usuário atualizado");
      setEditingId(null);
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  function startEdit(u: UserRow) {
    setEditingId(u.id);
    setForm({
      name: u.name,
      role: u.role,
      department: u.department,
      hireDate: u.hireDate,
      managerId: u.managerId,
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-white dark:border-[#252a35] dark:bg-[#1a1d23]">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] dark:border-[#252a35] dark:bg-[#141720]">
              <th className="px-4 py-3 font-semibold text-[#1a1d23] dark:text-white">Nome</th>
              <th className="px-4 py-3 font-semibold text-[#1a1d23] dark:text-white">E-mail</th>
              <th className="px-4 py-3 font-semibold text-[#1a1d23] dark:text-white">Papel</th>
              <th className="px-4 py-3 font-semibold text-[#1a1d23] dark:text-white">Departamento</th>
              <th className="px-4 py-3 font-semibold text-[#1a1d23] dark:text-white">Admissão</th>
              <th className="px-4 py-3 font-semibold text-[#1a1d23] dark:text-white">Coordenador/Gerente</th>
              <th className="px-4 py-3 font-semibold text-[#1a1d23] dark:text-white">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-[#e2e8f0] dark:border-[#252a35]">
                <td className="px-4 py-3">
                  {editingId === u.id ? (
                    <input
                      value={form.name ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full rounded border border-[#e2e8f0] bg-white px-2 py-1.5 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
                    />
                  ) : (
                    <span className="font-medium text-[#1a1d23] dark:text-white">{u.name}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[#64748b] dark:text-slate-400">{u.email}</td>
                <td className="px-4 py-3">
                  {editingId === u.id ? (
                    <select
                      value={form.role ?? u.role}
                      onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                      className="rounded border border-[#e2e8f0] bg-white px-2 py-1.5 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
                    >
                      <option value="FUNCIONARIO">Funcionário(a)</option>
                      <option value="COORDENADOR">Coordenador(a)</option>
                      <option value="GERENTE">Gerente</option>
                      <option value="RH">RH</option>
                    </select>
                  ) : (
                    getRoleLabel(u.role)
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === u.id ? (
                    <input
                      value={form.department ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, department: e.target.value || null }))}
                      placeholder="Ex: Engenharia"
                      className="w-32 rounded border border-[#e2e8f0] bg-white px-2 py-1.5 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
                    />
                  ) : (
                    u.department ?? "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === u.id ? (
                    <input
                      type="date"
                      value={form.hireDate ? new Date(form.hireDate).toISOString().slice(0, 10) : ""}
                      onChange={(e) => setForm((f) => ({ ...f, hireDate: e.target.value ? new Date(e.target.value) : null }))}
                      className="rounded border border-[#e2e8f0] bg-white px-2 py-1.5 dark:border-[#252a35] dark:bg-[#0f1117] dark:text-white"
                    />
                  ) : (
                    u.hireDate ? new Date(u.hireDate).toLocaleDateString("pt-BR") : "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === u.id ? (
                    <select
                      value={form.managerId ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, managerId: e.target.value || null }))}
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
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSave(u.id)} disabled={saving}>
                        {saving ? "Salvando…" : "Salvar"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => startEdit(u)}>
                      Editar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
