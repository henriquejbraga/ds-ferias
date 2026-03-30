## Visao geral do sistema

Este projeto e um sistema interno de gestao de ferias CLT para um laboratorio/empresa (Editora Globo - Ferias). O objetivo e permitir:

- Colaborador: criar solicitacoes de ferias respeitando regras CLT e bloqueios internos.
- Gestores (Coordenador, Gerente, Diretor): aprovar/reprovar solicitações de seus subordinados diretos ou indiretos.
- RH: visualizacao global, relatorios, gestao de blackouts e auditoria (não participa do fluxo de aprovação).

---

## Arquitetura (alto nivel)

- `app/`: paginas e rotas HTTP (App Router).
- `components/`: UI por dominio (dashboard, requests, times, calendario, admin).
- `services/`: orquestracao e composicao de dados (ex: `vacationActionService`).
- `repositories/`: acesso a dados via Prisma (User, Vacation, Blackout, Acquisition).
- `lib/`: regras de negocio (dominio), auth, visibilidade, conflitos, utilitarios de datas.

---

## Papeis e fluxo de aprovacao (status)

O fluxo de aprovação é de **etapa única**. Qualquer gestor com nível hierárquico superior ao solicitante pode aprovar a solicitação, movendo-a para um estado terminal de aprovação que reflete o papel do aprovador:

- `PENDENTE` -> `APROVADO_COORDENADOR` | `APROVADO_GERENTE` | `APROVADO_DIRETOR`

Regra de permissao e definida em `lib/vacationRules.ts`:

- `ROLE_LEVEL` define a hierarquia (FUNCIONARIO=1, COORDENADOR=2, GERENTE=3, DIRETOR=4, RH=5).
- `canApproveRequest` garante que o aprovador tenha nível superior ao solicitante e que o RH não possa aprovar.
- `getNextApprovalStatus` define o status final com base no papel de quem aprova.
- Líderes indiretos só podem atuar se o líder direto estiver de férias (regra em `lib/indirectLeaderRule.ts`).

---

## Fluxo fim-a-fim (do pedido ao consumo do periodo aquisitivo)

1. Criacao do pedido:
   - Endpoint: `POST /api/vacation-requests`
   - Validacoes principais:
     - `validateCltPeriods` (CLT: fracionamento, aviso previo, DSR/feriados, etc.)
     - `checkBlackoutPeriods` (periodos bloqueados)
     - Overlap com outros pedidos ativos do proprio colaborador
     - Saldo via `calculateVacationBalance` e validação de período concessivo (FIFO).
   - Regras de elegibilidade:
     - Sem 12 meses de empresa o pedido é tratado como pré-agendamento (validação específica).

2. Aprovacao:
   - Endpoint: `POST /api/vacation-requests/[id]/approve`
   - Revalida permissao (hierarquia) e visibilidade.
   - Calcula conflito de ferias no time via `detectTeamConflicts`.
   - Se houver conflito (>30% do time), o sistema exige confirmação (`confirmConflict: true`).

3. Consumo do periodo aquisitivo:
   - Implementado com **consistência transacional** via `prisma.$transaction`.
   - Ao aprovar, o sistema:
     - Identifica o `AcquisitionPeriod` mais antigo com saldo disponível (FIFO).
     - Incrementa `AcquisitionPeriod.usedDays`.
     - Vincula o pedido ao período via `VacationRequest.acquisitionPeriodId`.
     - Garante idempotência usando `updateMany` condicionado ao status anterior.

---

## Modelos principais (Prisma)

- `User`: hierarquia por `managerId`, papel (`Role`), relacionamento com `acquisitionPeriods`.
- `VacationRequest`: datas, status, flags (`abono`, `thirteenth`) e vinculo opcional com `acquisitionPeriodId`.
- `AcquisitionPeriod`: ciclos explicitamente persistidos de 12 meses e acumulador `usedDays`.
- `VacationRequestHistory`: auditoria de mudancas de status.
- `BlackoutPeriod`: bloqueios internos cadastrados pelo RH.

