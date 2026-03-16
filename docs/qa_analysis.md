## Visão geral de QA

O projeto possui uma base sólida de qualidade:

- **Vitest** para testes de unidade e domínio.
- **Stryker** para mutation testing, garantindo que os testes sejam efetivos.
- Estrutura de testes bem organizada em `tests/`, cobrindo regras de negócio, serviços, filtros, autenticação e repositórios.

Ao mesmo tempo, ainda há lacunas significativas em:

- Testes de API end‑to‑end (`app/api/*`).
- Cobertura de componentes client críticos.
- Testes de cenários extremos de datas, múltiplos ciclos de férias e políticas de abono/13º.

## Cobertura atual

### Domínio e regras de negócio

- `tests/vacationRules.test.ts`
  - Testa:
    - CLT básica (fracionamento, mínimo/máximo de dias, aviso prévio, DSR).
    - Cálculo de saldo (`calculateVacationBalance`) em diferentes cenários de hireDate e histórico.
    - Detecção de conflitos por equipe.

- `tests/workflows.test.ts`
  - Valida fluxos:
    - Cadeia de aprovação (Coordenador/ Gerente → RH).  
    - Permissões de aprovação (`canApproveRequest`) e visibilidade de equipe (`hasTeamVisibility`).  
    - Criação com `validateCltPeriods` e `checkBlackoutPeriods`.

- `tests/requestVisibility.test.ts`
  - Garante que a lógica de visibilidade (inbox vs histórico) e papéis funcione como esperado.

### Serviços e repositórios

- `tests/dashboardDataService.test.ts`, `tests/teamMembersService.test.ts`
  - Testam montagem de dados de dashboard e composição da árvore de times.

- `tests/vacationRequestListService.test.ts`
  - Cobre lógica de listagem de solicitações para export/dashboard.

- `tests/repositories.test.ts`
  - Exercita funções de repositório com Prisma stubado ou em ambiente de teste.

### Infraestrutura e utilitários

- `tests/auth.test.ts`: autenticação, hashing de senha, cookies de sessão.
- `tests/rateLimit.test.ts`: rate limit por chave.
- `tests/logger.test.ts`: logger estruturado.
- `tests/dashboardFilters.test.ts`, `tests/utils.test.ts`, `tests/validation.test.ts`.

### Mutation testing

- Stryker configurado com limiar mínimo (threshold) alto, reforçando que os testes realmente exercitam ramificações críticas.

## Lacunas de QA

### Alta prioridade

1. **Ausência de testes de API end‑to‑end**
   - **Sintomas:**  
     - Mudanças em rotas (por exemplo, filtros de visibilidade, campos novos como `abono`/`thirteenth`) exigem deploy manual para validar contratos.  
     - Risco de divergência entre validação de domínio e comportamento real das APIs.
   - **Impacto:**  
     - Alto risco de regressão em produção em fluxos como criação/aprovação/cancelamento de férias e relatórios CSV.

2. **Validação parcial de casos extremos de datas**
   - **Sintomas:**  
     - Testes focam cenários típicos; casos cruzando ano civil, múltiplas solicitações em ciclos diferentes e interações complexas com feriados ainda são pouco exercitados.
   - **Impacto:**  
     - Possibilidade de bugs sutis em clientes que usam intensamente o sistema ao longo de vários anos.

### Média prioridade

3. **Cobertura insuficiente de componentes client**
   - Componentes como `NewRequestCardClient`, `EditPeriodFormClient`, `TimesView` e partes do dashboard são críticos para UX, mas não têm testes de comportamento.
   - Bugs de UI podem quebrar fluxos (por exemplo, cálculo de dias mostrados, tooltips de abono/13º, estados de desabilitação do botão de envio).

4. **Testes limitados de regras financeiras (abono/13º)**
   - Embora o sistema trate abono/13º principalmente de forma informativa, a ligação com datas de retorno e comunicação visual poderia ser mais profundamente testada.

### Baixa prioridade

5. **Testes de performance e carga**
   - Não há testes automatizados de carga; qualquer análise de performance depende de monitoramento em runtime.

6. **Testes de acessibilidade**
   - A UI segue boas práticas básicas, mas não há testes automatizados de acessibilidade (aria‑labels, navegação por teclado, contraste).

## Recomendações de QA

1. **Criar suíte de testes de API (alta prioridade)**
   - Pasta sugerida: `tests/api/`.
   - Cobrir:
     - `POST /api/login` e `POST /api/logout` (credenciais válidas/ inválidas, rate limit).  
     - `POST /api/vacation-requests` (cenários de sucesso e todos os principais erros: CLT, saldo, blackout, overlap).  
     - `POST /api/vacation-requests/[id]/approve|reject|delete|update` (permissões por papel, cadeia de status).  
     - `GET /api/reports/balance`, `GET /api/reports/adherence`, `GET /api/vacation-requests/export` (filtros e formato CSV).

2. **Expandir testes de borda de datas (alta/média prioridade)**
   - Incluir cenários:
     - Períodos que cruzam fim de ano.  
     - Múltiplas solicitações em ciclos diferentes (ex.: 2 anos trabalhados, 60 dias de direito).  
     - Próximo a feriados móveis e DSR.  
     - Variações com e sem abono, com 13º marcado.

3. **Adicionar testes de componentes client (média prioridade)**
   - Usar React Testing Library e Vitest para:
     - Verificar que `NewRequestCardClient` desabilita/enabilita o botão corretamente e exibe mensagens de erro do backend.  
     - Garantir que as opções de abono/13º refletem os estados esperados (badges, resumo, textos).  
     - Testar interação de `TimesView` (expansão de times, contagem de colaboradores em férias).

4. **Planejar testes de carga focados (baixa prioridade)**
   - Rodar cenários de stress em endpoints mais críticos (`dashboard`, `reports`, `vacation-requests`) para medir comportamentos em datasets maiores.

5. **Introduzir checagens de acessibilidade básicas**
   - Adotar ferramentas como `@testing-library/jest-dom` + `axe-core` em testes de UI para validar roles/labels básicos.

