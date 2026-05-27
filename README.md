# ChoiceForge

> Visual node-based editor for [ChoiceScript](https://www.choiceofgames.com/make-your-own-games/choicescript-intro/) — the domain-specific language behind *Choice of Games*' interactive fiction.

**Languages:** English (this file) · [Português (Brasil)](./README.pt-BR.md)

ChoiceForge lets you build branching interactive stories by connecting visual nodes on a canvas, then exports a `.zip` package of valid `.txt` files that runs against the official ChoiceScript runtime **without any modification**. Think of it as Twine, but targeting ChoiceScript's specific syntax and semantics instead of hypertext.

---

## Table of Contents

- [Highlights](#highlights)
- [Screenshots & Demo](#screenshots--demo)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Scripts](#project-scripts)
- [Architecture Overview](#architecture-overview)
- [The Domain Model](#the-domain-model)
- [Node Types](#node-types)
- [Editing Workflow](#editing-workflow)
- [Import & Export](#import--export)
- [Linter](#linter)
- [Playtesting](#playtesting)
- [Persistence](#persistence)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Desktop App (Tauri)](#desktop-app-tauri)
- [Deployment (Cloudflare Pages)](#deployment-cloudflare-pages)
- [Project Layout](#project-layout)
- [Contributing](#contributing)
- [Roadmap](#roadmap)
- [License & Credits](#license--credits)

---

## Highlights

- **Visual graph editor** — 24 node types (`passage`, `choice`, `if`, `set`, `goto`, `gosub`, `goto_scene`, `ending`, `finish`, `checkpoint`, `restore_checkpoint`, `fake_choice`, `page_break`, `comment`, `input_text`, `input_number`, `rand`, `gosub_scene`, `label`, `return`, `image`, `sound`, `temp`, `params`, `achieve`).
- **Round-trip safe exports** — generated `.txt` files run on the official ChoiceScript runner with zero hand-fixing.
- **Pragmatic ChoiceScript importer** — drop in an existing `.txt`, `.json` or whole `.zip` and ChoiceForge reconstructs the visual graph for common patterns (`*choice` / `*fake_choice` inline branches, `*if`/`*elseif`/`*else`, `*goto`, `*label`, `*gosub`, `*goto_scene`, stat charts, achievements, `*temp` / `*params`, input commands, etc.). Unsupported structures are preserved verbatim as editable source so nothing is ever lost.
- **Bilingual UI** — Portuguese, English, and Spanish strings (`I18nLabels`).
- **Real-time linter** — 140+ keyed diagnostics covering project metadata, achievements, scenes, variables, choices, conditions, jumps, assets, and preserved source.
- **Embedded official ChoiceScript runtime** — the *Play* button launches the actual game in an iframe, not a custom interpreter.
- **CodeMirror full-file editor** — edit the generated `startup.txt`, `choicescript_stats.txt`, or any scene file as raw ChoiceScript. Convert back to the visual graph at any time.
- **Cross-cutting tools** — global search (`Ctrl+Shift+F`), command palette (`Ctrl+K`), find & replace, copy/paste nodes between scenes, drag-to-reorder choice options, inline title edit, per-node notes, todo/done status, manuscript / prose view, dashboard with stats and word-count goals.
- **Custom canvas** — no React Flow, no Cytoscape. Pan, zoom, fit-view, minimap, resizable nodes, auto-layout (hierarchical by topological depth), edge-drop quick node creation.
- **Local-first persistence** — autosave to `localStorage` with `pagehide` flush; export remains the portable `.zip` package.
- **Desktop scaffold** — Tauri v2 wrapper with native open/save dialogs (browser version is unchanged).

---

## Screenshots & Demo

> The web app lives at the project's Cloudflare Pages URL. Run `npm run dev` for a local preview.

| View | Description |
|------|-------------|
| Canvas | Pan/zoom node graph with derived edges (choice / if / goto) and manual flow edges. |
| Inspector | Per-node *Content*, *Logic*, and *Raw* tabs in the right panel. |
| Scene Map | Pannable grid of all scenes with solid arrows for `*goto_scene` and dashed for `*gosub_scene`. |
| Prose View | DFS-ordered manuscript reading mode with author notes as italicised asides. |
| Lint Console | Expandable list of clickable issues at the bottom of the screen. |
| Help Guide | Press `?` to open a six-tab in-app guide. |

---

## Tech Stack

| Layer | Tool |
|-------|------|
| Framework | React 19 + TypeScript 5.8 |
| Build | Vite 4 |
| State | React `useState` + `useMemo` (no Redux / Zustand) |
| Editor | CodeMirror 6 (full-file source view) |
| Compression | [`fflate`](https://github.com/101arrowz/fflate) (zip export/import) |
| Persistence | `localStorage` key `choiceforge.project.v2` |
| Desktop | Tauri 2 (`src-tauri/`) with `tauri-plugin-dialog` and `tauri-plugin-fs` |
| Deployment | Cloudflare Pages |
| Tests | Node built-in test runner (`node --test`) — 382 tests |

**Required Node version:** `>= 24.15.0` (see `.nvmrc` / `.node-version`).

There is intentionally **no graph library**. The canvas is custom-built so the editor can stay tightly coupled to the ChoiceScript domain model.

---

## Getting Started

### Prerequisites

- Node.js `>= 24.15.0` (use `nvm install` to pick up `.nvmrc`).
- npm `>= 11.12.1`.
- (Optional) Rust toolchain if you want to build the desktop app — `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`.

### Install and run

```bash
git clone https://github.com/<your-account>/ChoiceForge.git
cd ChoiceForge
npm install
npm run dev          # http://localhost:5173
```

### Production build

```bash
npm run build        # tsc + vite build → ./dist
npm run preview      # static preview of ./dist
```

### Tests

```bash
npm test             # node --test tests/*.test.ts
```

Tests live in `tests/domain.test.ts` and cover the pure domain layer (code generator, importer, linter, layout). The current suite is **382 passing**.

---

## Project Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server on port `5173`. |
| `npm run build` | Type-check (`tsc`) + production build to `./dist`. |
| `npm run preview` | Local preview of the production build. |
| `npm run test` | Run the Node-test suite over `tests/*.test.ts`. |
| `npm run cf:preview` | Build, then run Cloudflare Pages dev (`wrangler pages dev dist`). |
| `npm run cf:deploy` | Build, then deploy with `wrangler pages deploy dist`. |
| `npm run tauri:dev` | Start the desktop app in dev mode (requires Rust). |
| `npm run tauri:build` | Bundle the desktop app for the current OS. |
| `npm run tauri:icons` | Generate Tauri icons from `src-tauri/app-icon.png`. |

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│ src/components/  ← React UI (App, TopBar, GraphCanvas, …)      │
│                                                                │
│        ▲                                                       │
│        │ reads/writes via ProjectActions                       │
│        ▼                                                       │
│ src/state/projectStore.ts ← useProjectStore() — all mutations │
│        │                                                       │
│        │ delegates pure logic to                               │
│        ▼                                                       │
│ src/domain/                                                    │
│   ├── types.ts            ← Single source of truth (types)     │
│   ├── choicescript.ts     ← Pure: code generator + linter      │
│   ├── choicescriptImport.ts ← Pure: pragmatic CS importer      │
│   └── graphLayout.ts      ← Pure: auto-layout algorithm        │
│                                                                │
│ src/platform/fileSystem.ts ← Tauri-aware open/save             │
│ src/workers/sceneParser.ts ← Off-main-thread heavy parsing     │
│ src/data/ ← Sample project, lint messages (PT/EN/ES)           │
└────────────────────────────────────────────────────────────────┘
```

### Key invariants

1. **`choicescript.ts` is pure.** No React, no DOM, no side-effects.
2. **All mutations go through `commitProject`** (`syncDerivedEdges → updateSceneCounts → persistActiveScene`). Skipping it leaves derived data stale.
3. **The active scene's graph lives in both `project.nodes`/`project.edges` and `project.sceneData[sceneTitle]`** — `persistActiveScene` keeps them in sync.
4. **`startup` and special scenes are locked** (can't be renamed, deleted, or navigated as graphs).
5. **Exported `.txt` files must be valid ChoiceScript** — anything you change in the generator must keep the official runtime green.
6. **Scene/variable/achievement names are normalised identifiers** (lowercase, underscores, no leading digits).
7. **Node IDs are stable references**; deleting a node must clean up `option.to`, `branch.to`, and edges referencing it (`deleteNode` already does this).
8. **Global rename/delete touches every saved graph in `sceneData`**, not just the active scene.

The full design rules live in [`agents.md`](./agents.md) (the authoritative context file for AI agents working on this repo).

---

## The Domain Model

A `ChoiceForgeProject` is a self-contained snapshot:

- **Metadata** — title, author, language, project-level word goal.
- **Scenes** — ordered list (`*scene_list`) plus the special non-listed `choicescript_stats` scene. The first listed scene is the start scene and is locked.
- **Per-scene graph** — `sceneData[sceneTitle]` holds `{ nodes, edges, sourceText?, sourceLanguage? }`. The active scene is mirrored into `project.nodes` and `project.edges` for fast access.
- **Variables** — global `*create` declarations with type (`string` / `number` / `boolean`), initial value, description, fairmath toggle, "show in stats" flag, and optional opposed-low label.
- **Achievements** — `*achievement` blocks with id, title, points, visibility, pre/post earn descriptions.
- **Assets** — files (images, audio) imported as `dataUrl` blobs, exported as real binary files inside the package.

Mutations are issued through `ProjectActions` (see `src/state/projectStore.ts`). Every action returns a brand-new project object — there is no in-place mutation anywhere in the domain layer.

---

## Node Types

| Node | ChoiceScript output |
|------|---------------------|
| `passage` | Prose body followed by `*goto next_node`. |
| `choice` | `*choice` block with `#option` lines (each `*goto` its target). |
| `fake_choice` | `*fake_choice` — options continue inline. |
| `if` | `*if` / `*elseif` / `*else` chain, each branch `*goto`ing its target. |
| `set` | One or more `*set var op value` lines. |
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
| `comment` | `*comment` lines (not visible to players). |
| `input_text` | Prompt body + `*input_text variable`. |
| `input_number` | Prompt body + `*input_number variable min max`. |
| `rand` | `*rand variable min max`. |
| `image` | `*image filename alignment alt`. |
| `sound` | `*sound filename`. |
| `temp` | `*temp name initial` (scene-local). |
| `params` | `*params a b c` (gosub arguments). |
| `achieve` | `*achieve id` (unlocks an achievement). |

Every node also gets a synthetic label `cf_<id>` so that `*goto` can target any node, regardless of whether the author added an explicit `*label`.

### Edge kinds

| `edge.kind` | Origin |
|-------------|--------|
| `flow` | Manual connection drawn by the user. **Persisted.** |
| `choice` | Derived from `choice` / `fake_choice` `option.to`. |
| `goto` | Derived from `goto` / `goto_scene` / `gosub` titles. |
| `if` / `elseif` / `else` | Derived from `if` branch targets. |

`syncDerivedEdges` regenerates all derived edges on every commit. Only `flow` edges are persisted.

---

## Editing Workflow

1. **Create a project** from a sample or from scratch (`File → New`).
2. **Pick a scene** in the left panel. The canvas shows that scene's graph.
3. **Add nodes** from the canvas toolbar, or drop an edge onto empty canvas for a quick type picker.
4. **Wire nodes together** by dragging from a node's bottom-right anchor onto another node's top-left anchor. Choice / if / goto edges are derived from the node's data and update automatically.
5. **Open the right-panel Inspector** for the selected node:
   - **Content** — prose body, prompt, options, branches.
   - **Logic** — conditions, stat changes, outgoing target navigation, autocomplete for `${var}` and `*achieve`.
   - **Raw** — read-only preview of the generated ChoiceScript for the node.
6. **Lint** results show at the bottom (click to jump). Press `?` for the in-app help guide, `Ctrl+K` for the command palette, `Ctrl+Shift+F` for global search, `Ctrl+H` for find & replace.
7. **Save** with `Ctrl+S` (or the *Save* button). Autosave runs in the background and on tab close.
8. **Play** with the *Play* button — opens the embedded official ChoiceScript runtime.
9. **Export** to a `.zip` for upload to the ChoiceScript runtime (or for handing to the Choice of Games review process).

---

## Import & Export

### Export package

`createExportPackage()` builds a `ChoiceForgeExportPackage` that the UI serialises to a `.zip`:

```
_choiceforge/
  project.json                      ← full ChoiceForge metadata (re-importable)
mygame/
  startup.txt                       ← *title, *author, *scene_list, *create, *achievement
  choicescript_stats.txt
  <scene_name>.txt                  ← one per non-startup, non-special scene
  <asset paths…>                    ← imported assets as real binary files
```

### Supported imports

- **ChoiceForge `.zip`** — round-trips perfectly via `_choiceforge/project.json`.
- **ChoiceForge `.json`** — same metadata, no asset binaries.
- **Plain ChoiceScript `.zip`** — parsed by `choicescriptImport.ts`. Recognises `startup.txt` (title/author/scene list/creates/achievements), `choicescript_stats.txt` stat-chart rows, and per-scene `.txt` files.
- **Single `.txt`** — merges as a scene into the current project.
- **Folder selection** — multi-file import via the browser's directory picker (where supported).

The importer is **deliberately pragmatic**: it parses the common patterns (`*choice` / `*fake_choice` with inline body, `*if` / `*elseif` / `*else`, `*goto` / `*goto_scene` / `*gosub` / `*gosub_scene`, `*label`, `*set`, `*input_*`, `*rand`, `*temp`, `*params`, `*achieve`, `*page_break`, `*checkpoint`, `*image`, `*sound`, stat-chart blocks). Whatever it can't fully model is preserved verbatim as **source text** for that scene, openable in the full-file CodeMirror editor and convertible to visual editing on demand.

Imports that would replace a non-trivial existing project ask for confirmation first (`confirmReplaceProject`).

---

## Linter

`lintProject()` runs on every state change (`useMemo`) and emits keyed, localised messages from `src/data/lintMessages.ts` (PT / EN / ES). Categories include:

- **Project & scenes** — empty title/author, missing `*scene_list`, unreachable scenes, scenes excluded from `*scene_list`, duplicate scene names.
- **Variables** — invalid identifiers, reserved names, undeclared, duplicate `*create`, missing initial value, type mismatches.
- **Achievements** — empty id/title/description, invalid visibility/points, duplicates, `*achieve` referencing unknown id.
- **Assets** — unsafe paths, conflicts with exported paths, malformed data URLs, duplicate ids/paths.
- **Graph integrity** — orphan nodes, dead ends, empty option text, missing labels, invalid identifiers, duplicate option text, choices with a single option, `*page_break` / `*checkpoint` missing labels.
- **Conditions** — empty `*if`, branch-after-`*else`, self-loops, `*if` no-ops, all branches landing on the same target.
- **Stat-chart** — invalid type, invalid variable, raw numbers, non-percent values, undeclared stats.
- **Preserved source** — anything the importer kept as raw text is linted line-by-line for `*set` / `*input_*` / `*rand` / `*temp` / `*params` / `*label` / jump correctness, with a size cap (`LARGE_SOURCE_LINT_LIMIT = 40 KB`) to keep the UI responsive on big chapters.

Issues are clickable; clicking jumps to the node, scene, or source line.

---

## Playtesting

- **Official runtime** (`OfficialPlayView.tsx`) — bundles your exported `.txt` files into an `iframe srcdoc` and runs them against the real Choice of Games ChoiceScript engine. This is the default *Play* button.
- **Internal graph playtest** (`PlaytestView.tsx`) — still in the codebase as a graph-level smoke test (variable assignments, branch resolution) but no longer wired into the main toolbar. Useful when you want to validate the *graph* without dragging in the runtime.

---

## Persistence

- **Working project** — stored in `localStorage` under `choiceforge.project.v2`.
- **Autosave** — debounced write whenever React state changes.
- **Manual save** — *Save* button or `Ctrl/Cmd+S`. Calls `actions.saveNow()` which commits the active graph and flushes immediately.
- **Tab-close safety** — `pagehide` and `visibilitychange` listeners flush the latest snapshot before unload.
- **Large `sourceText` stripping** — sourceTexts > 30 KB are excluded from the localStorage snapshot to avoid `QuotaExceededError`. They stay in memory and in the next export.

This is **local-first**, not cloud sync. The `.zip` export is the portable artifact.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd+S` | Save now. |
| `Ctrl/Cmd+K` | Command palette. |
| `Ctrl/Cmd+Shift+F` | Global search. |
| `Ctrl/Cmd+H` | Find & replace. |
| `Ctrl/Cmd+C` / `Ctrl/Cmd+V` | Copy / paste selected nodes (clipboard survives scene switches). |
| `Delete` / `Backspace` | Delete the selected node. |
| `Spacebar + drag` | Pan canvas. |
| `Ctrl + wheel` | Zoom centred on the pointer. |
| `?` | Open the in-app help guide. |
| Double-click a node title | Inline rename. |
| Drag the `::` handle on a choice option | Reorder option. |

A full reference is available in the in-app *Help → Shortcuts* tab.

---

## Desktop App (Tauri)

The web build is the source of truth; the desktop app is a thin Tauri v2 wrapper.

### Prerequisites

- Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- Provide a 512×512 `src-tauri/app-icon.png` and run `npm run tauri:icons` once.

### Run / build

```bash
npm run tauri:dev    # dev with HMR + native window
npm run tauri:build  # release bundle for the current OS
```

The Tauri layer adds:

- Native *Open* / *Save* / *Save As* file pickers (`.json` project files).
- Persistent file path remembered for `Ctrl/Cmd+S` (writes back to disk instead of localStorage).
- Native window title that updates with the loaded project.

Detection is done at runtime via `isTauri()` in `src/platform/fileSystem.ts`. In the browser the *Save* button keeps its existing behaviour.

---

## Deployment (Cloudflare Pages)

Cloudflare Pages must publish the compiled `dist/` directory, not the repo root.

| Setting | Value |
|---------|-------|
| Framework preset | `Vite` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | repository root |
| Node version | `24.15.0` |

Do **not** add a `wrangler.toml` for the static Git deployment unless the Pages project is intentionally Wrangler-managed — when Cloudflare detects `wrangler.toml`, it becomes the source of truth and may skip the Vite build entirely.

If the deployed page is blank, check the served HTML: if it contains `<script type="module" src="/src/main.tsx"></script>`, Cloudflare is serving the raw source `index.html`. The deployed HTML should reference compiled assets under `/assets/`.

You can also deploy from your machine with:

```bash
npm run cf:deploy
```

See [`docs/cloudflare-pages.md`](./docs/cloudflare-pages.md) for the long version.

---

## Project Layout

```
ChoiceForge/
├── src/
│   ├── App.tsx                       # Root layout: TopBar / LeftPanel / Canvas / RightPanel / BottomBar
│   ├── main.tsx                      # React entry point
│   ├── components/
│   │   ├── BottomBar.tsx             # Lint console
│   │   ├── CodeEditor.tsx            # Shared CodeMirror wrapper
│   │   ├── CommandPalette.tsx        # Ctrl+K fuzzy navigator
│   │   ├── Dashboard.tsx             # Project stats overview
│   │   ├── GeneratedDocumentView.tsx # Full-file CodeMirror editor
│   │   ├── GraphCanvas.tsx           # The custom canvas (no graph library)
│   │   ├── HelpGuide.tsx             # In-app guide modal
│   │   ├── KeyboardShortcutOverlay.tsx
│   │   ├── LeftPanel.tsx             # Scenes / Variables / Achievements / Assets tabs
│   │   ├── ManuscriptView.tsx        # DFS prose reader
│   │   ├── NewProjectModal.tsx
│   │   ├── NodeBodyEditor.tsx        # Body editor with var/achievement autocomplete
│   │   ├── NodeCard.tsx              # Single-node rendering on the canvas
│   │   ├── OfficialPlayView.tsx      # Embedded official ChoiceScript runtime
│   │   ├── PlaytestView.tsx          # Legacy graph-level playtest
│   │   ├── RightPanel.tsx            # Inspector: Content / Logic / Raw tabs
│   │   ├── SceneMapView.tsx          # Scene-level overview map
│   │   ├── SnapshotPanel.tsx         # localStorage snapshots
│   │   └── TopBar.tsx                # Save / import / export / play / settings
│   ├── data/
│   │   ├── lintMessages.ts           # PT/EN/ES translations of all lint keys
│   │   └── sampleProject.ts          # PT/EN sample project + I18n strings
│   ├── domain/
│   │   ├── choicescript.ts           # PURE: code generator + linter
│   │   ├── choicescriptImport.ts     # PURE: pragmatic CS importer
│   │   ├── graphLayout.ts            # PURE: auto-layout
│   │   └── types.ts                  # All TypeScript types
│   ├── platform/
│   │   └── fileSystem.ts             # Tauri-aware open/save abstraction
│   ├── state/
│   │   └── projectStore.ts           # useProjectStore() — all mutations here
│   └── workers/
│       └── sceneParser.ts            # Off-main-thread heavy scene parse
├── src-tauri/                        # Tauri v2 desktop wrapper
├── tests/
│   └── domain.test.ts                # 382 tests over the pure domain layer
├── public/
│   ├── _redirects                    # Cloudflare Pages SPA redirect
│   ├── favicon.svg
│   └── play/                         # Static official ChoiceScript runtime assets
├── docs/
│   └── cloudflare-pages.md           # Deployment notes
├── agents.md                         # Authoritative AI-agent context (architecture + session log)
├── CLAUDE.md                         # Claude Code workflow rules
├── index.html
├── styles.css                        # App-wide styles (canvas, panels, modals)
├── directions.css                    # Directional/animation styles
├── package.json
├── tsconfig.json
└── vite.config.ts
```

> Legacy `.jsx` files at the repository root (`app.jsx`, `chrome.jsx`, `dashboard.jsx`, `data.jsx`, `graph-canvas.jsx`, `left-panel.jsx`, `node-card.jsx`, `right-panel.jsx`, `tweaks-panel.jsx`) and `ChoiceForge.html` belong to the original prototype that predates the TypeScript port. They are kept as a reference but are not part of the current build.

---

## Contributing

1. **Read [`agents.md`](./agents.md) before touching code.** It is the authoritative architecture / invariants / gotchas document for both humans and AI agents.
2. **Never break passing tests.** Run `npm test` before committing anything in `src/domain/`.
3. **Keep `choicescript.ts` pure.** No React imports, no DOM access, no side-effects.
4. **All mutations go through `commitProject`** (see *Adding a New Scene Action* in `agents.md`).
5. **No comments unless the *why* is non-obvious.** Self-documenting names beat narration.
6. **Immutable updates everywhere** — return new arrays/objects, never mutate in place.
7. **i18n strings** come from `I18nLabels`; never hardcode user-visible text in components.
8. **`normalizeIdentifier`** lowercase + underscore + no leading digits — applied to every user-typed name.

For new node types and scene actions, follow the step-by-step checklists in `agents.md` (sections *Adding a New Node Type* and *Adding a New Scene Action*).

---

## Roadmap

In rough order of value:

1. **Import / parser hardening** — broaden the pragmatic importer toward a more complete AST, especially for nested structures.
2. **Broader automated tests** — domain layer is well covered (382 tests); UI / integration coverage is still light.
3. **CodeMirror inside the right-panel inspector** — full-file editing already uses CodeMirror; node-level fields are still plain controls.
4. **Stats-screen designer** — replace the raw `choicescript_stats.txt` editor with a structured editor.
5. **Git / cloud sync** — currently local-first only; snapshots are localStorage-only.
6. **Desktop polish** — Tauri scaffold exists; needs auto-update, signing, and platform packaging.

The current state of "done vs. not yet implemented" is tracked at the top of [`agents.md`](./agents.md).

---

## License & Credits

- **ChoiceScript** is a trademark of Choice of Games LLC. ChoiceForge is an independent, fan-made editor and is not affiliated with or endorsed by Choice of Games.
- **Project author:** Vinicius (see `git log`).
- **Built with assistance from Claude Code** — see the session log inside `agents.md` for an audit trail of every AI-assisted change.

Unless stated otherwise, the source code in this repository is released under the MIT License. See `LICENSE` if present.
