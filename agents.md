# ChoiceForge — Agent Context

## What This Project Is

ChoiceForge is a **visual node-based editor for ChoiceScript**, the domain-specific language used by Choice of Games to write interactive fiction. Think Twine, but targeting ChoiceScript's specific syntax and semantics instead of hypertext.

The editor lets authors build stories by connecting visual nodes on a canvas, then exports valid `.txt` files that run against the official ChoiceScript runtime without modification.

This is a **web app** (React + TypeScript + Vite), deployed to Cloudflare Pages. There is no Tauri/Electron wrapper yet — the original spec mentioned desktop, but the current implementation is browser-only.

---

## Current Implementation Status

### Done
- Full TypeScript domain model (`src/domain/types.ts`) for nodes, edges, scenes, variables, achievements (23 NodeTypes including `temp` and `params`)
- ChoiceScript code generator (`src/domain/choicescript.ts`): produces valid `.txt` output from the graph model
- Real-time linter (`lintProject`) runs across every playable scene and covers empty project title/author, empty achievement titles/descriptions, invalid achievement points, unsafe/duplicate asset metadata, duplicate exported asset files, malformed asset data URLs, asset export path collisions, orphan nodes, missing labels, undefined variables/achievements, dead-end nodes, empty choices, empty page break labels, empty checkpoint names, invalid `*goto_scene` targets, input bounds, invalid stat operators, scene reachability (`lintSceneReachability` warns when scenes have no incoming connections), temp variable shadowing, and preserved-source diagnostics for imported `startup.txt`, `choicescript_stats.txt`, and scene files
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
- Find & Replace (Ctrl H) in the left panel: replace text in node body/prompt/options across the current scene or all scenes at once; returns count of replacements and shows a transient status message
- Copy/paste nodes (Ctrl+C / Ctrl+V): clipboard persists across scene switches; paste places nodes centered on the viewport, remaps internal edges, and selects all pasted nodes
- `set` node type added to the canvas toolbar (was missing despite being a core ChoiceScript command)
- Scene Map view ("map" tab in TopBar): pannable/zoomable grid of all scene cards with SVG arrows for goto_scene (solid) and gosub_scene (dashed) connections; click to navigate to any scene
- Variable/achievement autocomplete in node body editors: type `${` or `@{` to get variable name suggestions; type `*achieve ` to get achievement ID suggestions
- Jump-to-scene button (→) in goto_scene/gosub_scene inspector: one click opens the target scene in the editor
- Word count goal in Dashboard: number input sets a project-level target, progress bar fills as total word count grows
- Keyboard shortcut overlay: press `?` (when not typing) to toggle a modal listing all shortcuts; dismiss with Escape or click-outside
- Command palette (Ctrl+K): fuzzy-search all scenes, nodes, variables, achievements, and static commands; arrow-key navigation, Enter to activate
- Edge-drop quick node creation: drag a connection port to empty canvas → type-picker popup with 8 common types → new node created and connected in one gesture
- Node writing-status markers: tag any node as `todo` or `done` from the inspector; badge shown on the card; per-scene progress bar in the scene list
- Drag-to-reorder choice options: drag handle (`::`) on each option row in the inspector lets authors reorder options without delete/recreate; works for both `choice` and `fake_choice` nodes
- Inline node title editing: double-click any node title on the canvas to edit in place; Enter/blur commits, Escape cancels
- Per-node private notes: resizable textarea in the inspector (always visible, never exported); nodes with notes show a ✎ indicator on the canvas card
- Manuscript / prose view ("prose" tab): DFS-ordered reading mode showing passage text, choice boxes, page breaks, and structural commands; author notes shown as italicised asides
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
| Preserved source linting | Implemented for imported scenes, startup, stats, scene lists, startup title/author empties, global declarations and initial values, startup achievement headers, stat chart rows/types, label definitions, `*goto`/`*gosub`/`*goto_scene` targets, checkpoint saves/restores, `*page_break` labels, `*achieve` targets, `*return` without `*gosub`, empty/undeclared conditions, `*set` values/operators, input/rand variable types and bounds, `*temp`, and `*params`; still not a complete ChoiceScript semantic validator |
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
| i18n in ES (Spanish) | PT + EN + ES implemented |

When you see something in the spec that sounds implemented but isn't in the code — it isn't implemented.

---

## Session Log

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 32
- **Added snap-to-grid for node placement and dragging.**
  - `G` key (when not typing) toggles snap on/off. Preference persisted to localStorage (`choiceforge.snap.v1`).
  - When snap is active, nodes snap to a 20px grid on drag release and on double-click creation.
  - The grid background transitions from the default 24px dot pattern to a denser 20px pattern (slightly brighter dots) to visually confirm snap state. Implemented via `.is-snapping .canvas-grid`.
  - A small grid icon button (four squares) appears in the zoom controls bar; turns accent color when active.
  - `SnapIcon` component added (12×12 SVG, four squares).
  - `GRID_SIZE = 20` and `SNAP_KEY` constants at top of `GraphCanvas.tsx`; snap state uses a `snapRef` so the `pointerup` closure always reads the current value without stale-closure issues (same pattern as `selectedIdsRef`).
  - `src/components/KeyboardShortcutOverlay.tsx`: added `G → Toggle snap-to-grid` entry.
  - Zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 31
- **Added full-project manuscript scope — read and export the entire story in one view.**
  - `src/components/ManuscriptView.tsx`:
    - Added `scope: "scene" | "project"` state and `[scene] [project]` toggle buttons in the toolbar.
    - `buildProjectSections(data)`: iterates `data.scenes` in order (excluding `special` stats screen), fetches each scene's graph from `data.sceneData` (or the live `data.nodes/edges` for the active scene), runs `narrativeOrder` per scene, and filters out empty scenes.
    - In project scope: renders a centered `ms-scene-divider` (`~~~ scene_name.txt ~~~`) before each section, separated by `ms-scene-end` spacers.
    - Word count, passage count, and reading time aggregate across all displayed sections.
    - `generateProjectText`: emits all scenes with `~~~ scene ~~~` headers separated by blank lines.
    - Download filename switches to `{title}_full_manuscript.txt` in project scope.
    - Refactored text generation into shared `nodeListToLines(nodes)` helper used by both single-scene and project exports.
  - `directions.css`: added `.ms-scope-toggle`, `.ms-scope-btn`, `.ms-scope-btn.is-active` (accent fill), `.ms-scene-divider` (centered rule with label), `.ms-scene-divider-name`, `.ms-scene-end`.
  - Zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 30
