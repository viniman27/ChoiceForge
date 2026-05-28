<div align="center">

# ChoiceForge

**Visual node-based editor for [ChoiceScript](https://www.choiceofgames.com/make-your-own-games/choicescript-intro/) — build branching stories on a canvas, export `.txt` files that run unmodified on the official Choice of Games runtime.**

[**🎮 Try it in your browser**](https://choiceforge.pages.dev) · [**💾 Download desktop**](https://github.com/viniman27/ChoiceForge/releases/latest) · [**📖 Português**](./README.pt-BR.md)

[![CI](https://github.com/viniman27/ChoiceForge/actions/workflows/ci.yml/badge.svg)](https://github.com/viniman27/ChoiceForge/actions/workflows/ci.yml)
![tests](https://img.shields.io/badge/tests-476_passing-brightgreen)
![license](https://img.shields.io/badge/license-MIT-blue)

</div>

---

## What is it?

Authoring a ChoiceScript game in plain text means juggling `*goto` labels, `*if`/`*elseif` chains, `*choice` blocks, and `*scene_list` ordering across dozens of `.txt` files. ChoiceForge replaces that with a **visual graph** where every node is a passage, choice, condition, or jump — wired together with arrows. You see your story's shape at a glance, the linter flags broken references before you ship, and **export produces the same `.txt` files** the official ChoiceScript runner expects.

It's a sibling to Twine, but it speaks ChoiceScript natively instead of HTML — every node maps to a real CS command, and round-tripping export→import is lossless for everything the visual editor models.

> Think Twine for ChoiceScript: graph editor in, official-compatible `.txt` files out.

---

## Pick how you want to use it

|  | What you get | When to pick this |
|--|--|--|
| **🌐 Web app** | Open the [latest build](https://choiceforge.pages.dev) — no install, autosaves locally. | Quickest way to try the editor, share with co-authors. |
| **💾 Desktop app** | Native `.dmg` (macOS) or `.msi` (Windows) on the [Releases page](https://github.com/viniman27/ChoiceForge/releases/latest). | You want native file open/save, work offline, or prefer a desktop window. |
| **🛠️ Build from source** | Full Vite + React dev environment. See [Getting Started](#getting-started). | You're contributing, hacking, or self-hosting. |

---

## Highlights

- **Visual graph editor** with **24 node types** covering every ChoiceScript command: `passage`, `choice`, `fake_choice`, `if`/`elseif`/`else`, `set`, `goto`, `goto_scene`, `gosub`, `gosub_scene`, `return`, `ending`, `finish`, `checkpoint`, `restore_checkpoint`, `page_break`, `comment`, `input_text`, `input_number`, `rand`, `image`, `sound`, `temp`, `params`, `achieve`, `label`.
- **Round-trip safe exports**: every generated `.txt` runs on the official ChoiceScript runner with zero hand-fixing.
- **Pragmatic importer**: drop in an existing `.txt`, `.json`, or whole `.zip` — common patterns reconstruct as a visual graph, unsupported structures are preserved verbatim as editable source so nothing is ever lost.
- **Trilingual UI**: Portuguese, English, Spanish (~165 localised strings).
- **Real-time linter**: 140+ keyed diagnostics across project metadata, achievements, scenes, variables, choices, conditions, jumps, assets, and preserved source.
- **Embedded official ChoiceScript runtime**: the *Play* button runs the actual Choice of Games engine in an iframe — not a custom interpreter.
- **CodeMirror source editor**: drop into any scene as raw ChoiceScript, then convert back to the visual graph.
- **Cross-cutting tools**: global search (`Ctrl+Shift+F`), command palette (`Ctrl+K`), find & replace, copy/paste nodes between scenes, drag-to-reorder choice options, inline title edit, per-node author notes, todo/done status, manuscript / prose reading view, dashboard with stats and word-count goals.
- **Custom canvas**: pan, zoom, fit-view, minimap, resizable nodes, auto-layout (hierarchical by topological depth), edge-drop quick node creation.
- **Local-first persistence**: autosave to `localStorage` with pagehide flush; the portable artifact stays the `.zip` export.
- **Native desktop**: Tauri v2 wrapper with native open/save dialogs.
- **Robustness**: each panel is wrapped in a React error boundary — a crash in one pane shows an inline error instead of taking down the whole app.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Desktop App](#desktop-app)
- [Architecture in 30 Seconds](#architecture-in-30-seconds)
- [Node Types](#node-types)
- [Editing Workflow](#editing-workflow)
- [Import & Export](#import--export)
- [Linter](#linter)
- [Playtesting](#playtesting)
- [Persistence](#persistence)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Self-Hosting](#self-hosting)
- [Project Layout](#project-layout)
- [Contributing](#contributing)
- [Roadmap](#roadmap)
- [License & Credits](#license--credits)

---

## Getting Started

### Prerequisites

- **Node.js ≥ 24.15.0** — `nvm install` picks the version from `.nvmrc`.
- **npm ≥ 11.12.1**.
- (Optional, only for desktop builds) **Rust toolchain** — `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`.

### Install & run

```bash
git clone https://github.com/viniman27/ChoiceForge.git
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
npm test             # domain tests (387 tests, node --test)
npm run test:ui      # UI / store / round-trip tests (89 tests, Vitest)
npm run test:all     # both suites
```

CI runs both suites + type check + build on every push and pull request.

### Scripts at a glance

| Script | What it does |
|--------|--------------|
| `npm run dev` | Vite dev server on port `5173`. |
| `npm run build` | Type-check + Vite production build. |
| `npm run preview` | Local preview of the production build. |
| `npm test` | Domain test suite (Node built-in runner). |
| `npm run test:ui` | UI test suite (Vitest + jsdom + Testing Library). |
| `npm run test:ui:watch` | Vitest watch mode. |
| `npm run test:ui:coverage` | HTML + text coverage report in `coverage/`. |
| `npm run test:all` | Both test suites in sequence. |
| `npm run tauri:dev` | Desktop dev with HMR (requires Rust). |
| `npm run tauri:build` | Build the desktop installer for your current OS. |
| `npm run tauri:icons` | Regenerate platform icons from `src-tauri/app-icon.png`. |

---

## Desktop App

Native installers are published on the [**Releases page**](https://github.com/viniman27/ChoiceForge/releases/latest):

| Platform | Installer | Architecture |
|----------|-----------|--------------|
| **macOS** | `.dmg` | Universal (Intel + Apple Silicon) |
| **Windows** | `.msi` | x64 |

### Installing

#### macOS

1. Open the `.dmg` and drag **ChoiceForge** to **Applications**.
2. The first launch is blocked by Gatekeeper because the build is not yet code-signed. **Right-click → *Open* may not be enough on macOS 15+** — Gatekeeper will say *"Apple could not verify this app is free of malware."* Two options:
   - **Easy fix (Settings)**: try to open the app → close the Gatekeeper dialog → open **System Settings → Privacy & Security** → scroll to "ChoiceForge was blocked…" → click **Open Anyway** → confirm.
   - **Terminal fix (one command)**: remove the quarantine flag that Gatekeeper checks:
     ```bash
     xattr -dr com.apple.quarantine /Applications/ChoiceForge.app
     ```
     Then double-click as normal.
3. After the first successful open, macOS remembers your choice — subsequent launches work normally.

#### Windows

1. Run the `.msi` (or `.exe` installer). Windows SmartScreen will block it because the build is not yet code-signed (*"Windows protected your PC"*).
2. Click **More info → Run anyway** to confirm.
3. Subsequent launches work normally.

> Code-signing certificates for both platforms are on the roadmap. Until then, the prompts above are part of the install flow.

### What the desktop app adds over the web version

- **Native file dialogs** for *Open* / *Save* / *Save As* on real `.json` project files.
- **Persistent file path** — `Ctrl/Cmd+S` writes back to disk instead of `localStorage`.
- **Native window title** that updates with the open project.

The desktop app is the same Vite build as the web version, packaged in a Tauri 2 shell. Source under `src-tauri/`.

### Building your own desktop installer

```bash
npm install
npm run tauri:build   # produces the installer for your current OS in src-tauri/target/release/bundle/
```

Cutting a new public release: push a `v*` tag and the `Desktop Release` GitHub Actions workflow builds mac + win installers and drafts a GitHub Release with them attached.

```bash
git tag v0.2.0
git push --tags
```

---

## Architecture in 30 Seconds

```
src/
├── domain/        ← PURE: types, code generator, importer, linter, layout
├── state/         ← useProjectStore() — all mutations through ProjectActions
├── components/    ← React UI: App, TopBar, LeftPanel, GraphCanvas, RightPanel, BottomBar, …
├── data/          ← Sample projects + I18nLabels (PT/EN/ES)
├── platform/      ← Tauri-aware file system abstraction
└── workers/       ← Off-main-thread heavy parsing (scene + zip)
```

### Five rules that keep the system coherent

1. **`src/domain/choicescript.ts` is pure** — no React, no DOM, no side-effects.
2. **All project mutations go through `commitProject`** (`syncDerivedEdges → updateSceneCounts → persistActiveScene`).
3. **The active scene's graph lives in BOTH `project.nodes`/`project.edges` AND `project.sceneData[sceneTitle]`** — `persistActiveScene` keeps them in sync.
4. **`startup` and `special` scenes are locked** — they can't be renamed, deleted, or navigated as graphs.
5. **User-typed identifiers always pass through `normalizeIdentifier`** (lowercase, underscores, no leading digit) before persisting.

Full architectural deep dive in [`agents.md`](./agents.md) — also the authoritative context file for AI assistants working on the repo.

---

## Node Types

| Node | ChoiceScript output |
|------|---------------------|
| `passage` | Prose body + `*goto next_node`. |
| `choice` | `*choice` with `#option` lines, each `*goto`ing its target. |
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
| `comment` | `*comment` lines (invisible to players). |
| `input_text` | Prompt + `*input_text variable`. |
| `input_number` | Prompt + `*input_number variable min max`. |
| `rand` | `*rand variable min max`. |
| `image` | `*image filename alignment alt`. |
| `sound` | `*sound filename`. |
| `temp` | `*temp name initial` (scene-local). |
| `params` | `*params a b c` (gosub arguments). |
| `achieve` | `*achieve id`. |

Every node also gets a synthetic `*label cf_<id>` so `*goto` can target any node regardless of whether the author placed an explicit `*label`.

### Edge kinds

| Kind | Origin |
|------|--------|
| `flow` | Manual connection drawn by the user. **Persisted.** |
| `choice` | Derived from `option.to` on a `choice` / `fake_choice` node. |
| `goto` | Derived from `goto` / `goto_scene` / `gosub` title. |
| `if` / `elseif` / `else` | Derived from `if` branch targets. |

`syncDerivedEdges` regenerates all derived edges on every commit. Only `flow` edges persist.

---

## Editing Workflow

1. **Create a project** — `File → New`, blank, or load the sample.
2. **Pick a scene** in the left panel. The canvas shows its graph.
3. **Add nodes** from the canvas toolbar, or drop an edge onto empty canvas for the quick-type picker.
4. **Wire nodes**: drag from a node's bottom-right anchor onto another node's top-left anchor. Choice / if / goto edges update automatically from the underlying data.
5. **Open the Inspector** (right panel) — Content / Logic / Raw tabs.
6. **Lint results** stream into the bottom bar; click an issue to jump.
7. **Save** with `Ctrl+S` (autosave also runs in the background).
8. **Play** — the *Play* button embeds the official ChoiceScript runtime.
9. **Export** — produces a `.zip` ready for the Choice of Games review process.

---

## Import & Export

### Export package

`createExportPackage()` builds a structured package that the UI serialises to a `.zip` (DEFLATE-compressed via `fflate`):

```
_choiceforge/
  project.json                ← ChoiceForge metadata (re-importable)
mygame/
  startup.txt                 ← *title, *author, *scene_list, *create, *achievement
  choicescript_stats.txt
  <scene_name>.txt            ← one per playable scene
  <asset paths…>              ← imported assets as binary files
```

### Supported imports

- **ChoiceForge `.zip`** — round-trips perfectly via `_choiceforge/project.json`.
- **ChoiceForge `.json`** — same metadata, no asset binaries.
- **Plain ChoiceScript `.zip`** — parsed by the pragmatic importer.
- **Single `.txt`** — merges as a scene into the current project.
- **Folder selection** — multi-file via the browser's directory picker.

The importer is **pragmatic**: common patterns reconstruct as a visual graph (`*choice` / `*fake_choice` inline branches, `*if`/`*elseif`/`*else`, `*goto` / `*goto_scene` / `*gosub` / `*gosub_scene`, `*label`, `*set`, `*input_*`, `*rand`, `*temp`, `*params`, `*achieve`, `*page_break`, `*checkpoint`, `*image`, `*sound`, stat-chart blocks). Anything it can't fully model is preserved as raw source for that scene, openable in the CodeMirror editor and convertible to visual editing on demand.

Imports that would replace a non-trivial existing project ask for confirmation first.

### Performance

Large `.zip` imports (> 256 KB) decompress in a Web Worker so the main thread stays responsive even on multi-MB ChoiceScript archives with images.

---

## Linter

`lintProject()` runs on every state change and emits **140+ keyed, localised diagnostics** from `src/data/lintMessages.ts` (PT/EN/ES). Categories include:

- **Project & scenes** — empty title/author, missing `*scene_list`, unreachable scenes, duplicates.
- **Variables** — invalid identifiers, reserved names, undeclared, duplicate `*create`, missing initial value, type mismatches.
- **Achievements** — empty id/title/description, invalid visibility/points, duplicates.
- **Assets** — unsafe paths, conflicts with exported paths, malformed data URLs, duplicate ids/paths.
- **Graph integrity** — orphan nodes, dead ends, empty option text, missing labels, invalid identifiers, choices with one option, `*page_break` / `*checkpoint` missing labels.
- **Conditions** — empty `*if`, branch-after-`*else`, self-loops, no-op branches.
- **Stat-chart** — invalid type / variable / raw numbers / non-percent / undeclared stats.
- **Preserved source** — line-by-line lint on `*set`, `*input_*`, `*rand`, `*temp`, `*params`, `*label`, jump correctness (skipped for files > 40 KB to keep the UI responsive).

Issues are clickable; clicking jumps to the node, scene, or source line.

---

## Playtesting

- **Official runtime** (`OfficialPlayView.tsx`) — bundles your exported `.txt` files into an `iframe srcdoc` and runs them against the real Choice of Games ChoiceScript engine. This is what the *Play* button does.
- **Internal graph playtest** (`PlaytestView.tsx`) — still in the code as a graph-level smoke test, useful for validating the *graph* without dragging in the runtime.

---

## Persistence

- **Working project** — stored in browser `localStorage` under `choiceforge.project.v2`.
- **Autosave** — debounced write whenever React state changes.
- **Manual save** — *Save* button or `Ctrl/Cmd+S`.
- **Tab-close safety** — `pagehide` + `visibilitychange` listeners flush the latest snapshot.
- **Desktop app** — also writes to the chosen native file path.

This is **local-first**, not cloud sync. The `.zip` export is the portable artifact you hand to other tools or to the Choice of Games review process.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd+S` | Save now. |
| `Ctrl/Cmd+K` | Command palette. |
| `Ctrl/Cmd+Shift+F` | Global search. |
| `Ctrl/Cmd+H` | Find & replace. |
| `Ctrl/Cmd+C` / `Ctrl/Cmd+V` | Copy / paste selected nodes (clipboard survives scene switches). |
| `Delete` / `Backspace` | Delete selected node. |
| `Spacebar + drag` | Pan canvas. |
| `Ctrl + wheel` | Zoom centred on the pointer. |
| `?` | Open the in-app help guide. |
| Double-click a node title | Inline rename. |
| Drag the `::` handle on a choice option | Reorder option. |

Full reference in the in-app *Help → Shortcuts* tab.

---

## Self-Hosting

ChoiceForge is a static SPA — any host that can serve files works.

### Build & deploy

```bash
npm run build        # output in ./dist
```

Upload the contents of `./dist` to any static host (or your S3-compatible bucket, GitHub Pages, Netlify, your own server). The app is fully client-side: no backend, no API, no environment variables required.

### One-page checklist for the host

- Serve `index.html` for unknown routes (SPA fallback). A `public/_redirects` file is included for the convenience of hosts that read it.
- Make sure compiled assets under `/assets/` are served with their hashed filenames.
- Set `Node version` to the value in `.nvmrc` (`24.15.0`) if the host runs the build itself.

---

## Project Layout

```
ChoiceForge/
├── src/
│   ├── App.tsx                       # Root layout (TopBar / LeftPanel / Canvas / RightPanel / BottomBar)
│   ├── main.tsx                      # React entry point
│   ├── components/                   # All UI components
│   ├── data/                         # Sample projects + lint message catalogue (PT/EN/ES)
│   ├── domain/                       # PURE: types, generator, importer, layout, parsing helpers
│   ├── platform/                     # Tauri-aware file system abstraction
│   ├── state/projectStore.ts         # useProjectStore() — all mutations
│   └── workers/                      # Off-main-thread scene + zip parsing
├── src-tauri/                        # Tauri v2 desktop wrapper
├── tests/
│   ├── domain.test.ts                # 387 tests over the pure domain layer
│   └── ui/                           # 89 tests: components, store, i18n, round-trips, update check, App smoke
├── public/                           # Static assets + SPA redirect + official runtime files
├── agents.md                         # Authoritative AI-agent context (architecture + session log)
├── CLAUDE.md                         # Claude Code workflow rules
├── CONTRIBUTING.md                   # Contributor guide
├── CHANGELOG.md                      # Keep-a-Changelog
├── CODE_OF_CONDUCT.md
├── SECURITY.md
└── LICENSE                           # MIT
```

> Legacy `.jsx` files at the repo root and `ChoiceForge.html` come from the original prototype before the TypeScript port. Kept as a reference; not part of the current build.

---

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) — covers the workflow, the **eight non-negotiable invariants** (purity of `choicescript.ts`, `commitProject` discipline, identifier normalization, etc.), code style, the testing pattern for each layer, and the checklist for adding a new node type or scene action.

Before touching code, read [`agents.md`](./agents.md) — the architecture deep dive that both human contributors and AI assistants use as ground truth.

**Behavioural standards**: see [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md). **Security issues**: see [`SECURITY.md`](./SECURITY.md) — please disclose privately.

---

## Roadmap

In rough order of value:

1. **Import / parser hardening** — broaden the pragmatic importer toward a more complete AST, especially for nested structures.
2. **Code signing for desktop releases** — currently unsigned (first-launch security prompts on both macOS and Windows).
3. **Inline CodeMirror in the right-panel inspector** — full-file editing already uses CodeMirror; node-level fields are still plain controls.
4. **Stats-screen designer** — replace the raw `choicescript_stats.txt` editor with a structured editor.
5. **Cloud sync / Git integration** — currently local-first only; snapshots are localStorage-only.

The current state of "done vs. not yet implemented" lives at the top of [`agents.md`](./agents.md).

---

## License & Credits

- **MIT License** — see [`LICENSE`](./LICENSE).
- **ChoiceScript** is a trademark of Choice of Games LLC. ChoiceForge is an independent, fan-made editor and is **not affiliated with or endorsed by Choice of Games**.
- **Project author**: Vinicius de Araujo ([@viniman27](https://github.com/viniman27)).
- **Built with assistance from Claude Code** — see the session log inside [`agents.md`](./agents.md) for the audit trail of AI-assisted changes.
