## Visao geral do sistema

Este projeto e um sistema interno de gestao de ferias CLT para a Editora Globo. O objetivo e permitir:

- **Colaborador:** criar solicitacoes de ferias respeitando regras CLT, acompanhar saldo FIFO e enviar feedbacks.
- **Gestores (Coordenador, Gerente, Diretor):** aprovar/reprovar solicitações de seus subordinados com visao de conflitos de equipe.
- **RH (Admin):** visualizacao global, indicadores estratégicos de saúde da operação, gestão de usuários e **administração de feedbacks**.

---

## Arquitetura e Observabilidade

- **App Router (Next.js 16):** Rotas otimizadas e renderização híbrida.
- **Monitoramento Estruturado:** Integração nativa com Vercel Logs usando um logger centralizado em JSON.
  - Rastreamento de ações administrativas (Audit Trail).
  - Alertas de performance (Slow Queries > 500ms).
  - Detecção de abusos via Rate Limit.
- **Camada de Dados:** Prisma 7 com transações para garantir consistência entre pedidos e saldos.

---

## Papeis e fluxo de aprovacao

O fluxo de aprovação é de **etapa única**, onde o status final reflete o papel do aprovador:

- `PENDENTE` -> `APROVADO_COORDENADOR` | `APROVADO_GERENTE` | `APROVADO_DIRETOR`

- **Regra de Hierarquia:** O aprovador deve ter nível superior ao solicitante.
- **Líder Indireto:** Pode atuar apenas se o líder direto estiver em período de gozo de férias.

---

## Gestão de Feedbacks e Sugestões

O sistema possui um canal direto para melhoria contínua:
- **Envio:** Qualquer usuário pode enviar relatos (Bug, Sugestão, Elogio).
- **Privacidade:** Suporte a envio **Anônimo** (sem vínculo de ID no banco) com assinatura opcional por apelido.
- **Gestão (RH):** Tela exclusiva para o RH visualizar, marcar como "Resolvido" ou excluir relatos, com paginação e ordenação por recência.

---

## Segurança e Governança (Padrão Sentinel)

- **Sanitização de Relatórios:** Proteção contra *CSV Formula Injection*.
- **Integridade de Acesso:** Troca de senha obrigatória e cookies assinados.
- **Auditoria Total:** Cada mudança de status ou alteração de usuário gera um log rastreável no monitoramento de produção.

---

## Modelo de Dados (Entidades)

- `User`: Cadastro, cargos e hierarquia.
- `VacationRequest`: O pedido de férias com flags de abono/13º.
- `AcquisitionPeriod`: Ciclos de 12 meses para controle de saldo FIFO.
- `Feedback`: Relatos dos usuários com controle de status (Pendente/Resolvido).
- `BlackoutPeriod`: Datas bloqueadas para solicitações.
