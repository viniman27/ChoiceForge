# ChoiceForge — Agent Context

## What This Project Is

ChoiceForge is a **visual node-based editor for ChoiceScript**, the domain-specific language used by Choice of Games to write interactive fiction. Think Twine, but targeting ChoiceScript's specific syntax and semantics instead of hypertext.

The editor lets authors build stories by connecting visual nodes on a canvas, then exports valid `.txt` files that run against the official ChoiceScript runtime without modification.

This is a **web app** (React + TypeScript + Vite), deployed to Cloudflare Pages. There is no Tauri/Electron wrapper yet — the original spec mentioned desktop, but the current implementation is browser-only.

---

## Current Implementation Status

### Done
- Full TypeScript domain model (`src/domain/types.ts`) for nodes, edges, scenes, variables, achievements
- ChoiceScript code generator (`src/domain/choicescript.ts`): produces valid `.txt` output from the graph model
- Real-time linter (`lintProject`) runs across every playable scene and covers orphan nodes, missing labels, undefined variables/achievements, dead-end nodes, empty choices, empty page break labels, empty checkpoint names, invalid `*goto_scene` targets, input bounds, invalid stat operators, and preserved-source diagnostics for imported `startup.txt`, `choicescript_stats.txt`, and scene files
- Project state management (`src/state/projectStore.ts`) using React `useState` with localStorage autosave, manual Save, Ctrl/Cmd+S, and pagehide/visibilitychange flush
- Per-scene graph persistence via `sceneData` — each scene has independent nodes/edges
- Scene CRUD: create, rename (with cross-reference updates), duplicate, delete, reorder
- Variable CRUD with rename/delete propagation across all saved scene graphs
- Achievement CRUD with rename/delete propagation for `*achieve` commands across all saved scene graphs
- Asset CRUD with real file import stored as `dataUrl` and exported as binary package entries
- Auto-layout (hierarchical by topological depth)
- Export package: generates `_choiceforge/project.json`, `startup.txt`, `choicescript_stats.txt`, per-scene `.txt` files, and imported asset files inside a `.zip`
- Editable generated files for current scene, `startup.txt`, and `choicescript_stats.txt`, using CodeMirror for the full-file ChoiceScript editor
- Import of ChoiceForge `project.json` / exported zip, plus a pragmatic ChoiceScript archive importer for simple scenes, playable `startup.txt` content, basic `choicescript_stats.txt` stat chart rows, normalized external identifiers/condition identifiers, and common inline `*choice` / `*if` branch bodies
- Canvas panning, zooming, fit view, minimap, resizable side panels, resizable node toolbar, and keyboard deletion
- Internal playtest view for graph-level smoke testing, including `*finish` scene advancement; it is not the official ChoiceScript runtime
- Global search/navigation via Ctrl/Cmd+Shift+F across scenes, nodes, variables, achievements, assets, and preserved imported source; source matches can open the text editor at the matched line
- Preserved imported scenes open as source by default and expose conversion to visual editing from the full-file editor; dirty editor contents must be saved before conversion. The full-file editor shows dirty state, confirms close/Escape with unsaved changes, and registers `beforeunload` while dirty.
- Expandable lint console with clickable issue navigation, plus clickable outgoing node links in the inspector logic tab; same-scene node navigation recenters the canvas
- `if` node inspector supports branch target/effect editing plus adding/removing `*elseif` and single trailing `*else` branches
- Choice option reuse modes: default, `*hide_reuse`, `*disable_reuse`, and `*allow_reuse`
- Sample project in both PT and EN (`src/data/sampleProject.ts`)
- Bilingual UI (PT/EN) via `I18nLabels` type in `types.ts`

### Not Yet Implemented
- Full-fidelity ChoiceScript parser/AST. Current import handles common/simple structures but is not a complete parser.
- Inline node-body editor with syntax highlighting/autocomplete. The full-file editor uses CodeMirror, but individual node body fields still use plain controls.
- Play-test with the official ChoiceScript runtime
- Git integration, version history, snapshots
- Desktop packaging (Tauri/Electron)

---

## Tech Stack

