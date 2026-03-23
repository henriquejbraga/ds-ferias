# Guia dos diagramas

Este arquivo virou um mapa de leitura dos diagramas separados em `.mermaid`.

Os arquivos `.mermaid` sao a fonte principal. Este documento explica:

- o que cada diagrama mostra
- em que ordem vale a pena ler
- quais perguntas cada um responde
- quais nuances de arquitetura aparecem no codigo

## Ordem sugerida de leitura

1. [project_macro.mermaid](./project_macro.mermaid)
2. [project_fe_pages_and_ui.mermaid](./project_fe_pages_and_ui.mermaid)
3. [project_fe_dashboard_view_selection.mermaid](./project_fe_dashboard_view_selection.mermaid)
4. [project_api_auth_logout_health_balance.mermaid](./project_api_auth_logout_health_balance.mermaid)
5. [project_api_vacation_requests.mermaid](./project_api_vacation_requests.mermaid)
6. [project_api_vacation_request_actions.mermaid](./project_api_vacation_request_actions.mermaid)
7. [project_api_users_reports_blackout.mermaid](./project_api_users_reports_blackout.mermaid)
8. [project_app_services.mermaid](./project_app_services.mermaid)
9. [project_domain_rules_visibility.mermaid](./project_domain_rules_visibility.mermaid)
10. [project_domain_auth_infra_integrations.mermaid](./project_domain_auth_infra_integrations.mermaid)
11. [project_data_repositories_prisma.mermaid](./project_data_repositories_prisma.mermaid)
12. [project_data_model.mermaid](./project_data_model.mermaid)

## Legenda rapida

- `FE` representa a camada de pagina/componentes do Next.js.
- `API` representa as rotas de `app/api/*`.
- `APP` representa a camada de servicos, que orquestra chamadas.
- `DOMAIN` concentra regras de negocio e infraestrutura compartilhada.
- `DATA` cobre repositories, Prisma e banco.
- `EXT` representa dependencias externas, como BrasilAPI, webhook e analytics.

## 1. Macro

Arquivo: [project_macro.mermaid](./project_macro.mermaid)

Este e o diagrama de orientacao. Ele nao tenta mostrar cada detalhe interno; ele responde a pergunta "quais sao as grandes partes do sistema e como elas conversam?".

O que observar:

- O frontend nao fala sempre com `app/api/*`. `login`, `logout`, mutacoes e exportacoes usam API, mas `dashboard` e `admin` tambem carregam dados direto no servidor.
- Os links de relatorios CSV ficam na experiencia de gestao, mas hoje aparecem apenas para RH dentro de `ManagerView`.
- No backoffice atual, a leitura inicial de usuarios e gestores acontece via SSR com repository; a API de `users` entra principalmente nas mutacoes do client.
- `services/` existe como camada de aplicacao para composicao de dados, principalmente no dashboard e na exportacao.
- `lib/` concentra tanto dominio quanto infraestrutura. Isso quer dizer que nem tudo em `lib/` e "regra pura"; ali tambem moram sessao, rate limit, logger e integracoes.
- `repositories/` encapsulam boa parte das consultas Prisma, reduzindo acoplamento direto das paginas e servicos ao banco.

Quando usar:

- para onboarding rapido
- para explicar a arquitetura a outra pessoa
- para decidir em qual camada uma mudanca deve entrar

## 2. Micro FE - paginas e composicao

Arquivo: [project_fe_pages_and_ui.mermaid](./project_fe_pages_and_ui.mermaid)

Este diagrama detalha a camada visual. Ele responde "quais telas existem e como os componentes se encaixam dentro delas?".

O que observar:

- `app/layout.tsx` e a moldura global. Ele injeta `DashboardNavProvider`, `Toaster` e `Analytics`.
- `app/page.tsx` nao renderiza uma tela real; ele so decide se manda o usuario para `login` ou `dashboard`.
- `app/dashboard/page.tsx` e a pagina principal do produto. Ela compoe sidebar, topbar, cards, lista de pedidos, formulario de nova solicitacao e a view de times.
- `RequestCard` e um componente central. Ele aparece tanto em "Minhas Ferias" quanto na gestao de pedidos.
- `RequestActions` e `ActionButtonForm` concentram as acoes operacionais da UI: aprovar, reprovar, editar e excluir.
- `TimesViewClient` organiza a experiencia da aba `Times`, com filtro, agrupamento e calendario por equipe.
- `BackofficeClient` e a UI administrativa de usuarios.

Quando usar:

- para entender a montagem das telas
- para localizar rapidamente onde uma alteracao visual deve acontecer
- para identificar componentes reutilizados entre views diferentes

## 3. Micro FE - selecao de view no dashboard

Arquivo: [project_fe_dashboard_view_selection.mermaid](./project_fe_dashboard_view_selection.mermaid)

Este diagrama foca numa decisao especifica do frontend: como o `dashboard` decide qual tela interna mostrar.

O que observar:

- A pagina le a sessao primeiro e so depois interpreta os `searchParams`.
- `view` controla se o usuario ve `MyRequestsList`, `ManagerView` ou `TimesView`.
- Nem todo papel pode acessar todas as views; a permissao depende do nivel do papel e da logica de aprovador.
- `NewRequestCardClient` aparece apenas na visao pessoal (`isMyView`).

Quando usar:

- para entender bugs de roteamento interno do dashboard
- para alterar a navegacao por query string
- para adicionar uma nova subview ao dashboard

## 4. Micro API - auth, logout, health e balance

Arquivo: [project_api_auth_logout_health_balance.mermaid](./project_api_auth_logout_health_balance.mermaid)

Este diagrama mostra as rotas basicas de sessao e observabilidade.

O que observar:

- `POST /api/login` aplica rate limit antes de validar credenciais.
- `verifyCredentials()` consulta usuario por e-mail e compara o hash SHA-256 da senha.
- `createSession()` grava o cookie HTTP-only.
- `POST /api/logout` sempre remove a sessao. Se a chamada vier de `fetch`, responde JSON; se vier de `<form>`, a propria rota redireciona para `/login`.
- `GET /api/health` faz um ping simples no banco com `SELECT 1`.
- `GET /api/vacation-balance` e uma leitura autenticada que combina sessao, repository e regra de saldo.

Quando usar:

- para ajustar login/logout
- para revisar autenticacao e sessao
- para monitoramento e health check

## 5. Micro API - vacation-requests

Arquivo: [project_api_vacation_requests.mermaid](./project_api_vacation_requests.mermaid)

Este e o diagrama mais importante do fluxo de negocio. Ele cobre listagem, criacao e exportacao de solicitacoes.

O que observar:

- A listagem segue dois caminhos: funcionario ve so os proprios pedidos; aprovadores usam `buildManagedRequestsWhere()`.
- A criacao tem varias camadas de validacao: sessao, rate limit, parse de periodos, leitura de blackouts, validacao CLT, saldo, periodos aquisitivos e overlap.
- Quando `hireDate` existe, o fluxo tenta sincronizar `AcquisitionPeriod` antes de validar saldo e disponibilidade.
- A exportacao nao faz consulta "na mao" na rota; ela delega para `getVacationRequestsForExport()`, que centraliza filtros e visibilidade para CSV. A listagem HTTP ainda consulta o banco na propria rota, mas reaproveita `buildManagedRequestsWhere()`.

Quando usar:

- para ajustar regras de criacao de ferias
- para entender por que um pedido foi bloqueado
- para revisar filtros e exportacao

## 6. Micro API - actions por request

Arquivo: [project_api_vacation_request_actions.mermaid](./project_api_vacation_request_actions.mermaid)

Este diagrama cobre as rotas que atuam sobre um pedido existente: aprovar, reprovar, editar e excluir.

O que observar:

- Todas essas rotas partem de um bloco comum: carregar sessao, carregar a solicitacao e verificar permissao.
- A aprovacao e o caminho mais complexo. Ela pode exigir confirmacao por conflito de time e ainda atualizar `AcquisitionPeriod.usedDays`.
- A reprovacao exige permissao equivalente a aprovacao, mas com regra adicional de lider direto.
- A edicao so vale para pedidos pendentes e revalida periodo, blackout, overlap e saldo aquisitivo.
- A exclusao nao marca `CANCELADO`; hoje ela remove historico e o pedido do banco.

Quando usar:

- para revisar regras de aprovacao
- para mexer na experiencia de conflito de time
- para corrigir inconsistencias de exclusao ou consumo de saldo

## 7. Micro API - users, reports e blackout

Arquivo: [project_api_users_reports_blackout.mermaid](./project_api_users_reports_blackout.mermaid)

Este diagrama cobre o backoffice de RH e os endpoints administrativos.

O que observar:

- Todas essas rotas passam por sessao, mas nem todas usam o mesmo gate de permissao.
- `app/admin/page.tsx` monta a tela inicial via SSR com `findAllUsersForAdmin()` e `findManagersForAdmin()`. `POST /api/users` e `PATCH /api/users/[id]` ficam responsaveis pelas mutacoes do backoffice.
- `GET /api/users` continua existindo para listagem autenticada de RH e segue alinhado com as mesmas restricoes de permissao.
- `PATCH /api/users/[id]` atualiza os metadados do usuario, incluindo gestor, departamento, papel e data de admissao.
- `GET /api/blackout-periods` e aberto a qualquer usuario autenticado; `POST /api/blackout-periods` e `DELETE /api/blackout-periods?id=...` ficam com papeis de nivel 3+, ou seja, Gerente, Diretor e RH. Mesmo pequeno, esse CRUD impacta diretamente a criacao e a edicao de ferias.
- `GET /api/reports/acquisition-periods` nao apenas consulta `AcquisitionPeriod`: antes do CSV, ele carrega usuarios elegiveis e sincroniza os periodos em lote com `syncAcquisitionPeriodsForUser()`.
- Os relatorios (`balance`, `adherence`, `acquisition-periods`) montam CSV na propria rota, e os links da UI atual aparecem apenas para RH dentro de `ManagerView`.

Quando usar:

