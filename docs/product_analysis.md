## Visão de produto

O sistema **Editora Globo - Férias** é um gerenciador interno de férias para funcionários CLT, coordenadores/gerentes e RH. A experiência de uso é moderna (Next.js + Tailwind + shadcn/ui), com foco em:

- Autonomia do colaborador para solicitar férias respeitando a CLT.
- Eficiência para gestores na aprovação e acompanhamento da equipe.
- Governança para RH, incluindo relatórios e períodos de blackout.

Do ponto de vista de produto, o sistema cobre bem o fluxo essencial de férias, mas ainda há oportunidades claras de melhoria em visualizações, controles de RH avançados, comunicação e analytics.

## Perspectiva do colaborador

### Pontos fortes

- **Dashboard “Minhas Férias”**
  - Exibe saldo (direito, pendente, usado, disponível) de forma clara.
  - Mostra histórico, calendário mensal e próximas férias com detalhes.
  - Indica visualmente pedidos com **Abono 1/3** e **Adiantamento 13º**, destacando retorno estimado quando há abono.

- **Criação de solicitação**
  - Formulário guiado com explicação das regras CLT (5–30 dias, 3 períodos, 14 dias mínimos etc.).
  - Feedback imediato de dias utilizados, saldo restante e total do ciclo.
  - Bloqueios amigáveis de datas proibidas (aviso prévio, DSR, blackout).

### Lacunas

- **Falta de timeline histórica mais rica**
  - O histórico atual lista solicitações e status, mas não oferece uma linha do tempo consolidada por ciclo/ano, o que facilitaria compreensão de quando o colaborador realmente descansou.

- **Ausência de simulações financeiras**
  - O sistema não mostra estimativas de valor de férias, 1/3 constitucional ou abono, mesmo que apenas aproximadas.

## Perspectiva do gestor (Coordenador/ Gerente)

### Pontos fortes

- **Caixa de aprovação**
  - Lista solicitações da equipe com filtros por status, colaborador, data e departamento.
  - Mostra claramente o papel atual no fluxo (quem deve aprovar em seguida).
  - Cards de solicitação exibem:
    - período;  
    - status;  
    - equipe/departamento;  
    - pedidos de abono/13º;  
    - retorno estimado e dias vendidos quando há abono.

- **Visão de times**
  - Exibe times por coordenador, mostrando quem tem férias a tirar, quem está em férias e conflitos potenciais.

### Lacunas

- **Visualização de sobreposição de férias na equipe**
  - Embora haja detecção de conflitos e indicação textual, não há uma visualização gráfica por time (ex.: calendário de barras por colaborador) para rapidamente ver gargalos.

- **Recomendações de escalonamento**
  - O sistema poderia sugerir remarcação quando muitos membros do mesmo time solicitam períodos coincidentes.

## Perspectiva do RH

### Pontos fortes

- **Visibilidade total**
  - RH enxerga todas as solicitações e pode acompanhar tanto inbox quanto histórico.

- **Relatórios**
  - `Relatório de saldo (CSV)` por usuário (direito, usado, pendente, disponível).
  - `Relatório de adesão` (quem tem direito e não tirou férias).
  - Export de solicitações de férias (`/api/vacation-requests/export`) com filtros.

- **Blackouts**
  - Cadastro e listagem de períodos de blackout por departamento ou globais.

### Lacunas

- **Painel específico para RH**
  - Um painel dedicado com indicadores chave (percentual de adesão, distribuição de férias por mês, times críticos) ainda não existe; o RH usa o mesmo dashboard genérico.

- **Gestão de políticas diferenciadas**
  - Não há lugar para cadastrar políticas específicas por unidade, sindicato ou cargo (ex.: regras diferentes para determinados grupos).

- **Integração com folha de pagamento**
  - O sistema é isolado: não exporta dados estruturados de férias/abono/13º em formato pronto para sistemas de folha.

## Funcionalidades importantes faltantes

### Alta prioridade (produto)

1. **Calendário de equipe/empresa mais rico**
   - Visualização de férias por colaborador na horizontal (estilo Gantt) por time/departamento, para gestores e RH.

2. **Melhor feedback sobre abono e retorno**
   - Já houve evolução visual, mas seria útil:
     - mostrar claramente o **período de descanso efetivo** vs. período financeiro;  
     - permitir configurar se a empresa sempre aplica venda de 10 dias ou se é variável.

3. **Painel de RH com KPIs**
   - Percentual de colaboradores com férias vencidas;  
   - Distribuição de férias por mês;  
   - Times com maior acúmulo de saldo.

### Média prioridade

4. **Notificações mais robustas**
   - Hoje há um mecanismo de notificação programática (`notifyNewRequest`, `notifyApproved`), mas não há uma tela de configuração ou logs de notificação.
   - Sugestão: permitir ao RH configurar canais (e‑mail, webhook) e ver histórico básico de envios.

5. **Auditoria de alterações**
   - O histórico guarda alterações de status, mas não registra mudanças de períodos feitas pelo RH/gestão de forma detalhada (antes/depois do período).

6. **Administração de feriados e regras por unidade**
   - Expor uma tela simples para RH configurar:
     - feriados próprios da empresa;  
     - cidade/estado de referência para cada colaborador/unidade.

### Baixa prioridade

7. **Autoatendimento avançado**
   - Recursos como sugestão automática de datas com baixa taxa de conflito ou bloqueios dinâmicos por equipe.

8. **Analytics avançados**
   - Dashboards com gráficos de tendência de uso de férias ao longo dos anos, correlação entre férias e indicadores de clima/engajamento (se integrados a outros sistemas).

