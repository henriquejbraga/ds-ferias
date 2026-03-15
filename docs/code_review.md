# Revisão de Código — Editora Globo Férias

**Escopo:** Arquitetura, separação de módulos, legibilidade, type safety, lógica de negócio, APIs, queries, tratamento de erros, logging e manutenibilidade.

---

## 1. Arquitetura e separação de módulos

### Pontos positivos

- **Camadas claras:** `repositories/` (Prisma), `services/` (orquestração), `app/` (rotas e páginas), `components/` por domínio (dashboard, requests, layout).
- **Dashboard page:** Enxuta (~161 linhas); delega dados a `getDashboardData`, `getTeamMembersForTimes` e renderiza componentes.
- **Regras centralizadas:** `lib/vacationRules.ts` e `lib/requestVisibility.ts` como fonte única para hierarquia, aprovação, visibilidade e CLT.
- **Tipos de domínio:** `types/dashboard.ts` com `DashboardFilters`, `TeamMemberInfo`, `TeamDataCoord`, `TeamDataRH`.

### Pontos de melhoria

- **APIs não usam camada de serviço de forma consistente:**  
  - `app/api/vacation-requests/route.ts`: monta `where` manualmente, chama Prisma direto, implementa `hasOverlappingRequest` localmente.  
  - `app/api/vacation-requests/export/route.ts`: usa `buildManagedRequestsWhere` (bom), mas repete lógica de visibilidade e filtros por view em JavaScript (duplicada em relação a `filterRequestsByVisibilityAndView` / `filterRequests`).  
  - Ideal: APIs de listagem/export chamarem um service que use repositories + `requestVisibility`/`dashboardFilters`, evitando duplicação e divergência.
- **admin e reports:** `app/admin/page.tsx` e `app/api/reports/balance/route.ts` usam Prisma direto; poderiam usar `userRepository` e um service de relatório.

---

## 2. Type safety

### Uso de `any` e casts

| Arquivo | Ocorrência | Recomendação |
|---------|------------|--------------|
| `app/api/vacation-requests/route.ts` | `where: any`, `userFull.vacationRequests as any` | Tipar `where` com tipo Prisma ou tipo explícito; usar tipo de request com `startDate/endDate/status` para `calculateVacationBalance`. |
| `app/api/vacation-requests/[id]/approve/route.ts` | `getNextApprovalStatus(user.role) as any` | Usar tipo `VacationStatus` do Prisma para retorno. |
| `app/api/vacation-requests/export/route.ts` | `(where as any).user`, `where as any` no findMany | Construir objeto tipado (ex.: tipo auxiliar para where de vacation request) ou usar type assertion para tipo Prisma. |
| `app/api/users/[id]/route.ts` | `body.role as any` em ROLES.includes | Validar com enum ou tipo union e atribuir com type guard. |
| `app/api/vacation-balance/route.ts` | `user.vacationRequests as any` | Mesmo tipo usado em vacationRules para requests aprovados. |
| `components/times-view-client.tsx` | `requests: any[]`, `r: any` em map | Definir tipo mínimo (id, status, startDate, endDate, user?) e usar em props e callbacks. |

### Outros

- Testes usam `as never` ou `as unknown[]` em mocks; aceitável em testes, mas manter mocks tipados quando possível.
- Repositories retornam tipos inferidos do Prisma; está adequado. Services e componentes que consomem esses dados estão em geral bem tipados.

---

## 3. Lógica de negócio e validação

### Pontos positivos

- Criação de solicitação (POST vacation-requests): valida CLT (`validateCltPeriods`), blackout (`checkBlackoutPeriods`), sobreposição, saldo e entitlement; fluxo claro.
- Aprovação e reprovação: uso de `canApproveRequest`, `getNextApprovalStatus`, checagens de time (level 2/3); histórico e notificações.
- Delete: verificação de ownership e status antes de excluir.

### Riscos / melhorias

- **Overlap:** `hasOverlappingRequest` na API repete a ideia de “períodos ativos”; a regra poderia estar em um service ou em `vacationRules` (ex.: função que recebe userId + períodos e consulta via repo) para reuso e testes.
- **Export:** Filtros por view (inbox/histórico) e por role estão reimplementados em relação a `filterRequestsByVisibilityAndView`; uma única função (ou service) que retorne “requests filtrados para este usuário e filtros” reduziria divergência (ex.: esquecer um status no export).
- **Ausência de validação de id (UUID/CUID):** Rotas `[id]` aceitam qualquer string; Prisma retorna null se não existir, mas validar formato pode evitar consultas desnecessárias e mensagens mais claras.

