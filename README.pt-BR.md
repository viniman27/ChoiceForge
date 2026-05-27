# ChoiceForge

> Editor visual baseado em nós para [ChoiceScript](https://www.choiceofgames.com/make-your-own-games/choicescript-intro/) — a linguagem de domínio específico por trás das ficções interativas da *Choice of Games*.

**Idiomas:** [English](./README.md) · Português (Brasil) (este arquivo)

ChoiceForge permite que você construa histórias interativas com ramificações conectando nós visuais em um canvas, e então exporta um pacote `.zip` de arquivos `.txt` válidos que rodam no runtime oficial do ChoiceScript **sem nenhuma modificação**. Pense como Twine, mas focado especificamente na sintaxe e semântica do ChoiceScript em vez de hipertexto.

---

## Sumário

- [Destaques](#destaques)
- [Capturas & Demo](#capturas--demo)
- [Stack Técnica](#stack-técnica)
- [Começando](#começando)
- [Scripts do Projeto](#scripts-do-projeto)
- [Visão Geral da Arquitetura](#visão-geral-da-arquitetura)
- [Modelo de Domínio](#modelo-de-domínio)
- [Tipos de Nó](#tipos-de-nó)
- [Fluxo de Edição](#fluxo-de-edição)
- [Importação e Exportação](#importação-e-exportação)
- [Linter](#linter)
- [Playtest](#playtest)
- [Persistência](#persistência)
- [Atalhos de Teclado](#atalhos-de-teclado)
- [App Desktop (Tauri)](#app-desktop-tauri)
- [Deploy (Cloudflare Pages)](#deploy-cloudflare-pages)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Contribuindo](#contribuindo)
- [Roadmap](#roadmap)
- [Licença & Créditos](#licença--créditos)

---

## Destaques

- **Editor visual de grafos** — 24 tipos de nó (`passage`, `choice`, `if`, `set`, `goto`, `gosub`, `goto_scene`, `ending`, `finish`, `checkpoint`, `restore_checkpoint`, `fake_choice`, `page_break`, `comment`, `input_text`, `input_number`, `rand`, `gosub_scene`, `label`, `return`, `image`, `sound`, `temp`, `params`, `achieve`).
- **Exportação ida-e-volta segura** — os arquivos `.txt` gerados rodam no runtime oficial do ChoiceScript sem ajustes manuais.
- **Importador pragmático de ChoiceScript** — arraste um `.txt`, um `.json` ou um `.zip` inteiro e o ChoiceForge reconstrói o grafo visual para os padrões comuns (`*choice` / `*fake_choice` com corpo inline, `*if`/`*elseif`/`*else`, `*goto`, `*label`, `*gosub`, `*goto_scene`, gráficos de status, conquistas, `*temp` / `*params`, comandos de input, etc.). Estruturas não suportadas são preservadas literalmente como texto-fonte editável — nada é perdido.
- **UI bilíngue** — strings em Português, Inglês e Espanhol (`I18nLabels`).
- **Linter em tempo real** — mais de 140 diagnósticos chaveados cobrindo metadados de projeto, conquistas, cenas, variáveis, escolhas, condições, jumps, assets e código preservado.
- **Runtime oficial do ChoiceScript embutido** — o botão *Play* abre o jogo real em um iframe, não um interpretador caseiro.
- **Editor de arquivo inteiro com CodeMirror** — edite o `startup.txt`, o `choicescript_stats.txt` ou qualquer cena gerada como ChoiceScript bruto. Converta de volta ao grafo visual quando quiser.
- **Ferramentas transversais** — busca global (`Ctrl+Shift+F`), paleta de comandos (`Ctrl+K`), find & replace, copiar/colar nós entre cenas, arrastar para reordenar opções de escolha, edição de título inline, notas privadas por nó, status todo/done, modo manuscrito/prosa, dashboard com estatísticas e meta de palavras.
- **Canvas customizado** — sem React Flow, sem Cytoscape. Pan, zoom, fit-view, minimapa, nós redimensionáveis, auto-layout (hierárquico por profundidade topológica), criação rápida de nó ao soltar uma conexão.
- **Persistência local-first** — autosave em `localStorage` com flush em `pagehide`; o `.zip` exportado continua sendo o artefato portátil.
- **Scaffold desktop** — wrapper Tauri v2 com diálogos nativos de abrir/salvar (a versão web fica intacta).

---

## Capturas & Demo

> O app web roda no Cloudflare Pages do projeto. Use `npm run dev` para um preview local.

| Tela | Descrição |
|------|-----------|
| Canvas | Grafo de nós com pan/zoom, com arestas derivadas (choice / if / goto) e arestas de fluxo manuais. |
| Inspetor | Abas *Conteúdo*, *Lógica* e *Raw* por nó no painel direito. |
| Mapa de Cenas | Grade pannable de todas as cenas com setas sólidas para `*goto_scene` e tracejadas para `*gosub_scene`. |
| Modo Prosa | Leitura ordenada por DFS estilo manuscrito, com notas do autor como apartes em itálico. |
| Console de Lint | Lista expansível de issues clicáveis no rodapé. |
| Guia de Ajuda | Pressione `?` para abrir o guia em 6 abas. |

---

## Stack Técnica

| Camada | Ferramenta |
|--------|------------|
| Framework | React 19 + TypeScript 5.8 |
| Build | Vite 4 |
| Estado | `useState` + `useMemo` do React (sem Redux / Zustand) |
| Editor | CodeMirror 6 (visão de arquivo inteiro) |
| Compressão | [`fflate`](https://github.com/101arrowz/fflate) (zip export/import) |
| Persistência | chave `choiceforge.project.v2` do `localStorage` |
| Desktop | Tauri 2 (`src-tauri/`) com `tauri-plugin-dialog` e `tauri-plugin-fs` |
| Deploy | Cloudflare Pages |
| Testes | Test runner nativo do Node (`node --test`) para domínio — 387 testes; Vitest + Testing Library para UI — 44 testes |

**Versão mínima do Node:** `>= 24.15.0` (veja `.nvmrc` / `.node-version`).

Intencionalmente **não há biblioteca de grafos**. O canvas é construído à mão para manter o editor fortemente acoplado ao modelo de domínio do ChoiceScript.

---

## Começando

### Pré-requisitos

- Node.js `>= 24.15.0` (use `nvm install` para pegar o `.nvmrc`).
- npm `>= 11.12.1`.
- (Opcional) Toolchain do Rust se quiser empacotar o desktop — `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`.

### Instalar e rodar

```bash
git clone https://github.com/<sua-conta>/ChoiceForge.git
cd ChoiceForge
npm install
npm run dev          # http://localhost:5173
```

### Build de produção

```bash
npm run build        # tsc + vite build → ./dist
npm run preview      # preview estático de ./dist
```

### Testes

```bash
npm test             # testes de dominio (funcoes puras, node --test)
npm run test:ui      # testes de UI / componentes / store (Vitest + Testing Library)
npm run test:all     # ambas as suites
```

Duas camadas:

- **Domínio** (`tests/domain.test.ts`) — gerador puro, importador, linter, layout. Roda no test runner nativo do Node. **387 passando.**
- **UI** (`tests/ui/`) — componentes React, o hook `useProjectStore`, e comportamento i18n via Vitest + jsdom + Testing Library. **44 passando.**

CI roda ambas a cada push e PR.

---

## Scripts do Projeto

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Servidor Vite na porta `5173`. |
| `npm run build` | Type-check (`tsc`) + build de produção em `./dist`. |
| `npm run preview` | Preview local do build de produção. |
| `npm run test` | Roda a suíte de testes Node sobre `tests/*.test.ts`. |
| `npm run cf:preview` | Build, depois `wrangler pages dev dist` para Cloudflare Pages local. |
| `npm run cf:deploy` | Build, depois `wrangler pages deploy dist`. |
| `npm run tauri:dev` | Inicia o app desktop em modo dev (requer Rust). |
| `npm run tauri:build` | Empacota o desktop para o SO atual. |
| `npm run tauri:icons` | Gera ícones Tauri a partir de `src-tauri/app-icon.png`. |

---

## Visão Geral da Arquitetura

```
┌────────────────────────────────────────────────────────────────┐
│ src/components/  ← UI React (App, TopBar, GraphCanvas, …)      │
│                                                                │
│        ▲                                                       │
│        │ lê/escreve via ProjectActions                         │
│        ▼                                                       │
│ src/state/projectStore.ts ← useProjectStore() — toda mutação  │
│        │                                                       │
│        │ delega lógica pura para                               │
│        ▼                                                       │
│ src/domain/                                                    │
│   ├── types.ts            ← Fonte da verdade (tipos)           │
│   ├── choicescript.ts     ← Puro: gerador + linter             │
│   ├── choicescriptImport.ts ← Puro: importador pragmático      │
│   └── graphLayout.ts      ← Puro: algoritmo de auto-layout     │
│                                                                │
│ src/platform/fileSystem.ts ← Abrir/salvar com awareness Tauri  │
│ src/workers/sceneParser.ts ← Parsing pesado fora da main       │
│ src/data/ ← Projeto de amostra, mensagens de lint (PT/EN/ES)   │
└────────────────────────────────────────────────────────────────┘
```

### Invariantes-chave

1. **`choicescript.ts` é puro.** Sem React, sem DOM, sem side-effects.
2. **Toda mutação passa por `commitProject`** (`syncDerivedEdges → updateSceneCounts → persistActiveScene`). Pular isso deixa dados derivados desatualizados.
3. **O grafo da cena ativa vive em `project.nodes`/`project.edges` E em `project.sceneData[sceneTitle]`** — `persistActiveScene` mantém ambos em sincronia.
4. **Cenas `startup` e especiais são bloqueadas** (não podem ser renomeadas, deletadas ou navegadas como grafo).
5. **Arquivos `.txt` exportados devem ser ChoiceScript válido** — qualquer mudança no gerador precisa manter o runtime oficial verde.
6. **Nomes de cena / variável / conquista são identificadores normalizados** (minúsculas, underscore, sem dígito inicial).
7. **IDs de nó são referências estáveis**; ao deletar um nó é preciso limpar `option.to`, `branch.to` e arestas que apontam para ele (`deleteNode` já faz isso).
8. **Operações globais de rename/delete tocam todo grafo salvo em `sceneData`**, não só a cena ativa.

As regras completas de design estão em [`agents.md`](./agents.md) (o arquivo autoritativo de contexto para agentes de IA neste repositório).

---

## Modelo de Domínio

Um `ChoiceForgeProject` é um snapshot autossuficiente:

- **Metadados** — título, autor, idioma, meta de palavras do projeto.
- **Cenas** — lista ordenada (`*scene_list`) mais a cena especial não listada `choicescript_stats`. A primeira cena listada é a inicial e é bloqueada.
- **Grafo por cena** — `sceneData[sceneTitle]` guarda `{ nodes, edges, sourceText?, sourceLanguage? }`. A cena ativa é espelhada em `project.nodes` e `project.edges` para acesso rápido.
- **Variáveis** — declarações `*create` globais com tipo (`string` / `number` / `boolean`), valor inicial, descrição, toggle fairmath, flag "mostrar em stats" e rótulo "oposto baixo" opcional.
- **Conquistas** — blocos `*achievement` com id, título, pontos, visibilidade, descrições pré/pós-conquista.
- **Assets** — arquivos (imagens, áudio) importados como blobs `dataUrl`, exportados como binários reais dentro do pacote.

Mutações são feitas via `ProjectActions` (veja `src/state/projectStore.ts`). Cada ação retorna um objeto de projeto novo — não há mutação in-place em lugar nenhum da camada de domínio.

---

## Tipos de Nó

| Nó | Saída ChoiceScript |
|----|---------------------|
| `passage` | Texto narrativo seguido de `*goto next_node`. |
| `choice` | Bloco `*choice` com linhas `#option` (cada uma com `*goto` para seu alvo). |
| `fake_choice` | `*fake_choice` — opções continuam inline. |
| `if` | Cadeia `*if` / `*elseif` / `*else`, cada ramo fazendo `*goto` para o alvo. |
| `set` | Uma ou mais linhas `*set var op value`. |
| `label` | `*label name`. |
| `goto` | `*goto label_name`. |
| `goto_scene` | `*goto_scene scene_name`. |
| `gosub` | `*gosub label`. |
| `gosub_scene` | `*gosub_scene scene_name label`. |
| `return` | `*return`. |
| `ending` | `*ending`. |
| `finish` | `*finish`. |
| `checkpoint` | `*save_checkpoint name`. |
| `restore_checkpoint` | `*restore_checkpoint name`. |
| `page_break` | `*page_break label`. |
| `comment` | Linhas `*comment` (invisíveis ao jogador). |
| `input_text` | Corpo do prompt + `*input_text variable`. |
| `input_number` | Corpo do prompt + `*input_number variable min max`. |
| `rand` | `*rand variable min max`. |
| `image` | `*image filename alignment alt`. |
| `sound` | `*sound filename`. |
| `temp` | `*temp name initial` (escopo da cena). |
| `params` | `*params a b c` (argumentos de gosub). |
| `achieve` | `*achieve id` (desbloqueia uma conquista). |

Cada nó também recebe um label sintético `cf_<id>` para que `*goto` possa apontar para qualquer nó, mesmo sem o autor ter colocado um `*label` explícito.

### Tipos de aresta

| `edge.kind` | Origem |
|-------------|--------|
| `flow` | Conexão manual desenhada pelo usuário. **Persistida.** |
| `choice` | Derivada de `choice` / `fake_choice` `option.to`. |
| `goto` | Derivada do título de `goto` / `goto_scene` / `gosub`. |
| `if` / `elseif` / `else` | Derivada dos alvos dos ramos `if`. |

`syncDerivedEdges` regenera todas as arestas derivadas a cada commit. Só arestas `flow` são persistidas.

---

## Fluxo de Edição

1. **Crie um projeto** a partir de uma amostra ou do zero (*Arquivo → Novo*).
2. **Escolha uma cena** no painel esquerdo. O canvas mostra o grafo daquela cena.
3. **Adicione nós** pela toolbar do canvas, ou solte uma aresta no canvas vazio para abrir o seletor rápido de tipo.
4. **Conecte nós** arrastando da âncora inferior-direita de um nó até a âncora superior-esquerda de outro. Arestas de choice / if / goto são derivadas dos dados do nó e se atualizam sozinhas.
5. **Abra o Inspetor** no painel direito para o nó selecionado:
   - **Conteúdo** — corpo de prosa, prompt, opções, ramos.
   - **Lógica** — condições, mudanças de estado, navegação para alvos de saída, autocomplete para `${var}` e `*achieve`.
   - **Raw** — preview somente-leitura do ChoiceScript gerado para o nó.
6. **Resultados de lint** aparecem no rodapé (clique para pular). Pressione `?` para o guia in-app, `Ctrl+K` para a paleta de comandos, `Ctrl+Shift+F` para busca global, `Ctrl+H` para find & replace.
7. **Salve** com `Ctrl+S` (ou o botão *Save*). O autosave roda em background e ao fechar a aba.
8. **Jogue** com o botão *Play* — abre o runtime oficial embutido.
9. **Exporte** para `.zip` para upload no runtime ChoiceScript (ou para entregar à revisão da Choice of Games).

---

## Importação e Exportação

### Pacote de exportação

`createExportPackage()` monta um `ChoiceForgeExportPackage` que a UI serializa em `.zip`:

```
_choiceforge/
  project.json                      ← metadados ChoiceForge (reimportável)
mygame/
  startup.txt                       ← *title, *author, *scene_list, *create, *achievement
  choicescript_stats.txt
  <scene_name>.txt                  ← uma por cena não-startup, não-especial
  <caminhos de assets…>             ← assets importados como binários reais
```

### Importações suportadas

- **`.zip` ChoiceForge** — round-trip perfeito via `_choiceforge/project.json`.
- **`.json` ChoiceForge** — mesmos metadados, sem binários de asset.
- **`.zip` ChoiceScript puro** — parseado por `choicescriptImport.ts`. Reconhece `startup.txt` (title/author/scene list/creates/achievements), linhas de stat-chart de `choicescript_stats.txt` e arquivos `.txt` por cena.
- **`.txt` único** — mescla como uma cena no projeto atual.
- **Seleção de pasta** — importação multi-arquivo via picker de diretório do navegador (onde houver suporte).

O importador é **deliberadamente pragmático**: parseia os padrões comuns (`*choice` / `*fake_choice` com corpo inline, `*if` / `*elseif` / `*else`, `*goto` / `*goto_scene` / `*gosub` / `*gosub_scene`, `*label`, `*set`, `*input_*`, `*rand`, `*temp`, `*params`, `*achieve`, `*page_break`, `*checkpoint`, `*image`, `*sound`, blocos de stat-chart). O que ele não consegue modelar é preservado **literalmente como texto-fonte** daquela cena, abrível no editor CodeMirror de arquivo inteiro e convertível para edição visual sob demanda.

Importações que substituiriam um projeto não trivial pedem confirmação primeiro (`confirmReplaceProject`).

---

## Linter

`lintProject()` roda a cada mudança de estado (`useMemo`) e emite mensagens chaveadas e localizadas a partir de `src/data/lintMessages.ts` (PT / EN / ES). Categorias:

- **Projeto & cenas** — título/autor vazios, `*scene_list` ausente, cenas inalcançáveis, cenas fora do `*scene_list`, nomes duplicados.
- **Variáveis** — identificadores inválidos, nomes reservados, não declaradas, `*create` duplicado, valor inicial faltando, mismatch de tipo.
- **Conquistas** — id/título/descrição vazios, visibilidade/pontos inválidos, duplicatas, `*achieve` apontando para id desconhecido.
- **Assets** — caminhos inseguros, conflitos com caminhos exportados, dataURLs malformados, ids/caminhos duplicados.
- **Integridade do grafo** — nós órfãos, becos sem saída, opção com texto vazio, labels faltando, identificadores inválidos, texto de opção duplicado, choices com uma opção só, `*page_break` / `*checkpoint` sem label.
- **Condições** — `*if` vazio, ramo após `*else`, self-loops, no-ops de `*if`, todos os ramos caindo no mesmo alvo.
- **Stat-chart** — tipo inválido, variável inválida, números crus, valores não-percent, stats não declaradas.
- **Código preservado** — qualquer coisa que o importador manteve como texto bruto é lintada linha a linha para `*set` / `*input_*` / `*rand` / `*temp` / `*params` / `*label` / corretude de jumps, com limite de tamanho (`LARGE_SOURCE_LINT_LIMIT = 40 KB`) para manter a UI responsiva em capítulos grandes.

Issues são clicáveis; clicar pula para o nó, a cena ou a linha de código.

---

## Playtest

- **Runtime oficial** (`OfficialPlayView.tsx`) — empacota seus `.txt` exportados em um `iframe srcdoc` e roda no engine ChoiceScript real da Choice of Games. É o que o botão *Play* faz por padrão.
- **Playtest interno** (`PlaytestView.tsx`) — ainda no código como smoke test no nível do grafo (atribuições de variável, resolução de ramos), mas não está mais ligado à toolbar principal. Útil para validar o *grafo* sem invocar o runtime.

---

## Persistência

- **Projeto em edição** — guardado em `localStorage` sob `choiceforge.project.v2`.
- **Autosave** — escrita debounced em toda mudança de estado React.
- **Salvar manual** — botão *Save* ou `Ctrl/Cmd+S`. Chama `actions.saveNow()` que comita o grafo ativo e descarrega imediatamente.
- **Segurança ao fechar a aba** — listeners de `pagehide` e `visibilitychange` descarregam o snapshot mais recente antes do unload.
- **Strip de `sourceText` grande** — `sourceText`s > 30 KB são excluídos do snapshot localStorage para evitar `QuotaExceededError`. Continuam em memória e no próximo export.

Isto é **local-first**, não sync em nuvem. O `.zip` exportado é o artefato portátil.

---

## Atalhos de Teclado

| Atalho | Ação |
|--------|------|
| `Ctrl/Cmd+S` | Salvar agora. |
| `Ctrl/Cmd+K` | Paleta de comandos. |
| `Ctrl/Cmd+Shift+F` | Busca global. |
| `Ctrl/Cmd+H` | Find & replace. |
| `Ctrl/Cmd+C` / `Ctrl/Cmd+V` | Copiar / colar nós selecionados (clipboard sobrevive a troca de cena). |
| `Delete` / `Backspace` | Deletar o nó selecionado. |
| `Espaço + arrastar` | Pan do canvas. |
| `Ctrl + roda` | Zoom centrado no ponteiro. |
| `?` | Abre o guia in-app. |
| Duplo clique no título do nó | Rename inline. |
| Arrastar o handle `::` da opção | Reordena a opção. |

A referência completa está na aba *Ajuda → Atalhos* do app.

---

## App Desktop (Tauri)

O build web é a fonte da verdade; o app desktop é só um wrapper fino Tauri v2.

### Pré-requisitos

- Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- Forneça um `src-tauri/app-icon.png` de 512×512 e rode `npm run tauri:icons` uma vez.

### Rodar / build

```bash
npm run tauri:dev    # dev com HMR + janela nativa
npm run tauri:build  # bundle de release para o SO atual
```

A camada Tauri adiciona:

- Pickers nativos *Abrir* / *Salvar* / *Salvar Como* (`.json` de projeto).
- Caminho persistente lembrado para `Ctrl/Cmd+S` (grava no disco em vez de localStorage).
- Título da janela nativo que atualiza com o projeto carregado.

A detecção é em runtime via `isTauri()` em `src/platform/fileSystem.ts`. No navegador, o botão *Save* mantém o comportamento atual.

---

## Deploy (Cloudflare Pages)

O Cloudflare Pages tem que publicar o diretório compilado `dist/`, não a raiz do repo.

| Configuração | Valor |
|--------------|-------|
| Framework preset | `Vite` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | raiz do repositório |
| Node version | `24.15.0` |

**Não** adicione um `wrangler.toml` para o deploy estático via Git a menos que o projeto Pages seja intencionalmente gerenciado por Wrangler — quando o Cloudflare detecta `wrangler.toml`, ele vira a fonte da verdade e pode pular o build do Vite inteiramente.

Se a página deployada estiver em branco, cheque o HTML servido: se contiver `<script type="module" src="/src/main.tsx"></script>`, o Cloudflare está servindo o `index.html` fonte. O HTML deployado deveria referenciar assets compilados sob `/assets/`.

Você também pode deployar da sua máquina com:

```bash
npm run cf:deploy
```

Veja [`docs/cloudflare-pages.md`](./docs/cloudflare-pages.md) para a versão longa.

---

## Estrutura do Projeto

```
ChoiceForge/
├── src/
│   ├── App.tsx                       # Layout raiz: TopBar / LeftPanel / Canvas / RightPanel / BottomBar
│   ├── main.tsx                      # Entry point React
│   ├── components/
│   │   ├── BottomBar.tsx             # Console de lint
│   │   ├── CodeEditor.tsx            # Wrapper compartilhado de CodeMirror
│   │   ├── CommandPalette.tsx        # Navegador fuzzy Ctrl+K
│   │   ├── Dashboard.tsx             # Visão geral de estatísticas
│   │   ├── GeneratedDocumentView.tsx # Editor de arquivo inteiro com CodeMirror
│   │   ├── GraphCanvas.tsx           # O canvas customizado (sem biblioteca de grafo)
│   │   ├── HelpGuide.tsx             # Modal do guia in-app
│   │   ├── KeyboardShortcutOverlay.tsx
│   │   ├── LeftPanel.tsx             # Abas Cenas / Variáveis / Conquistas / Assets
│   │   ├── ManuscriptView.tsx        # Leitor de prosa em DFS
│   │   ├── NewProjectModal.tsx
│   │   ├── NodeBodyEditor.tsx        # Editor de corpo com autocomplete de var/achievement
│   │   ├── NodeCard.tsx              # Renderização de um nó no canvas
│   │   ├── OfficialPlayView.tsx      # Runtime ChoiceScript oficial embutido
│   │   ├── PlaytestView.tsx          # Playtest legado em nível de grafo
│   │   ├── RightPanel.tsx            # Inspetor: abas Conteúdo / Lógica / Raw
│   │   ├── SceneMapView.tsx          # Mapa-visão de cenas
│   │   ├── SnapshotPanel.tsx         # Snapshots em localStorage
│   │   └── TopBar.tsx                # Save / import / export / play / settings
│   ├── data/
│   │   ├── lintMessages.ts           # Traduções PT/EN/ES de todas as chaves de lint
│   │   └── sampleProject.ts          # Projeto de amostra PT/EN + strings I18n
│   ├── domain/
│   │   ├── choicescript.ts           # PURO: gerador + linter
│   │   ├── choicescriptImport.ts     # PURO: importador pragmático
│   │   ├── graphLayout.ts            # PURO: auto-layout
│   │   └── types.ts                  # Todos os tipos TypeScript
│   ├── platform/
│   │   └── fileSystem.ts             # Abstração de abrir/salvar ciente de Tauri
│   ├── state/
│   │   └── projectStore.ts           # useProjectStore() — toda mutação aqui
│   └── workers/
│       └── sceneParser.ts            # Parse pesado de cena fora da main
├── src-tauri/                        # Wrapper desktop Tauri v2
├── tests/
│   └── domain.test.ts                # 382 testes sobre a camada de domínio pura
├── public/
│   ├── _redirects                    # Redirect SPA do Cloudflare Pages
│   ├── favicon.svg
│   └── play/                         # Assets estáticos do runtime ChoiceScript oficial
├── docs/
│   └── cloudflare-pages.md           # Notas de deploy
├── agents.md                         # Contexto autoritativo para agentes de IA (arquitetura + log)
├── CLAUDE.md                         # Regras de workflow do Claude Code
├── index.html
├── styles.css                        # Estilos globais (canvas, panels, modais)
├── directions.css                    # Estilos direcionais/de animação
├── package.json
├── tsconfig.json
└── vite.config.ts
```

> Arquivos legados `.jsx` na raiz (`app.jsx`, `chrome.jsx`, `dashboard.jsx`, `data.jsx`, `graph-canvas.jsx`, `left-panel.jsx`, `node-card.jsx`, `right-panel.jsx`, `tweaks-panel.jsx`) e `ChoiceForge.html` pertencem ao protótipo original anterior ao port para TypeScript. Estão mantidos como referência mas não fazem parte do build atual.

---

## Contribuindo

1. **Leia [`agents.md`](./agents.md) antes de mexer no código.** É o documento autoritativo de arquitetura / invariantes / gotchas tanto para humanos quanto para agentes de IA.
2. **Nunca quebre testes que passam.** Rode `npm test` antes de comitar qualquer coisa em `src/domain/`.
3. **Mantenha `choicescript.ts` puro.** Sem imports do React, sem acesso ao DOM, sem side-effects.
4. **Toda mutação passa por `commitProject`** (veja *Adding a New Scene Action* em `agents.md`).
5. **Sem comentários a menos que o *porquê* não seja óbvio.** Nomes autoexplicativos batem narração.
6. **Atualizações imutáveis em todo lugar** — retorne arrays/objetos novos, nunca mute in-place.
7. **Strings de i18n** vêm de `I18nLabels`; nunca hardcode texto visível ao usuário em componentes.
8. **`normalizeIdentifier`** minúscula + underscore + sem dígito inicial — aplicado a todo nome digitado pelo usuário.

Para tipos de nó novos e ações de cena novas, siga os checklists passo-a-passo em `agents.md` (seções *Adding a New Node Type* e *Adding a New Scene Action*).

---

## Roadmap

Em ordem aproximada de valor:

1. **Hardening do parser de import** — ampliar o importador pragmático em direção a uma AST mais completa, especialmente para estruturas aninhadas.
2. **Cobertura de testes mais ampla** — a camada de domínio está bem coberta (382 testes); cobertura de UI / integração ainda é leve.
3. **CodeMirror dentro do inspetor do painel direito** — a edição de arquivo inteiro já usa CodeMirror; os campos de nó ainda são controles simples.
4. **Designer de stats-screen** — substituir o editor bruto de `choicescript_stats.txt` por um editor estruturado.
5. **Sync Git / nuvem** — atualmente só local-first; snapshots são só de localStorage.
6. **Polimento do desktop** — scaffold Tauri existe; falta auto-update, signing e packaging por plataforma.

O estado atual de "feito vs. ainda não implementado" é trackeado no topo de [`agents.md`](./agents.md).

---

## Licença & Créditos

- **ChoiceScript** é uma marca registrada da Choice of Games LLC. ChoiceForge é um editor independente feito por fãs, sem afiliação ou endosso da Choice of Games.
- **Autor do projeto:** Vinicius (veja `git log`).
- **Construído com assistência do Claude Code** — veja o session log em `agents.md` para um trilho de auditoria de cada mudança assistida por IA.

A menos que indicado de outra forma, o código-fonte deste repositório é liberado sob a Licença MIT. Veja `LICENSE` se presente.