- **Added canvas quick-filter (Ctrl+F) and fit-to-selection (Shift+F).**
  - **Canvas filter:**
    - `Ctrl+F` opens a floating search bar at the top-right of the canvas. As you type, nodes that don't match (by title, body, prompt, or option text) get dimmed to opacity 0.18 and become non-interactive. The bar shows a live `M/N` match count. `Escape` or the × button closes and clears the filter.
    - `src/components/GraphCanvas.tsx`: added `canvasFilter`, `filterOpen` state + `filterInputRef`; `nodeMatchesFilter(node, filter)` helper; `CanvasFilterBar` inlined in JSX.
    - `src/components/NodeCard.tsx`: added `isDimmed?: boolean` prop; adds `is-dimmed` class when true.
    - `styles.css`: `.node.is-dimmed { opacity: 0.18; pointer-events: none }`, `.canvas-filter-bar`, `.canvas-filter-input`, `.canvas-filter-count`, `.canvas-filter-close`.
  - **Fit to selection (Shift+F):**
    - `F` key (when not typing) fits all nodes (same as the toolbar button, now also has keyboard shortcut).
    - `Shift+F` fits only the currently selected nodes into the viewport.
    - Refactored `fitGraphToViewport` to delegate to new `fitNodesToViewport(nodes, ...)` for reuse.
  - `src/components/KeyboardShortcutOverlay.tsx`: added `F`, `Shift+F`, `Ctrl+F` entries.
  - Zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 29
- **Added node alignment toolbar (appears when ≥2 nodes selected).**
  - Replaced the plain "N selected" badge with a full `SelectionBar` component that floats at the bottom-center of the canvas.
  - Buttons: align left edges, align horizontal centers, align right edges | align top edges, align vertical centers, align bottom edges | distribute horizontally, distribute vertically (last two disabled when < 3 nodes selected).
  - Align operations compute the bounding box of selected nodes and reposition each node to the target edge/center. Vertical operations use `estimateNodeHeight` for accurate bottom/middle alignment.
  - Distribute operations keep the outermost two nodes fixed and space inner nodes with equal whitespace gaps (not equal center-to-center, so mixed-width/height nodes look evenly spaced).
  - `AlignIcon` component: 8 small 14×14 SVG icons with filled rectangles and ruler lines, consistent with `NodeIcon` style.
  - `styles.css`: replaced `.sel-count-badge` with `.sel-bar`, `.sel-bar-count`, `.sel-bar-sep`, `.sel-bar-div`, `.sel-bar-btn` (hover + disabled states).
  - Zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 28
- **Added manuscript export (download .txt + copy to clipboard).**
  - `src/components/ManuscriptView.tsx`:
    - Added `generateManuscriptText(ordered, data)` function: outputs a clean plain-text document with title/author/scene header, `--- Passage Title ---` sections, `> Prompt` + numbered options for choices, and `* * *` for page breaks. Structural navigation nodes (goto, if, label, etc.) are omitted — the export targets editors and beta readers, not the runtime.
    - Added `handleDownload`: creates a Blob and triggers a browser download as `{sceneTitle}_manuscript.txt`.
    - Added `handleCopy`: writes the same text to `navigator.clipboard`; shows `✓ copied` feedback for 2 s.
    - Toolbar restructured: `ms-actions` flex row holds the two new `.ms-action-btn` buttons and the existing back button.
  - `directions.css`: added `.ms-actions`, `.ms-action-btn` (matches `.ms-close` styling with an accent hover).
  - Zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 27
- **Double-click empty canvas to create a passage node + reading time in manuscript view.**
  - `src/components/GraphCanvas.tsx`: added `onDoubleClick` handler on the canvas-wrap div. When the target passes `isCanvasPanTarget` (i.e., empty canvas) and source is not preserved, creates a `passage` node centered on the double-clicked world position. Consistent with Twine and other node editors.
  - `src/components/ManuscriptView.tsx`: added `readingMinutes = Math.ceil(wordCount / 200)` (200 wpm for interactive fiction). Stats line now reads `"N words · P passages · ~M min"`.
  - `src/components/KeyboardShortcutOverlay.tsx`: added "double-click → Create passage node" entry under Canvas shortcuts.
  - Zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 26
- **Fixed canvas panning broken by multi-select box feature.**
  - Plain left drag on empty canvas now pans again (was being stolen by the selection box).
  - Shift + left drag on empty canvas now starts the selection box.
  - Plain click (no drag, < 4px movement) still clears selection (detected in the pointerup handler).
  - Middle mouse / Space + drag still pan as before.
  - `src/components/KeyboardShortcutOverlay.tsx`: updated Canvas section to show "drag → pan", "Space+drag → pan (alt)", "Shift+drag → box select".
  - Zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 25
- **Added per-node color tags.**
  - `src/domain/types.ts`: added `NodeColorTag = "red" | "orange" | "yellow" | "green" | "blue" | "purple"` and `colorTag?: NodeColorTag` to `StoryNode`.
  - `src/components/NodeCard.tsx`: exported `COLOR_TAG_VALUES: Record<NodeColorTag, string>` (oklch color strings for all 6 tags). Node div gets `has-color-tag` class and `--ct` CSS variable when a color tag is set.
  - `src/components/RightPanel.tsx`: added `.ip-color-row` below `.ip-status-row` in `ip-head`. Six colored dot buttons + clear button. Clicking active tag clears it. Disabled when source is preserved.
  - `src/components/ManuscriptView.tsx`: passage node titles show an 8px colored dot (`ms-color-dot`) when a color tag is set.
  - `styles.css`: added `.node.has-color-tag { border-left: 3.5px solid var(--ct) }`, `.ip-color-row`, `.ip-color-dot`, `.ip-color-dot.is-active`, `.ip-color-clear`.
  - `directions.css`: added `.ms-color-dot` and added `display: flex; align-items: center` to `.ms-node-title` to align the dot.
  - 86 tests, all passing; zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 24
