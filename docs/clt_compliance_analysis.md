## Fontes e escopo

Esta análise de conformidade considera regras de férias da **CLT** e da legislação trabalhista brasileira, com foco em:

- Aquisição de férias (período aquisitivo de 12 meses).
- Fracionamento de férias (até 3 períodos, com restrições de duração).
- Aviso prévio para marcação.
- Pagamento de férias (1/3 constitucional) e **abono pecuniário** (venda de até 1/3 dos dias).
- Possibilidade de antecipar a primeira parcela do **13º salário** junto com as férias.
- Restrições de agendamento (DSR, feriados, blackouts).

Fontes consultadas incluem: texto consolidado da CLT, materiais de orientação de órgãos trabalhistas e artigos especializados de 2026 sobre fracionamento de férias, abono pecuniário e antecipação de 13º.

## Resumo das regras CLT relevantes

1. **Aquisição de férias**
   - Após **12 meses de trabalho**, o empregado adquire direito a **30 dias de férias**.
   - Podem existir múltiplos períodos aquisitivos acumulados (ex.: 24 meses ⇒ 60 dias de direito).

2. **Fracionamento**
   - As férias podem ser fracionadas em **até 3 períodos**, desde que:
     - Pelo menos **um período tenha 14 dias corridos ou mais**.
     - Os demais períodos tenham ao menos **5 dias corridos** cada.
   - O fracionamento deve ser acordado entre empregador e empregado.

3. **Aviso prévio**
   - O empregado deve ser avisado da concessão das férias com **no mínimo 30 dias de antecedência**.

4. **Pagamento de férias e 1/3 constitucional**
   - O empregador deve pagar as férias **até 2 dias antes** do início do período de gozo.
   - O empregado recebe a remuneração do período + **1/3 constitucional** (33,33%).
   - Deve considerar médias de horas extras, adicionais e comissões.

5. **Abono pecuniário (“venda” de férias)**
   - O empregado pode converter em dinheiro até **1/3 das férias** (até 10 dias em um período de 30).
   - O pedido deve ser feito até **15 dias antes do fim do período aquisitivo** (regra formal da CLT).
   - Menores de 18 anos não podem vender férias.
   - O empregador pode recusar o abono.

6. **13º salário**
   - O empregado pode solicitar a antecipação da **primeira parcela** do 13º:
     - Junto com as férias (solicitação usualmente até janeiro); ou  
     - Até 30 de novembro, dependendo da política da empresa.

7. **Agendamento e restrições adicionais**
   - A lei não proíbe explicitamente início/ fim em finais de semana, mas empresas frequentemente evitam início em sexta/sábado e fim em sábado/domingo por motivos operacionais e de DSR.
   - Empresas podem definir **períodos de blackout** internos (ex.: fechamento contábil), desde que não inviabilizem o gozo do direito.

## Implementação atual no sistema

### Aquisição e saldo de férias

- Implementado em `calculateVacationBalance`:
  - Calcula meses trabalhados a partir de `hireDate`.
  - Concede 30 dias a cada 12 meses completos (`yearsWorked * 30`).
  - Computa `usedDays` a partir de solicitações com `APROVADO_RH` e `pendingDays` a partir de status pendentes/em aprovação.
  - Impede solicitação quando `monthsWorked < 12` (sem direito).
  - Impede exceder o total de dias disponíveis (`availableDays`).

**Conformidade:**  
✅ Em linha com a CLT para aquisição de 30 dias a cada 12 meses.  
⚠️ Não diferencia formalmente períodos aquisitivos (anos civis) nem trata prescrição/caducidade de férias não gozadas.

### Fracionamento e duração

- Implementado em `validateCltPeriods`:
  - Garante **5–30 dias** por período, máximo de **3 períodos**.
  - Exige pelo menos **um período com 14 dias ou mais** no ciclo.
  - Verifica se a combinação total dos períodos não ultrapassa o direito no ciclo.

**Conformidade:**  
✅ Atende às regras principais de fracionamento pós‑reforma (1≥14 dias, demais ≥5, até 3 períodos).  
⚠️ A verificação de “acordo entre as partes” é implícita (o sistema assume que o gestor/RH representam o empregador).

### Aviso prévio e agendamento

- O sistema aplica:
  - Aviso prévio mínimo de **30 dias** (`validateCltPeriods` compara datas com `today`).  
  - Regra de DSR/operacional:
    - Início não pode ser sexta/sábado;  
    - Término não pode ser sábado/domingo.
  - Integração com **feriados nacionais + feriados de SP** via `holidaysApi`/`isSaoPauloHoliday`, usada para validações e exibições.

**Conformidade:**  
✅ Aviso prévio de 30 dias implementado.  
✅ Regras adicionais de início/fim e feriados melhoram aderência à prática de mercado.  
⚠️ Não há parametrização por localização (ex.: outras cidades/estados além de SP).

### Pagamento de férias, 1/3 constitucional e abono