| Layer | Tool |
|-------|------|
| Framework | React 19 + TypeScript 5.8 |
| Build | Vite 4 |
| State | React `useState` + `useMemo` (no external state library) |
| Persistence | `localStorage` (key: `choiceforge.project.v2`), manual Save, Ctrl/Cmd+S, autosave debounce, pagehide flush |
| Deployment | Cloudflare Pages (`npm run cf:deploy`) |
| Tests | Node's built-in test runner via `npm test` |

**Node version:** ≥ 24.15.0 (see `.nvmrc`)

There is no React Flow, Zustand, or Redux. The canvas is custom-built. CodeMirror is used for the full-file generated/source editor, not for every node inspector field.

---

## Architecture

```
src/
  domain/
    types.ts          ← All TypeScript types. Single source of truth for the data model.
    choicescript.ts   ← Pure functions: code generation + linting. No React, no side-effects.
  state/
    projectStore.ts   ← useProjectStore() hook. All mutations go through ProjectActions.
  data/
    sampleProject.ts  ← Sample ChoiceForgeProject for PT and EN languages.
  components/
    App.tsx           ← Root layout: TopBar, LeftPanel, GraphCanvas, RightPanel, BottomBar
    TopBar.tsx        ← Save, import/export, play, language/theme/density toggles, project title/author
    BottomBar.tsx     ← Lint issue list, encoding/indent status
    LeftPanel.tsx     ← Scenes / Variables / Achievements tabs
    GraphCanvas.tsx   ← The node canvas (SVG/div-based, custom pan/zoom)
    NodeCard.tsx      ← Single node rendering on the canvas
    RightPanel.tsx    ← Inspector for the selected node
    Dashboard.tsx     ← Project stats overview (word count, scene count, etc.)
```

**The golden rule:** `choicescript.ts` is pure — no React, no DOM, no side-effects. Keep it that way. Business logic belongs there, not in components.

---

## Domain: ChoiceScript Concepts

Agents must understand these before touching logic or generating code.

### Project structure
- A project maps to a directory with `.txt` files. `startup.txt` contains `*title`, `*author`, `*scene_list`, `*create` declarations, and `*achievement` blocks.
- Each scene is one `.txt` file. Scenes are listed in `*scene_list` in play order.
- `choicescript_stats.txt` is a special scene for the stats screen (not in `*scene_list`).

### Node types and what they generate

| `NodeType` | ChoiceScript output |
|------------|---------------------|
| `passage` | Plain narrative text. Followed by `*goto next_node`. |
| `choice` | `*choice` block with `#option` lines, each pointing to a target node via `*goto`. |
| `if` | `*if` / `*elseif` / `*else` block, each branch doing `*goto target_node`. |
| `set` | One or more `*set var op value` lines. |
| `label` | `*label name` — jump target. |
| `goto` | `*goto label_name` — jumps to a label node. |
| `goto_scene` | `*goto_scene scene_name` — ends current scene, jumps to another. |
| `gosub` | `*gosub label` — calls a subroutine. |
| `ending` | `*ending` — game over / play again screen. |
| `finish` | `*finish` — advances to the next scene in `*scene_list`. |
| `checkpoint` | `*save_checkpoint name`. |
| `fake_choice` | `*fake_choice` block; options continue after their inline content. |
| `page_break` | `*page_break label`. |
| `comment` | One or more `*comment` lines. |
| `input_text` | Prompt body plus `*input_text variable`. |
| `input_number` | Prompt body plus `*input_number variable min max`. |
| `rand` | `*rand variable min max`. |

### Edge kinds

| `kind` | Meaning |
|--------|---------|
| `flow` | Manual sequential connection (drawn by the user). |
| `choice` | Derived from a choice option's `to` field. |
| `goto` | Derived from a goto/gosub node's title. |
| `if` / `elseif` / `else` | Derived from conditional branches. |

`syncDerivedEdges` regenerates `choice`, `goto`, `if` edges every commit. Only `flow` edges are persisted as user intent.

### Generated labels
Every node gets a synthetic label `cf_<id>` (e.g., `cf_n1`, `cf_n2`). The code generator emits `*label cf_<id>` at the top of each node section so that `*goto` can target any node. Human-readable `*label` nodes produce an additional label.

