# Auditoria de Engenharia — Editora Globo - Férias

**Data:** 2026-03-12  
**Escopo:** APIs, regras de férias, Prisma, aprovação, validações CLT, autenticação, dashboard.

---

## 1. Resumo executivo

O sistema implementa fluxo de aprovação em cadeia (Coordenador → Gerente → RH), regras CLT e controle de saldo. Foram identificados **bugs críticos** (segurança e lógica), **inconsistências** entre backend/frontend, **problemas de performance** e **melhorias de arquitetura**.

---

## 2. Autenticação e segurança

### 2.1 [CRÍTICO] Sessão em cookie não assinada

**Arquivo:** `lib/auth.ts`

A sessão é armazenada em cookie como JSON puro (`JSON.stringify(user)`). O cookie **não é assinado nem criptografado**. Um atacante pode forjar um cookie com `{ "id": "...", "email": "...", "role": "RH" }` e obter acesso como outro usuário.

**Recomendação:** Usar cookie assinado (HMAC) ou token JWT assinado; ou session store server-side com ID opaco no cookie.

### 2.2 Hash de senha fraco

**Arquivo:** `lib/auth.ts`

Uso de SHA-256 simples para senha. O padrão recomendado é **bcrypt**, **scrypt** ou **argon2** com salt por usuário.

**Recomendação:** Migrar para bcrypt (ou similar) e planejar migração de hashes existentes.

### 2.3 Log de credenciais em falha de login

**Arquivo:** `lib/auth.ts` (linha ~24)

Em falha de login é feito `console.error` com `hashed` e `stored` (hash da senha). Isso pode vazar informação sensível em logs.

**Recomendação:** Remover ou limitar ao mínimo (ex.: apenas email sem hashes).

---

## 3. APIs — bugs e inconsistências

### 3.1 [BUG] PUT/update de solicitação: apenas role "COLABORADOR"

**Arquivo:** `app/api/vacation-requests/[id]/update/route.ts`

A rota exige `user.role === "COLABORADOR"`. Usuários com role **FUNCIONARIO** (padrão do schema) **não conseguem editar** sua própria solicitação pendente.

**Recomendação:** Permitir nível 1 (FUNCIONARIO ou COLABORADOR), por exemplo `getRoleLevel(user.role) === 1`.

### 3.2 [BUG] Overlap na atualização de solicitação — status incompletos

**Arquivo:** `app/api/vacation-requests/[id]/update/route.ts`

A verificação de sobreposição considera apenas:

- `PENDENTE`, `APROVADO_GESTOR`, `APROVADO_RH`

Faltam **APROVADO_COORDENADOR** e **APROVADO_GERENTE**. O usuário pode alterar datas e criar sobreposição com uma solicitação já aprovada pelo coordenador ou gerente.

**Recomendação:** Incluir todos os status “ativos”: `PENDENTE`, `APROVADO_COORDENADOR`, `APROVADO_GESTOR`, `APROVADO_GERENTE`, `APROVADO_RH`.

### 3.3 [SEGURANÇA] Delete de solicitação sem verificação de equipe

**Arquivo:** `app/api/vacation-requests/[id]/delete/route.ts`

Qualquer usuário com `ROLE_LEVEL >= 2` (Coordenador, Gerente, RH) pode **excluir qualquer solicitação**, mesmo de outras equipes. Apenas `isOwner` e `isApprover` são verificados.

**Recomendação:** Para nível 2 e 3, restringir delete a solicitações em que o usuário tenha visibilidade (`hasTeamVisibility`). RH pode manter permissão global.

### 3.4 [UX/BUG] RequestCard usa role errado para exibir botão Aprovar/Reprovar

**Arquivo:** `app/dashboard/page.tsx` (RequestCard, ~linha 837)

`canApproveRequest` é chamado com:

- `request._approverRole ?? "RH"` (ou `request.user?.role` em fallback)

O objeto `request` vindo do servidor **não possui** `_approverRole`. Na prática o primeiro argumento (role do aprovador) acaba sendo **"RH"**. Com isso, a UI trata o usuário como se fosse sempre RH e pode **mostrar "Aprovar" para Coordenador/Gerente em solicitações que só o RH pode aprovar** (ex.: APROVADO_GERENTE). O backend então retorna 403.

**Recomendação:** Passar o role do usuário logado para `RequestCard` (ex.: `userRole={user.role}`) e usar `canApproveRequest(userRole, userId, request)`.

### 3.5 PATCH users: roles legados fora da lista

