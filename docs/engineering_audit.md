## Visão técnica geral

O código segue um padrão de **camadas claras** (app → services → repositories → lib) e usa ferramentas modernas (Next 16, Prisma 7, Vitest, Stryker). Em geral, a arquitetura está bem estruturada para um sistema de férias interno, com boa separação entre UI, domínio e banco de dados. O principal risco é a concentração de muita lógica em poucos módulos grandes e a ausência de uma camada de validação formal para os contratos HTTP.

### Arquitetura e separação de responsabilidades

- **Camada de aplicação (`app/`)**
  - Páginas e rotas API são relativamente finas: autenticação, autorização, parsing básico de entrada e delegação para serviços e funções de domínio.
  - As rotas de férias (`api/vacation-requests`, `api/vacation-requests/[id]/*`) encapsulam lógica de fluxo (aprovar, reprovar, cancelar, editar), mas dependem fortemente de utilitários em `lib/` para aplicar regras de negócio.

- **Camada de serviços (`services/`)**
  - `dashboardDataService` reúne dados de múltiplos repositórios, aplica filtros, regras de visibilidade e alimenta componentes server (`DashboardPage`).
  - `teamMembersService` prepara dados agregados de times, incluindo saldo e status (em férias ou não).
  - `vacationRequestListService` centraliza a lógica de listagem/filtragem para export e dashboards, o que reduz duplicação.

- **Repositórios (`repositories/`)**
  - Encapsulam consultas Prisma e evitam espalhar `prisma.*` pelas rotas.
  - Queries são expressivas e usam includes adequados (usuário, histórico, hierarquia).
  - Pontos de melhoria: adicionar índices explícitos no schema para colunas frequentemente consultadas.

- **Domínio (`lib/`)**
  - `vacationRules.ts` cobre:
    - hierarquia de papéis, aprovação e visibilidade;  
    - regras CLT de períodos, aviso prévio e fracionamento;  
    - cálculo de saldo;  
    - conflitos por equipe;  
    - integração com feriados nacionais/SP.
  - `requestVisibility.ts` abstrai quem enxerga o quê e quais status aparecem na inbox/histórico por papel.
  - `auth.ts`, `rateLimit.ts`, `logger.ts`, `dashboardFilters.ts` e `notifications.ts` cuidam de cross‑cutting concerns.

### Qualidade de código e manutenibilidade

- **Pontos fortes**
  - Tipagem consistente em TypeScript; uso de tipos explícitos em services e componentes.
  - Uso de utilitários de datas em UTC para evitar bugs de timezone.
  - Funções de domínio geralmente puras e com poucos efeitos colaterais (exceto acesso a APIs externas de feriados).
  - Testes de unidade e workflows bem escritos, cobrindo cenários CLT típicos.

- **Pontos fracos / débitos técnicos**
  - **Módulo monolítico de regras**: `vacationRules.ts` concentra muitas responsabilidades (roles, CLT, saldo, visibilidade, conflitos).  
    - Impacto: qualquer mudança exige muito contexto e aumenta o risco de regressão.
  - **Validação dispersa**: a validação de payloads é feita manualmente em várias rotas (checando `typeof`, datas, presença de campos), sem schema compartilhado.
  - **Overlap duplicado**: a lógica de sobreposição de períodos (`hasOverlappingRequest`) existe como função local na rota e não como parte do módulo de domínio, o que dificulta reutilização e testes isolados.
  - **Índices de banco ausentes**: o schema Prisma não declara índices para campos muito usados em filtros (`userId`, `status`, `startDate`, `endDate`, `managerId`), o que pode afetar performance à medida que o volume cresce.
  - **Hash de senha**: uso de SHA‑256 em vez de bcrypt/argon2 é aceitável em ambiente de demonstração, mas inadequado para produção.

### Escalabilidade e extensibilidade

- A arquitetura atual é adequada para um único tenant e tráfego moderado, com:
  - poucas dependências externas (DB + API de feriados);
  - acesso a dados centralizado;
  - lógica de domínio de férias bem encapsulada.
- Para evoluir para multi‑tenant, alta escala ou integrações complexas, seriam necessários:
  - modularizar `vacationRules` em submódulos independentes (saldo, CLT, feriados, visibilidade);
  - introduzir uma camada de **domínio explícita** (`domain/`) com entidades e use cases desacoplados de Next/Prisma;
  - adicionar mecanismos de cache e índices no banco para relatórios pesados.

### Principais riscos técnicos

1. **Acoplamento excessivo em `vacationRules.ts`**  
   - Afeta: `lib/vacationRules.ts`, services que o consomem.  
   - Risco: dificuldade para incorporar novas regras CLT, políticas por unidade/país ou integrações com folha sem quebrar fluxos existentes.

2. **Validação de dados insuficiente nas rotas**  
   - Afeta: `app/api/vacation-requests/*`, `app/api/login`, `app/api/users/*`.  
   - Risco: payloads malformados ou inconsistentes podem passar, gerando estados inválidos ou erros de runtime difíceis de depurar.

3. **Ausência de índices para queries críticas**  
   - Afeta: todas as views de dashboard e relatórios (`vacationRequest`, `user`).  
   - Risco: degradação de performance com centenas/milhares de solicitações; impacto direto em UX para RH/gestores.

4. **Hash de senha fraco para produção**  
   - Afeta: `lib/auth.ts`, `prisma/seed.ts`.  
   - Risco: se usado em ambiente real, representa vulnerabilidade séria de segurança.

### Recomendações técnicas

1. **Modularizar regras de férias**
   - Criar submódulos em `lib/vacation-rules/`:
     - `roles.ts` (ROLE_LEVEL, ROLE_LABEL, canApprove, hasTeamVisibility);  
     - `clt-validation.ts` (validateCltPeriods, DSR, feriados);  
     - `balance.ts` (calculateVacationBalance);  
     - `conflicts.ts` (detectTeamConflicts, hasOverlappingRequest);  
     - `holidays.ts` (integração com BrasilAPI + cache).
   - Manter `lib/vacationRules.ts` como façade, reexportando as funções principais.

2. **Introduzir camada de validação baseada em schema**
   - Adotar Zod ou biblioteca similar para definir schemas de:
     - Login (`email`, `password`);  
     - Criação e update de férias (`periods`, `notes`, `abono`, `thirteenth`);  
     - Atualização de usuário (papel, departamento, hireDate).  
   - Reutilizar esses schemas em rotas e testes de API.

3. **Otimizar queries com índices**
   - Atualizar `prisma/schema.prisma` para incluir `@@index` em:
     - `VacationRequest(userId)`, `VacationRequest(status)`, `VacationRequest(startDate, endDate)`,  
     - `User(managerId)`, `User(role)`, `User(department)`.  
   - Rodar migrações e medir impacto em endpoints de dashboard e relatórios.

4. **Planejar migração de hash de senha**
   - Introduzir funções `hashPassword`/`verifyPassword` baseadas em bcrypt ou argon2.  
   - Suportar transição de SHA‑256 legado (detecção por formato/tamanho) e rehash na próxima autenticação bem‑sucedida.

5. **Domínio explícito e observabilidade**
   - Criar `domain/` com agregados (`VacationRequest`, `User`, `Team`) e use cases (criar férias, aprovar, reprovar, cancelar, gerar relatório).  
   - Integrar logging estruturado e métricas em pontos críticos (criação/ aprovação/ reprovação/ cancelamento/ relatórios) para monitorar uso e falhas em produção.

