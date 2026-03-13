## Portal de Férias (DS-Férias)

Aplicação interna para gestão de férias (colaborador, gestor e RH) construída em **Next.js 16**, **Prisma 7** e **Postgres**, com fluxo de aprovação em duas etapas (gestor → RH), histórico de mudanças e validações alinhadas à CLT (São Paulo).

---

### Visão geral funcional

- **Papéis**
  - **COLABORADOR**: cria solicitações, edita/exclui enquanto estiverem pendentes, acompanha o histórico.
  - **GESTOR**: aprova/reprova férias do **seu time direto** e exclui solicitações; também pode criar as próprias férias.
  - **RH**: faz a aprovação final, agrupada por gestor, e pode excluir qualquer solicitação; também pode criar as próprias férias.

- **Regras principais**
  - **Fluxo de aprovação em 2 etapas**:
    - 1ª etapa: **Gestor** aprova solicitações com status `PENDENTE`.
    - 2ª etapa: **RH** aprova solicitações com status `APROVADO_GESTOR`.
  - **Autoprovação proibida**:
    - Ninguém pode aprovar nem reprovar a **própria solicitação** (checado na API).
  - **Escopo do Gestor**:
    - Gestor só vê na tela de aprovação as férias dos **colaboradores cujo `managerId` = id do gestor**.
  - **Caixa de aprovação x Histórico** (para Gestor/RH):
    - **Caixa de aprovação (`view=inbox`)**:
      - Gestor: apenas solicitações `PENDENTE` do seu time.
      - RH: apenas solicitações `APROVADO_GESTOR`.
    - **Histórico (`view=historico`)**:
      - Gestor: `APROVADO_GESTOR`, `APROVADO_RH`, `REPROVADO`.
      - RH: `APROVADO_RH`, `REPROVADO`, **agrupado por gestor**.
  - **Histórico de mudanças**:
    - Cada aprovação/reprovação gera um registro em `VacationRequestHistory` com:
      - `previousStatus`, `newStatus`, `changedByUserId`, `note`, `changedAt`.
    - O histórico é exibido para colaborador, gestor e RH (data **e hora**).

-- **Regras de CLT implementadas**
  - As férias são sempre de **30 dias corridos no total**, podendo ser gozadas em **até 3 períodos**.
  - Regras de fracionamento (implementadas em `lib/vacationRules.ts`):
    - Pelo menos **um dos períodos** deve ter **14 dias corridos ou mais**.
    - Os demais períodos, se existirem, devem ter **no mínimo 5 dias corridos**.
    - Não é permitido que os períodos se **sobreponham** entre si.
  - Aviso mínimo: **30 dias de antecedência** entre a data de hoje e o início do **primeiro período**.
  - **Conflitos com outras solicitações**:
    - Não é possível criar/editar um período que se sobreponha a outra solicitação **pendente ou aprovada** do mesmo colaborador.
    - Períodos que “encostam” (ex.: um termina dia 29 e outro começa dia 30) são permitidos.
  - **Saldo por período aquisitivo (CLT)**:
    - A cada **12 meses** de trabalho (a partir da data de admissão), o colaborador adquire direito a **30 dias** de férias.
    - Ex.: **quase 2 anos** de empresa sem ter gozado férias → **2 períodos** → direito a **60 dias** (30 + 30).
    - O saldo é calculado em `lib/vacationRules.ts` (`calculateVacationBalance`).

---

### UX / UI e comportamento de tela

- **Dashboard**
  - **Colaborador**:
    - Coluna principal: `Minhas Solicitações` (cards com período, status e histórico).
    - Sidebar:
      - Card **Nova Solicitação** com seletor de data (início/término).
      - Card “Como funciona” explicando o fluxo de aprovação.
  - **Gestor / RH**:
    - Coluna principal:
      - Navegação em pill:
        - **📥 Caixa de Aprovação** – apenas pedidos que precisam de ação agora.
        - **📋 Histórico** – pedidos já aprovados/reprovados.
      - Filtros:
        - Busca por colaborador (`q` via query string).
        - Filtro por status (`status` via query string).
      - Lista:
        - Cards com nome/e-mail do colaborador, período, status e histórico.
        - Botões de **Aprovar / Reprovar / Excluir** com estado de carregamento.
        - Para RH, o histórico é **agrupado por gestor**.
    - Sidebar:
      - Card **Nova Solicitação** (gestor/RH também podem pedir férias).
      - Card de dicas operacionais.
      - Cards de **estatísticas rápidas** (pendentes / aprovadas).

