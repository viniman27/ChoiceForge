<div align="center">

<img src="./src-tauri/icons/128x128.png" alt="ChoiceForge" width="96" height="96" />

# ChoiceForge

**Editor visual baseado em nós para [ChoiceScript](https://www.choiceofgames.com/make-your-own-games/choicescript-intro/) — monte histórias ramificadas num canvas, exporte arquivos `.txt` que rodam direto no runtime oficial da Choice of Games sem nenhuma modificação.**

[**🎮 Abrir no navegador**](https://choiceforge.pages.dev) · [**💾 Baixar desktop**](https://github.com/viniman27/ChoiceForge/releases/latest) · [**📖 English**](./README.md)

[![CI](https://github.com/viniman27/ChoiceForge/actions/workflows/ci.yml/badge.svg)](https://github.com/viniman27/ChoiceForge/actions/workflows/ci.yml)
![testes](https://img.shields.io/badge/testes-476_passando-brightgreen)
![licen%C3%A7a](https://img.shields.io/badge/licen%C3%A7a-MIT-blue)

</div>

---

## O que é?

Escrever um jogo em ChoiceScript em texto puro significa juntar manualmente labels de `*goto`, cadeias de `*if`/`*elseif`, blocos de `*choice` e ordenação de `*scene_list` espalhada em dezenas de arquivos `.txt`. O ChoiceForge troca isso por um **grafo visual** onde cada nó é uma passagem, escolha, condição ou salto — conectados por setas. Você enxerga o formato da história num relance, o linter sinaliza referências quebradas antes do export, e **a exportação produz os mesmos arquivos `.txt`** que o runner oficial ChoiceScript espera.

É primo do Twine, mas falando ChoiceScript nativamente em vez de HTML — cada nó mapeia pra um comando CS real, e o round-trip export→import é lossless pra tudo que o editor visual modela.

> Pense Twine para ChoiceScript: editor de grafo entra, arquivos `.txt` compatíveis com o oficial saem.

<div align="center">

![Editor ChoiceForge — canvas de grafo com o projeto de exemplo carregado](./docs/screenshot-editor.png)

<sub>O editor com o projeto de exemplo (PT) carregado — cenas à esquerda, canvas com passagens/escolhas/saltos no meio, inspetor à direita.</sub>

</div>

---

## Escolha como usar

|  | O que recebe | Quando pegar |
|--|--|--|
| **🌐 App web** | Abra a [última build](https://choiceforge.pages.dev) — sem instalar, autosave local. | Caminho mais rápido pra testar, compartilhar com co-autores. |
| **💾 App desktop** | Instaladores nativos `.dmg` (macOS) ou `.msi` (Windows) na [página de Releases](https://github.com/viniman27/ChoiceForge/releases/latest). | Quer file dialogs nativos, trabalhar offline, ou prefere uma janela desktop. |
| **🛠️ Build do código** | Ambiente Vite + React completo. Veja [Começando](#começando). | Está contribuindo, hackeando, ou hospedando próprio. |

---

## Destaques

- **Editor visual de grafo** com **24 tipos de nó** cobrindo cada comando ChoiceScript: `passage`, `choice`, `fake_choice`, `if`/`elseif`/`else`, `set`, `goto`, `goto_scene`, `gosub`, `gosub_scene`, `return`, `ending`, `finish`, `checkpoint`, `restore_checkpoint`, `page_break`, `comment`, `input_text`, `input_number`, `rand`, `image`, `sound`, `temp`, `params`, `achieve`, `label`.
- **Exportação round-trip safe**: cada `.txt` gerado roda no runner oficial sem ajustes manuais.
- **Importador pragmático**: arraste um `.txt`, `.json` ou `.zip` existente — padrões comuns reconstroem como grafo visual, estruturas não suportadas ficam preservadas como código-fonte editável; nada se perde.
- **UI trilíngue**: Português, Inglês, Espanhol (~165 strings localizadas).
- **Linter em tempo real**: mais de 140 diagnósticos chaveados cobrindo metadados, conquistas, cenas, variáveis, escolhas, condições, saltos, assets e código preservado — incluindo consistência de capitalização de variáveis (pra `coragem` vs `Coragem` não passar batido na revisão de código).
- **Validadores de submissão embutidos**: Quicktest + Randomtest oficiais da Choice of Games rodam dentro do editor, mais um checklist `Pronto?` (lint limpo, contagem de palavras, conquistas, `*stat_chart`, quicktest passa, randomtest 10k passa).
- **Exportação Graphviz `.dot`**: gera o grafo inteiro do projeto como arquivo `.dot` (cluster por cena, cores por tipo de nó, edges entre cenas) pra compartilhar a estrutura fora do editor.
- **Runtime ChoiceScript oficial embutido**: o botão *Jogar* roda o engine real da Choice of Games num iframe — não um interpretador caseiro.
- **Editor CodeMirror de código-fonte**: entre em qualquer cena como ChoiceScript bruto, depois converta de volta pro grafo visual.
- **Ferramentas transversais**: busca global (`Ctrl+Shift+F`), paleta de comandos (`Ctrl+K`), find & replace, copiar/colar nós entre cenas, drag-to-reorder de opções de escolha, edição de título inline, notas privadas por nó, status todo/feito, modo manuscrito/prosa, dashboard com estatísticas e metas de palavras.
- **Canvas customizado**: pan, zoom, fit-view, minimapa, nós redimensionáveis, auto-layout (hierárquico por profundidade topológica), criação rápida de nó ao soltar uma conexão.
- **Persistência local-first**: autosave em `localStorage` com flush em `pagehide`; o artefato portátil continua sendo o `.zip` exportado.
- **Desktop nativo**: wrapper Tauri v2 com diálogos nativos de abrir/salvar.
- **Robustez**: cada painel envolto em React error boundary — crash em um pane mostra erro inline em vez de derrubar o app inteiro.

---

## Sumário

- [Começando](#começando)
- [App Desktop](#app-desktop)
- [Arquitetura em 30 segundos](#arquitetura-em-30-segundos)
- [Tipos de Nó](#tipos-de-nó)
- [Fluxo de Edição](#fluxo-de-edição)
- [Importação & Exportação](#importação--exportação)
- [Linter](#linter)
- [Playtest](#playtest)
- [Persistência](#persistência)
- [Atalhos de Teclado](#atalhos-de-teclado)
- [Self-Hosting](#self-hosting)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Contribuindo](#contribuindo)
- [Roadmap](#roadmap)
- [Licença & Créditos](#licença--créditos)

---

## Começando

### Pré-requisitos

- **Node.js ≥ 24.15.0** — `nvm install` pega a versão do `.nvmrc`.
- **npm ≥ 11.12.1**.
- (Opcional, só pra builds desktop) **Toolchain Rust** — `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`.

### Instalar & rodar

```bash
git clone https://github.com/viniman27/ChoiceForge.git
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
npm test             # testes de domínio (387 testes, node --test)
npm run test:ui      # testes de UI / store / round-trip (89 testes, Vitest)
npm run test:all     # ambas as suites
```

CI roda ambas as suites + type check + build em todo push e PR.

### Scripts disponíveis

| Script | O que faz |
|--------|-----------|
| `npm run dev` | Servidor Vite na porta `5173`. |
| `npm run build` | Type-check + build de produção. |
| `npm run preview` | Preview local do build. |
| `npm test` | Suite de testes de domínio. |
| `npm run test:ui` | Suite UI (Vitest + jsdom + Testing Library). |
| `npm run test:ui:watch` | Vitest em watch mode. |
| `npm run test:ui:coverage` | Relatório de cobertura em `coverage/`. |
| `npm run test:all` | Ambas as suites em sequência. |
| `npm run tauri:dev` | Desktop com HMR (requer Rust). |
| `npm run tauri:build` | Build do instalador desktop pra seu SO atual. |
| `npm run tauri:icons` | Regenera ícones das plataformas a partir de `src-tauri/app-icon.png`. |

---

## App Desktop

Instaladores nativos publicados na [**página de Releases**](https://github.com/viniman27/ChoiceForge/releases/latest):

| Plataforma | Instalador | Arquitetura |
|------------|------------|-------------|
| **macOS** | `.dmg` | Universal (Intel + Apple Silicon) |
| **Windows** | `.msi` | x64 |

### Instalação

#### macOS

1. Abra o `.dmg` e arraste o **ChoiceForge** pra **Aplicativos**.
2. A primeira execução é bloqueada pelo Gatekeeper porque o build ainda não é code-signed. **Botão direito → Abrir não funciona mais no macOS 15+** — o Gatekeeper mostra *"A Apple não pode verificar se o item ChoiceForge está livre de algum malware"* com **só "Mover para o Lixo" / "OK"** como opções.

   **Escolha um dos dois caminhos pra desbloquear:**

   **A. Terminal (um comando, funciona em qualquer versão do macOS):** abra o Terminal e rode
   ```bash
   xattr -dr com.apple.quarantine /Applications/ChoiceForge.app
   ```
   Depois é só dar duplo clique no ChoiceForge normalmente.

   **B. Ajustes do Sistema (sem Terminal):**
   1. Clique em **OK** no diálogo de bloqueio (**NÃO** clique em "Mover para o Lixo" — isso apaga o app).
   2. Abra **Ajustes do Sistema → Privacidade e Segurança**.
   3. Role até o fim da seção **Segurança** — vai aparecer uma linha *"ChoiceForge foi bloqueado para proteger seu Mac"* com um botão **Abrir Mesmo Assim** do lado. O macOS só mostra essa linha por cerca de 1 hora depois do diálogo de bloqueio.
   4. Clique em **Abrir Mesmo Assim** → digite sua senha se pedir → no próximo diálogo clique em **Abrir**.

3. Depois de qualquer um dos dois caminhos, a primeira abertura bem-sucedida é lembrada — toda execução seguinte funciona sem prompts.

> O comando de Terminal é mais rápido e confiável entre versões do macOS. O caminho de Ajustes está aí pra quem prefere não usar Terminal.

#### Windows

1. Rode o `.msi` (ou o `.exe` installer). O SmartScreen do Windows vai bloquear porque o build ainda não é code-signed (*"O Windows protegeu seu PC"*).
2. Clique em **Mais informações → Executar mesmo assim** pra confirmar.
3. Execuções seguintes funcionam normalmente.

> Certificados de code-signing pras duas plataformas estão no roadmap. Até lá, esses prompts fazem parte do fluxo de instalação.

### O que o desktop adiciona sobre a versão web

- **Diálogos nativos** de *Abrir* / *Salvar* / *Salvar Como* em arquivos `.json` reais.
- **Caminho de arquivo persistente** — `Ctrl/Cmd+S` grava no disco em vez de localStorage.
- **Título da janela nativo** atualizado com o projeto aberto.

O desktop é a mesma build Vite da web, empacotada num shell Tauri 2. Código em `src-tauri/`.

### Construindo seu próprio instalador desktop

```bash
npm install
npm run tauri:build   # gera o instalador pro SO atual em src-tauri/target/release/bundle/
```

Pra lançar nova release pública: dê push de uma tag `v*` e o workflow `Desktop Release` no GitHub Actions cria instaladores mac + win e abre uma Release draft com eles anexados.

```bash
git tag v0.2.0
git push --tags
```

---

## Arquitetura em 30 segundos

```
src/
├── domain/        ← PURO: tipos, gerador, importador, linter, layout
├── state/         ← useProjectStore() — toda mutação via ProjectActions
├── components/    ← UI React: App, TopBar, LeftPanel, GraphCanvas, RightPanel, BottomBar, …
├── data/          ← Projetos de amostra + I18nLabels (PT/EN/ES)
├── platform/      ← Abstração de file system ciente de Tauri
└── workers/       ← Parsing pesado fora da main thread (cena + zip)
```

### Cinco regras que mantêm o sistema coerente

1. **`src/domain/choicescript.ts` é puro** — sem React, sem DOM, sem side-effects.
2. **Toda mutação de projeto passa por `commitProject`** (`syncDerivedEdges → updateSceneCounts → persistActiveScene`).
3. **O grafo da cena ativa vive EM AMBOS `project.nodes`/`project.edges` E `project.sceneData[sceneTitle]`** — `persistActiveScene` mantém em sincronia.
4. **Cenas `startup` e `special` são bloqueadas** — não podem ser renomeadas, deletadas ou navegadas como grafo.
5. **Identificadores digitados pelo usuário sempre passam por `normalizeIdentifier`** (minúsculas, underscore, sem dígito inicial) antes de persistir.

Deep dive da arquitetura em [`agents.md`](./agents.md) — também o arquivo de contexto autoritativo pra agentes de IA trabalhando no repo.

---

## Tipos de Nó

| Nó | Saída ChoiceScript |
|----|---------------------|
| `passage` | Corpo de prosa + `*goto next_node`. |
| `choice` | `*choice` com linhas `#option`, cada uma com `*goto` pro alvo. |
| `fake_choice` | `*fake_choice` — opções continuam inline. |
| `if` | Cadeia `*if` / `*elseif` / `*else`. |
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
| `input_text` | Prompt + `*input_text variable`. |
| `input_number` | Prompt + `*input_number variable min max`. |
| `rand` | `*rand variable min max`. |
| `image` | `*image filename alignment alt`. |
| `sound` | `*sound filename`. |
| `temp` | `*temp name initial` (escopo de cena). |
| `params` | `*params a b c` (argumentos de gosub). |
| `achieve` | `*achieve id`. |

Cada nó também recebe um label sintético `*label cf_<id>` pra que `*goto` possa apontar pra qualquer nó, com ou sem `*label` explícito.

### Tipos de aresta

| Tipo | Origem |
|------|--------|
| `flow` | Conexão manual desenhada pelo usuário. **Persistida.** |
| `choice` | Derivada de `option.to` em nó `choice` / `fake_choice`. |
| `goto` | Derivada do título de `goto` / `goto_scene` / `gosub`. |
| `if` / `elseif` / `else` | Derivada dos alvos dos ramos `if`. |

`syncDerivedEdges` regenera todas as arestas derivadas a cada commit. Só arestas `flow` são persistidas.

---

## Fluxo de Edição

1. **Crie um projeto** — `Arquivo → Novo`, em branco, ou carregue a amostra.
2. **Escolha uma cena** no painel esquerdo. O canvas mostra o grafo dela.
3. **Adicione nós** pela toolbar do canvas, ou solte uma aresta no canvas vazio pro picker rápido.
4. **Conecte nós**: arraste do anchor inferior-direito de um nó pro superior-esquerdo de outro. Choice / if / goto atualizam automaticamente.
5. **Abra o Inspetor** (painel direito) — abas Conteúdo / Lógica / Raw.
6. **Resultados do linter** fluem pro rodapé; clique numa issue pra pular.
7. **Salve** com `Ctrl+S` (autosave também roda em background).
8. **Jogue** — o botão *Jogar* embute o runtime oficial.
9. **Exporte** — gera um `.zip` pronto pro processo de revisão da Choice of Games.

---

## Importação & Exportação

### Pacote exportado

`createExportPackage()` monta um pacote estruturado que a UI serializa em `.zip` (compressão DEFLATE via `fflate`):

```
_choiceforge/
  project.json                ← Metadados ChoiceForge (reimportável)
mygame/
  startup.txt                 ← *title, *author, *scene_list, *create, *achievement
  choicescript_stats.txt
  <scene_name>.txt            ← um por cena jogável
  <caminhos de assets…>       ← assets importados como arquivos binários
```

### Importações suportadas

- **`.zip` ChoiceForge** — round-trip perfeito via `_choiceforge/project.json`.
- **`.json` ChoiceForge** — mesmos metadados, sem binários de asset.
- **`.zip` ChoiceScript puro** — parseado pelo importador pragmático.
- **`.txt` único** — mescla como uma cena no projeto atual.
- **Seleção de pasta** — multi-arquivo via picker de diretório do navegador.

O importador é **pragmático**: padrões comuns reconstroem como grafo visual (`*choice` / `*fake_choice` com corpo inline, `*if`/`*elseif`/`*else`, `*goto` / `*goto_scene` / `*gosub` / `*gosub_scene`, `*label`, `*set`, `*input_*`, `*rand`, `*temp`, `*params`, `*achieve`, `*page_break`, `*checkpoint`, `*image`, `*sound`, blocos de stat-chart). O que não consegue modelar é preservado como texto-fonte daquela cena, abrível no editor CodeMirror e convertível pra edição visual sob demanda.

Importações que substituiriam um projeto não trivial pedem confirmação primeiro.

### Performance

Imports `.zip` grandes (> 256 KB) descomprimem em um Web Worker pra main thread continuar responsiva mesmo em arquivos ChoiceScript de vários MB com imagens.

---

## Linter

`lintProject()` roda a cada mudança de estado e emite **mais de 140 diagnósticos chaveados e localizados** vindos de `src/data/lintMessages.ts` (PT/EN/ES). Categorias:

- **Projeto & cenas** — título/autor vazios, `*scene_list` ausente, cenas inalcançáveis, duplicatas.
- **Variáveis** — identificadores inválidos, nomes reservados, não declaradas, `*create` duplicado, valor inicial faltando, mismatch de tipo.
- **Conquistas** — id/título/descrição vazios, visibilidade/pontos inválidos, duplicatas.
- **Assets** — caminhos inseguros, conflitos com caminhos exportados, dataURLs malformados, ids/caminhos duplicados.
- **Integridade do grafo** — nós órfãos, becos sem saída, opção vazia, labels faltando, identificadores inválidos, choices com uma opção, `*page_break` / `*checkpoint` sem label.
- **Condições** — `*if` vazio, ramo após `*else`, self-loops, no-ops.
- **Stat-chart** — tipo / variável / números crus / não-percent / stats não declaradas inválidos.
- **Código preservado** — lint linha a linha em `*set`, `*input_*`, `*rand`, `*temp`, `*params`, `*label`, corretude de jumps (pulado pra arquivos > 40 KB pra manter a UI responsiva).

Issues são clicáveis; clicar pula pro nó, cena ou linha de código.

---

## Playtest

- **Runtime oficial** (`OfficialPlayView.tsx`) — empacota seus `.txt` exportados num `iframe srcdoc` e roda no engine ChoiceScript real da Choice of Games. É o que o botão *Jogar* faz.
- **Playtest interno** (`PlaytestView.tsx`) — ainda no código como smoke test no nível do grafo, útil pra validar o *grafo* sem invocar o runtime.

---

## Persistência

- **Projeto em edição** — guardado em `localStorage` sob `choiceforge.project.v2`.
- **Autosave** — escrita debounced em toda mudança de estado.
- **Salvar manual** — botão *Salvar* ou `Ctrl/Cmd+S`.
- **Segurança ao fechar a aba** — listeners de `pagehide` + `visibilitychange` descarregam o snapshot mais recente.
- **App desktop** — também grava no caminho de arquivo nativo escolhido.

É **local-first**, não sync em nuvem. O `.zip` exportado é o artefato portátil que você entrega pra outras ferramentas ou ao processo de revisão da Choice of Games.

---

## Atalhos de Teclado

| Atalho | Ação |
|--------|------|
| `Ctrl/Cmd+S` | Salvar agora. |
| `Ctrl/Cmd+K` | Paleta de comandos. |
| `Ctrl/Cmd+Shift+F` | Busca global. |
| `Ctrl/Cmd+H` | Find & replace. |
| `Ctrl/Cmd+C` / `Ctrl/Cmd+V` | Copiar / colar nós (clipboard sobrevive a troca de cena). |
| `Delete` / `Backspace` | Deletar nó selecionado. |
| `Espaço + arrastar` | Pan do canvas. |
| `Ctrl + roda` | Zoom centrado no ponteiro. |
| `?` | Abre o guia in-app. |
| Duplo clique no título do nó | Rename inline. |
| Arrastar o handle `::` da opção | Reordena opção. |

Referência completa na aba *Ajuda → Atalhos* do app.

---

## Self-Hosting

ChoiceForge é uma SPA estática — qualquer host que serve arquivos funciona.

### Build & deploy

```bash
npm run build        # output em ./dist
```

Faça upload do conteúdo de `./dist` pra qualquer host estático (ou seu bucket S3-compatible, GitHub Pages, Netlify, seu próprio servidor). O app é totalmente client-side: sem backend, sem API, sem variáveis de ambiente.

### Checklist pro host

- Servir `index.html` pra rotas desconhecidas (SPA fallback). Há um `public/_redirects` incluído pra conveniência de hosts que leem esse formato.
- Assets compilados sob `/assets/` precisam ser servidos com seus nomes hash.
- Setar `Node version` pro valor no `.nvmrc` (`24.15.0`) se o host roda o build sozinho.

---

## Estrutura do Projeto

```
ChoiceForge/
├── src/
│   ├── App.tsx                       # Layout raiz (TopBar / LeftPanel / Canvas / RightPanel / BottomBar)
│   ├── main.tsx                      # Entry point React
│   ├── components/                   # Todos os componentes UI
│   ├── data/                         # Projetos de amostra + catálogo de mensagens de lint (PT/EN/ES)
│   ├── domain/                       # PURO: tipos, gerador, importador, layout, helpers de parsing
│   ├── platform/                     # Abstração de file system ciente de Tauri
│   ├── state/projectStore.ts         # useProjectStore() — todas as mutações
│   └── workers/                      # Parsing fora da main: cena + zip
├── src-tauri/                        # Wrapper desktop Tauri v2
├── tests/
│   ├── domain.test.ts                # 387 testes da camada de domínio pura
│   └── ui/                           # 89 testes: componentes, store, i18n, round-trip, update check, App smoke
├── public/                           # Assets estáticos + redirect SPA + arquivos do runtime oficial
├── agents.md                         # Contexto autoritativo pra agentes de IA (arquitetura + log de sessões)
├── CLAUDE.md                         # Regras de workflow do Claude Code
├── CONTRIBUTING.md                   # Guia do contribuidor
├── CHANGELOG.md                      # Keep-a-Changelog
├── CODE_OF_CONDUCT.md
├── SECURITY.md
└── LICENSE                           # MIT
```

> Arquivos `.jsx` legados na raiz do repo e `ChoiceForge.html` vêm do protótipo original antes do port pra TypeScript. Mantidos como referência; não fazem parte do build atual.

---

## Contribuindo

Veja [`CONTRIBUTING.md`](./CONTRIBUTING.md) — cobre o workflow, os **oito invariantes não-negociáveis** (pureza de `choicescript.ts`, disciplina de `commitProject`, normalização de identificadores, etc.), code style, padrão de testes pra cada camada, e o checklist pra adicionar um tipo de nó ou action de cena.

Antes de mexer no código, leia [`agents.md`](./agents.md) — o deep dive de arquitetura que tanto contribuidores humanos quanto agentes de IA usam como verdade.

**Padrões de comportamento**: veja [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md). **Issues de segurança**: veja [`SECURITY.md`](./SECURITY.md) — por favor reporte privadamente.

---

## Roadmap

Em ordem aproximada de valor:

1. **Hardening do parser de import** — ampliar o importador pragmático em direção a uma AST mais completa, especialmente pra estruturas aninhadas.
2. **Code signing pras releases desktop** — atualmente unsigned (prompts de segurança no primeiro launch em mac e win).
3. **CodeMirror inline no inspetor do painel direito** — edição de arquivo inteiro já usa CodeMirror; campos de nó ainda são controles simples.
4. **Designer de stats-screen** — substituir o editor raw de `choicescript_stats.txt` por um editor estruturado.
5. **Sync cloud / integração Git** — atualmente só local-first; snapshots são só localStorage.

O estado atual de "feito vs. não implementado" mora no topo de [`agents.md`](./agents.md).

---

## Licença & Créditos

- **Licença MIT** — veja [`LICENSE`](./LICENSE).
- **ChoiceScript** é marca registrada da Choice of Games LLC. ChoiceForge é um editor independente feito por fãs, **sem afiliação ou endosso da Choice of Games**.
- **Autor do projeto**: Vinicius de Araujo ([@viniman27](https://github.com/viniman27)).
- **Construído com assistência do Claude Code** — veja o session log em [`agents.md`](./agents.md) pra trilho de auditoria das mudanças assistidas por IA.

### Reconhecimentos

- **[BenSeawalker / Chronicler](https://forum.choiceofgames.com/t/chronicler-visual-choicescript-editor/4081)** — o primeiro editor visual de ChoiceScript, que provou anos atrás que autores queriam uma ferramenta baseada em grafo. ChoiceForge usa um stack diferente (navegador + desktop multiplataforma, runtime oficial embedado) mas a *ideia* — "tratar a história como grafo, gerar `.txt` limpo do outro lado" — vem direto dessa linhagem.
- **[M3ales / choicescript-tree](https://github.com/M3ales/choicescript-tree)** — um analisador estático de ChoiceScript com pipeline de compilador completa. O lint de capitalização de variáveis e a exportação Graphviz `.dot` do ChoiceForge são inspirados em `analysis/variable-casing/` e `renderer/graph/` desse projeto (ambos MIT). Algoritmos específicos creditados inline no código fonte relevante.
