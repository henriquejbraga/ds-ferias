## Relatorio de QA (qualidade e confiabilidade)

### Status atual (março/2026)

- Testes: Vitest (suite de unidade/servicos/repositórios).
- Mutation testing: Stryker configurado.
- Cobertura de statements: **91.00%** (alvo >= 90%).
- Cobertura de linhas: **94.55%**.

### O que esta coberto bem

- Regras CLT e validadores: `tests/vacationRules.test.ts` (95%+ de cobertura de linhas).
- Repositórios: `userRepository.ts` e `vacationRepository.ts` (100% de cobertura).
- Fluxo e permissões: visibilidade, aprovações e limitações por papel.
- Sincronização de períodos aquisitivos: `acquisitionRepository.ts` (98%+).
- Notificações e lembretes: `notifications.ts`.

### Execucao rapida (agora)

- `npm run test:run`: **30 arquivos, 290 testes aprovados**.

### Onde ha risco residual

1. **Contratos HTTP (E2E)**
   - Unit tests garantem regras, mas nao substituem testes de API completas.
   - Risco: regressao em parsing, status codes, campos obrigatorios e integração real Prisma.

2. **Fluxos com efeitos colaterais**
   - Especialmente:
     - aprovacao com conflitos (409 + modal + confirmacao),
     - consumo de `AcquisitionPeriod.usedDays` em aprovacao RH,
     - atualizacao/exclusao e consistencia de saldo.

3. **Datas e timezone**
   - Ha mitigacoes (UTC/local), mas casos extremos (anos/ciclos/momentos de conversao) devem ter testes de integracao.

### Recomendacao de plano de testes (alto impacto)

- Criar `tests/api/` para cobrir:
  - `POST /api/vacation-requests`
  - `POST /api/vacation-requests/[id]/approve|reject|update|delete`
  - `GET /api/reports/balance`, `GET /api/vacation-requests/export` e `GET /api/reports/acquisition-periods`
- Adicionar cenarios de retry/idempotencia para consumo de periodo aquisitivo.