- **Added manuscript / prose view ("prose" tab in TopBar).**
  - `src/domain/types.ts`: extended `EditorView` to include `"manuscript"`.
  - `src/components/TopBar.tsx`: added "prose" button in the tab-toggle between "map" and "stats".
  - `src/components/ManuscriptView.tsx` (new): fixed panel (same geometry as Scene Map / Dashboard). Shows all scene nodes in DFS narrative order from the first node, then any disconnected nodes. Renders:
    - **passage** → node id as small mono heading, body text as paragraphs (double-newline = paragraph break), private note as italicised aside
    - **choice / fake_choice** → boxed section with italic prompt and numbered option list
    - **page_break** → dashed `<hr>`
    - **if** → subtle mono line showing branch kinds/expressions
    - **goto_scene / gosub_scene / goto / label / finish / ending / etc.** → dim mono command + target
    - Unknown structural nodes → null (not rendered)
  - `src/App.tsx`: renders `<ManuscriptView>` when `view === "manuscript"`; "prose" added to command palette command list.
  - `src/components/CommandPalette.tsx`: added `{ id: "manuscript", label: "Open prose / manuscript view" }` to static commands.
  - `directions.css`: added `.ms-wrap`, `.ms-toolbar`, `.ms-meta`, `.ms-scene`, `.ms-stats`, `.ms-close`, `.ms-body`, `.ms-content`, `.ms-passage`, `.ms-node-title`, `.ms-prose`, `.ms-para`, `.ms-choice`, `.ms-prompt`, `.ms-options`, `.ms-option`, `.ms-note`, `.ms-break`, `.ms-structural`, `.ms-cmd`, `.ms-branch-label`, `.ms-target`.
  - 86 tests, all passing; zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 23
- **Added per-node private author notes.**
  - `src/domain/types.ts`: added `note?: string` to `StoryNode`. The field is intentionally ignored by the code generator — notes are never exported.
  - `src/components/NodeCard.tsx`: shows a small `✎` icon in the node head when `node.note` is set; hovering the icon shows the note text as a tooltip.
  - `src/components/RightPanel.tsx`: added a persistent `ip-notes` section between the tab body and the `ip-footer`, always visible regardless of active tab. Contains a resizable `<textarea>` (min 56px, max 180px). Clearing the textarea sets `note: undefined` (no empty-string clutter in the data). Disabled when source is preserved.
  - `styles.css`: added `.node-note-dot`, `.ip-notes`, `.ip-notes-label`, `.ip-notes-area` (with placeholder, focus, disabled, resize styles).
  - 86 tests, all passing; zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 22
- **Added inline node title editing (double-click on canvas).**
  - `src/components/NodeCard.tsx`:
    - Added `useEffect`, `useRef`, `useState` imports.
    - Added `onUpdateTitle?: (id: string, title: string) => void` prop.
    - Added `editingTitle` / `editValue` state and `titleInputRef`.
    - Double-clicking `.node-title` (when `onUpdateTitle` is set) switches the span to a focused `<input className="node-title-input no-drag">`. Enter or blur commits; Escape resets to the original title without saving. Empty commits fall back to the original title.
    - All keyboard events stop propagation to prevent canvas shortcuts from firing during edit.
  - `src/components/GraphCanvas.tsx`: added `onUpdateTitle: (id: string, title: string) => void` prop; passes it to `NodeCard` (undefined when `sourcePreserved`).
  - `src/App.tsx`: wires `onUpdateTitle={(id, title) => actions.updateNode(id, { title })}`.
  - `styles.css`: added `.node-title-input` (mono font, accent border, no outline, right-aligned to match the title span).
  - 86 tests, all passing; zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 21
- **Added drag-to-reorder choice options in the inspector.**
  - `src/components/RightPanel.tsx` — `ContentTab`:
    - Added `dragOptIdx` and `dragOverIdx` local state.
    - Added `moveOption(from, to)` (for `choice`) and `moveFakeOption(from, to)` (for `fake_choice`) helpers that splice the options array and call `onUpdateNode`.
    - Added `optDragHandlers(index)` and `fakeOptDragHandlers(index)` factory functions returning `draggable`, `onDragStart`, `onDragOver`, `onDragLeave`, `onDrop`, `onDragEnd` props.
    - Each `<li>` in both choice and fake_choice option lists is now draggable, gets the drag handler set, and receives `.is-dragging` / `.is-drag-over` class modifiers.
    - A `<span className="opt-drag-handle">::</span>` drag handle prepended to each `.ip-opt-head`.
    - Changed option `key` from `${option.text}-${index}` to `opt-${index}` / `fopt-${index}` to avoid stale-key issues during reorder.
  - `styles.css`: added `.ip-opt-row.is-dragging`, `.ip-opt-row.is-drag-over`, `.opt-drag-handle` rules.
  - 86 tests, all passing; zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 20
- **Added node writing-status markers (todo / done) + per-scene progress bar.**
  - `src/domain/types.ts`: added `NodeStatus = "todo" | "done"` and `status?: NodeStatus` to `StoryNode`.
  - `src/components/NodeCard.tsx`: renders a `.node-status` badge in the node header when `node.status` is set. Color-coded: todo = yellow/orange, done = green.
  - `src/components/RightPanel.tsx`: added `.ip-status-row` with two toggle buttons (`todo` / `done`) below the title input in `ip-head`. Clicking an already-active status clears it (sets `undefined`). Disabled when source is preserved.
  - `src/components/LeftPanel.tsx`: added `sceneDoneCounts` memo (computes done/total per scene from `data.nodes` for the current scene and `sceneData` for others). Shows a 3px green progress bar (`.scene-progress-track / .scene-progress-fill`) between the scene name row and stats row, only when at least one node is marked done.
  - `styles.css`: added `.node-status`, `.node-status-todo`, `.node-status-done`, `.ip-status-row`, `.ip-status-btn`, per-status active states, `.scene-progress-track`, `.scene-progress-fill`.
  - 86 tests, all passing; zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 19
