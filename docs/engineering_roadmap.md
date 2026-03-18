## Roadmap de Engenharia (prioridades para producao)

### Alta prioridade

1. **Teste E2E de rotas (contratos HTTP)**
   - Garantir status codes e validações reais no Prisma em fluxo completo.
   - Focar endpoints de aprovacao/cancelamento/consumo de `AcquisitionPeriod` e export CSV.

2. **Consistencia transacional no consumo do periodo aquisitivo**
   - Ao aprovar como RH, executar update do `VacationRequest` e incremento do `AcquisitionPeriod.usedDays` em uma unica transacao.
   - Garantir idempotencia (nao duplo incremento em retry).

3. **Validação de payloads com schema**
   - Introduzir Zod (ou equivalente) para:
     - criação e update de ferias,
     - payloads de approve/reject,
     - payload de login.

4. **Camada de use cases (minima) / maquina de estados**
   - Centralizar regras de transicao de status em um unico modulo.
   - Reduzir duplicacao e risco de desvio entre rotas.

### Media prioridade

1. **Auditoria completa**
   - Registrar eventos de:
     - alteracao manual de periodo,
     - ajuste de blackout,
     - exclusao por papel,
     - vinculacao a `AcquisitionPeriod`.

2. **Performance no dashboard e times**
   - Introduzir cache e reduzir N+1.
   - Paginar/limitar includes historicos quando o volume crescer.

3. **KPIs e relatorios gerenciais**
   - Painel dedicado para RH com percentuais, distribuicao e SLA.

### Baixa prioridade

1. Parametrizacao de feriados/DSR por unidade.
2. Acessibilidade automatizada e testes de UI.
3. Melhorias de UX em calendarios e visuais de conflito.

