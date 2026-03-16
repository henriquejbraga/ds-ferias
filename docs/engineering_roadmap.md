## Roadmap de Engenharia — Prioridades

Este roadmap consolida as principais ações técnicas necessárias para levar o sistema a um nível de produto pronto para produção em escala, mantendo conformidade com a CLT e boa experiência para colaboradores, gestores e RH.

As iniciativas estão agrupadas por prioridade (Alta, Média, Baixa).

---

## Alta prioridade

### 1. Testes de API end‑to‑end

- **Motivo:** hoje confiamos majoritariamente em testes de domínio e serviços; mudanças nas rotas podem passar sem cobertura.
- **Ações:**
  - Criar `tests/api/` com testes de:
    - Login/ logout.  
    - Criação de férias (`POST /api/vacation-requests`) em cenários de sucesso e erros (CLT, saldo, blackout, overlap).  
    - Aprovação/ reprovação/ cancelamento/ atualização (`/api/vacation-requests/[id]/*`).  
    - Relatórios e export CSV.
  - Validar status HTTP, formato de resposta e mensagens de erro.

### 2. Validação baseada em schema

- **Motivo:** validação manual dispersa aumenta risco de inconsistência entre rotas.
- **Ações:**
  - Introduzir Zod (ou similar) em `lib/validation.ts` para:
    - Payload de login.  
    - Criação/ update de férias (incluindo `abono` e `thirteenth`).  
    - Atualizações de usuário/ admin.
  - Reutilizar schemas nas rotas e nos testes de API.

### 3. Modularização de `vacationRules.ts`

- **Motivo:** módulo monolítico, difícil de evoluir sem regressões.
- **Ações:**
  - Criar pasta `lib/vacation-rules/` com submódulos:
    - `roles.ts`, `balance.ts`, `clt-validation.ts`, `holidays.ts`, `conflicts.ts`.  
  - Manter `lib/vacationRules.ts` como façade de compatibilidade, reexportando as funções.
  - Atualizar imports gradualmente para os novos submódulos.

### 4. Índices de banco para queries críticas

- **Motivo:** queries de dashboard e relatórios dependem de filtros intensivos em `userId`, `status`, `startDate`, `endDate` e `managerId`.
- **Ações:**
  - Atualizar `prisma/schema.prisma` com índices adequados (`@@index`).  
  - Rodar migrações e validar impacto em ambientes de teste.

---

## Média prioridade

### 5. Refinar suporte a abono pecuniário e 13º

- **Motivo:** hoje os campos `abono` e `thirteenth` são flags informativas, sem validações de CLT.
- **Ações:**
  - Adicionar campo opcional `abonoDays` (0–10) por solicitação ou ciclo.  
  - Validar que a soma de `abonoDays` não ultrapassa 10 dias por período/ciclo.  
  - Se o sistema for evoluir para cálculo financeiro, integrar com módulo de folha ou export detalhado.

### 6. Modelagem de períodos aquisitivos

- **Motivo:** saldo atual é calculado com base em meses trabalhados, sem entidade clara de período aquisitivo.
- **Ações:**
  - Introduzir um conceito de “ciclo de férias” (período aquisitivo + concessivo) na lógica de saldo.  
  - Permitir relatórios de férias vencidas e múltiplos ciclos pendentes.

### 7. Painel de RH e visualizações avançadas

- **Motivo:** RH usa hoje dashboards genéricos; faltam KPIs específicos.
- **Ações:**
  - Criar página dedicada para RH com:
    - KPIs de férias vencidas, adesão, distribuição por mês.  
    - Lista de times/unidades com maior acúmulo de saldo.  
  - Evoluir visualização de calendário de equipe (Gantt simplificado).

### 8. Testes de componentes client

- **Motivo:** UI é crítica para UX, mas pouco coberta por testes.
- **Ações:**
  - Adicionar testes com React Testing Library para:
    - `NewRequestCardClient`;  
    - `EditPeriodFormClient`;  
    - `TimesView`/ dashboards principais.

---

## Baixa prioridade

### 9. Migração de hash de senha para bcrypt/argon2

- **Motivo:** SHA‑256 não é adequado para produção.
- **Ações:**
  - Implementar `hashPassword/verifyPassword` com bcrypt/argon2.  
  - Suportar login com hash antigo e rehash transparente até migração completa.

### 10. Parametrização de feriados e unidades

- **Motivo:** hoje os feriados focam em SP; empresas podem ter unidades em outras localidades.
- **Ações:**
  - Permitir configuração de feriados por unidade/filial e por colaborador.  
  - Persistir metadados de localização no `User` ou em entidade de unidade.

### 11. Observabilidade e auditoria

- **Motivo:** há logging estruturado, mas pouca visibilidade agregada.
- **Ações:**
  - Integrar logs com plataforma de observabilidade (ELK, Datadog, etc.).  
  - Registrar eventos de auditoria para alterações sensíveis (ajuste de períodos, mudanças de papel, alterações manuais de saldo).