- **Added edge-drop quick node creation — drag a connection port to empty canvas to get a node type picker.**
  - `src/components/GraphCanvas.tsx`:
    - Added `onAddAndConnectNode: (fromId, type, position) => void` prop.
    - Added `pendingConnect` state: `{ from, screenX, screenY, worldX, worldY } | null`.
    - In the connection `up` handler: if no `.anchor-in` target is found under the pointer, sets `pendingConnect` (instead of simply canceling). Clicking the canvas background clears `pendingConnect`.
    - New `EdgeDropPicker` component: a fixed-position popup rendered at the drop screen coordinates, showing 8 quick-create types (`passage`, `choice`, `fake_choice`, `if`, `set`, `goto`, `goto_scene`, `ending`) as icon+label buttons. Each button uses that type's `dot`/`tint` CSS variables. Dismisses on Escape or click-outside.
    - New `QUICK_TYPES` constant listing the 8 types shown in the picker.
  - `src/App.tsx`: added `onAddAndConnectNode` handler — generates next node ID, calls `addNode` then `connectNodes`, then selects the new node.
  - `src/components/KeyboardShortcutOverlay.tsx`: added "drag → empty: Create + connect node" hint.
  - `directions.css`: added `.edrop-picker`, `.edrop-hint`, `.edrop-grid`, `.edrop-btn`.
  - 86 tests, all passing; zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 18
- **Added command palette (Ctrl+K) — fuzzy-search navigation and command runner.**
  - `src/components/CommandPalette.tsx` (new): modal with a text input and a scored, filterable list of:
    - **Scenes** — all project scenes (name, word count, node count)
    - **Nodes** — all nodes from the current scene + every `sceneData` entry (by title, with scene context)
    - **Variables** — all declared project variables (with type)
    - **Achievements** — all achievement IDs with titles
    - **Commands** — static list: auto-layout, fit view, dashboard, scene map, play, export, save, undo, redo, keyboard shortcuts
    - Scoring: exact match → 100, prefix → 80, substring → 60 - position, fuzzy → 20, no match excluded
    - Keyboard navigation: ↑↓ to move cursor, Enter to activate, Escape to close; click-outside also closes
  - `src/App.tsx`:
    - `paletteOpen` state; Ctrl/Cmd+K toggles palette.
    - Extracted `navigateToScene(id)` helper (replaces duplicated navigation logic in SceneMapView, RightPanel, and CommandPalette callbacks).
    - `onSelectScene` → `navigateToScene`; `onSelectNode` switches scene + focuses node; `onCommand` dispatches to existing action handlers.
    - `KeyboardShortcutOverlay` updated to include Ctrl+K entry.
  - `directions.css`: `.cp-backdrop`, `.cp-panel`, `.cp-input-row`, `.cp-icon`, `.cp-input`, `.cp-clear`, `.cp-list`, `.cp-row`, `.cp-badge` (per-kind colors), `.cp-row-main`, `.cp-row-meta`, `.cp-shortcut`, `.cp-empty`, `.cp-footer`.
  - 86 tests, all passing; zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 17
- **Added word count goal to Dashboard + keyboard shortcut overlay (`?` key).**
  - **Word count goal:**
    - `src/domain/types.ts`: added `wordGoal?: number` to `ChoiceForgeProject`.
    - `src/state/projectStore.ts`: `updateMetadata` now accepts `Partial<Pick<ChoiceForgeProject, "title" | "author" | "wordGoal">>` — backward-compatible with TopBar's existing call.
    - `src/components/Dashboard.tsx`: accepts new `onUpdateWordGoal: (goal: number | undefined) => void` prop. Adds a "word count goal" section with a number input (blur/Enter to commit), current word count display, and a progress bar that fills towards the goal (turns accent-2 when complete).
    - `src/App.tsx`: passes `onUpdateWordGoal` to `<Dashboard>` calling `actions.updateMetadata({ wordGoal: goal })`.
    - `directions.css`: added `.word-goal-card`, `.word-goal-row`, `.word-goal-label`, `.word-goal-input`, `.word-goal-current`, `.word-goal-track`, `.word-goal-fill`.
  - **Keyboard shortcut overlay:**
    - `src/components/KeyboardShortcutOverlay.tsx` (new): full-screen modal listing all shortcuts in three columns across six groups (Canvas, Selection, History, File, Search, Help). Dismisses via Escape or click-outside.
    - `src/App.tsx`: imported `KeyboardShortcutOverlay`; added `shortcutsOpen` state; `?` keydown (when not typing) toggles the overlay; renders `<KeyboardShortcutOverlay>` when open.
    - `directions.css`: added `.ks-backdrop`, `.ks-panel`, `.ks-head`, `.ks-title`, `.ks-close`, `.ks-grid`, `.ks-group`, `.ks-group-title`, `.ks-row`, `.ks-keys`, `.ks-plus`, `.ks-key`, `.ks-label`.
  - 86 tests, all passing; zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 16
- **Added variable/achievement autocomplete in node body editors and jump-to-scene navigation from the inspector.**
  - **Variable autocomplete (`@codemirror/autocomplete`):**
    - Installed `@codemirror/autocomplete` as a dependency.
    - `src/components/NodeBodyEditor.tsx`: accepts `variables?: string[]` and `achievements?: string[]` props. Uses `variablesRef` / `achievementsRef` mutable refs so completions stay current without recreating the EditorView. Added `autocompletion()` extension with a custom source:
      - Triggers after `${` or `@{` — completes from the list of project variable names.
      - Triggers after `*achieve ` — completes from the list of achievement IDs.
    - `src/components/RightPanel.tsx`: all three `NodeBodyEditor` usages now receive `variables` and (for passage nodes) `achievements` from the project.
  - **Jump-to-scene button:**
    - `RightPanelProps`: added optional `onSelectScene?: (id: string) => void`.
    - `ContentTab` and `CommandNodeFields`: `onSelectScene` is threaded through.
    - `goto_scene` and `gosub_scene` inspector rows now include an `→` button (`.scene-jump-btn`) that opens the target scene in the editor view.
    - `src/App.tsx`: wired `onSelectScene` for the RightPanel — reuses the same navigation logic as LeftPanel (handles `hasPreserved`, resets playtest/doc state).
  - `styles.css`: added `.ip-scene-row` (flex row for select + jump button) and `.scene-jump-btn` (goto-color arrow button).
  - 86 tests, all passing; zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 15
