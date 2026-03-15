# Análise de Refatoração — Editora Globo Férias

## 1. Arquivos grandes e responsabilidades

### 1.1 `app/dashboard/page.tsx` (~1360 linhas)
**Problema:** Arquivo monolítico com múltiplas responsabilidades.

**Conteúdo atual:**
- **Data fetching:** `getData()`, `getTeamMembersForTimes()` — acesso a Prisma direto na página.
- **Tipos:** `TeamMemberInfo`, `Filters`, `ChipColor`.
- **Página:** `DashboardPage` (orquestração).
- **Layout:** `AppSidebar`, `SidebarBalance`, `TopBar`.
- **Estatísticas:** `StatCard`.
- **Blackout:** `BlackoutAlert`, `BlackoutListCard`.
- **Status/UI:** `StatusBadge`, `StatusChip`, `ApprovalProgressBar`, `RoleChip`.
- **Listas/Views:** `MyRequestsList`, `TimesView`, `ManagerView`, `FilterForm`, `RequestsGroupedByManager`.
- **Request:** `RequestCard`, `HistorySection`, `RequestActions`, `EditPeriodForm`.
- **Utilitários:** `EmptyState`, `ExportButton`, ícones (IconCalendar, IconInbox, etc.), `normalizeParam`, `formatDateRange`, `getManagerOptions`, `getDepartmentOptions`, `filterRequests`, `groupByManager`, `buildExportQuery`.

**Impacto:** Difícil manutenção, testes e colaboração; mistura de UI, lógica de negócio e acesso a dados.

### 1.2 `lib/vacationRules.ts` (~592 linhas)
**Problema:** Módulo único com regras de negócio, hierarquia, aprovação, saldo, feriados e validação CLT.

**Conteúdo:**
- Constantes de roles e labels.
- Funções de aprovação: `getNextApprovalStatus`, `canApproveRequest`, `getNextApprover`, `getApprovalSteps`, `getApprovalProgress`.
- Visibilidade: `hasTeamVisibility`.
- Saldo: `calculateVacationBalance`, helpers internos.
- Feriados SP: `isSaoPauloHoliday`, `getEasterSunday`, etc.
- Validação CLT: `validateCltPeriod`, `validateCltPeriods`, `checkBlackoutPeriods`, `detectTeamConflicts`.

**Impacto:** Um único ponto de mudança; possível separar em subdomínios (roles, approval, balance, holidays, validation).

### 1.3 Outros arquivos
- **`components/dashboard/new-request-card.tsx`** (~351 linhas): Dentro do limite, mas pode ser dividido (form + validação).
- **`components/dashboard/header-menu.tsx`** (~260 linhas): Tamanho aceitável.
- **`app/login/page.tsx`** (~191 linhas): Aceitável.
- **Rotas API:** Pequenas e focadas; manter ou extrair lógica para services.

## 2. Acoplamento e responsabilidades

- **Dashboard:** A página conhece Prisma, regras de negócio (getRoleLevel, hasTeamVisibility, etc.) e toda a árvore de componentes.
- **Repositórios inexistentes:** Queries Prisma espalhadas na página e em rotas API.
- **Serviços inexistentes:** Orquestração de dados e regras feita na página.
- **Tipos:** Uso de `any` em vários pontos; tipos de request/user não centralizados.

## 3. Metas de refatoração

1. Nenhum arquivo com mais de ~300–400 linhas.
2. Separação clara: **repositories** (dados), **services** (orquestração/regras), **components** (UI).
3. Dashboard como orquestrador fino: busca via service, renderiza componentes.
4. Componentes de request e layout reutilizáveis e testáveis.
5. Tipos explícitos; reduzir `any`.
6. Manter comportamento atual e regras CLT/hierarquia.