**Arquivo:** `app/api/users/[id]/route.ts`

`ROLES` inclui apenas `FUNCIONARIO`, `COORDENADOR`, `GERENTE`, `RH`. **COLABORADOR** e **GESTOR** (aliases no schema) não podem ser definidos via API. Dados existentes com esses roles continuam válidos, mas a API não permite atribuí-los.

**Recomendação:** Incluir COLABORADOR e GESTOR em `ROLES` para compatibilidade com o schema e dados existentes.

### 3.6 Blackout DELETE sem ownership

**Arquivo:** `app/api/blackout-periods/route.ts`

Qualquer usuário com nível >= 3 (Gerente ou RH) pode **deletar qualquer** período de bloqueio, não apenas os que criou. Pode ser intencional (RH/Gerente como donos globais); se não for, restringir por `createdById` para nível 3.

---

## 4. Regras de negócio e CLT

### 4.1 Regras em `lib/vacationRules.ts`

- **Hierarquia e níveis:** COLABORADOR/FUNCIONARIO=1, GESTOR/COORDENADOR=2, GERENTE=3, RH=4 — consistente com o schema.
- **Autoprovação:** `canApproveRequest` retorna `false` quando `request.userId === approverUserId` — correto.
- **Progressão de status:** PENDENTE → APROVADO_COORDENADOR/GESTOR → APROVADO_GERENTE → APROVADO_RH — alinhado ao fluxo.
- **Saldo:** `calculateVacationBalance` considera 12 meses para aquisição, 30 dias por período, dias usados/pendentes — coerente com CLT.
- **Validações CLT:** `validateCltPeriod` / `validateCltPeriods` cobrem: mínimo 5 dias, máximo 30 por período, máximo 3 períodos, um período ≥14 dias, início não em sexta/sábado, término não em sábado/domingo, aviso prévio 30 dias, feriados SP. Nenhuma violação óbvia identificada.

### 4.2 API POST vacation-requests

**Arquivo:** `app/api/vacation-requests/route.ts`

- Usa `validateCltPeriods` com `existingDaysInCycle` e `entitledDays`.
- Verifica blackout e overlap por período.
- Verifica saldo (`availableDays`) quando há `hireDate`.
- Cria múltiplos registros em transação (um por período) — correto para fracionamento.

Nenhum bug de regra CLT identificado na criação.

---

## 5. Queries e performance

### 5.1 Dashboard: carregar todas as solicitações para aprovadores

**Arquivo:** `app/dashboard/page.tsx` — `getData()`

Para Coordenador, Gerente e RH, `managedRequestsPromise` busca **todas** as solicitações (apenas com filtros opcionais por `q` e `status`). O filtro por equipe (`hasTeamVisibility`) é aplicado **em memória** depois. Em empresas grandes isso vira **N solicitações** no banco e na rede.

**Recomendação:** Aplicar filtro de equipe na query (por `user.managerId`, `user.manager.managerId`, etc.) conforme o role do usuário, e paginar ou limitar quando necessário.

### 5.2 Export CSV: mesmo padrão

**Arquivo:** `app/api/vacation-requests/export/route.ts`

Busca todas as solicitações e filtra em memória por papel (coordenador/gerente/RH) e view. Mesmo problema de escala.

**Recomendação:** Construir `where` no Prisma com base no role e visibilidade de equipe.

### 5.3 Relatório de saldo

**Arquivo:** `app/api/reports/balance/route.ts`

`prisma.user.findMany` com `vacationRequests` incluído. Para muitos usuários e muitas solicitações, o payload pode crescer. Considerar paginação ou streaming para CSV no futuro.

---

## 6. Race conditions e concorrência

- **Aprovação/reprovação:** Uma única atualização por request (update + create history). Não há lock otimista; dois aprovadores podem tentar aprovar ao mesmo tempo. O último update “vence”. Risco baixo se a UI for usada por uma pessoa por vez por solicitação; para cenários mais críticos, considerar versão/lock ou fila.
- **Criação de solicitação:** Transação com múltiplos `create`; overlap é verificado antes. Sem race óbvia na análise estática.
- **Delete:** Delete direto; sem condição de corrida relevante identificada.

---

## 7. Server vs client components

- **Dashboard:** `app/dashboard/page.tsx` é Server Component (async, `getSessionUser`, `getData`). Componentes como `NewRequestCardClient` e `ActionButtonForm` são client (“use client”) — adequado.
- **RequestCard / ManagerView:** São funções no mesmo arquivo do Server Component; não usam “use client”, então rodam no servidor. OK.
- **ActionButtonForm:** Usa `fetch` + `router.refresh()`; não usa Server Actions. Funcional, mas formulários de aprovação/reprovação poderiam ser Server Actions no futuro para simplificar.