- **Added Scene Map view (top-bar "map" button) — bird's-eye overview of all scenes and their cross-scene connections.**
  - `src/domain/types.ts`: extended `EditorView` to `"editor" | "dashboard" | "map"`.
  - `src/components/TopBar.tsx`: added "map" button in the tab-toggle between "editor" and "stats".
  - `src/components/SceneMapView.tsx` (new file):
    - Scenes are laid out in a 4-column grid in scene_list order (startup first, stats last).
    - SVG arrows connect scenes for every unique `*goto_scene` (solid) and `*gosub_scene` (dashed) reference found in any scene graph.
    - Each card shows: scene name, source status badge, lint error/warning counts, word count, and node count.
    - Active scene card is highlighted with an accent border.
    - Pan with drag, zoom with Ctrl+scroll — same pattern as the main canvas.
    - Clicking a card navigates to that scene and switches back to the editor view.
  - `src/App.tsx`: wired the map view as a `position: fixed` overlay (same as Dashboard). `onSelectScene` handles startup/stats/regular scenes and resets document/playtest state before navigating.
  - `directions.css`: added scene map CSS (`.scene-map-wrap`, `.map-card`, `.map-card-head`, `.map-scene-name`, `.map-card-stats`, `.scene-map-legend`, `.scene-map-inner`, `.scene-map-svg`).
  - The map overlay uses CSS variables `--left-panel-width` / `--right-panel-width` so it respects panel resizing.
  - 86 tests, all passing; zero TS errors; clean production build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 14
- **Fixed missing `*set` node in the canvas toolbar and added copy/paste for nodes.**
  - **`*set` toolbar fix:** `set` was absent from `creatableNodeTypes` in `GraphCanvas.tsx` — authors had no way to create `*set` (variable-assignment) nodes from the UI without importing ChoiceScript. Added it between `if` and `label`.
  - **Copy/paste nodes (Ctrl+C / Ctrl+V):**
    - `src/domain/types.ts` import added to `GraphCanvas.tsx` for `StoryNode` and `StoryEdge`.
    - `GraphCanvasProps`: added `onPasteNodes: (nodes, internalEdges, center) => string[]`.
    - `GraphCanvas.tsx`: added `clipboardRef` (in-memory, persists across scene switches within the tab). Ctrl+C copies selected nodes + edges that are internal to the selection. Ctrl+V pastes at the current viewport center, selects all pasted nodes, respects `sourcePreserved`.
    - `src/state/projectStore.ts`: added `pasteNodes(nodes, internalEdges, center)` action — assigns fresh IDs (sequential off the global max), remaps internal `option.to` / `branch.to` references via an `idMap`, drops any option/branch targets not in the clipboard, centers the pasted group at the given viewport coordinate, appends to the current scene, returns new IDs.
    - `src/App.tsx`: wired `onPasteNodes`.
  - 86 tests, all passing; zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 13
- **Implemented Find & Replace across node text.**
  - `src/domain/types.ts`: added `replace: string` to `I18nLabels`.
  - `src/data/sampleProject.ts`: added `replace` translation for PT ("Substituir..."), EN ("Replace..."), ES ("Reemplazar...").
  - `src/state/projectStore.ts`: added `replaceInNodes(find, replace, scope: "scene"|"all"): number` action.
    - "scene" scope: replaces in all `current.nodes` text fields and clears any preserved source text for the current scene.
    - "all" scope: replaces in every scene graph in `sceneData` (drops sourceText for all), then extracts the updated current scene nodes.
    - Replaces in: `node.body`, `node.prompt`, `node.options[].text`, `node.fakeOptions[].text`.
    - Returns the count of replaced occurrences (safe across React StrictMode double-invoke via count reset inside updater).
  - `src/components/LeftPanel.tsx`:
    - New prop `onReplace: (find, replace, scope) => number`.
    - Search bar restructured into `.search-row` wrapper (flex row) + optional `.replace-row` below.
    - Toggle button (find-replace icon SVG) shows/hides the replace row; also triggered by Ctrl+H.
    - Replace row: replace input + "scene" and "all" action buttons + transient status message (3s timeout).
    - Ctrl+Shift+F focuses search and collapses replace mode; Ctrl+H opens replace mode.
  - `src/App.tsx`: passed `onReplace={actions.replaceInNodes}` to LeftPanel.
  - `styles.css`: added `.search-row`, `.search-toggle-replace`, `.replace-row`, `.replace-actions`, `.replace-btn`, `.replace-status`.
  - 86 tests, all passing; zero TS errors; clean production build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 12
- **Implemented multi-select on the canvas and fixed missing node types in the toolbar.**
  - **Multi-select (shift-click, Ctrl+A, rubber-band, group move/delete):**
    - `src/state/projectStore.ts`:
      - `moveNodes(moves: {id, x, y}[])`: batch-moves all nodes in one history entry (replaces per-node `onMoveNode` call from canvas).
      - `deleteNodes(ids: string[])`: batch-deletes all nodes in the set, cleaning up edges, option targets, branch targets, and scene counts in one commit.
    - `src/components/GraphCanvas.tsx` (major rewrite):
      - Props changed: `onMoveNode` → `onMoveNodes`, `onDeleteNode` → `onDeleteNodes`.
      - New state: `selectedIds: Set<string>` for multi-select highlights. `selectedId` prop still drives the RightPanel inspector.
      - External sync: `lastSetIdRef` tracks when the parent changes `selectedId` (e.g., via focusNode in LeftPanel) and resets `selectedIds` to a single-item set.
      - `selectNode(id, addToSet)`: shift-click toggles id in/out of `selectedIds` and updates primary. Plain click replaces selection.
      - `clearSelection()`: sets both `selectedId(null)` and `selectedIds` to empty set.
      - Drag start: if dragged node is already in `selectedIds`, all selected nodes move together; otherwise, selection is reset to just that node. `origPositions` captures all positions at drag-start.
      - Rubber-band selection: left-click-drag on the canvas background (when not holding space) draws a `sel-box` rect in world coordinates. On pointer-up, all nodes whose center-top point `(x + w/2, y + 18)` falls within the rect are added to `selectedIds`. Shift-held preserves existing selection.
      - Ctrl+A: selects all nodes in the scene.
      - Delete/Backspace: calls `onDeleteNodes([...selectedIds])` — deletes all selected nodes at once.
      - Toolbar delete button label shows count when multiple nodes are selected ("delete selected (N)").
      - "sel-count-badge" floats above the zoom controls showing "N selected" when N > 1.
    - `src/components/NodeCard.tsx`: `onSelect` signature changed to `(id, addToSelection: boolean)` — passes `event.shiftKey` from the pointer event.
    - `src/App.tsx`: wired `onMoveNodes` and `onDeleteNodes`.
    - `styles.css`: added `.sel-box` (dashed amber rect with translucent fill) and `.sel-count-badge` (floating pill at bottom-center).
  - **`temp` and `params` added to the canvas node toolbar** (`creatableNodeTypes` in GraphCanvas.tsx).
  - 86 tests, all passing; zero TS errors.

