# Estado do Projeto — Editora Globo Férias

**Data da análise:** Março 2026  
**Responsável:** Revisão de engenharia (Principal Engineer / Tech Lead)

---

## 1. Documentação existente

### 1.1 Documentos presentes em `docs/`

| Documento | Conteúdo |
|-----------|----------|
| **refactor_analysis.md** | Análise que motivou a refatoração: dashboard monolítico (~1360 linhas), `vacationRules.ts` grande (~592), acoplamento página–Prisma, ausência de repositories/services. |
| **refactor_plan.md** | Plano de estrutura: repositories, services, componentes por domínio (dashboard, requests, layout), tipos centralizados. |
| **refactor_report.md** | Relatório pós-refatoração: dashboard reduzido (~159 linhas), criação de repositories (vacation, user, blackout), services (dashboardData, teamMembers), componentes extraídos, tipos em `types/dashboard.ts`. |

### 1.2 Documentos removidos (referenciados no contexto do projeto)

Os seguintes documentos **não existem mais** em `docs/` (foram removidos em limpeza anterior):

- `system_audit.md`
- `security_audit.md`
- `performance_report.md`
- `engineering_roadmap.md`
- `engineering_audit.md`
- `agent_report.md`

As **recomendações que foram implementadas** (com base no README e no código atual) incluem: sessão com HMAC quando `SESSION_SECRET` definido, visibilidade centralizada (`requestVisibility`), filtros de dashboard, cobertura de testes ≥85%, Stryker com threshold 80%. Itens que seguem em aberto: migração de hash de senha para bcrypt/argon2, notificações por e-mail, relatórios adicionais.

---

## 2. Problemas já resolvidos

- **Dashboard monolítico:** Dividido em página enxuta + services + componentes por domínio.
- **Acesso a dados:** Concentrado em `repositories/` (vacation, user, blackout).
- **Orquestração:** `dashboardDataService` e `teamMembersService` encapsulam lógica e uso de repos + regras.
- **Tipos:** `types/dashboard.ts` com filtros e estruturas de times; tipagem explícita nos componentes.
- **Testes:** Cobertura de lib, services e repositories; meta ≥85% atingida; Stryker configurado (threshold 80%).
- **Segurança de sessão:** Cookie assinado com HMAC quando `SESSION_SECRET` está definido.
- **Visibilidade de solicitações:** `buildManagedRequestsWhere` e `filterRequestsByVisibilityAndView` como fonte única para “quem vê o quê”.

---

## 3. Problemas em aberto / parcialmente implementados

- **APIs ainda usam Prisma direto:** Rotas em `app/api/` (ex.: `vacation-requests/route.ts`, `export/route.ts`) não utilizam os services/repositories de forma consistente; há duplicação de lógica (ex.: `hasOverlappingRequest`, construção de `where`) e uso de `any` em alguns pontos.
- **Hash de senha:** Continua SHA-256; recomendação de migrar para bcrypt/argon2 não implementada.
- **`lib/vacationRules.ts`:** Mantido como módulo único (~592 linhas); refactor_report sugere opcionalmente dividir em submódulos (roles, balance, validation, holidays).
- **Mutation score Stryker:** Configurado para ≥80%; na prática o score atual pode ficar abaixo, exigindo mais testes/asserts para matar mutantes.
- **Observabilidade:** Sem métricas estruturadas, tracing ou health checks dedicados; logs ad hoc (ex.: auth em desenvolvimento).

---

## 4. Maturidade atual do sistema

| Dimensão | Avaliação | Comentário |
|----------|-----------|------------|
| **Arquitetura** | Boa | Camadas repos/services/pages/components estabelecidas; APIs ainda acopladas a Prisma. |
| **Qualidade de código** | Boa | Código legível; alguns `any` e casts em APIs e em componentes (ex.: times-view-client). |
| **Regras de negócio** | Boa | CLT, hierarquia, aprovação e saldo centralizados em `vacationRules.ts` e usados de forma consistente na UI e em parte das APIs. |
| **Testes** | Boa | Cobertura alta em lib/services/repositories; fluxos E2E ou de integração das APIs não cobertos. |
| **Segurança** | Média | Sessão HMAC; senha em SHA-256; sem rate limit ou CSRF explícito documentado. |
| **Operação / observabilidade** | Baixa | Sem health check, métricas ou logging estruturado. |

---

## 5. Dívida técnica resumida

1. **APIs:** Alinhar rotas de vacation-requests (e export) aos services/repositories e `requestVisibility`; remover `any` e duplicação de validação/where.
2. **Tipos:** Eliminar `any` em `times-view-client.tsx` e em rotas API; usar tipos Prisma ou tipos explícitos de request/balance.
3. **vacationRules.ts:** Opcionalmente modularizar em submódulos para facilitar evolução e testes isolados.
4. **Senha:** Planejar migração para bcrypt/argon2 (compatibilidade com hashes antigos).
5. **Observabilidade:** Introduzir health check, logging estruturado e, se necessário, métricas.

---

## 6. Riscos conhecidos

- **Mutation testing:** Build de mutação pode falhar até que mais mutantes sejam mortos (meta 80%).
- **Produção:** Uso de SHA-256 para senha e ausência de rate limit aumentam risco em caso de vazamento ou abuso.
- **Evolução de APIs:** Lógica duplicada entre API e services pode levar a divergências (ex.: regras de filtro ou visibilidade).

Este documento serve de base para o roadmap de engenharia e para a revisão de código detalhada em `code_review.md`.