### Variable operators
- Arithmetic: `=`, `+`, `-` (absolute)
- Fairmath: `%+`, `%-` (percentage-based, clamped 0–100)
- The `VariableSet.op` field uses these values directly.

### Conditions / expressions
Conditions appear in `*if`, `*elseif`, and `*selectable_if` / `*if` guards on choices. Expression strings are stored raw (e.g., `"strength > 50 and courage > 30"`). The linter extracts variable names via word-boundary regex, excluding reserved words (`and`, `or`, `not`, `true`, `false`).

---

## Key Invariants — Never Break These

1. **`choicescript.ts` is pure.** No imports from React, no DOM access, no side-effects.
2. **`commitProject` must be called on every project state mutation.** It runs `syncDerivedEdges → updateSceneCounts → persistActiveScene`. Skipping it causes stale derived data.
3. **The active scene's graph always lives in `project.nodes` + `project.edges`**, and is also mirrored in `project.sceneData[project.sceneTitle]`. Both must stay in sync — `persistActiveScene` does this.
4. **`startup` and `special` scenes are locked.** `isStart` and `special` scenes cannot be renamed, deleted, or navigated to as a graph. The store enforces this — keep it.
5. **Exported `.txt` files must be UTF-8** and produce zero errors in the official ChoiceScript runner. When changing `generateNodeChoiceScript` or `generateStartupChoiceScript`, verify output manually against the ChoiceScript spec.
6. **Scene names and variable names are identifiers.** Use `normalizeIdentifier()` (lowercase, underscores only, no leading digits) before persisting user-typed names. Never skip this.
7. **Node IDs are stable references.** Choice `option.to`, branch `branch.to`, and edge `from`/`to` all reference node IDs. When deleting a node, clean up all references — the `deleteNode` action in the store already does this.
8. **Global rename/delete operations must touch every saved graph.** Variables, achievements, and scene references can exist in inactive `sceneData` entries; do not update only `project.nodes`.
9. **Save semantics are local-first.** Autosave and manual Save write the full project snapshot to `localStorage`. Export is a separate ChoiceScript/ChoiceForge zip package.

---

## Coding Conventions

- **No comments in code** unless the "why" is non-obvious (a quirk, a workaround, a hidden constraint). Self-documenting names preferred.
- **Immutable updates** everywhere — always return new objects/arrays, never mutate in place.
- **`structuredClone`** for deep copies (used in `cloneProject` and `duplicateScene`).
- **Pure helper functions at the bottom** of each file, not exported unless needed elsewhere.
- **`nextAvailableName(base, existingSet)`** is the canonical way to generate non-colliding names for scenes, variables, achievements, and node titles.
- **Error handling:** the store guards invalid operations (e.g., deleting the last node, renaming startup) by returning `current` unchanged. Do not throw.
- **i18n strings** come from `I18nLabels`. Never hardcode user-visible strings in components — thread them through the labels object passed down from `App.tsx`.

---

## Adding a New Node Type

1. Add the type to `NodeType` union in `types.ts`.
2. Add default title in `defaultNodeTitle()` in `projectStore.ts`.
3. Add default width in `defaultNodeWidth()`.
4. Add creation logic in `createStoryNode()`.
5. Add code generation in `generateNodeChoiceScript()` in `choicescript.ts`.
6. Add linting logic in `lintProject()` if the node has validatable fields.
7. Add `deriveNodeEdges()` case if the node has outgoing edges derived from its data.
8. Add a visual card variant in `NodeCard.tsx`.
9. Add an inspector panel in `RightPanel.tsx`.
10. Add the PT/EN label to `I18nLabels.nodeTypes` and both sample projects.

---

## Adding a New Scene Action

All scene mutations go through `ProjectActions` in `projectStore.ts`. Pattern:

```ts
newAction: (param) => {
  setProjectState((current) => {
    const saved = commitProject(current); // always start from committed state
    // ... compute next state ...
    return commitProject({ ...saved, /* changes */ });
  });
},
```

---

## Export Format

`createExportPackage()` returns a `ChoiceForgeExportPackage` with a `files[]` array. The UI serializes this to a `.zip` download. File paths mirror the ChoiceScript web runner layout plus a ChoiceForge metadata directory:

