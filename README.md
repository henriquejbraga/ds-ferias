# Editora Globo - Férias

Sistema interno de gestão de férias com fluxo de aprovação pelo líder direto, regras CLT, **abono 1/3** e **adiantamento de 13º**, além de auditoria completa, **controle por períodos aquisitivos** e **monitoramento avançado**. Desenvolvido com **Next.js 16** (App Router), **Prisma 7**, **PostgreSQL** e **TailwindCSS**.

## Visão geral

- **Colaborador (FUNCIONARIO/COLABORADOR):** cria solicitações, cancela as pendentes, acompanha histórico, saldo, calendário e envia **feedbacks/sugestões**.
- **Coordenador:** aprova/reprova férias do **seu time**, exclui solicitações da equipe e acessa a aba **Times** (reportes diretos com status explícito).
- **Gerente/Diretor:** aprova solicitações dos coordenadores e dos times sob sua gestão; possui visão macro de **Saúde da Operação** e calendários consolidados.
- **RH (Admin):** visualização completa, Backoffice, indicadores estratégicos, gestão de blackouts, **gestão de feedbacks** e monitoramento técnico.

---

## Diferenciais e Segurança (Padrão Sentinel)

O sistema foi blindado para uso corporativo real seguindo diretrizes do **Sentinel**:

- **Analytics Estratégico:** Painel de "Saúde da Operação" na aba Times, mostrando em tempo real o % de disponibilidade da força de trabalho.
- **Segurança Jurídica:** Motor de regras CLT que bloqueia pedidos irregulares automaticamente.
- **Observabilidade de Elite:** Implementação de **Logs Estruturados** em JSON integrados ao **Vercel Logs**.
    - Monitoramento de **Slow Queries** (queries > 500ms no Prisma).
    - Trilha de auditoria para ações administrativas (Audit Trail).
    - Alertas de **Rate Limit** para prevenção de abusos.
- **Proteção de Dados:** 
    - **CSV Injection:** Relatórios sanitizados contra injeção de fórmulas no Excel.
    - **Troca de Senha:** Obrigatoriedade de troca de senha no primeiro acesso.
- **Canal de Feedback:** Interface integrada para usuários relatarem bugs ou sugestões (com suporte a anonimato).

---

## Qualidade e Testes

O projeto possui um rigoroso controle de qualidade:

- **Cobertura de Código:** **91% de Statements** e **94% de Linhas** cobertos por testes automatizados (Vitest).
- **Mutation Testing:** Validado via Stryker (Mutation Score ≥ 85%).
- **Consistência Transacional:** Aprovações utilizam transações atômicas no banco de dados.

---

## Regras CLT (São Paulo) e opções financeiras

Implementadas em `lib/vacationRules.ts`:

- **Direito:** 30 dias a cada 12 meses; até 60 dias acumulados (limite de 2 ciclos).
- **Ciclos Aquisitivos:** Gestão inteligente que para a geração automática no ciclo atual, evitando poluição visual.
- **Fracionamento:** até 3 períodos (um com ≥ 14 dias, demais ≥ 5).
- **Aviso prévio:** 30 dias; feriados (SP + nacionais via BrasilAPI) considerados.
- **Abono 1/3:** Suporte a conversão pecuniária com destaque visual do retorno antecipado.
- **Adiantamento de 13º:** Flag informativa para processamento financeiro pelo RH.

---

## Arquitetura do projeto

- **`app/`** — Rotas (dashboard, login, admin, feedback, API).
- **`components/`** — UI por domínio:
  - **dashboard/** — Sidebar, topbar, stat-cards, blackout, times-view.
  - **requests/** — RequestCard, filtros, MyRequestsList (com help toggles interativos).
  - **layout/** — EmptyState, ExportButton, ícones.
- **`lib/`** — Logger estruturado, regras de férias, auth, visibilidade, Prisma, rate limit.
- **`repositories/`** — Acesso a dados (Prisma): vacation, user, blackout, acquisition, **feedback**.
- **`services/`** — Lógica de negócio e orquestração: `vacationActionService`, `dashboardDataService`.

---

## Stack e segurança

- **Next.js 16** (Turbopack), **Prisma 7**, **PostgreSQL**, **TailwindCSS**, **shadcn/ui**, **sonner**.
- Sessão: cookie HTTP-only assinado via HMAC.
- Senhas: hash SHA-256 com fluxo de troca obrigatória.

---

## Como rodar (dev)

1. **Requisitos:** Node.js LTS, PostgreSQL.
2. **Variáveis de ambiente:** Crie `.env` conforme `.env.example`.
3. **Instalar e preparar o banco:**
```bash
npm install
npx prisma db push
npx prisma generate
```
4. **Popular usuários de teste:**
```bash
npm run db:seed
```
5. **Desenvolvimento:**
```bash
npm run dev
```

---

## Monitoramento em Produção (Vercel)

O sistema emite logs estruturados em JSON. Para acompanhar:
1. Acesse o painel da Vercel → Projeto → **Logs**.
2. Filtre por `level: "error"` para encontrar bugs ou `message: "Slow query"` para problemas de performance.
3. Ações como login, criação de férias e gestão de usuários são logadas com o `actorId` para auditoria.

---

## Documentação Adicional em `docs/`

- **`system_overview.md`** — Visão geral atualizada com feedbacks e monitoramento.
- **`project_data_model.mermaid`** — Modelo de dados incluindo a tabela de Feedback.
- **`architecture.md`** — Detalhes da arquitetura de logs e serviços.