- O sistema **não calcula valores monetários** de férias, 1/3 constitucional ou tributos; foca apenas em dias de gozo e saldo.
- **Abono 1/3**:
  - Representado por um campo booleano `VacationRequest.abono`.
  - UI permite marcar “Solicitar conversão de 1/3 das férias em abono”.
  - O sistema:
    - **não desconta** automaticamente os 10 dias do saldo;  
    - não calcula o valor do abono;  
    - trata o pedido como um **indicador para RH**, com explicações visuais (retorno até 10 dias antes).
  - Não há validação de:
    - limite de 10 dias por período;  
    - prazo formal de até 15 dias antes do fim do período aquisitivo;  
    - restrição de idade (menores de 18 anos).

**Conformidade:**  
⚠️ Parcial. O sistema captura a intenção de abono e comunica impacto no retorno, mas não implementa as regras legais de limite, prazo e elegibilidade; também não integra com folha para cálculo financeiro.

### 13º salário

- O campo `thirteenth` indica pedido de **adiantamento de 13º junto com férias**.
- Não há:
  - cálculo de valores;  
  - controle formal do prazo máximo (até 30 de novembro);  
  - vínculo com folha ou regras tributárias.

**Conformidade:**  
⚠️ Parcial, focada apenas em sinalizar o pedido para RH. A lógica financeira/tributária e controles de prazo não estão implementados.

### Blackout periods

- `BlackoutPeriod` e `checkBlackoutPeriods`:
  - Permitem bloquear solicitações que se sobrepõem a janelas críticas (fechamento, picos, etc.).
  - Podem ser globais ou por departamento.

**Conformidade:**  
✅ Alinhado com a prática comum de empresas; não é exigência legal, mas reforça governança.

### Cadeia de aprovação e permissões

- Cadeia modela o fluxo FUNCIONÁRIO → COORDENADOR/GERENTE → RH.
- `canApproveRequest` impede aprovação própria e respeita níveis hierárquicos.
- `hasTeamVisibility` garante que coordenadores/gerentes vejam apenas suas equipes; RH enxerga tudo.

**Conformidade:**  
✅ Compatível com estruturas organizacionais típicas e com a necessidade de controle empresarial sobre férias.  
⚠️ A CLT exige apenas comunicação e registro; o modelo multi‑nível é uma escolha de política interna.

## Gaps de conformidade identificados

### Alta prioridade

1. **Abono pecuniário sem validação de limite e prazo**
   - **Problema:** o sistema registra apenas um flag de pedido de abono, sem:
     - limitar formalmente a quantidade de dias vendidos a 10 por ciclo;  
     - controlar o prazo de solicitação (até 15 dias antes do fim do período aquisitivo);  
     - bloquear venda para menores de 18 anos.
   - **Risco:** discrepância entre o que o colaborador solicita e o que a CLT permite; risco de expectativas incorretas se o RH não tratar fora do sistema.

2. **Ausência de cálculo financeiro oficial**
   - **Problema:** o sistema não calcula o valor das férias, 1/3 constitucional, abono ou antecipação de 13º.
   - **Risco:** se usado como fonte “oficial” de pagamentos, não atenderia às exigências legais (médias de extras, tributos, prazos de pagamento).

### Média prioridade

3. **Não modelagem explícita de períodos aquisitivos**
   - **Problema:** o saldo é calculado por ciclos de 12 meses acumulativos, mas não há entidade ou registro claro de períodos aquisitivos e concessivos.
   - **Risco:** dificuldade para tratar cenários de férias vencidas, múltiplos períodos vencidos e regras internas específicas de prescrição.

4. **Feriados e DSR centralizados em SP**
   - **Problema:** validações de feriado usam feriados nacionais + São Paulo; outras localidades não são parametrizáveis.
   - **Risco:** em empresas com unidades em outros estados/municípios, a validação poderia divergir das práticas locais.

### Baixa prioridade

5. **Controle de antecipação de 13º apenas informativo**
   - **Problema:** o campo `thirteenth` não valida janelas de solicitação (janeiro/novembro) nem integra com folha.
   - **Risco:** baixo se o sistema for apenas sinalizador; aumenta se for tomado como “fonte da verdade” para pagamentos.

## Recomendações de conformidade

1. **Definir claramente o papel do sistema**  
   - Se o sistema for apenas **operacional de dias e aprovação**, documentar explicitamente que cálculos financeiros e regras detalhadas de abono/13º são responsabilidade da folha/RH.
   - Se for evoluir para **fonte oficial de pagamento**, planejar módulos de cálculo financeiro com contabilidade/DP.

2. **Aprimorar o suporte a abono**
   - Adicionar campos estruturados:
     - `abonoDays` (0–10) por solicitação ou ciclo;  
     - validações que impedem exceder 10 dias vendidos.  
   - Validar prazo de solicitação com base na `hireDate` + período aquisitivo.  
   - Bloquear abono para colaboradores com idade < 18 anos (se `birthDate` estiver disponível).

3. **Modelar períodos aquisitivos**
   - Introduzir uma abstração de “período aquisitivo”/“ciclo de férias” na lógica de saldo, permitindo relatórios de férias vencidas e múltiplos ciclos pendentes.

4. **Parametrização de feriados**
   - Tornar configurável o conjunto de feriados por unidade/filial, em vez de fixo em SP, com possibilidade de desligar/ligar a verificação por site.

