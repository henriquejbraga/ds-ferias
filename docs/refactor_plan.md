# Plano de Refatoração — Editora Globo Férias

## Estrutura atual (resumida)

```
app/
  dashboard/page.tsx   (muito grande)
  login/page.tsx
  api/...
components/
  dashboard/
  ui/
  theme-toggle.tsx, ...
lib/
  auth.ts
  vacationRules.ts    (grande)
  requestVisibility.ts
  prisma.ts
prisma/
  schema.prisma
```

## Estrutura proposta

```
app/
  dashboard/page.tsx          # Orquestração fina (~150–250 linhas)
  login/page.tsx
  api/...                     # Inalterado ou usa services
components/
  dashboard/
    sidebar.tsx               # AppSidebar + SidebarBalance
    top-bar.tsx
    stat-card.tsx
    blackout-alert.tsx
    blackout-list-card.tsx
    new-request-card.tsx      # existente
    header-menu.tsx           # existente
  requests/
    request-card.tsx          # RequestCard + StatusBadge, ApprovalProgressBar, HistorySection, RequestActions, EditPeriodForm
    status-badge.tsx
    approval-progress-bar.tsx
    history-section.tsx
    request-actions.tsx
    edit-period-form.tsx
    filter-form.tsx
    requests-grouped-by-manager.tsx
    my-requests-list.tsx
  layout/
    empty-state.tsx
    export-button.tsx
    icons.tsx                 # IconCalendar, IconInbox, etc.
  times-view-client.tsx       # existente
  ...
lib/
  auth.ts
  vacationRules.ts            # Manter; opcionalmente split em vacationRoles, vacationBalance, vacationValidation
  requestVisibility.ts
  prisma.ts
  utils.ts                    # normalizeParam, formatDateRange (ou em lib/format.ts)
repositories/
  vacationRepository.ts       # findMyRequests, findManagedRequests, etc.
  userRepository.ts           # findUserWithBalance, findTeamMembersForTimes
  blackoutRepository.ts       # findActiveBlackouts
services/
  dashboardDataService.ts     # getDashboardData(userId, role, filters) → usa repos + vacationRules
  teamMembersService.ts       # getTeamMembersForTimes(userId, role) → usa userRepository
types/
  dashboard.ts                # Filters, TeamMemberInfo, request types (opcional)
docs/
  refactor_analysis.md
  refactor_plan.md
  refactor_report.md
```

## Justificativa

- **Repositories:** Centralizam acesso a dados; facilitam testes e troca de implementação.
- **Services:** Encapsulam orquestração e regras; a página e as APIs ficam mais simples.
- **components/dashboard:** Tudo relacionado ao layout do dashboard (sidebar, stats, blackout).
- **components/requests:** Tudo relacionado a listagem/filtro/ações de solicitações.
- **components/layout:** Elementos genéricos (empty state, export, ícones).
- **Página dashboard:** Apenas chama service, passa props e monta layout; sem Prisma nem lógica pesada.

## Ordem de execução

1. Criar `types/dashboard.ts` (Filters, TeamMemberInfo, etc.).
2. Criar repositórios (vacation, user, blackout).
3. Criar services (dashboardData, teamMembers).
4. Extrair componentes de layout (empty-state, export-button, icons).
5. Extrair componentes de requests (request-card, status-badge, filter-form, etc.).
6. Extrair componentes de dashboard (sidebar, topbar, stat-card, blackout).
7. Refatorar `app/dashboard/page.tsx` para usar services e componentes extraídos.
8. Mover utilitários (normalizeParam, formatDateRange) para lib se necessário.
9. Limpeza: remover duplicações, ajustar tipos, verificar build e fluxos.