### 2026-05-14 — Claude Code (claude-sonnet-4-6) — session 11
- **Implemented node duplication (Ctrl+D) and the `*params` node type.**
  - **Node duplication:**
    - `src/state/projectStore.ts`: added `duplicateNode(id): string | null` action — uses `structuredClone` to deep-copy the node, offsets position by 24px diagonally, assigns next sequential ID (max over all scene graphs), increments current-scene node count, returns new node ID.
    - `src/components/GraphCanvas.tsx`: added `onDuplicateNode` prop; Ctrl+D keyboard shortcut fires before Delete/Backspace; "dup" toolbar button.
    - `src/App.tsx`: wires `onDuplicateNode` — calls `actions.duplicateNode(id)` and selects the newly created node.
  - **`*params` node type** (subroutine parameter declarations):
    - `src/domain/types.ts`: added `"params"` to the `NodeType` union (23 types total).
    - `src/domain/choicescript.ts`:
      - Code generation: emits `*params {body}` where body is the space-separated param names. Excluded `params` from the generic body narrative push.
      - `lintSceneGraph`: collects param names from all `params` nodes into `paramsVarNames` (alongside `tempVarNames`) so param identifiers are treated as locally-declared — prevents false "undeclared variable" warnings. Validates each param is a valid CS identifier; warns if it shadows a global; errors on duplicate param names within the same node; errors if the node has no param names at all.
    - `src/domain/choicescriptImport.ts`:
      - `simpleCommandNode`: added `params` case — parses `*params name1 name2` into a params node with normalized identifiers stored in `body`.
      - `isChoiceForgeBodyStop`: added `"*params"` prefix so body parsing stops before a `*params` line.
      - `defaultImportedWidth`: added `params` to the 280px group.
      - `updateChoiceForgeCommandNode`: added `params` case for round-trip re-import of exported params nodes.
    - `src/state/projectStore.ts`: `defaultNodeTitle` → `"*params"`, `defaultNodeWidth` → 280px, `createStoryNode` → `{ body: "" }`.
    - `src/components/NodeCard.tsx`: `typeColors` entry (shares `c-set` color); `NodeIcon` SVG (pill/parameter shape).
    - `src/components/RightPanel.tsx`: inspector panel — single text input for space-separated param names; title auto-updates to match; hint note explaining subroutine usage.
    - `src/components/PlaytestView.tsx`: auto-advances (follows flow edge, no runtime arg injection in playtest).
    - `src/components/Dashboard.tsx`: `params: "var(--c-set)"` added to `summarizeNodeTypes` colors.
    - `src/data/sampleProject.ts`: added `params` label in PT (`parametros`), EN (`params`), ES (`parámetros`).
    - `tests/domain.test.ts`: 8 new tests (86 total, all pass): code gen with names, code gen with empty body, lint error on no names, lint error on invalid identifier, lint error on duplicate names, lint warning on global shadow, no false undeclared-variable warnings, import of standalone `*params` lines.

### 2026-05-14 — Claude Code (claude-sonnet-4-6) — session 10
- **Implemented Redo (Ctrl+Shift+Z) and per-scene lint count badges.**
  - `src/state/projectStore.ts`:
    - Added `futureRef = useRef<ChoiceForgeProject[]>([])` and `futureLength` state alongside the existing `historyRef`/`historyLength`.
    - `pushHistory` now also clears `futureRef`/`futureLength` whenever a new action is committed (any new edit invalidates the redo stack).
    - `undo()` refactored to run inside `setProjectState` updater — captures current state before restore, pushes it to `futureRef`.
    - `redo()` added — mirrors `undo()` in reverse: pops from `futureRef`, pushes current to `historyRef`, restores state.
    - `ProjectActions` interface extended with `canRedo: boolean` and `redo: () => void`.
  - `src/components/TopBar.tsx`: added `canRedo`/`onRedo` props; added `<button>Redo</button>` next to Undo with `title="Ctrl+Shift+Z"`.
  - `src/App.tsx`: added keyboard handler for Ctrl/Cmd+Shift+Z → `actions.redo()`; passes `canRedo`/`onRedo` to `TopBar`.
  - `src/components/LeftPanel.tsx` (`ScenesList`):
    - Added `useMemo` that groups `data.lints` by `issue.scene` into a `Map<string, {errors, warnings}>`.
    - Each scene row now shows `Xe` (error count) and `Xw` (warning count) badges when > 0, styled in red/amber respectively.
  - `styles.css`: added `.scene-tag.scene-err` (red tint) and `.scene-tag.scene-warn` (amber tint) badge styles.
  - 78 tests, all passing; zero TS errors.

### 2026-05-14 — Claude Code (claude-sonnet-4-6) — session 9
- **Added `*temp` node type for scene-local variable declarations.**
  - `src/domain/types.ts`: added `"temp"` to the `NodeType` union (22 types total).
  - `src/domain/choicescript.ts`:
    - Code generation: `*temp {inputVar} {body}` — body is the initial value (defaults to `"0"` if empty). Excluded `temp` from the generic body narrative push (same treatment as `comment`).
    - `lintSceneGraph`: collects `inputVar` from all `temp` nodes as scene-local variables before linting, preventing false "uses an undeclared variable" warnings. Validates `inputVar` is a valid CS identifier; warns if it shadows a global variable; warns if no initial value is provided.
  - `src/domain/choicescriptImport.ts`: `simpleCommandNode` parses `*temp var value` into a `temp` node with `inputVar` and `body`; added `"*temp "` to `isChoiceForgeBodyStop`; added to 280px width group; `updateChoiceForgeCommandNode` round-trips `temp` nodes on re-import.
  - `src/state/projectStore.ts`: `defaultNodeTitle` → `"*temp"`, `defaultNodeWidth` → 280px, `createStoryNode` → default `inputVar: "temp_var"` + `body: "0"`.
  - `src/components/NodeCard.tsx`: `typeColors` entry (shares `c-set` color); `NodeIcon` SVG (set-like icon with small circle suffix marker).
  - `src/components/RightPanel.tsx`: inspector panel for `temp` — variable name input (auto-normalizes identifier) + initial value input + hint note about scene-local scope.
  - `src/components/PlaytestView.tsx`: auto-advances like `set`/`rand` — parses the initial value string to boolean/number/string and stores it in the stats map, then follows the flow edge.
  - `src/components/Dashboard.tsx`: `colors` map in `summarizeNodeTypes` updated to include `temp` (uses `c-set` color).
  - `src/data/sampleProject.ts`: added `temp` label in PT (`variavel local`), EN (`temp variable`), ES (`variable local`).
  - `styles.css`: added `.ip-hint` style for the small inspector hint paragraph.
  - `tests/domain.test.ts`: 6 new tests (78 total, all pass): code generation, string initial value, empty identifier error, global variable shadow warning, no false undeclared-variable warnings, import round-trip.

