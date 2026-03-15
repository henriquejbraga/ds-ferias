# Editora Globo - Férias

Sistema interno de gestão de férias com fluxo de aprovação em cadeia (Coordenador → Gerente → RH), regras CLT e auditoria. Desenvolvido com **Next.js 16** (App Router), **Prisma 7**, **PostgreSQL** e **TailwindCSS**.

---

## Visão geral

- **Colaborador (FUNCIONARIO/COLABORADOR):** cria solicitações, edita/exclui as pendentes, acompanha histórico e saldo.
- **Coordenador:** aprova/reprova férias do **seu time**, exclui solicitações da equipe e acessa a aba **Times** (todos os reportes diretos com status explícito).
- **Gerente:** aprova solicitações dos coordenadores e dos times sob sua gestão; vê **Times** agrupados por coordenador.
- **RH:** aprovação final, agrupada por gerente/coordenador; **Times** com todos os colaboradores; Backoffice; relatórios e export CSV.

Fluxo: **PENDENTE** → Coordenador → **APROVADO_COORDENADOR** → Gerente → **APROVADO_GERENTE** → RH → **APROVADO_RH**. Ninguém aprova a própria solicitação.

---

## Regras CLT (São Paulo)

Implementadas em `lib/vacationRules.ts`:

- **Direito:** 30 dias a cada 12 meses; até 60 dias com 2 períodos aquisitivos.
- **Fracionamento:** até 3 períodos (um com ≥ 14 dias, demais ≥ 5).
- **Início:** não pode ser sexta nem sábado; **término:** não sábado nem domingo (DSR).
- **Aviso prévio:** 30 dias; feriados (SP + nacionais) considerados.
- **Conflitos:** não sobrepor outra solicitação pendente ou aprovada.
- **Saldo:** `calculateVacationBalance` retorna `entitledDays`, `availableDays`, `pendingDays`, `usedDays`.

Períodos em que a empresa não permite férias (blackout) são configurados pelo RH e bloqueiam novas solicitações.

---

## Arquitetura do projeto (pós-refatoração)

- **`app/`** — Rotas (dashboard, login, admin, API).
- **`components/`** — UI por domínio:
  - **dashboard/** — Sidebar, topbar, stat-cards, blackout, times-view.
  - **requests/** — RequestCard, filtros, ManagerView, MyRequestsList, aprovação.
  - **layout/** — EmptyState, ExportButton, ícones.
- **`lib/`** — Auth, regras de férias (`vacationRules.ts`), visibilidade (`requestVisibility.ts`), filtros do dashboard (`dashboardFilters.ts`), Prisma, utils.
- **`repositories/`** — Acesso a dados (Prisma): vacation, user, blackout.
- **`services/`** — Lógica de negócio e orquestração: `dashboardDataService`, `teamMembersService`.
- **`types/`** — Tipos compartilhados (ex.: `dashboard.ts`).

Detalhes em **`docs/refactor_report.md`**.

---

## Stack

- **Next.js 16** (App Router), **Prisma 7**, **PostgreSQL**, **TailwindCSS**, **shadcn/ui**, **sonner** (toasts).
- Sessão: cookie HTTP-only; assinatura HMAC quando `SESSION_SECRET` está definido no `.env`.
- Senhas: hash SHA-256 (recomendado em produção: migrar para bcrypt/argon2).

---

## Como rodar

1. **Requisitos:** Node.js LTS, PostgreSQL.

2. **Variáveis de ambiente** — Crie `.env` (pode copiar de `.env.example`):

```bash
DATABASE_URL="postgresql://usuario:senha@host:porta/banco"
# Recomendado: assina o cookie de sessão (mín. 16 caracteres)
SESSION_SECRET="seu-secret-com-pelo-menos-16-caracteres"
```

Opcional: `NOTIFY_WEBHOOK_URL` para notificações (webhook em novo pedido / aprovação / reprovação).

3. **Instalar e preparar o banco:**

```bash
npm install
npx prisma migrate dev
npx prisma generate
```

4. **Popular usuários de teste:**

```bash
npm run db:seed
```

Senha padrão para todos: **`senha123`**.

Usuários criados: Coordenadores (`gestor1@empresa.com`, `gestor2@empresa.com`), Gerentes (`gerente1@empresa.com`, `gerente2@empresa.com`), RH (`rh1@empresa.com`, `rh2@empresa.com`), Colaboradores (`colaborador1@empresa.com`, `colaborador2@empresa.com`, `colaborador3@empresa.com`). Hierarquia: RH → Gerente → Coordenador → Colaborador (veja `prisma/seed.ts`).

5. **Desenvolvimento:**

```bash
npm run dev
```

Aplicação em `http://localhost:3000`.

6. **Testes:**

```bash
npm run test        # watch
npm run test:run    # uma vez
```

Testes em `tests/vacationRules.test.ts` cobrem papéis, aprovação, visibilidade, CLT e saldo.

---

## Scripts

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Gera Prisma Client e build de produção |
| `npm run start` | Servidor em produção |
| `npm run test` | Testes Vitest (watch) |
| `npm run test:run` | Testes Vitest (uma execução) |
| `npm run db:seed` | Popula/atualiza usuários de teste |
| `npm run db:check-visibility` | Diagnóstico de visibilidade de solicitações por usuário |

---

## Documentação em `docs/`

- **`refactor_analysis.md`** — Análise que motivou a refatoração (arquivos grandes, responsabilidades).
- **`refactor_plan.md`** — Plano de estrutura (repositórios, services, componentes).
- **`refactor_report.md`** — Relatório final: arquivos criados, arquitetura atual e recomendações.

---

## Funcionalidades implementadas

- Fluxo de aprovação em 3 níveis (Coordenador → Gerente → RH) com histórico em `VacationRequestHistory`.
- Validações CLT (início/fim, aviso, feriados, fracionamento, conflitos).
- Dashboard por papel: Minhas Férias, Caixa de Aprovação, Histórico, **Times** (com filtro e expandir/colapsar por gerente e coordenador).
- Filtros (busca, status, coordenador, departamento, período); export CSV e relatório de saldo (RH).
- Períodos de bloqueio (blackout) por RH.
- Backoffice (**/admin**) para usuários (nome, papel, departamento, admissão, gestor).
- Notificações via webhook (`lib/notifications.ts`); opcional definir `NOTIFY_WEBHOOK_URL`.
- Tema claro/escuro; layout responsivo; loading na navegação (sidebar) e no login.

---

## Melhorias futuras sugeridas

- Migrar hash de senha para bcrypt/argon2.
- Notificações por e-mail (ex.: Resend) ou Slack/Teams.
- Calendário consolidado de férias; limite de pessoas em férias por equipe.
- Relatórios gerenciais adicionais; delegação temporária de aprovação.

---

## Referências

- [Next.js](https://nextjs.org/docs)
- [Prisma](https://www.prisma.io/docs)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