```
_choiceforge/
  project.json        ← ChoiceForge metadata (full project state)
mygame/
  startup.txt         ← title, author, scene_list, creates, achievements
  choicescript_stats.txt
  <scene_name>.txt    ← one file per non-startup, non-special scene
  <asset paths>       ← imported assets as binary files when `dataUrl` exists
```

Imported ChoiceForge zips are restored from `_choiceforge/project.json` when present. Plain ChoiceScript zips are parsed by the pragmatic importer in `choicescriptImport.ts`.

---

## What to Prioritize Next

In rough order of value:

1. **Import/parser hardening** — current import handles common/simple structures, playable `startup.txt` content, basic `choicescript_stats.txt` stat chart rows, normalized external identifiers/condition identifiers, and inline branch bodies for `*choice` and `*if`, but is still not a full AST or full roundtrip parser.
2. **Automated test coverage** — a minimal domain/import/generator suite exists; broaden it before broad parser work.
3. **CodeMirror inline editor in RightPanel** — full-file editing uses CodeMirror, but node-level fields are still plain controls. Syntax highlighting and autocomplete inside node inspectors remain important.
4. **Official ChoiceScript play-test integration** — embed or package the official runtime using exported files.
5. **More complete ChoiceScript commands** — more expression helpers, subroutine ergonomics.

---

## Canvas Implementation Details

The canvas (`GraphCanvas.tsx`) is **custom-built** — there is no React Flow, Cytoscape, or similar library. Before touching canvas code, understand:

### Coordinate system
- Node positions (`node.x`, `node.y`, `node.w`) are in **world space** (logical pixels).
- The DOM transform is `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` applied to `.canvas-inner`.
- To convert a client point to world coordinates: `worldX = (clientX - canvasRect.left - pan.x) / zoom`.
- `clientPointToWorld()` in `GraphCanvas.tsx` does this conversion — use it, don't reimplement.

### Edge routing
- Edges are SVG `<path>` elements inside a fixed `3000×2000` SVG overlay.
- `edgePath()` computes cubic Bézier control points using **estimated** node heights via `estimateNodeHeight()`.
- `estimateNodeHeight()` must stay in sync with what `NodeCard` actually renders. If you add content to a node card, update `estimateNodeHeight` too — otherwise edges will misalign.
- When the target is to the left of the source (`x2 < x1`), `edgePath` routes a loop that dips below both nodes.

### Connection UX
- Drag starts on `.anchor-out` (bottom-right of each card) → fires `onConnectStart`.
- Drop target detection uses `document.elementFromPoint` on `pointerup`, checking for `.anchor-in[data-node-id]`.
- `onConnectEnd` on `NodeCard` is also wired to handle drops when the pointer releases directly on a card.
- Only exportable flow nodes can start manual flow connections. Terminal/derived-output nodes such as `choice`, `if`, `ending`, `finish`, `goto`, and `goto_scene` are restricted because their outgoing behavior comes from node-specific data.

### Zoom and pan
- Zoom range: `0.25` – `2.5`. Ctrl+wheel zooms centered on the pointer; plain wheel pans.
- `fitGraphToViewport()` fits all nodes with 90px padding and a fixed 200px estimated height (rough approximation — good enough for the home button).
- Spacebar + drag also pans.

### Node selection and deletion
- `selectedId` state lives in `App.tsx`, passed down. Pressing `Delete`/`Backspace` with a node selected calls `onDeleteNode` and clears `selectedId`.
- The `.no-drag` class on `.anchor-in` and `.anchor-out` prevents pointer-down from triggering node drag.

---

## Persistence

- The working project is stored in browser `localStorage` under `choiceforge.project.v2`.
- Autosave writes the current project after a short debounce whenever React project state changes.
- Manual Save in `TopBar` and Ctrl/Cmd+S call `actions.saveNow()`, which commits the active scene graph and writes immediately.
- A `pagehide` / `visibilitychange` flush writes the latest project when the tab is closed, hidden, or navigated away.
- This is not cloud sync and not a file backup. Export remains the portable zip format.

## Known UI Gaps

