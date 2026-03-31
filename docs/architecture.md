# Arquitetura do Sistema

O sistema utiliza uma arquitetura baseada no **Next.js 16 (App Router)** com uma separação clara de responsabilidades em camadas, garantindo manutenibilidade e testabilidade.

---

## Camadas do Sistema

1.  **Apresentação (`app/` e `components/`):**
    *   Utiliza **React Server Components (RSC)** para busca de dados eficiente.
    *   Componentes interativos usando **Client Components** para uma UX fluida.
    *   UI responsiva baseada em **Tailwind CSS** e **shadcn/ui**.

2.  **Serviços (`services/`):**
    *   Contém a orquestração da lógica de negócio.
    *   Exemplo: `vacationActionService` gerencia transações complexas que envolvem aprovação, histórico e consumo de saldo FIFO.

3.  **Domínio e Regras (`lib/`):**
    *   Motor central de regras CLT (`vacationRules.ts`).
    *   Lógica de visibilidade e filtros.
    *   **Observabilidade:** Logger centralizado que emite JSON estruturado para o Vercel Logs.

4.  **Acesso a Dados (`repositories/`):**
    *   Abstração do Prisma para operações de banco de dados.
    *   Repositórios específicos para Usuários, Férias, Períodos Aquisitivos e **Feedbacks**.

5.  **Infraestrutura e Segurança:**
    *   Rate Limit customizado para proteção de endpoints sensíveis.
    *   Sanitização de dados para exportação CSV.
    *   Monitoramento de performance (Slow Query Detection no Prisma).

---

## Estratégia de Logs (Monitoramento)

O sistema implementa logs estruturados em todos os pontos críticos:
-   **Segurança:** Log de logins, trocas de senha e hits no rate limit.
-   **Negócio:** Log de criação, aprovação e cancelamento de férias.
-   **Audit Trail:** Rastreabilidade de quem alterou ou deletou usuários no Backoffice.
-   **Performance:** Alertas automáticos para queries de banco que excedem 500ms.

---

## Fluxo de Dados de Feedback

O novo módulo de feedback segue o fluxo:
`Interface (Form) -> API Route (POST) -> Repository (Prisma) -> Banco de Dados`
A gestão pelo RH adiciona uma camada de visualização interativa com filtros de status (Pendente/Resolvido) e paginação eficiente.