- **Feedback ao usuário**
  - Uso de **toasts flutuantes** com [`sonner`](https://sonner.emilkowal.ski/):
    - Sucesso: criação, aprovação, reprovação, exclusão.
    - Erro: violações de CLT, sobreposição de datas, falta de permissão etc.
  - Duração dos toasts: ~**8 segundos**.
  - Botões exibem label de loading (ex.: “Aprovando…”, “Excluindo…”).

- **Layout e tema**
  - Estilo inspirado em **O Globo** (tons de azul, branco, cinza).
  - Suporte a **modo claro/escuro** via `ThemeToggle`.
  - Tipografia e espaçamentos ampliados para evitar necessidade de zoom manual.

---

### Stack técnica

- **Frontend / Backend**
  - **Next.js 16** (App Router, rotas em `app/api/*`).
  - Componentes com:
    - Server Components para carregamento de dados e controle de sessão.
    - Client Components para formulários, ações de aprovação e UI interativa.
  - CSS com **Tailwind** + `app/globals.css` (tema customizado).
  - Componentes base do **shadcn/ui** (ex.: `Button`) e `sonner` para toasts.

- **Banco / ORM**
  - **Postgres**.
  - **Prisma 7** com `PrismaPg` adapter:
    - Schema em `prisma/schema.prisma`.
    - Geração do client em `generated/prisma`.
  - Modelos principais:
    - `User` (inclui `role`, `managerId`, relação `reports`).
    - `VacationRequest` (datas, status, notas de gestor/RH, usuário).
    - `VacationRequestHistory` (auditoria de mudanças).

- **Autenticação**
  - Login por **e-mail + senha**.
  - Senhas armazenadas com **hash SHA-256**.
  - Sessão via cookie HTTP-only, manipulada em `lib/auth.ts`.

---

### Usuários de teste

Todos os usuários abaixo usam a **mesma senha**:

- **Senha padrão**: `senha123`

#### Colaboradores

- **Colaborador 1**
  - E-mail: `colaborador1@empresa.com`
- **Colaborador 2**
  - E-mail: `colaborador2@empresa.com`
  - Cenário de teste: **quase 2 anos de empresa, nunca tirou férias** → direito a **60 dias** (2 períodos). Para popular: `npm run db:seed` (define `hireDate` em ~24 meses atrás).

#### Gestores

- **Gestor Líder**
  - E-mail: `gestor@empresa.com`
- **Gestor Projeto**
  - E-mail: `gestor2@empresa.com`

#### RH

- **RH Master**
  - E-mail: `rh@empresa.com`
- **RH Operacional**
  - E-mail: `rh2@empresa.com`

> Observação: gestores e RH também podem criar solicitações de férias, mas **não podem aprovar/reprovar as próprias solicitações**. Sempre é necessário outro usuário para aprovar.

---

### Como rodar o projeto localmente

1. **Dependências**
   - Node.js LTS
   - Postgres rodando e acessível (local ou remoto).

2. **Variáveis de ambiente**

Crie um arquivo `.env` na pasta `ds-ferias` com pelo menos:

```bash
DATABASE_URL="postgresql://usuario:senha@host:porta/banco"
```

3. **Instalar dependências**

```bash
npm install
```

4. **Rodar migrações e gerar Prisma Client**

> Atenção: se o banco não estiver acessível, `prisma migrate` pode falhar com `P1001`. Corrija a conexão antes de rodar.

```bash
npx prisma migrate dev
npx prisma generate
```

4.1. **Popular cenário Colaborador 2 (quase 2 anos, 60 dias de direito)**  
   - Rode o seed: `npm run db:seed`. Isso cria/atualiza o usuário `colaborador2@empresa.com` com `hireDate` em ~24 meses atrás, sem férias, resultando em **60 dias disponíveis**.

5. **Subir o servidor de desenvolvimento**

```bash
npm run dev
```

A aplicação ficará disponível em `http://localhost:3000`.

6. **Popular usuários**
   - Use o **Prisma Studio** para criar usuários com os e-mails acima e `passwordHash` gerado para `senha123`, ou reutilize os registros já existentes no seu banco.
   - Defina o `role` (`COLABORADOR`, `GESTOR`, `RH`) e, para colaboradores, associe o `managerId` ao gestor correto.

---

### Como contribuir / extender o sistema

- **Novas regras de negócio**
  - Validações de CLT centralizadas em `lib/vacationRules.ts`:
    - `validateCltPeriod` para um único bloco (5–30 dias, aviso mínimo de 30 dias).
    - `validateCltPeriods` para férias fracionadas em até 3 períodos (um ≥ 14 dias, demais ≥ 5, sem sobreposição, aviso mínimo).
  - Adicionar regras específicas da empresa (ex.: bloquear férias em períodos críticos, limite de colaboradores simultâneos por equipe).

- **Melhorias de UX**
  - Visão do RH com filtros adicionais:
    - Por gestor (managerId) – selecionar apenas equipes de um gestor específico.
    - Por período (data inicial/final) – filtrar solicitações por janela de datas.
  - Dashboard adicional com calendário consolidado da empresa.

- **Backoffice / Admin**
  - Tela de administração para:
    - Cadastrar/editar usuários.
    - Definir relações de gestor → time (gerenciar `managerId`).
    - Ajustar parâmetros de regra (mínimo/máximo de dias, aviso mínimo etc.).

- **Boas práticas para PRs**
  - Manter validações de regra sempre no **backend** (rotas API) e, opcionalmente, duplicar no front apenas para UX.
  - Garantir que toda mudança em status crie um registro consistente em `VacationRequestHistory`.
  - Rodar `npx prisma generate` após qualquer alteração em `schema.prisma`.
  - Manter mensagens ao usuário em **português** e coerentes com o tom atual da UI.

---

### Ideias de melhorias futuras (roadmap sugerido)

Estas são sugestões baseadas em padrões comuns de portais internos de férias em empresas médias/grandes:

- **1. Calendário corporativo consolidado**
  - Visão mensal/anual mostrando:
    - Férias aprovadas por equipe/gestor.
    - Picos de ausência (para evitar muitos colaboradores de uma mesma área saindo juntos).
  - Filtros por área, gestor, colaborador e status.

- **2. Limite de pessoas simultâneas em férias por equipe**
  - Regra configurável por gestor/RH:
    - Ex.: “no máximo 2 pessoas da equipe X em férias ao mesmo tempo”.
  - Validação de conflito considerando esse limite, antes da aprovação.

- **3. Sobra de saldo de férias / integração com folha**
  - Campo de **saldo de dias** de férias do colaborador (sincronizado com folha ou cadastrado manualmente).
  - Bloquear solicitações acima do saldo ou apenas sinalizar alerta para RH.

- **4. Workflows especiais**
  - Aprovação diferenciada para:
    - Cargos críticos (ex.: diretoria, TI de produção).
    - Períodos sensíveis (ex.: fechamento contábil, black friday).
  - Tabelas de “janelas bloqueadas” por área/período.

- **5. Notificações**
  - Integração com e-mail/Teams/Slack:
    - Quando um colaborador cria pedido → notificar gestor.
    - Quando gestor aprova → notificar RH.
    - Quando RH aprova/reprova → notificar colaborador.

- **6. Relatórios gerenciais**
  - Relatórios exportáveis (CSV/Excel) com:
    - Férias por período, área, gestor, status.
    - Indicadores: % de férias vencidas, média de dias gozados, concentração por mês.

- **7. Autoatendimento mais rico para o colaborador**
  - Mostrar:
    - Linha do tempo completa das férias (últimos anos).
    - Quantos dias já tirou no período aquisitivo e quantos restam.
    - Sugestões de período que respeitam CLT + regras da empresa.

- **8. Auditoria avançada**
  - Guardar também:
    - IP / user agent da aprovação (se fizer sentido para compliance interno).
    - Justificativas obrigatórias para reprovação.

- **9. Delegação de aprovação**
  - Permitir que um gestor delegue temporariamente aprovação para outro (ex.: férias do gestor).
  - Janelas de delegação com data de início e fim.

- **10. Acessibilidade e internacionalização**
  - Melhorar contraste, navegação por teclado e textos alternativos.
  - Suporte a outros idiomas (ex.: en-US) caso a empresa tenha operações fora do Brasil.

Estas melhorias não estão implementadas ainda, mas o código atual (modelo de dados, histórico, separação por papéis e validações no backend) já prepara um bom terreno para evoluir o sistema nessa direção.

---

### Referências

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)

