## Completude do produto (visao de PM + especialista em sistemas de RH)

### O que esta forte

- Fluxo essencial de ferias CLT com aprovacao em cadeia (Coord -> Gest -> RH).
- Validacoes CLT relevantes:
  - fracionamento (ate 3 periodos, sendo um >= 14 dias),
  - aviso previo minimo (30 dias),
  - restricoes operacionais (DSR/feriados/blackouts).
- Dashboard por papel (Minhas Ferias, Caixa de Aprovação, Historico, Times).
- Alertas de conflito de ferias no time durante aprovacao (com modal e confirmacao explicita).
- Blackouts e relatórios CSV (balance/adherence/export).
- Modelagem de `AcquisitionPeriod` e vinculo parcial de `VacationRequest` para rastrear consumo por periodo aquisitivo.

### O que ainda falta para um sistema "de producao corporativa"

Os pontos abaixo sao lacunas comuns em ambientes reais e devem ser tratados para reduzir risco operacional:

1. **Politica configuravel**
   - Regras CLT/operacionais deveriam ser parametrizaveis (cidades/estados, feriados por unidade, regras por sindicato/unidade).
2. **Trilha completa e padronizada de auditoria**
   - Existe historico de status, mas faltam eventos de auditoria para:
     - alteracao manual de datas,
     - ajustes de saldo/periodos aquisitivos,
     - exclusao por RH/gestores.
3. **Relatorios gerenciais**
   - KPI de RH e painels especificos (aderencia, ferias vencidas, conflitos por time, SLA).
4. **Notificacoes**
   - O webhook existe, mas faltam:
     - configuracao por tenant/unidade/canal,
     - tela de logs/historico de envio.
5. **Consistencia transacional para periodo aquisitivo**
   - O consumo por `AcquisitionPeriod.usedDays` ocorre em aprovacao RH, mas deve ser:
     - idempotente (nao duplicar caso haja reprocessamento),
     - transacional (em conjunto com update do status).
6. **Teste E2E de rotas**
   - A base de testes e boa para dominio; faltam testes para contratos completos das rotas (HTTP -> DB -> resposta).

### Conclusao PM

O sistema cobre o fluxo essencial e ja tem varios mecanismos de robustez. Para virar "pronto para producao" com risco baixo:

- Tornar politicas configuraveis,
- Expandir auditoria,
- Fechar consistencia transacional do consumo aquisitivo,
- Fortalecer E2E das rotas mais criticas.

