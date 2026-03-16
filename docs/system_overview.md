## Visão geral do sistema

O projeto **Editora Globo - Férias** é um sistema interno de gestão de férias construído sobre **Next.js (App Router)**, **Prisma** e **PostgreSQL**. A aplicação é full‑stack React (RSC + Client Components) com rotas de API em `app/api/*`, e segue uma arquitetura em camadas:

- **app/**: páginas e APIs (camada de aplicação e orquestração HTTP).
- **components/**: componentes de UI por domínio (dashboard, requests, calendário, times, admin).
- **services/**: serviços de aplicação que coordenam regras de negócio e acesso a dados.
- **repositories/**: camada de acesso a dados com Prisma.
- **lib/**: regras de negócio (domínio), autenticação, visibilidade, utilitários de datas, feriados e logging.
- **prisma/**: schema, migrations e seed.
- **tests/**: suíte de testes de unidade, domínio e serviços com Vitest + Stryker.

O foco é suportar fluxos de solicitação, aprovação e controle de férias alinhados à hierarquia corporativa (Funcionário → Coordenador/ Gerente → RH) e às regras principais da CLT.

## Fluxos principais

- **Solicitação de férias (colaborador)**  
  - Tela `Minhas Férias` (`app/dashboard/page.tsx` + `NewRequestCardClient`) permite criar até 3 períodos no mesmo ciclo, com validações CLT:
    - 5–30 dias por período; no máximo 3 períodos; pelo menos um período ≥ 14 dias; aviso prévio mínimo de 30 dias; início/fim evitando DSR.  
  - A rota `POST /api/vacation-requests` aplica:
    - `validateCltPeriods` (regras CLT e datas);  
    - `checkBlackoutPeriods` (períodos de bloqueio);  
    - `calculateVacationBalance` (saldo e direito a férias);  
    - `hasOverlappingRequest` (sobreposição com outras solicitações ativas);  
    - verificação de saldo disponível por ciclo.

- **Aprovação / reprovação (gestão e RH)**  
  - Coordenadores e gerentes visualizam solicitações da equipe via `ManagerView`, alimentado por `dashboardDataService` e `requestVisibility`.  
  - Aprovação acontece via `POST /api/vacation-requests/[id]/approve`, que usa:
    - `canApproveRequest` + `ROLE_LEVEL` para garantir que apenas o nível adequado aprova cada etapa;  
    - validações de visibilidade (`hasTeamVisibility`);  
    - criação de histórico (`VacationRequestHistory`).  
  - A cadeia de status é linear:
    - `PENDENTE` → `APROVADO_COORDENADOR` → `APROVADO_RH` (com aliases legados `APROVADO_GESTOR`, `APROVADO_GERENTE`).  
  - A reprovação segue fluxo similar via `POST /api/vacation-requests/[id]/reject`.

- **Gestão de RH e relatórios**  
  - RH enxerga todas as solicitações (visibilidade total em `hasTeamVisibility`), e a caixa de aprovação lista pedidos em fila para o RH.  
  - Relatórios CSV:
    - `api/reports/balance`: saldo consolidado por colaborador;  
    - `api/reports/adherence`: quem tem direito mas não tirou férias no ano;  
    - `api/vacation-requests/export`: export de solicitações por filtros.  
  - Blackouts são geridos via `BlackoutPeriod` e expostos em `api/blackout-periods`.

## Modelo de dados

### User

- Campos principais:
  - `id`, `name`, `email`, `passwordHash`, `role` (FUNCIONARIO, COORDENADOR, GERENTE, RH e aliases legados);
  - `registration` (matrícula, única);
  - `department`, `hireDate`;
  - `managerId`/`reports` (hierarquia).
- Relações:
  - `vacationRequests`, `historyEntries`, `blackoutPeriods`, `manager`, `reports`.

### VacationRequest

- Campos:
  - `userId`, `startDate`, `endDate`, `status`;  
  - `notes` (solicitante), `managerNote` (gestão), `hrNote` (RH);  
  - flags financeiras: `abono` (pedido de venda de 1/3) e `thirteenth` (pedido de adiantamento de 13º);  
  - `createdAt`, `updatedAt`.
- Histórico:
  - `VacationRequestHistory` registra transições de status, responsável e nota.

### BlackoutPeriod

- Períodos de bloqueio de férias com `startDate`, `endDate`, `reason` e `department` opcional.
- Apenas RH/gestão podem cadastrar; aplicados a todos ou a um departamento específico.

## Regras de domínio centrais

Concentradas em `lib/vacationRules.ts` e `lib/requestVisibility.ts`:

- **Hierarquia e aprovação**  
  - `ROLE_LEVEL`, `ROLE_LABEL`, `getNextApprovalStatus`, `canApproveRequest`, `getApprovalSteps`, `getApprovalProgress`.
  - `hasTeamVisibility` e `buildManagedRequestsWhere` determinam o que cada papel enxerga (coordenador só time direto, gerente times diretos/indiretos, RH tudo).

- **Regras CLT de férias**  
  - `validateCltPeriods`:
    - 5–30 dias por período;  
    - máximo 3 períodos por ciclo;  
    - ao menos um período ≥ 14 dias;  
    - aviso prévio de 30 dias;  
    - bloqueia início em sexta/sábado e término em sábado/domingo;  
    - considera feriados e DSR com apoio de `holidaysApi`.

- **Saldo de férias**  
  - `calculateVacationBalance`:
    - calcula meses trabalhados;  
    - concede 30 dias por cada 12 meses completos (ciclos acumulados);  
    - soma dias aprovados e pendentes por status para obter `usedDays`, `pendingDays` e `availableDays`.

- **Conflitos e visibilidade**  
  - `hasOverlappingRequest` (rota de criação) bloqueia sobreposição com solicitações ativas do mesmo colaborador.  
  - `detectTeamConflicts` identifica conflitos de férias dentro de times (usado em telas de times).

## Considerações de arquitetura

- **Pontos fortes**
  - Separação razoável entre UI (`components`), aplicação (`services`/`app`), domínio (`lib`) e dados (`repositories`).  
  - Regras críticas centralizadas em poucos módulos (`vacationRules`, `requestVisibility`), facilitando testes.  
  - Boa cobertura de testes de domínio e workflows com Vitest + Stryker.

- **Pontos de atenção**
  - `vacationRules.ts` é um módulo grande e multifuncional, o que aumenta o risco de regressão ao evoluir regras.  
  - Parte da validação ainda é feita diretamente nas rotas, com pouca validação baseada em schema.  
  - Lógica de saldo e ciclos é complexa; qualquer ajuste na CLT ou em políticas internas exige muita cautela e testes.

