# 1. TÍTULO
Cronograma Gantt do Projeto Editora Globo - Férias

# 2. RESUMO EXECUTIVO
Este cronograma apresenta uma radiografia da evolução técnica e de negócio da plataforma de férias gerencial. O documento condensa um intervalo de entrega extremamente ágil e iterativo durante a última quinzena de Março de 2026. Ele demonstra como a equipe avançou, saindo do setup básico da infraestrutura `Next.js 15+` até a fase final de suporte corporativo profundo (Compliance exigente do eSocial, auditoria FIFO perante processos de segurança interna).

# 3. BASE DE ANÁLISE
- **Intervalo de datas analisadas**: 12/03/2026 a 27/03/2026.
- **Quantidade de commits**: 182 _commits_ recuperados do controle de versão.
- **Branch Analisada**: Tópicos operantes mesclados (*merge*) contidos fundamentalmente pelo registro principal (`git log`).
- **Limitações**: Esta análise foca unicamente na observabilidade cronológica do empilhamento de código nos repositórios. Períodos anteriores de elaboração (*Discovery*, Design Estrutural ou PRDs offline) que antecedem 12/03 não estão presentes; inferimos seu volume no formato que as lógicas já eram concretizadas na programação.

# 4. FASES IDENTIFICADAS

| Fase | Início | Fim | Duração | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| **F1: Setup & Motor Estrutural** | 12/03 | 13/03 | 2 dias | Inicialização de núcleo operante, rotas e regras primárias contra Sábado/Domingo, bem como as restrições corporativas vitais (Períodos Blackout e Exportações CSV nativas). |
| **F2: Admin, UX & Qualidade** | 14/03 | 15/03 | 2 dias | Lançamentos de interface de Recursos Humanos (*Backoffice*). Entrega densa de Acessibilidade universal (leitores ARIA) aliados a sistemas de Rate Limit contra tentativas de intrusão. Testes mutantes (Stryker) e Saúde API. |
| **F3: Compliance CLT Completo** | 16/03 | 17/03 | 2 dias | Fortalecimento do mecanismo contábil, introduzindo tratos de "Abono Pecuniário" constitucional e "Adiantamento 13º", suportes a API real de feriados nacionais e limite (teto corporativo) de bloqueio (ex. >60 dias). |
| **F4: Motor de Governança** | 18/03 | 20/03 | 3 dias | Engenharia voltada à Segurança Operacional: Lógica avançada FIFO para saldos corretos de férias antigas, impedimento em múltiplos choques de licenças transacionais, liberação hierárquica escalar entre Coordenador, Gerente e Diretor. |
| **F5: Automações & Defesas** | 21/03 | 24/03 | 4 dias | Inserção veloz de fluxos automatizados (Cron Jobs base) de notificações integradas no formato Resend/E-mail + Slack. Atualização Crítica (*Sentinel Security Patch*) debelando fraude de ataque bypass sobre tokens de Sessão. |
| **F6: Fólios de Auditoria & Perfil** | 25/03 | 27/03 | 3 dias | Implementação de trava judicial preventiva na companhia perante saldo vencidos (Período Concessivo limitador). Importadores (Bulk CSV/Onboarding RH). Interatividade final (Troca da chave criptográfica de segurança nativa sob o logado). |

# 5. GRÁFICO GANTT HORIZONTAL

```text
Data (Mar/26)      | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 |
F1. Setup & Core   | ███████ |
F2. Admin & QA     |         | ███████ |
F3. Leis CLT       |                   | ███████ |
F4. Governança     |                             | ████████████ |
F5. Segurança      |                                            | █████████████████ |
F6. Fechamentos    |                                                                | ████████████ |