Nenhuma violação grave de uso de server/client identificada.

---

## 8. Duplicação e arquitetura

### 8.1 Arquivo único muito grande

**Arquivo:** `app/dashboard/page.tsx` (~1163 linhas)

Contém: data fetching, sidebar, topbar, cards de estatísticas, blackout, lista de solicitações, ManagerView, FilterForm, RequestCard, StatusBadge, ApprovalProgressBar, HistorySection, RequestActions, EditPeriodForm, EmptyState, ExportButton, ícones, normalização de params, filtros, agrupamento, etc. Dificulta manutenção e testes.

**Recomendação:** Extrair em módulos, por exemplo:
- `components/dashboard/AppSidebar.tsx`
- `components/dashboard/RequestCard.tsx` (e subcomponentes)
- `components/dashboard/ManagerView.tsx` e `FilterForm.tsx`
- `lib/dashboard-filters.ts` (filterRequests, buildExportQuery, getManagerOptions, etc.)

### 8.2 Lógica de filtro duplicada

A lógica de “quem vê o quê” (coordenador/gerente/RH, inbox/histórico) existe em:

- Dashboard: `filterRequests` + `hasTeamVisibility`
- Export: implementação própria em `filter` no array

**Recomendação:** Centralizar em uma função ou serviço compartilhado (ex.: `buildManagedRequestsWhere(userId, userRole, filters)`) e usar no dashboard e na API de export.

### 8.3 Validação CLT apenas no backend

A validação CLT está em `lib/vacationRules.ts` e é usada nas APIs. O frontend (`NewRequestCardClient`) faz cálculos locais (dias, 14+ dias, etc.) mas não reutiliza as mesmas funções de validação. Mensagens e regras podem divergir.

**Recomendação:** Usar as mesmas funções de validação no client (importar de `vacationRules`) ou expor um endpoint de “preview/validate” que retorne erros antes do submit.

---

## 9. Inconsistências backend × frontend

| Aspecto | Backend | Frontend | Observação |
|--------|---------|----------|------------|
| Quem pode editar solicitação pendente | Só `role === "COLABORADOR"` | Formulário “Editar período” para dono | FUNCIONARIO não consegue editar (API bloqueia). |
| Botão Aprovar visível | - | Baseado em `request._approverRole ?? "RH"` | Deveria usar role do usuário logado. |
| Status considerados “ativos” no overlap (update) | PENDENTE, APROVADO_GESTOR, APROVADO_RH | - | Faltam APROVADO_COORDENADOR e APROVADO_GERENTE. |
| Delete por aprovador | Qualquer nível ≥ 2 | - | Não verifica equipe; coordenador pode apagar de outro time. |

---

## 10. Outros pontos

### 10.1 Logout

**Arquivo:** `app/api/logout/route.ts`

Aceita apenas POST. Se a página usar GET (ex.: link “Sair” sem form), o logout pode não ser chamado. Verificar se todos os “Sair” disparam POST (form ou fetch).

### 10.2 Notificações

**Arquivo:** `lib/notifications.ts`

Uso de `NOTIFY_WEBHOOK_URL` e `console.log` em dev está adequado. Nenhum bug identificado.

### 10.3 Prisma

- Schema com enums Role e VacationStatus e relações User ↔ Manager; VacationRequest ↔ User, History; BlackoutPeriod. Consistente com o uso nas APIs.
- Uso de `prisma` singleton em `lib/prisma.ts` com adapter Pg — OK.

---

## 11. Checklist de verificação

- [x] Autoprovação: bloqueada em `canApproveRequest`.
- [x] Bypass de autorização: approve/reject checam role e equipe; delete não checa equipe.
- [x] Inconsistência de status: fluxo de status coerente; bugs em update (overlap) e em quem pode editar.
- [x] Race conditions: risco baixo; sem lock explícito.
- [x] Validação CLT: implementada e usada na criação; update usa apenas um período e `validateCltPeriod`.
- [x] Queries pesadas: dashboard e export carregam muitas solicitações e filtram em memória.
- [x] Server/Client: uso adequado; dashboard como Server Component, interatividade em Client Components.
- [x] Sessão: **não assinada** — risco crítico de falsificação de identidade.

---

**Fim da auditoria.**