- para evoluir backoffice
- para revisar relatorios de RH
- para alterar a regra operacional de blackout

## 8. Micro APP - services

Arquivo: [project_app_services.mermaid](./project_app_services.mermaid)

Este diagrama mostra a camada de orquestracao.

O que observar:

- `dashboardDataService` combina repositories, funcoes de visibilidade e a regra de lider indireto para montar a tela principal.
- `teamMembersService` transforma usuarios crus em estruturas prontas para a aba `Times`, incluindo saldo e status "em ferias".
- `vacationRequestListService` centraliza a exportacao e a regra de visibilidade usada no CSV. A listagem HTTP ainda nao foi totalmente movida para esse service.

Em termos de responsabilidade:

- `services/` nao deveriam guardar regras de dominio profundas
- `services/` devem orquestrar chamadas e devolver estruturas prontas para a pagina/rota

Quando usar:

- para localizar composicao de dados
- para evitar duplicar regra entre paginas e APIs
- para decidir se uma logica pertence a `service`, `lib` ou `repository`

## 9. Micro DOMAIN - regras de negocio e visibilidade

Arquivo: [project_domain_rules_visibility.mermaid](./project_domain_rules_visibility.mermaid)

Este diagrama mostra o coracao funcional do sistema.

O que observar:

- `vacationRules.ts` junta muitas responsabilidades: papeis, aprovacoes, visibilidade, saldo, validacoes CLT, conflitos e feriados locais.
- `requestVisibility.ts` e `dashboardFilters.ts` refinam a leitura de pedidos visiveis para inbox, historico e exportacao.
- A logica de papeis e reaproveitada em varios pontos: pagina, service, API e UI.

Pontos de atencao:

- `vacationRules.ts` e um modulo grande e central. Qualquer mudanca nele pode afetar varios fluxos ao mesmo tempo.
- Parte da semantica de visibilidade esta em `vacationRules.ts`, e parte em `requestVisibility.ts` / `dashboardFilters.ts`. O diagrama ajuda a nao confundir essas fronteiras.

Quando usar:

- para mexer em papeis e hierarquia
- para alterar validacoes CLT
- para revisar inbox, historico e filtros

## 10. Micro DOMAIN - auth, infra e integracoes

Arquivo: [project_domain_auth_infra_integrations.mermaid](./project_domain_auth_infra_integrations.mermaid)

Este diagrama explica os modulos de suporte que nao sao tela nem banco, mas sustentam o runtime.

O que observar:

- `auth.ts` concentra hash de senha, sessao via cookie e leitura/escrita do usuario autenticado.
- `indirectLeaderRule.ts` implementa uma regra bem especifica: lider indireto so atua se o lider direto estava de ferias no momento da solicitacao.
- `rateLimit.ts` usa um `Map` em memoria por processo; isso e simples, mas muda de comportamento se a aplicacao rodar em varias instancias.
- `logger.ts` produz log estruturado em JSON.
- `notifications.ts` dispara webhook opcional.
- `holidaysApi.ts` existe como integracao auxiliar com BrasilAPI, mas os fluxos principais de validacao em `vacationRules.ts` usam calendario local e hoje nao chamam esse modulo.

Quando usar:

- para revisar autenticacao e seguranca
- para revisar observabilidade
- para mexer em integracoes externas

## 11. Micro DATA - repositories e Prisma

Arquivo: [project_data_repositories_prisma.mermaid](./project_data_repositories_prisma.mermaid)

Este diagrama mostra como os repositories se apoiam em Prisma e quais tabelas cada um toca.

O que observar:

- `userRepository.ts` e o repository mais versatil. Ele abastece dashboard, times, admin e relatorios.
- `vacationRepository.ts` concentra a leitura rica de pedidos com usuario e historico.
- `blackoutRepository.ts` e pequeno, mas serve de fonte para validacoes sensiveis da operacao.
- `acquisitionRepository.ts` e o mais "inteligente" do ponto de vista de consistencia: cria ciclos, recalcula `usedDays` e corrige vinculos FIFO.

Quando usar:

- para entender impacto de uma consulta no banco
- para revisar o acoplamento real ao Prisma
- para decidir onde colocar uma nova query

## 12. Micro DATA - modelo de dados

Arquivo: [project_data_model.mermaid](./project_data_model.mermaid)

Este e o ERD do projeto.

O que observar:

- `User` e o centro da hierarquia organizacional.
- `VacationRequest` representa o pedido operacional.
- `VacationRequestHistory` registra auditoria de transicoes.
- `BlackoutPeriod` representa janelas de bloqueio definidas pela empresa.
- `AcquisitionPeriod` modela os ciclos aquisitivos usados no calculo e no consumo FIFO.

Quando usar:

- para mexer em schema Prisma
- para revisar migracoes
- para discutir impacto de novas entidades

## Notas finais

- O macro serve para orientacao.
- Os micros servem para manutencao e investigacao.
- Se algum fluxo parecer "quebrado" entre dois diagramas, isso normalmente indica que a responsabilidade esta dividida entre camadas diferentes.
- Os diagramas nao sao contrato absoluto; a fonte de verdade continua sendo o codigo.