### 2026-05-14 — Claude Code (claude-sonnet-4-6) — session 8
- **Implemented scene reachability linting and achievement usage tracking.**
  - `src/domain/choicescript.ts`:
    - `lintSceneReachability(project, sceneNames, issues)`: private function called from `lintProject`. Builds an outgoing-edge graph for all visual scenes by scanning `goto_scene`/`gosub_scene` node targets and `finish` chain (finish in scene N implies reachability of scene N+1). Also scans preserved `startup.txt` source for `*goto_scene`/`*gosub_scene` calls. BFS from first scene; emits `warning` for any scene with no incoming path.
    - `computeAchievementUses(project)`: exported function, mirrors `computeVariableUses`. Scans all scene-graph node bodies via `extractAchievementCommandTargets` and preserved source texts via `*achieve` command matching. Returns `Map<string, number>`.
  - `src/components/LeftPanel.tsx`: `AchievementsList` now calls `computeAchievementUses` via `useMemo`; displays a `var-uses` badge with use count next to the `*achieve id` code snippet; zero-use achievements shown in warning amber.
  - `src/components/Dashboard.tsx`: added "unused achievements" KPI card (warn/ok accent); added "achievement usage" bar chart card (amber bars for unused, accent-3 for used).
  - `styles.css`: added `.ach-footer-row` flex row to hold `*achieve` snippet and usage badge side by side.
  - `tests/domain.test.ts`: 4 new tests (72 total, all pass):
    1. `lintSceneReachability warns on unreachable scenes` — goto_scene only connects intro→scene2; scene3 has no incoming edges → warning.
    2. `lintSceneReachability does not warn when all scenes are reachable via finish chain` — consecutive finish nodes propagate reachability.
    3. `computeAchievementUses counts *achieve commands in node bodies` — two achievements, one used twice, one unused.
    4. `computeAchievementUses counts *achieve in preserved source text` — achievement scanning in preserved scene source.

### 2026-05-14 — Claude Code (claude-sonnet-4-6) — session 7
- **Implemented variable usage counting across all project scenes.**
  - `src/domain/choicescript.ts`: added exported `computeVariableUses(project)` function — scans all nodes in all scenes (sets, inputVar, body `${var}` refs, option conditions/sets, branch conditions/sets) plus preserved source texts (`*set`, `*if`/`*elseif` expressions, `*input_*`/`*rand` targets). Returns `Map<string, number>`.
  - `src/components/LeftPanel.tsx`: `VariablesList` now calls `computeVariableUses` via `useMemo`; displays a `var-uses` count badge in a new "uses" column; zero-use variables shown in warning amber.
  - `src/components/Dashboard.tsx`: added "unused variables" KPI card (warn color when > 0, green when all used); added "variable usage" bar chart card showing all variables with usage counts, zero-use bars highlighted in warning amber.
  - `directions.css`: added `kpi-card[data-accent="warn"]` and `[data-accent="ok"]` styles.
  - `styles.css`: added `.var-uses` and `.var-uses.is-zero` badge styles.
  - `tests/domain.test.ts`: 2 new tests — graph-node counting (body refs + conditions + sets) and preserved-source counting. 68 tests total, all pass.

### 2026-05-14 — Claude Code (claude-sonnet-4-6) — session 6
- **Upgraded PlaytestView with full node type coverage and variable interpolation.**
  - `src/components/PlaytestView.tsx`:
    - **`gosub_scene`**: cross-scene subroutine — pushes `{scene, nodeId}` return entry, jumps to target scene (optionally at the entry label node), returns via `*return`.
    - **`return` stack** refactored from `string[]` to `Array<{scene: string; nodeId: string}>` for cross-scene support; `*gosub` and `*gosub_scene` both push typed entries.
    - **`rand`**: auto-advances — rolls a random integer in [min, max], stores result in the variable, follows the flow edge.
    - **`set`**: auto-advances — applies all variable sets, follows the flow edge.
    - **`input_text` / `input_number`**: shows an inline form with a labeled text/number input and a Confirm button; stores the typed value in the variable and advances on submit.
    - **`image`**: renders the asset's `dataUrl` as an `<img>` if found in project assets, or shows a placeholder text box.
    - **`fake_choice`**: displays all options as disabled (decorative) buttons, then shows Continue.
    - **`page_break`**: Continue button now shows the configured label (e.g. "Next Chapter") instead of generic "Continue".
    - **Variable interpolation**: `interpolate(text, stats)` replaces `${variable}` references in node body and prompt text with live stat values.
    - **Conditional choice options**: `*if (cond) #option` options are now hidden when condition is false; `*selectable_if` options remain visible but disabled.
  - `styles.css`: added `.playtest-image`, `.playtest-image-placeholder`, `.playtest-input-form`, `.playtest-input-label`, `.playtest-input` rules.
  - Build: clean (zero TS errors). Tests: 66/66 pass.

