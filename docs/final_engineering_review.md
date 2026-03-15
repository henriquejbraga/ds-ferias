# Revisão Final de Engenharia — Editora Globo Férias

**Data:** Março 2026  
**Responsável:** Principal Engineer / Tech Lead  
**Escopo:** Estado atual do sistema, melhorias implementadas nesta revisão, dívida técnica restante e recomendações.

---

## 1. Qualidade atual do sistema

### 1.1 Pontos fortes

- **Arquitetura:** Separação clara entre repositories, services, páginas e componentes. Dashboard enxuto (~161 linhas); regras de negócio centralizadas em `lib/vacationRules.ts` e `lib/requestVisibility.ts`.
- **Funcionalidade:** Fluxo completo de férias (solicitação, aprovação em 3 níveis, reprovação, histórico, blackout, saldo, export CSV, relatório de saldo para RH, aba Times).
- **Regras CLT:** Implementadas e validadas (fracionamento, aviso prévio, feriados SP, DSR, 14 dias, teto por ciclo).
- **Testes:** Cobertura alta (≥85%) em lib, services e repositories; Stryker configurado (threshold 80%); 154 testes na suíte, incluindo fluxos de aprovação e validação.
- **Segurança de sessão:** Cookie HTTP-only com assinatura HMAC quando `SESSION_SECRET` está definido.
- **UX:** Tema claro/escuro, layout responsivo, toasts (sonner), loading no login e na navegação.

### 1.2 Fraquezas conhecidas

- **APIs:** Parte das rotas ainda usa Prisma direto e lógica duplicada (ex.: export repete filtros de view/role); GET vacation-requests foi corrigido para usar `buildManagedRequestsWhere` para aprovadores.
- **Tipos:** Uso residual de `any` em algumas rotas e em componentes (reduzido nesta revisão em approve e times-view-client).
- **Segurança:** Hash de senha em SHA-256; ausência de rate limit em login e criação de solicitações.
- **Observabilidade:** Sem health check estruturado (agora existe `/api/health`); logging limitado a avisos em desenvolvimento.
- **Mutation score:** Pode ficar abaixo de 80% até ampliação dos testes/asserts.

---

## 2. Melhorias implementadas nesta revisão

| Melhoria | Arquivos | Descrição |
|----------|----------|-----------|
| **Tipagem na aprovação** | `app/api/vacation-requests/[id]/approve/route.ts` | Uso de `VacationStatus` (Prisma) em vez de `as any` para o próximo status. |
| **GET vacation-requests por visibilidade** | `app/api/vacation-requests/route.ts` | Aprovadores passam a usar `buildManagedRequestsWhere`; colaboradores mantêm filtro por `userId` + status + query. Elimina vazamento de dados (antes retornava todas as solicitações para qualquer role). |
| **Health check** | `app/api/health/route.ts` | Rota GET `/api/health` que verifica conectividade com o banco; retorna 200 ou 503. |
| **Export histórico (coordenador)** | `app/api/vacation-requests/export/route.ts` | Inclusão de status `CANCELADO` na lista de status do histórico para coordenador, alinhado a `filterRequests`. |
| **Tipos em times-view-client** | `components/times-view-client.tsx` | Tipo `VacationRequestSummary` e uso em `requests` e em callbacks, substituindo `any`. |
| **Testes de workflows** | `tests/workflows.test.ts` | Novos testes para cadeia de aprovação (Coordenador → Gerente → RH), checagem de permissões, validação de criação (CLT + blackout) e saldo/entitlement. |

Nenhuma funcionalidade existente foi quebrada; a suíte de 154 testes passa.

---

## 3. Dívida técnica restante

1. **Unificar listagem e export:** Criar (ou estender) um service que use `buildManagedRequestsWhere` + `filterRequestsByVisibilityAndView` e consumi-lo na API GET vacation-requests e na API de export, eliminando duplicação de regras de view/role.
2. **Extrair overlap para service/lib:** Função que recebe userId + períodos e indica conflito com solicitações existentes (usando repository), reutilizada na API POST vacation-requests.
3. **Admin e relatório de saldo:** Passar a usar `userRepository` (e eventualmente um `reportService`) em vez de Prisma direto.
4. **Senha:** Migrar para bcrypt ou argon2 e definir estratégia de migração dos hashes atuais.
5. **Rate limit:** Aplicar em login e em criação de solicitações.
6. **Logging:** Log estruturado de erros e de ações sensíveis (login, aprovação, reprovação, export).
7. **vacationRules.ts:** Opcionalmente modularizar em submódulos (roles, balance, validation, holidays) para facilitar evolução e testes.
8. **Mutation score:** Aumentar cobertura de mutantes até ≥80% com novos asserts ou casos de teste.

---

## 4. Próximas funcionalidades recomendadas (alto impacto)

- **Notificação por e-mail:** Integrar Resend (ou SMTP) para enviar ao colaborador quando a solicitação for criada, aprovada ou reprovada.
- **Calendário visual:** Visão de “minhas férias” e, para gestores, “equipe” por mês.
- **Relatório de adesão:** Quem não tirou férias no período (para RH e conformidade).
- **Delegação temporária:** Permitir que um aprovador delegue a outro em período de férias/ausência.

---

## 5. Recomendações arquiteturais

- **APIs:** Manter a tendência de “API fina”: autenticação/autorização na rota, orquestração e regras em services, dados em repositories. Unificar listagem/export em um service compartilhado.
- **Tipos:** Reduzir ao máximo `any` e casts; usar tipos gerados pelo Prisma e tipos de domínio em `types/` onde fizer sentido.
- **Observabilidade:** Manter `/api/health`; evoluir para logging estruturado e, se necessário, métricas (contadores de solicitações, tempo de resposta).
- **Testes:** Manter cobertura alta e testes de workflow; quando houver tempo, adicionar testes de integração que chamem as rotas HTTP (com mocks de DB ou banco de teste) para cobrir contratos das APIs.

---

## 6. Documentação gerada

- **docs/project_state.md** — Estado do projeto, documentação existente, problemas resolvidos e em aberto, maturidade e riscos.
- **docs/code_review.md** — Revisão de código (arquitetura, type safety, regras de negócio, APIs, erros, possíveis bugs).
- **docs/product_improvements.md** — Melhorias de produto (colaborador, gestores, RH, UX).
- **docs/next_engineering_roadmap.md** — Roadmap priorizado (bugs, segurança, performance, arquitetura, testes, observabilidade, produto).
- **docs/final_engineering_review.md** — Este documento.

A base está sólida para evolução contínua; as prioridades imediatas recomendadas são unificação da listagem/export, segurança (senha + rate limit) e observabilidade (logging).
