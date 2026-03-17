# Editora Globo - Férias

Sistema interno de gestão de férias com fluxo de aprovação em cadeia (Coordenador → Gerente → RH), regras CLT, **abono 1/3** e **adiantamento de 13º**, além de auditoria completa. Desenvolvido com **Next.js 16** (App Router), **Prisma 7**, **PostgreSQL** e **TailwindCSS**.

---

## Visão geral

- **Colaborador (FUNCIONARIO/COLABORADOR):** cria solicitações, cancela as pendentes (antes da aprovação final) e acompanha histórico, saldo e calendário.
- **Coordenador:** aprova/reprova férias do **seu time**, exclui solicitações da equipe e acessa a aba **Times** (todos os reportes diretos com status explícito).
- **Gerente:** aprova solicitações dos coordenadores e dos times sob sua gestão; vê **Times** agrupados por coordenador.
- **RH:** aprovação final, agrupada por gerente/coordenador; **Times** com todos os colaboradores; Backoffice; relatórios e export CSV.

Fluxo: **PENDENTE** → **Coordenador ou Gerente** (primeira aprovação, status `APROVADO_COORDENADOR`) → **RH** (`APROVADO_RH`). Ninguém aprova a própria solicitação.

---

## Regras CLT (São Paulo) e opções financeiras

Implementadas em `lib/vacationRules.ts`:

- **Direito:** 30 dias a cada 12 meses; até 60 dias com 2 períodos aquisitivos (o sistema suporta múltiplos períodos aquisitivos).
- **Fracionamento:** até 3 períodos (um com ≥ 14 dias, demais ≥ 5).
- **Início:** não pode ser sexta nem sábado; **término:** não sábado nem domingo (DSR).
- **Aviso prévio:** 30 dias; feriados (SP + nacionais) considerados.
- **Conflitos:** não sobrepor outra solicitação pendente ou aprovada.
- **Saldo:** `calculateVacationBalance` retorna `entitledDays`, `availableDays`, `pendingDays`, `usedDays`.
- **Datas e timezone:** todos os cálculos de dias/semana usam datas **normalizadas em UTC** para evitar diferenças entre ambientes.
- **Feriados nacionais:** carregados automaticamente via BrasilAPI (com cache em memória por ano), com fallback local para garantir CLT mesmo se a API externa estiver indisponível.
- **Abono 1/3:** o colaborador pode marcar que deseja converter até 10 dias em abono. O sistema mantém o período corrido de férias (ex.: 30 dias), mas calcula e destaca visualmente o **retorno estimado 10 dias antes** em cards, Times e calendário.
- **Adiantamento de 13º:** flag informativa na solicitação; a decisão financeira continua com o RH. Todos os aprovadores (Coord, Gerente, RH) podem aprovar a solicitação, e o card exibe chips indicando abono/13º.

Períodos em que a empresa não permite férias (blackout) são configurados pelo RH e bloqueiam novas solicitações.

---

## Arquitetura do projeto

