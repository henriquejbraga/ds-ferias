# Usabilidade em mobile — Editora Globo Férias

Verificação e ajustes feitos para uso em dispositivos móveis (smartphones e tablets).

---

## 1. Viewport e meta

- **app/layout.tsx:** `viewport` configurado com `device-width`, `initialScale: 1`, `maximumScale: 5` (permite zoom para acessibilidade).
- **Idioma:** `lang="pt-BR"` no `<html>`.

---

## 2. Ajustes realizados

### 2.1 Sidebar no mobile

- **Antes:** No mobile a sidebar virava barra horizontal com abas (Minhas Férias, Caixa de Aprovação, etc.), mas o **Saldo de Férias** ficava só na versão desktop (nav lateral), ou seja, **oculto no celular**.
- **Depois:** Bloco “Saldo de Férias” exibido também no mobile, logo abaixo das abas de navegação (`lg:hidden`), usando o mesmo componente `SidebarBalance`.

### 2.2 Alvos de toque (mín. 44px)

Recomendação WCAG / boas práticas: elementos interativos com pelo menos **44×44 px** para toque.

| Área | Ajuste |
|------|--------|
| **Login** | Inputs de e-mail e senha e botão “Entrar” com `min-h-[44px]`. |
| **Filtros (Gestão)** | Input de busca, selects (status, coordenador, departamento), datas (de/até) e botão “Filtrar” com `min-h-[44px]`. |
| **Nova solicitação** | Campos de data (início/término) e botão “Enviar solicitação” com `min-h-[44px]`. |
| **Request card** | Botões Aprovar/Reprovar/Excluir e link já tinham `min-h-[44px]` via classe no container; “Editar período” (summary do `<details>`) e inputs de data do formulário de edição com `min-h-[44px]`; botão “Salvar” com `min-h-[44px]`. |
| **ThemeToggle** | Botão de tema (claro/escuro) com `min-h-[44px] min-w-[44px]` para garantir área de toque adequada no header. |
| **Itens do menu (sidebar)** | Links de navegação já com `min-h-[44px]` no mobile (`DashboardSidebarItem`). |

### 2.3 Painel de usuários de teste (login)

- Linhas com **altura mínima 44px** e padding para toque.
- E-mail com **truncate** e `min-w-0` para não estourar o layout em telas pequenas; `title` com o e-mail completo no hover.

### 2.4 Layout geral

- Dashboard: `flex-col` no mobile e `lg:flex-row` no desktop; grid de conteúdo `lg:grid-cols-12` com colunas que empilham no mobile.
- Sidebar: largura total no mobile (`w-full`), borda inferior; no desktop coluna fixa (`lg:w-72`).
- Espaçamento: `p-4 sm:p-6 lg:p-8` no main; padding consistente em cards e formulários.

---

## 3. O que já estava adequado

- Navegação principal no mobile em formato de abas/chips horizontais, sem drawer oculto.
- Request cards e listas com `flex-wrap` e `min-w-0` para não quebrar layout.
- Stat cards em grid 2 colunas no mobile (`grid-cols-2`), 4 no desktop.
- Uso de `truncate` em nomes e textos longos onde necessário.
- Toaster (sonner) com `position="top-center"` visível no mobile.

---

## 4. Recomendações futuras

- **Testes em dispositivo real:** Validar em iOS Safari e Chrome Android (zoom, teclado virtual, safe area).
- **Safe area:** Se o app for usado como PWA ou em notched devices, considerar `env(safe-area-inset-*)` nos paddings do header/footer.
- **Tabelas (admin/relatórios):** Em telas muito estreitas, considerar cards ou lista em vez de tabela horizontal, ou scroll horizontal com aviso.
- **Acessibilidade:** Revisar foco (tab order) e contraste em todos os fluxos principais no mobile.

---

## 5. Resumo

A aplicação está utilizável em mobile com:

- Saldo de férias visível na sidebar em todas as larguras.
- Alvos de toque ≥ 44px em formulários e botões principais.
- Layout responsivo (colunas que empilham, navegação adaptada).
- Viewport e zoom configurados no layout raiz.

Para validar: abrir no Chrome DevTools (modo dispositivo) ou em um celular real e percorrer login, dashboard, filtros, nova solicitação e aprovação/reprovação.

### Teste rápido no DevTools (modo dispositivo)

1. Abra o app no Chrome e pressione **F12** (ou Ctrl+Shift+I).
2. Clique no ícone **Toggle device toolbar** (ou Ctrl+Shift+M) para ativar o modo dispositivo.
3. Escolha um aparelho no topo (ex.: iPhone 14, Pixel 7) ou defina resolução customizada (ex.: 390×844).
4. Recarregue a página e teste: login, abas da sidebar, saldo de férias, formulário de nova solicitação, filtros e botões de ação (Aprovar/Reprovar). Confira se os toques acertam os alvos e se não há overflow horizontal.
5. Para testar em **celular real**: acesse pela mesma rede (ex.: `http://<IP-da-maquina>:3000`) ou use um túnel (ngrok, etc.).

---

## 6. Revisão de acessibilidade (segunda passada)

- **Skip link:** Link “Pular para o conteúdo principal” no topo (visível ao receber foco); destinos com `id="main"` em login, dashboard e admin.
- **Login:** Form e botão com `aria-label`; overlay de loading com `role="status"` e `aria-live="polite"`; botão com `aria-busy` e anel de foco.
- **Sidebar:** Botão Sair com `aria-label` e anel de foco.
- **Export e links:** Botão “Exportar CSV” e link “Relatório de saldo” com `aria-label` e `focus:ring`.
- **Admin (backoffice):** Cabeçalhos de tabela com `scope="col"`; inputs/selects de edição com `aria-label`; botões Editar/Salvar/Cancelar com `aria-label`; link Voltar com `aria-label` e foco visível.
- **Times (view):** Botões de expandir/recolher com `aria-expanded` e `aria-label` dinâmico (ex.: “Expandir time de X”).
- **Foco:** Anel de foco consistente (`focus:ring-2` / `focus:ring-blue-500`) em controles interativos onde faltava.
