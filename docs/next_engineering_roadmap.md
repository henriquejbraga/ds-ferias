# Próximos Passos de Engenharia — Editora Globo Férias

Roadmap priorizado: bugs, segurança, performance, arquitetura, testes, observabilidade e produto. Cada item traz descrição, prioridade, dificuldade, impacto esperado e arquivos afetados.

---

## 1. Bugs

| # | Descrição | Prioridade | Dificuldade | Impacto | Arquivos |
|---|-----------|------------|-------------|---------|----------|
| 1.1 | Export: alinhar status do histórico para coordenador com `filterRequests` (incluir CANCELADO na lista de “historico” se for o caso) | Média | Baixa | Consistência entre UI e CSV | `app/api/vacation-requests/export/route.ts` |
| 1.2 | Aprovação: confirmar se gerente (level 3) deve gravar nota em `managerNote` ou `hrNote` e ajustar se necessário | Média | Baixa | Dados corretos no histórico | `app/api/vacation-requests/[id]/approve/route.ts`, schema Prisma |
| 1.3 | Validar formato de id (CUID) nas rotas `[id]` antes de consultar Prisma | Baixa | Baixa | Menos consultas inválidas e mensagens claras | `app/api/vacation-requests/[id]/*.ts`, `app/api/users/[id]/route.ts` |

---

## 2. Segurança

| # | Descrição | Prioridade | Dificuldade | Impacto | Arquivos |
|---|-----------|------------|-------------|---------|----------|
| 2.1 | Migrar hash de senha de SHA-256 para bcrypt ou argon2 (com migração de hashes existentes) | Alta | Média | Resistência a vazamentos e rainbow tables | `lib/auth.ts`, `prisma/schema.prisma` (opcional), migração de dados |
| 2.2 | Rate limit em login e em criação de solicitações | Alta | Média | Mitigar brute force e abuso | Middleware ou rotas `app/api/login/route.ts`, `app/api/vacation-requests/route.ts` |
| 2.3 | Revisar necessidade de CSRF em formulários/APIs (Next.js e cookies SameSite) | Média | Baixa | Documentar ou reforçar proteção | Documentação, headers |

---

## 3. Performance

| # | Descrição | Prioridade | Dificuldade | Impacto | Arquivos |
|---|-----------|------------|-------------|---------|----------|
| 3.1 | Export: para grandes volumes, considerar paginação ou streaming do CSV | Média | Média | Evitar timeouts e alto consumo de memória | `app/api/vacation-requests/export/route.ts` |
| 3.2 | Cache de blackouts e/ou de saldo por usuário (curto TTL) onde fizer sentido | Baixa | Média | Menos consultas repetidas no dashboard | `services/dashboardDataService.ts`, camada de cache (ex.: Redis ou in-memory) |

---

## 4. Arquitetura

| # | Descrição | Prioridade | Dificuldade | Impacto | Arquivos |
|---|-----------|------------|-------------|---------|----------|
| 4.1 | Unificar listagem/export: service que usa `buildManagedRequestsWhere` + `filterRequestsByVisibilityAndView` (ou equivalente) e usar nas APIs GET vacation-requests e GET export | Alta | Média | Uma única fonte de verdade para visibilidade e filtros | `services/` (novo ou estender `dashboardDataService`), `app/api/vacation-requests/route.ts`, `app/api/vacation-requests/export/route.ts` |
| 4.2 | Extrair “overlap” para service ou `vacationRules`: função que recebe userId + períodos e retorna se há conflito (usando repo) | Média | Baixa | Reuso e testes; API POST mais enxuta | `lib/vacationRules.ts` ou `services/`, `app/api/vacation-requests/route.ts` |
| 4.3 | Admin e relatório de saldo: usar `userRepository` e, se fizer sentido, um `reportService` | Média | Baixa | Consistência e testabilidade | `app/admin/page.tsx`, `app/api/reports/balance/route.ts` |
| 4.4 | Opcional: dividir `vacationRules.ts` em submódulos (roles, balance, validation, holidays) | Baixa | Média | Manutenção e testes isolados | `lib/vacationRules.ts` → vários arquivos em `lib/vacation/` ou similar |

---

## 5. Testes

| # | Descrição | Prioridade | Dificuldade | Impacto | Arquivos |
|---|-----------|------------|-------------|---------|----------|
| 5.1 | Testes de integração/API: criar solicitação, aprovar, reprovar, excluir (com mocks de Prisma ou DB de teste) | Alta | Média | Garantir fluxos ponta a ponta | `tests/api/` ou `tests/integration/`, rotas API |
| 5.2 | Aumentar mutation score Stryker até ≥80%: cobrir mutantes sobreviventes com novos asserts ou casos | Média | Média | Confiabilidade da suíte | Diversos `tests/*.test.ts` |
| 5.3 | Testes para regras de visibilidade e filtros no export (reuso da lib) | Média | Baixa | Evitar regressões ao unificar lógica | `tests/requestVisibility.test.ts` ou `tests/export.test.ts` |

---

## 6. Observabilidade

| # | Descrição | Prioridade | Dificuldade | Impacto | Arquivos |
|---|-----------|------------|-------------|---------|----------|
| 6.1 | Health check: rota GET /api/health (e opcionalmente checagem de DB) | Alta | Baixa | Deploy e monitoramento | `app/api/health/route.ts` |
| 6.2 | Logging estruturado: erros de API e ações sensíveis (login, aprovação, reprovação, export) | Alta | Média | Diagnóstico e auditoria | `lib/logger.ts` ou similar, rotas API e auth |
| 6.3 | Métricas (opcional): contadores de solicitações criadas/aprovadas/reprovadas, tempo de resposta | Baixa | Média | Capacidade e SLA | Middleware ou rotas, integração com ferramenta de métricas |

---

## 7. Produto (recorte engenharia)

| # | Descrição | Prioridade | Dificuldade | Impacto | Arquivos |
|---|-----------|------------|-------------|---------|----------|
| 7.1 | Envio de e-mail ao colaborador (solicitação criada / aprovada / reprovada): integrar Resend ou SMTP | Alta | Média | Menos dúvidas e maior adesão | `lib/notifications.ts`, env, templates |
| 7.2 | Calendário visual (minhas férias e, para gestores, equipe): componente e dados por mês | Média | Alto | UX e planejamento | `components/`, `services/`, API ou dados existentes |
| 7.3 | Relatório “adesão” (quem não tirou férias no período): nova rota ou extensão do relatório de saldo | Média | Média | RH e conformidade | `app/api/reports/`, `services/` |

---

## Ordem sugerida de execução (primeiras sprints)

1. **Rápido e alto impacto:** Health check (6.1), validação de id (1.3), tipagem de status na aprovação (evitar `as any`) e alinhamento export/histórico (1.1).
2. **Arquitetura e consistência:** Unificar listagem/export (4.1), extrair overlap (4.2), usar repos em admin/reports (4.3).
3. **Segurança:** Rate limit (2.2), planejamento bcrypt/argon2 (2.1).
4. **Testes e qualidade:** Testes de API/integração (5.1), logging (6.2), depois mutation score (5.2).
5. **Produto:** E-mail (7.1); em seguida calendário (7.2) e relatórios (7.3) conforme prioridade de negócio.

Os itens da seção “Implementar melhorias de alto valor” abaixo foram escolhidos com base neste roadmap (tipagem, redução de duplicação e preparação para testes).