- **`app/`** — Rotas (dashboard, login, admin, API).
- **`components/`** — UI por domínio:
  - **dashboard/** — Sidebar, topbar, stat-cards, blackout, times-view.
  - **requests/** — RequestCard, filtros, ManagerView, MyRequestsList, aprovação.
  - **layout/** — EmptyState, ExportButton, ícones.
- **`lib/`** — Auth, regras de férias (`vacationRules.ts`), visibilidade (`requestVisibility.ts`), filtros do dashboard (`dashboardFilters.ts`), Prisma, utils.
- **`repositories/`** — Acesso a dados (Prisma): vacation, user, blackout.
- **`services/`** — Lógica de negócio e orquestração: `dashboardDataService`, `teamMembersService`, `vacationRequestListService`.
- **`types/`** — Tipos compartilhados (ex.: `dashboard.ts`).

---

## Stack e segurança

- **Next.js 16** (App Router), **Prisma 7**, **PostgreSQL**, **TailwindCSS**, **shadcn/ui**, **sonner** (toasts).
- Sessão: cookie HTTP-only; assinatura HMAC quando `SESSION_SECRET` está definido no `.env` (mín. 16 caracteres).
- Senhas: hash SHA-256 (recomendado em produção: migrar para bcrypt/argon2).
- Usuários criados via Backoffice recebem **senha padrão `senha123`** (mesma dos usuários seedados); isso é apenas para ambiente interno/dev.

---

## Como rodar (dev)

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

6. **Testes (QA)**

```bash
npm run test           # vitest em modo watch
npm run test:run       # vitest (uma execução)
npm run test:coverage  # relatório de cobertura (html em coverage/)
npm run test:mutation  # Stryker mutation testing (lento, mas robusto)
```

Testes em `tests/` cobrem `lib/`, `services` e `repositories` (papéis, aprovação, visibilidade, CLT, abono/13º, auth, notificações, serviços de dashboard, times, etc.).

- **Cobertura de linhas (vitest):** alvo ≥ **95%** (atualmente ~97%).  
- **Mutation testing (Stryker):** o comando falha se o **mutation score** ficar abaixo de **85%** (`stryker.config.json` → `thresholds.break`).

---

## Scripts

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Gera Prisma Client e build de produção |
| `npm run start` | Servidor em produção |
| `npm run test` | Testes Vitest (watch) |
| `npm run test:run` | Testes Vitest (uma execução) |
| `npm run test:coverage` | Cobertura de código (relatório em `coverage/`) |
| `npm run test:mutation` | Stryker: mutation testing (≥85% para passar) |
| `npm run db:seed` | Popula/atualiza usuários de teste |
| `npm run db:check-visibility` | Diagnóstico de visibilidade de solicitações por usuário |

---

## Documentação em `docs/`

- **`system_overview.md`** — visão geral do sistema, arquitetura, fluxos e modelo de dados.
- **`engineering_audit.md`** — avaliação técnica e de arquitetura, com forças e dívidas de engenharia.
- **`clt_compliance_analysis.md`** — análise de conformidade com a CLT (férias, fracionamento, abono, 13º, blackout).
- **`product_analysis.md`** — análise de produto/UX para colaborador, gestor e RH, com lacunas de funcionalidades.
- **`qa_analysis.md`** — visão de QA: cobertura de testes, mutation testing, riscos e recomendações.
- **`engineering_roadmap.md`** — roadmap priorizado (alta/média/baixa prioridade) para evolução técnica e de compliance.

---

## Funcionalidades implementadas

- Fluxo de aprovação em 3 níveis (Coordenador → Gerente → RH) com histórico em `VacationRequestHistory`.
- Validações CLT (início/fim, aviso, feriados, fracionamento, conflitos).
- Dashboard por papel: Minhas Férias, Caixa de Aprovação, Histórico, **Times** (com filtro e expandir/colapsar por gerente e coordenador).
- Filtros (busca, status, coordenador, departamento, período); export CSV e relatório de saldo (RH).
- Períodos de bloqueio (blackout) por RH.
- Backoffice (**/admin**) para usuários (nome, e‑mail, papel, matrícula, departamento, admissão, gestor), com:
  - Busca com filtro por papel.
  - Edição inline (inclusive e‑mail) com toasts de erro descritivos (ex.: e‑mail/matrícula já cadastrados).
  - Criação de novos usuários com senha padrão **`senha123`**.
- Notificações via webhook (`lib/notifications.ts`); opcional definir `NOTIFY_WEBHOOK_URL`.
- Tema claro/escuro; layout responsivo; loading na navegação (sidebar) e no login.

---

## Melhorias futuras sugeridas

- Migrar hash de senha para bcrypt/argon2 e implementar fluxo completo de troca/reset de senha (em vez de senha padrão).
- Notificações por e-mail (ex.: Resend) ou Slack/Teams.
- Calendário consolidado de férias; limite de pessoas em férias por equipe.
- Relatórios gerenciais adicionais; delegação temporária de aprovação.

---

## Referências

- [Next.js](https://nextjs.org/docs)
- [Prisma](https://www.prisma.io/docs)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