| Area | Status |
|------|--------|
| Generated file editor | Editable, CodeMirror-backed, line-highlightable, dirty-state aware, and applies changes back to project |
| Internal playtest | Useful graph smoke test, not the official ChoiceScript runtime |
| Import parser | Handles common/simple ChoiceScript commands, playable `startup.txt` content, basic `choicescript_stats.txt` stat chart rows, normalized external identifiers/condition identifiers, and common inline `*choice`/`*if` bodies, not a full AST or full language roundtrip |
| Preserved source linting | Implemented for imported scenes, startup, stats, scene lists, global declarations and initial values, startup achievement headers, stat charts, label definitions, `*goto`/`*gosub`/`*goto_scene` targets, checkpoint saves/restores, `*page_break` labels, `*achieve` targets, `*return` without `*gosub`, empty/undeclared conditions, `*set` values/operators, input/rand bounds, `*temp`, and `*params`; still not a complete ChoiceScript semantic validator |
| Tests | Minimal domain/import/generator coverage exists via Node's built-in test runner; no UI/browser test coverage yet |
| Global search | Implemented for scenes, nodes, variables, achievements, assets, and preserved source text |
| Lint console | Expandable and navigable; issue text is still not localized |
| Git/version history | Not implemented beyond browser undo history |

---

## Gotchas

Things that look wrong but are intentional, or are easy to break silently:

- **`normalizeIdentifier` is defined in three places** (`projectStore.ts`, `LeftPanel.tsx`, `RightPanel.tsx`). This is intentional — components own their local input normalization to avoid importing from the store. Don't consolidate into a shared util without checking that the import doesn't pull store dependencies into components.

- **`RawTab` calls `generateNodeChoiceScript(node, project.edges)`.** It can show flow `*goto` lines for the current scene, but it is still a node-level preview, not a whole-scene export.

- **`typeColors` in `NodeCard.tsx` is the single source of truth for node colors.** CSS variables like `--c-passage`, `--c-choice`, etc. are set globally; `typeColors` maps types to those vars. Never hardcode color values for nodes — always go through `typeColors[node.type]`.

- **The `if` node inspector normalizes branch order.** The first non-else branch is kept as `*if`, later conditional branches become `*elseif`, and a single `*else` stays at the end. Be careful when changing branch UX because stat effects are intentionally scoped to the branch that wins.

- **`syncDerivedEdges` runs on every `commitProject` call**, so `choice`, `goto`, and `if` edges are always recomputed from node data. If you add a new node type with derived edges, add a case in `deriveNodeEdges()` — otherwise the edges will never appear even if the data is correct.

- **`estimateNodeHeight` uses `density`**, but the density value itself is not in the project model — it's local UI state in `App.tsx`. Don't try to persist density per project.

- **The ChoiceScript importer is deliberately pragmatic.** It now recognizes common inline `*choice` and `*if` branch bodies by creating intermediate passage/terminal nodes, but unsupported nested structures should degrade conservatively to passage blocks instead of inventing lossy graph semantics.

---

## Spec vs. Reality

The original design document (`prompt_editor_visual_choicescript (1).md`) describes the aspirational product. These are the known divergences from that spec in the current implementation:

| Spec said | Reality |
|-----------|---------|
| Tauri desktop app (Windows/macOS/Linux) | Browser-only web app on Cloudflare Pages |
| React Flow or Rete.js for canvas | Custom canvas, no graph library |
| CodeMirror 6 / Monaco in node editor | CodeMirror is integrated for full-file source editing; node inspector fields remain plain controls |
| Zustand or Redux Toolkit | React `useState` + `useMemo` only |
| Vitest + Playwright tests, 70% coverage | Minimal Node test runner coverage only; no Vitest/Playwright suite |
| Parser (import `.txt` → graph) | Partially implemented pragmatic importer, not full AST |
| Play-test with official runtime | Not implemented; internal graph playtest exists |
| Stats screen editor | Basic editable generated `choicescript_stats.txt`, no rich stats-screen designer |
| Git integration, version history | Not implemented |
| i18n in ES (Spanish) | Only PT + EN |

When you see something in the spec that sounds implemented but isn't in the code — it isn't implemented.

---

## Running Locally

```bash
npm install
npm test
npm run dev        # starts Vite dev server
npm run build      # type-check + build to dist/
npm run cf:preview # build + run Cloudflare Pages locally (needs wrangler)
npm run cf:deploy  # deploy to production
```