### 2026-05-14 — Claude Code (claude-sonnet-4-6) — session 5
- **Completed import/parser hardening for `gosub_scene` and `image`** (closes gap #7).
  - `src/domain/choicescriptImport.ts`:
    - `simpleCommandNode`: already had `gosub_scene` and `image` cases from session 5 start.
    - `updateChoiceForgeCommandNode`: added `gosub_scene` and `image` cases so re-importing ChoiceForge-generated text round-trips both node types correctly (target, label, alignment, alt text).
    - `isChoiceForgeBodyStop`: added `"*image "` prefix so image nodes correctly stop body parsing in the ChoiceForge-format section reader.
    - `defaultImportedWidth`: added `"gosub_scene"` and `"image"` to the 280px group.
  - `src/domain/choicescript.ts` (`lintPreservedScriptSource`): added `gosub_scene` block (missing target → error, invalid identifier → error, unknown scene → error) and `image` block (empty filename → warning), matching the visual graph linter.
  - `tests/domain.test.ts`: added 3 new tests (66 total):
    1. "imports gosub_scene and image command nodes" — verifies `simpleCommandNode` parse, field mapping, and 280px width.
    2. "normalizes edited gosub_scene and image command nodes on re-import" — verifies `updateChoiceForgeCommandNode` round-trip.
    3. "lints gosub_scene and image in preserved script source" — verifies preserved-source diagnostics for both new commands.
  - Build: clean (zero TS errors). Tests: 66/66 pass.

### 2026-05-14 — Claude Code (claude-sonnet-4-6) — session 4
- **Added Spanish (ES) i18n** (closes gap #6 from session 1).
  - `src/domain/types.ts`: `Language` union extended to `"pt" | "en" | "es"`.
  - `src/data/sampleProject.ts`: added `es` sample project (reuses `pt` data, Spanish title/subtitle) and full `i18n.es` label set (all 21 node types, all UI strings).
  - `src/components/TopBar.tsx`: added `<option value="es">ES</option>` to language select; updated all 6 inline lang ternaries for Spanish.
  - `src/App.tsx`: updated `formatSaveStatus` (ES locale + "Guardado localmente"), reset/export confirm dialogs, and import error alert to handle Spanish.
- **Added domain tests for `gosub_scene` and `image` node types** (5 new tests, 63 total).
  - `tests/domain.test.ts`: code generation tests for both types (optional label, alignment, alt text, empty filename skip); lint tests for missing/invalid/unknown scene target, no-flow-continuation warning, and empty-filename warning.
  - Build: clean (zero TS errors). Tests: 63/63 pass.

### 2026-05-14 — Claude Code (claude-sonnet-4-6) — session 3
- **Implemented `*gosub_scene` and `*image` NodeTypes** (closes gap #3 from session 1).
  - `src/domain/types.ts`: added `"gosub_scene" | "image"` to the `NodeType` union.
  - `src/domain/choicescript.ts`:
    - Code generation: `*gosub_scene {target}[ {label}]` and `*image {file} {alignment}[ {alt}]`.
    - Linting: `gosub_scene` validates scene target exists and warns if no flow continuation; `image` warns if filename is empty.
  - `src/state/projectStore.ts`: `defaultNodeTitle`, `defaultNodeWidth` (280px each), and `createStoryNode` with correct default fields.
    - `gosub_scene`: `target` = scene name, `body` = optional entry label.
    - `image`: `target` = filename, `inputMin` = alignment (default "none"), `prompt` = alt text.
  - `src/components/NodeCard.tsx`: colors (`gosub` palette for `gosub_scene`; `passage` palette for `image`), SVG icons for both, and fixed `node.target` rich display (no spurious `.txt` on image nodes).
  - `src/components/RightPanel.tsx`: inspector panels for both types — scene dropdown + optional label input for `gosub_scene`; filename + alignment select + alt text input for `image`.
  - `src/components/Dashboard.tsx`: added color entries to the node-type summary chart.
  - `src/data/sampleProject.ts`: PT (`subrotina de cena`, `imagem`) and EN (`gosub scene`, `image`) labels.
  - `src/components/GraphCanvas.tsx`: added both to `creatableNodeTypes`.
  - Build: clean (zero TS errors). Tests: 58/58 pass.

### 2026-05-14 — Claude Code (claude-sonnet-4-6) — session 2
- **Implemented inline CodeMirror editor for node body fields** (closes gap #1 from session 1).
  - Created `src/components/NodeBodyEditor.tsx`: compact CM editor (no line numbers, no gutter, word-wrap, spellcheck, history, ChoiceScript highlighting).
  - Exported `choiceScriptHighlight` from `CodeEditor.tsx`; added `@{…}` multireplace highlighting (`cm-cs-multi` token) to both the full-file editor and the node body editor.
  - Replaced plain `<textarea className="narr-editor">` with `<NodeBodyEditor>` in three places in `RightPanel.tsx`: passage body, comment body, input_text/input_number prompt.
  - `key={node.id}` on each `NodeBodyEditor` ensures fresh undo history when switching nodes.
  - Added `.node-body-editor` CSS and `.cm-cs-multi` color token to `styles.css`.
  - Build: clean (zero TS errors). Tests: 58/58 pass.

### 2026-05-14 — Claude Code (claude-sonnet-4-6) — session 1
- First Claude Code session. Contextualised the full codebase: read agents.md, types.ts, App.tsx, RightPanel.tsx, NodeCard.tsx, domain tests, package.json, and spec.
- Confirmed 58 tests pass (`npm test`), zero errors.
- Created `CLAUDE.md` at project root for Claude-specific workflow guidance.
- **Gap assessment for project completion (priority order):**
  1. ~~**Inline CodeMirror in node body fields**~~ — **Done (session 2).** `NodeBodyEditor.tsx` replaces the plain textareas in `RightPanel.tsx` for passage body, comment body, and input prompt.
  2. **Official ChoiceScript runtime play-test** — Internal playtest exists but uses graph traversal, not the real engine. The official CS runtime (MIT) could be bundled and given the exported zip files to run in a sandboxed iframe.
  3. ~~**Missing NodeTypes from spec**~~ — **Done (session 3).** `*gosub_scene` and `*image` fully implemented across types, codegen, linter, inspector, NodeCard, Dashboard, and i18n.
  4. **Test coverage** — 58 tests cover domain/import/generator well. No component-level tests yet (no Vitest/Playwright).
  5. **Tauri/desktop packaging** — Nice-to-have; the web app on Cloudflare Pages serves the use case.
  6. ~~**Spanish i18n**~~ — **Done (session 4).** `Language` extended to `"es"`, full `i18n.es` label set, ES sample project, TopBar + App strings all handle Spanish.
- Nothing broken. Codebase is healthy.

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