---

## 4. API design

- **Autenticação:** Uso consistente de `getSessionUser()`; 401 quando não autenticado.
- **Autorização:** 403 com mensagens objetivas (ex.: “Sem permissão para aprovar”, “Só pode aprovar do seu time”).
- **Erros de validação:** 400 com `{ error: string }`; mensagens em português e alinhadas às regras CLT.
- **Corpo de requisição:** POSTs aceitam JSON e, em um caso, form data; parsing com `.catch(() => null)` e checagens de presença de campos evitam crashes.
- **Export:** Retorna CSV com headers adequados e `Content-Disposition` para download.

### Melhorias sugeridas

- Padronizar formato de erro (ex.: `{ error: string, code?: string }`) para possível uso no front.
- Rate limit em login e em criação de solicitações (não implementado).
- Documentação de contratos (OpenAPI/Swagger) não existe; seria útil para integrações.

---

## 5. Queries e acesso a dados

- **Repositories:** Queries concentradas, includes explícitos; `vacationRepository` e `userRepository` com selects adequados para dashboard e times.
- **APIs:** Algumas rotas fazem múltiplos `findMany`/`findUnique` (ex.: POST vacation-requests: blackouts + user + overlap); uso de `Promise.all` onde aplicável já existe. Criação em lote com `prisma.$transaction` está correto.
- **Export:** Um único `findMany` com include grande; para muitos registros, considerar paginação ou streaming no futuro.
- **N+1:** Não identificado; includes trazem relações necessárias em uma ida ao banco.

---

## 6. Tratamento de erros e logging

- **Try/catch:** Usado em parsing de body e em chamadas a `notify*` (`.catch(() => {})` para não falhar a request).
- **Logging:** Apenas `console.warn` em auth (credenciais inválidas em desenvolvimento); não há logging estruturado de erros ou de ações sensíveis (ex.: aprovação, reprovação).
- **Prisma:** Erros de banco não são tratados explicitamente; Next.js retorna 500. Recomendação: logar erro e retornar mensagem genérica ao cliente.
- **Notificações:** Falha no webhook não impacta a resposta da API; correto, mas poderia ser logada para diagnóstico.

---

## 7. Legibilidade e manutenibilidade

- Nomes de arquivos e componentes descritivos; estrutura de pastas coerente.
- Componentes de UI em geral pequenos e focados; `ManagerView`, `RequestCard`, `FilterForm` reutilizáveis.
- `vacationRules.ts` continua grande (~592 linhas), mas bem seccionado com comentários; divisão em submódulos (roles, balance, validation, holidays) pode facilitar mudanças pontuais.
- Duplicação principal: lógica de “quem vê quais requests” e “filtros por view” na API de export vs. lib (dashboardFilters/requestVisibility).

---

## 8. Possíveis bugs ou fragilidades

1. **Export – view “historico” para coordenador:** Condição usa `REPROVADO` mas não `CANCELADO` na lista de status do histórico; conferir se está alinhado com `filterRequests` (que inclui CANCELADO). Pequena inconsistência possível.
2. **Aprovação – nota do gerente:** Uso de `noteField = hrNote` para nível 3 (gerente); o schema tem `managerNote` (coordenador) e `hrNote` (RH). Verificar se gerente deve gravar em `managerNote` ou `hrNote` conforme regra de negócio.
3. **Login:** Sem rate limit; vulnerável a brute force (mitigação: bcrypt + política de senha e, no futuro, rate limit ou bloqueio).
4. **Datas:** Uso de `new Date()` em períodos; garantir que timezone está alinhado ao uso (ex.: exibição em pt-BR e comparações em UTC ou local conforme regra).

---

## 9. Resumo

- **Arquitetura:** Boa base com repos e services; APIs ainda acopladas a Prisma e com lógica duplicada em export.
- **Type safety:** Melhorar tipagem em APIs e em `times-view-client`; reduzir `any` e casts.
- **Regras de negócio:** Centralizadas e bem usadas na criação de solicitações e aprovação; overlap e filtros de export podem ser unificados com a lib.
- **Erros e logging:** Tratamento básico presente; falta logging estruturado e tratamento explícito de erros de banco.
- **Riscos:** Duplicação de lógica de visibilidade/filtros, uso de `any`, e ausência de rate limit/observabilidade.

As melhorias prioritárias estão refletidas em `next_engineering_roadmap.md`.
