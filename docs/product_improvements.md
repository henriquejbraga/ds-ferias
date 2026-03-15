# Melhorias de Produto — Editora Globo Férias

Análise sob a ótica de **produto**: o que usuários reais (colaboradores, coordenadores, gerentes, RH) e o negócio precisam além do que já existe.

---

## 1. O que já atende bem

- Fluxo de aprovação em 3 níveis (Coordenador → Gerente → RH) com histórico e notas.
- Dashboard por papel: Minhas Férias, Caixa de Aprovação, Histórico, Times.
- Regras CLT (fracionamento, aviso prévio, feriados, DSR) e saldo de férias.
- Blackout por departamento; filtros e export CSV; relatório de saldo (RH).
- Backoffice para usuários (nome, papel, departamento, gestor); tema claro/escuro.
- Notificações via webhook configurável.

---

## 2. O que usuários e RH podem esperar

### 2.1 Colaborador

- **Calendário visual:** Ver seus períodos aprovados e pendentes em um calendário (mês/ano), além da lista atual.
- **Lembretes:** Aviso quando faltam X dias para o início das férias ou quando o gestor ainda não aprovou (ex.: e-mail ou notificação in-app).
- **Justificativa opcional:** Campo “motivo” ou “observação” na solicitação já existe (notes); poderia ser mais destacado na UI como “Justificativa (opcional)”.
- **Cancelar solicitação:** Já é possível em algum fluxo; garantir que fique claro “cancelar” apenas quando permitido (ex.: pendente) e com confirmação.

### 2.2 Coordenador / Gerente

- **Visão de capacidade da equipe:** “Quantas pessoas podem estar de férias ao mesmo tempo?” ou “Quem está de férias em julho?” para evitar picos. Hoje existe detecção de conflito (>30% / >50%); um resumo por mês ou por período ajudaria.
- **Delegação temporária:** Aprovar em nome de outro gestor (férias/licença do gestor); hoje não há delegação.
- **Ações em lote:** Aprovar ou reprovar várias solicitações de uma vez (com cuidado para não aprovar em massa por engano).
- **Filtros salvos ou “vistas”:** Salvar conjunto de filtros (ex.: “Minha equipe – pendentes”) para acesso rápido.

### 2.3 RH

- **Relatórios gerenciais:** Além do CSV de saldo e do export de solicitações: relatório de adesão (quem não tirou férias), previsão de saída por mês, comparativo entre departamentos.
- **Políticas configuráveis:** Prazos (ex.: aviso prévio em dias), limite de fracionamento, regras por departamento (hoje blackout pode ser por departamento; regras CLT são globais).
- **Auditoria explícita:** Log de quem acessou o quê (ex.: “RH X exportou relatório em tal data”); hoje há histórico por solicitação, não por ação administrativa.
- **Comunicação:** Além do webhook: envio de e-mail ao colaborador (solicitação recebida, aprovada, reprovada) ou integração com Slack/Teams.

### 2.4 Geral (UX)

- **Busca e navegação:** Busca global por colaborador (já existe filtro por nome em listagens); breadcrumbs ou atalhos para “voltar” à última view.
- **Feedback de sucesso:** Toasts ou mensagens claras após criar solicitação, aprovar, reprovar, excluir (sonner já usado; garantir que todas as ações mostrem feedback).
- **Mobile:** Layout responsivo existe; garantir que formulários (nova solicitação, filtros) e tabelas/cards funcionem bem em telas pequenas.
- **Acessibilidade:** Labels, contraste e foco em formulários; garantir que fluxos principais sejam utilizáveis por teclado e leitores de tela.

---

## 3. Priorização sugerida (produto)

| Prioridade | Melhoria | Impacto | Esforço |
|------------|----------|---------|--------|
| Alta | E-mail (ou canal) ao colaborador: solicitação criada / aprovada / reprovada | Reduz dúvidas e “não vi” | Médio |
| Alta | Calendário visual (minhas férias e, para gestores, equipe) | Melhora compreensão e planejamento | Alto |
| Média | Relatório “quem não tirou férias” / adesão | RH e conformidade | Médio |
| Média | Delegação temporária de aprovador | Operação quando gestor ausente | Alto |
| Média | Ações em lote (aprovar/reprovar) com confirmação | Produtividade do gestor | Médio |
| Baixa | Políticas por departamento (ex.: aviso em dias) | Flexibilidade | Alto |
| Baixa | Auditoria de ações administrativas (export, acesso a relatórios) | Compliance | Médio |

---

## 4. Conclusão

O sistema cobre bem o núcleo do fluxo de férias e aprovação. As maiores expectativas adicionais são: **comunicação proativa** (e-mail/notificações), **visão em calendário**, **relatórios gerenciais** e **delegação**. As melhorias de produto aqui listadas podem ser incorporadas ao roadmap técnico em `next_engineering_roadmap.md` como épicos ou itens de backlog.
