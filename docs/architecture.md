## Arquitetura e revisao tecnica (DDD-lite)

### Organizacao por camadas

- **UI (`components/`)**
  - Responsavel por renderizacao, layout responsivo e eventos de clique.
  - Regras criticas sao evitadas na UI: o dominio esta em `lib/`.

- **Aplicacao (`app/`)**
  - Rotas HTTP: parsing basico, autorizacao (por papel), e delegacao para dominio e repositorios.

- **Servicos (`services/`)**
  - Orquestracao de queries para dashboards/relatorios.
  - Exemplo: `dashboardDataService` compoe dados e contagens de pendencias.

- **Repositorio (`repositories/`)**
  - Camada de acesso ao banco com Prisma.
  - Mantem includes e selecoes para reduzir acoplamento de `prisma.*` nas rotas.

- **Dominio (`lib/`)**
  - `vacationRules.ts`: regras de hierarquia, aprovac. e parte grande das validacoes/CLT.
  - `requestVisibility.ts` (ou similar): quem enxerga o que na tela (inbox vs historico, filtros).
  - Utilitarios: timezone/datas, conflitos e feriados.

### Pontos fortes

- Testes unitarios abrangem dominio e composicao de dados.
- Normalizacao de datas em UTC reduz efeitos colaterais de timezone.
- Existe uma camada clara de autorizacao e visibilidade.

### Pontos de atencao

- `lib/vacationRules.ts` e um modulo grande e multifuncional (risco de regressao e baixa coesao).
- Algumas regras de seguranca/estado sao reforcadas em UI e/ou em rotas, mas nem sempre existe um "use case" unico para transicao.
- Algumas rotas executam queries complexas (ex.: conflitos e lists de times) sem cache/paginacao.

### Construcao de casos de uso (use cases)

Atualmente, varios "use cases" ficam embutidos em rotas. Recomendacao para evolucao:

- Introduzir uma camada `domain/` com use cases:
  - criar solicitacao
  - aprovar/reprovar
  - cancelar/excluir
  - calcular saldo e vincular a ciclo aquisitivo

