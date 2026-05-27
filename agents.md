# ChoiceForge — Agent Context

## What This Project Is

ChoiceForge is a **visual node-based editor for ChoiceScript**, the domain-specific language used by Choice of Games to write interactive fiction. Think Twine, but targeting ChoiceScript's specific syntax and semantics instead of hypertext.

The editor lets authors build stories by connecting visual nodes on a canvas, then exports valid `.txt` files that run against the official ChoiceScript runtime without modification.

This is a **web app** (React + TypeScript + Vite), deployed to Cloudflare Pages. There is no Tauri/Electron wrapper yet — the original spec mentioned desktop, but the current implementation is browser-only.

---

## Current Implementation Status

### Done
- Full TypeScript domain model (`src/domain/types.ts`) for nodes, edges, scenes, variables, achievements (24 NodeTypes including `temp`, `params`, and `achieve`)
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
- Internal playtest view for graph-level smoke testing (`PlaytestView.tsx`); still available in the codebase but not exposed via the main UI (replaced by official runtime)
- Official ChoiceScript runtime playtest (`OfficialPlayView.tsx`): embeds the real CS engine in an `<iframe srcdoc>` panel; Play button now runs the actual game
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
- Git integration, version history, snapshots (SnapshotPanel covers localStorage snapshots; git/cloud sync is out of scope)
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

### 2026-05-27 — Claude Code (claude-opus-4-7) — session 195
- **Robustness pass: panel error boundaries + full round-trip integration tests.**
  - **PanelErrorBoundary** (`src/components/PanelErrorBoundary.tsx`): class-based React error boundary. Wrapped LeftPanel, the canvas/editor/playview area, and RightPanel in App.tsx. A render crash in any one panel now shows an inline error card (with panel name, the error message, a Retry button, and a hint about autosave) instead of taking down the whole app. Console.error gets a `[ChoiceForge] X panel crashed` prefix so it's obvious in devtools. The TopBar, BottomBar, modal overlays, and HelpGuide stay unwrapped — they need to keep working when an inner panel crashes, and they're simple enough to be unlikely to throw.
  - **Round-trip integration tests** (`tests/ui/exportImportRoundtrip.test.ts`): 12 new tests run `createExportPackage → unpack → importChoiceScriptArchive` on both EN and PT samples and assert title/author/scenes/variables/achievements survive. Also asserts export-package shape (always has `_choiceforge/project.json` + `mygame/startup.txt` + `mygame/choicescript_stats.txt`, scene `.txt` file count matches playable scene count) and verifies preserved scene source contains the generator's `cf_n*` labels. Higher leverage than single-function unit tests because each test exercises the whole generator + importer chain end-to-end — any regression in `generateSceneChoiceScript`, `generateStartupChoiceScript`, `generateStatsChoiceScript`, or `importChoiceScriptArchive` will fail at least one round-trip test.
  - **PanelErrorBoundary tests** (`tests/ui/PanelErrorBoundary.test.tsx`): 4 tests — renders children when nothing throws, catches errors with the panel name in the fallback, shows a Retry button, logs to console.error with the panel-name prefix.
  - **Tests**: 387 domain + 67 UI = **454 passing** (was 438). Build clean.
  - **Commits**: `b77eb8b` (error boundaries), `bedce18` (round-trip tests).
  - **README EN/PT, CHANGELOG, agents.md** updated with the new test counts and a Robustness subsection.

### 2026-05-27 — Claude Code (claude-opus-4-7) — session 194
- **Backlog cleanup pass: zip worker, ~90-string i18n bulk, a11y, more UI tests.**
  - **`extractZipEntries` async via Worker** (`src/workers/zipParser.ts`, `App.tsx`): unzipSync ran on the main thread, freezing input for multi-second decompresses on multi-MB ChoiceScript archives with images. New zipParser worker runs decompress off-main; chooses path by size (≤ 256 KB stays sync to avoid worker spin-up overhead; > 256 KB uses the worker with 30 s timeout and sync fallback on error).
  - **Bulk i18n pass — ~90 strings across 3 batches**:
    1. LeftPanel chrome (28 keys): variables table column headers + type select + stats select + low label, achievement hidden/desc/uses, scene synopsis/wordGoal/mini-actions (up/down/dup/del), source files summary, asset add.
    2. GraphCanvas chrome (21 keys): toolbar "dup", filter placeholder, tag label, snap title, SelectionBar count + all 8 align/distribute tooltips + mark-done/todo + tag-all + clear-tags, EdgeDropPicker hint, filter prev/next.
    3. RightPanel deep inspector (40 keys): #options labels, fake-choice prompt, no-condition, stat-step, target scene, entry label, variable name/initial value/parameter names, filename/alignment/alt-text, achievement assign/remove/field, page-break/label/comment, prompt-text/target-variable, finish/return/ending hints, next scene/end of scene_list, outgoing/incoming connections, logic structure/no-branches/visual flow/connect, option/branch/option effects, "+ effect", choose-asset/missing/select/none placeholders. Threaded labels through 13 inner components (LogicTab, CommandNodeFields, InputNodeFields, AchievementInsert, AchieveNodeFields, SetsList, BranchSets, OptionSets, FakeOptionSets, ChoiceConditionBuilder, FakeChoiceConditionBuilder, OutgoingEdges, IncomingConnections). Renamed local `labels` array in CommandNodeFields to `labelNodes` to avoid shadowing the prop. Dropped two long EN-only hint paragraphs whose info is now carried by the localized field labels.
    All three sample projects (PT/EN/ES) updated for every key.
  - **A11y pass**: aria-label + aria-pressed added to icon-only and toggle buttons across LeftPanel (scene/variable/achievement/asset mini-actions get `<action> <entity-name>` labels), GraphCanvas (snap toggle, tag-filter dots, SelectionBar tag buttons), RightPanel (status todo/done, node color tags). Screen readers and keyboard users now get announced names on every button.
  - **2 new UI test files (+7 tests, total 51)**:
    - `tests/ui/i18nBulk.test.ts`: enumerates every required I18nLabels key (~90 keys after the bulk passes), loops PT/EN/ES, asserts each is a non-empty string; sanity-checks the languages actually differ; verifies `{count}` interpolation placeholders survive in all three languages.
    - `tests/ui/appSmoke.test.tsx`: first end-to-end mount of `<App />` through jsdom. Required two polyfills in `tests/ui/setup.ts` — `ResizeObserver` stub (used by GraphCanvas viewport tracking) and a `Worker` mock (the scene/zip parsers new-up Workers, mock is enough for panels to render). Asserts the four left-panel tabs and the Play button render with EN labels.
  - **Docs**: CHANGELOG.md gained Internationalisation + Accessibility + (extended) Testing subsections; README.md / README.pt-BR.md updated test counts; this entry.
  - **Tests**: 387 domain + 51 UI = **438 passing**. Build clean.
  - **Commits**: `2c44fb3` (zip worker), `0ff4ac3` (LeftPanel i18n), `cee097e` (GraphCanvas i18n), `663be14` (RightPanel deep i18n), `6a6742b` (a11y), `8ee6f1a` (i18nBulk + appSmoke tests).
  - **Backlog cleared this session**: extractZipEntries worker ✓, ~35 chrome i18n strings (turned out to be ~90 once counted properly) ✓, A11y basics ✓, App.tsx integration test ✓.
  - **Remaining out-of-scope** (judgment calls, not bugs):
    - `clearStartupSource` aggressive wipe on var/ach mutations — design tradeoff (current behaviour is undoable; alternative is confirmation modal). Not changed.
    - Variable rename debounce — UX tradeoff (debouncing introduces stale input value during typing). Not changed.
    - lintProject memoization runs on every state change — only matters on very large projects; no concrete complaint. Not changed.
    - Wider App integration tests (drive full import → edit → export round-trip) — would need fuller Worker mocks for sceneParser; current smoke test is enough.

### 2026-05-27 — Claude Code (claude-opus-4-7) — session 193
- **UI test layer + 1 real bug caught by tests.**
  - **Motivation**: the project had 387 domain tests but **zero coverage of React components, the store, or any UI flow**. Any regression that touched a component or hook would land silently in `main`. Picked this as the biggest structural gap to close.
  - **Infrastructure** (`vitest.config.ts`, `tests/ui/setup.ts`): Vitest + jsdom + Testing Library + user-event + jest-dom matchers. Uses the existing `@vitejs/plugin-react` for transforms so there's no second build pipeline. `npm test` stays the fast domain-only path; `npm run test:ui` runs the new layer; `npm run test:all` runs both. CI workflow runs both before the build. Added `@vitest/coverage-v8` and `coverage/` is gitignored.
  - **44 UI tests** across four files:
    - `tests/ui/NewProjectModal.test.tsx` (5): EN/PT language switching, the blank-project callback with typed title+author, close button, Enter-to-submit. Used as the pipeline smoke test.
    - `tests/ui/projectStore.test.ts` (18): initial state, `updateMetadata` preserves startupSource on `wordGoal` (session-186 fix) and discards on title/author, `addNode` language defaults (EN/PT/ES per session 188), `duplicateNode` Y positioning uses height not width (session 186), variable add/rename/delete with reference propagation, scene add/duplicate/delete, undo/redo, `connectNodes` default option text (session 187).
    - `tests/ui/LeftPanel.test.tsx` (9): the `labels.words === "words"` heuristic regression caught for ES users — three i18n sites verified across EN/PT/ES (search no-results, search results title, replace status), plus a console.error spy that confirms VariablesList no longer triggers the React key warning (session 192 fix).
    - `tests/ui/RightPanel.test.tsx` (12): empty-state hint i18n, source-preserved banner localization, Convert button callback, private notes label + placeholder, disabled inputs in sourcePreserved mode, title-edit callback flow (session-190 fixes).
  - **Bug caught by tests — scene insertion** (`projectStore.ts` `addScene` + `duplicateScene`): both actions appended new scenes to the END of the array via `[...saved.scenes, newScene]`. Since `data.scenes` is rendered in array order by the left panel and the array convention is `[startup, …playable, choicescript_stats]`, the new scene appeared AFTER the stats scene — confusing for users. The fix: insert after the last playable scene via a new `lastIndex` helper. Caught by the addScene UI test that asserted the new scene index is less than the special scene index.
  - **Documentation**: extended `CONTRIBUTING.md` with a Tests section covering both layers, the renderHook pattern for store tests, watch mode, coverage. Updated `README.md` + `README.pt-BR.md` with the two-suite test commands and counts. Added a Testing section to `CHANGELOG.md`.
  - **Tests**: 387 domain + 44 UI = **431 passing**. Build clean.
  - **Commits**: `845c4ea` (Vitest infrastructure), `feb0e3f` (store tests + addScene bug fix), `7f3651c` (LeftPanel tests), `0f54a6a` (RightPanel tests).
  - **Tip recorded in CONTRIBUTING**: when an action returns an ID computed inside a setState updater (e.g. `duplicateNode`), tests should read state-after rather than the return value — React 19 batches updaters and the return value may be stale.
  - **Out of scope this session**: integration tests that drive App.tsx end-to-end (would need to mock Worker and fflate); coverage push for GraphCanvas (canvas math + pointer events are harder to test in jsdom); the remaining ~35 chrome i18n strings (LeftPanel chrome + GraphCanvas chrome).

### 2026-05-27 — Claude Code (claude-opus-4-7) — session 192
- **LeftPanel audit (948 lines) + 2 fixes.**
  - **Audit findings**: catalogued ~17 items. The two real fixes shipped this session; rest are either acceptable-as-is (most chrome strings already always-English, no Spanish regression; expandedVar persistence across tab switches is a UX nit), microoptimizations (per-row `indexOf` is fine for typical achievement counts; rename without debounce only matters on big projects), or deferred (broader chrome i18n).
  - **Fix 1 — React key warning** (`LeftPanel.tsx` VariablesList): each variable row was rendered as `<>...</>` Fragment inside `.map()` with keys on the inner `<tr>` elements but missing on the outer fragment. React was warning every render. Switched to `<React.Fragment key={variable.name}>` and dropped the redundant inner keys.
  - **Fix 2 — `labels.words === "words"` heuristic was broken for Spanish** (`LeftPanel.tsx`, `types.ts`, `sampleProject.ts`): six places detected language via the brittle `labels.words === "words" ? <en> : <pt>` pattern, handling only English vs everything-else. Spanish users saw Portuguese fallbacks for the search results title, no-results message, no-assets-yet, the asset file-picker label, the asset usage-note placeholder, and (in a 3-way variant) the replace status messages. Added 8 proper `I18nLabels` keys (`searchResultsTitle`, `searchNoResults`, `replaceNoMatches`, `replaceInScene`, `replaceInAll`, `noAssetsYet`, `assetFile`, `assetUsageNote`) with PT/EN/ES translations. The replace-status keys use a `{count}` interpolation pattern.
  - **Tests**: 387 passing. Build clean.
  - **Commits**: `5c4e516`.
  - **Deferred**: ~15 remaining always-English chrome strings ("type"/"name"/"initial" table headers, "num"/"str"/"bool" type options, "off"/"text"/"%"/"pair" stats select options, mini-action labels "up"/"down"/"dup"/"del", "synopsis…" placeholder, "hidden" checkbox label, "use(s)" suffix, etc.). These don't break Spanish fallbacks since they're always-English; they would just remain English in PT/ES projects until a future bulk i18n pass. Combined with the ~20 deferred canvas chrome strings, the next i18n pass is a ~35-string bulk effort worth a dedicated session.

### 2026-05-27 — Claude Code (claude-opus-4-7) — session 191
- **GraphCanvas audit (1133 lines) + 3 fixes.**
  - **Audit findings**: catalogued ~25 items. The three real fixes shipped this session; ~20 are either acceptable-in-practice (idempotent double-fire on connect end because store rejects duplicate options/branches/edges; substring match in `type:choice` filter is intentional) or deferred (large surface of canvas-chrome English strings: "dup", AlignIcon titles, "Mark all selected as done", "Filtering by ..." tooltip, etc.).
  - **Fix 1 — viewport culling height** (`GraphCanvas.tsx:566`): the off-screen culling filter used `n.y + 600` as the assumed node height. Nodes taller than 600px (long passage + many choice options + many *if branches) would flicker out of view when scrolled to the viewport edge. Now uses `nodeHeightEstimate(node, density)` which is already used for edge midpoints and fit-view bounds.
  - **Fix 2 — Minimap maxY + node rects** (`GraphCanvas.tsx:1089, 1120`): minimap's viewBox extent used `node.y + 200` for the bottom bound, and every node rect was drawn at a fixed `height="60"` regardless of actual size. The minimap cropped tall nodes and gave a wrong sense of relative node sizes. Both now use `nodeHeightEstimate`. Minimap takes a new `density` prop.
  - **Fix 3 — Canvas i18n** (`types.ts`, `sampleProject.ts`, `GraphCanvas.tsx`): the most-visible canvas chrome strings were hardcoded in English regardless of language setting — the source-preserved banner (title + hint), the "Convert to visual editing" CTA, and the "Converting scene…" overlay during async parse. Added 4 new `I18nLabels` keys (`sourcePreservedBannerTitle`, `sourcePreservedBannerHint`, `convertToVisual`, `convertingScene`) with PT/EN/ES translations.
  - **Tests**: 387 passing. Build clean.
  - **Commits**: `c5ba8f9` (height fixes), `871f53f` (canvas i18n).
  - **Deferred from canvas audit**: the broader chrome English strings (toolbar "dup", filter placeholder, AlignIcon titles for distribute/align buttons, "Mark all selected as done/todo", "Tag all selected: red", "Clear tag filter", "selected" count suffix, the source-preserved banner is now done). Each would need its own `I18nLabels` key — a future bulk pass when appetite for that surface area exists. Total remaining canvas-i18n strings: ~20.

### 2026-05-27 — Claude Code (claude-opus-4-7) — session 190
- **RightPanel audit (1620 lines) + 5 fixes.**
  - **Audit findings**: catalogued one bug per category — magic root-id fallback in type conversion, drag-state leak across node switches, an `\s+` regex pattern in `extractAchievementCommands` that was safe in practice but inconsistent with the session-178 hardening elsewhere, and six hardcoded English strings visible no matter the UI language (empty state, source-preserved banner, Convert button, private-notes label + placeholder, New option default).
  - **Fix 1 — magic 'n1' root removed** (`RightPanel.tsx`): `buildTypeConversionPatch` was called with `project.nodes[0]?.id ?? "n1"` as the fallback target for new options/branches during type conversion (e.g., `fake_choice → choice`). Imported projects whose first node id isn't "n1" would get options pointing at a non-existent node. Now uses `project.nodes.find((n) => n.id !== node.id)?.id ?? node.id` — first non-self id, falling back to a self-loop only in the single-node-scene edge case.
  - **Fix 2 — drag state reset on node switch** (`RightPanel.tsx`): `dragOptIdx` and `dragOverIdx` state on `ContentTab` was not cleared when the selected node changed; a half-finished drag on one node could leak into the next selection. Extended the existing `useEffect([node.id])` (which already reset `writingFocus`) to clear the drag state too.
  - **Fix 3 — `extractAchievementCommands` regex hardening** (`RightPanel.tsx`): replaced `\s+` (matches newlines) with `[ \t]+` for consistency with the same fix in `choicescript.ts` from session 178. The `^...$` + `m` flag prevented cross-line matches in practice, but the conservative form is what the rest of the codebase uses.
  - **Fix 4 — Inspector strings i18n** (`types.ts`, `sampleProject.ts`, `RightPanel.tsx`): added six new `I18nLabels` keys (`inspectorEmpty`, `sourcePreservedNotice`, `convert`, `privateNotes`, `privateNotesPlaceholder`, `newOption`) with PT/EN/ES translations. RightPanel now threads `labels.newOption` through `addOption`/`addFakeOption`. The six previously-hardcoded English strings now respect the editor language.
  - **Tests**: 387 passing. Build clean. No regressions.
  - **Commits**: `bd9d012` (root id + drag reset + regex), `730bb72` (i18n).
  - **Out-of-scope this session**: the inspector has many more English strings inside the various per-node-type branches (`#options`, `fake choice prompt`, `target scene`, `entry label (optional)`, `effects when this branch wins`, `stat effects`, etc.) — they would each require a labels key. Skipped for this pass; the six fixed here cover the always-visible chrome (empty state, source banner, notes, default option text). Per-node-type labels can come in a future pass when there's appetite for the much-larger I18nLabels surface area.

### 2026-05-27 — Claude Code (claude-opus-4-7) — session 189
- **OSS polish: bundle splitting, issue/PR templates, Dependabot, CHANGELOG.**
  - **Bundle splitting** (`vite.config.ts`): added `manualChunks` rule that pulls `@codemirror/*` + `@lezer/*`, `react`/`react-dom`/`scheduler`, and `fflate` into separate vendor chunks. Main app bundle dropped from 904 KB to 344 KB. No more Vite >500 KB warning. Total bytes shipped is slightly higher because of chunk-splitting overhead, but first-load parallelism + cache reuse across deploys both improve.
  - **GitHub issue + PR templates** (`.github/ISSUE_TEMPLATE/*.yml`, `.github/pull_request_template.md`): YAML issue forms for bug reports (steps, expected, actual, env) and feature requests (problem-first framing). `config.yml` disables blank issues and points users at the ChoiceScript wiki and Choice of Games site. PR template includes the invariant checklist (purity of `choicescript.ts`, `commitProject` discipline, identifier normalization, etc.) lifted from CONTRIBUTING.
  - **Dependabot** (`.github/dependabot.yml`): weekly npm updates with grouped PRs for CodeMirror, Tauri, and React ecosystems (keeps PR count manageable since CodeMirror alone has ~6 packages); monthly updates for the CI workflow's actions/* pins; weekly cargo updates for Tauri Rust crates under `src-tauri/`. All PRs labelled `dependencies`.
  - **CHANGELOG.md** (`CHANGELOG.md`): Keep-a-Changelog-style. Captures everything user-facing since the bilingual README (Added / Fixed / Performance / Internal). Points at `agents.md` for the per-session diary with file paths and rationale.
  - **Tests**: 387 passing, build clean (now under 500 KB warning).
  - **Commits**: `1cb1e55` (bundle split), `228517d` (issue + PR templates), `d905e15` (Dependabot), `d55516b` (CHANGELOG).
  - **Still deferred**: `extractZipEntries` async via worker (synchronous `unzipSync` blocks main on big zips); `clearStartupSource` aggressive wipe on var/ach mutations (real design tradeoff, current behaviour is defensible since changes are undoable); UI/integration test layer (no Vitest/Playwright). `SECURITY.md` and `CODE_OF_CONDUCT.md` not yet added — can wait until the repo is actually public.

### 2026-05-27 — Claude Code (claude-opus-4-7) — session 188
- **Open-source readiness pass: CI, CONTRIBUTING, finish i18n.**
  - **GitHub Actions CI** (`.github/workflows/ci.yml`): runs `npx tsc --noEmit`, `npm test`, and `npm run build` on every push to `main` and every PR. Pulls Node version from `.nvmrc` and caches npm. 10-minute timeout.
  - **CONTRIBUTING.md**: human-facing contributor guide. Sections: quick start, workflow, eight non-negotiables (purity of `choicescript.ts`, `commitProject` discipline, startup/special-scene locks, identifier normalization, etc.), code style, testing expectations, the new-node-type and new-scene-action checklists, bug-report template, license/trademark note. Links to `agents.md` as the authoritative deep dive.
  - **i18n for `createStoryNode` defaults** (`projectStore.ts` + `App.tsx`): new nodes added from the toolbar previously seeded English-only placeholder prose ("New narrative passage.", "What happens next?", "Author note.", etc.) regardless of the editor's UI language. Mixed English into PT/ES projects until the user overwrote each field. Added a `NODE_DEFAULTS: Record<Language, NodeDefaults>` table covering the 8 user-visible seed strings, extended `addNode` action signature with an optional `lang` param, and wired `lang` in at both call sites in `App.tsx`. ChoiceScript command titles (`*goto`, `*finish`, `*page_break`, etc.) stay in English — those are language syntax, not prose.
  - **Tests**: 387 passing. Build clean (904 KB main bundle).
  - **Commits**: `9d30136` (CI workflow), `40cd2d6` (CONTRIBUTING), `c07485a` (i18n defaults).
  - **Out-of-scope remaining**: `extractZipEntries` async via worker (still synchronous `unzipSync`); `clearStartupSource` aggressive wipe on var/ach mutations (design tradeoff); bundle splitting to shrink main chunk under 500 KB warning threshold; UI/integration test layer (no Vitest/Playwright yet). i18n of `simpleCommandNode` lossy-import defaults skipped — those are rare and seen only in unmodelled imports.

### 2026-05-27 — Claude Code (claude-opus-4-7) — session 187
- **3 follow-up cleanups: zip compression, helper dedup, drop English default in connectNodes.**
  - **Zip compression** (`App.tsx`): replaced the hand-rolled `createZipArchive` (~80 lines using STORE method, with `u16`/`u32`/`concatBytes`/`crc32` helpers) with `fflate.zipSync` at level 6. Already-compressed asset extensions (png/jpg/gif/webp/mp3/ogg/mp4/m4a/aac/zip) get level 0 to skip wasted CPU. ChoiceScript text exports should shrink ~70%.
  - **Helper dedup** (new `src/domain/parsing.ts`): `commandName`, `commandValue`, `stripCommandPrefix`, `gosubTarget`, `generatedNodeLabel` were duplicated 2–4× across `choicescript.ts`, `choicescriptImport.ts`, `graphLayout.ts`, and `projectStore.ts`. Consolidated into one module. choicescript.ts keeps `sourceCommand`/`sourceCommandValue` as local re-export aliases since many callers already use those names.
    - Required adding `"allowImportingTsExtensions": true` to `tsconfig.json` because Node's `--experimental-strip-types` test runner needs explicit `.ts` extensions on value imports — domain files use `from "./parsing.ts"` everywhere now.
  - **connectNodes default text** (`projectStore.ts`): when the user dragged a connection from a `choice` node to a target, the default option text was `"Go to ${target.title}"` — hardcoded English. Since the option text is player-facing and almost always edited immediately, just default to `target.title` (which is whatever the user named the target, typically in their working language).
  - **Tests**: 387 passing (no new tests for these cleanups — behaviour-preserving refactors plus a UX text simplification). Build clean.
  - **Commits**: `257e48f` (zip compression), `5d393c7` (parsing.ts dedup), `aa571d9` (connectNodes default).
  - **Still deferred**: i18n for `createStoryNode` defaults ("Imported text input.", "Continue", "Author note.") — needs `lang` plumbed into the store, invasive; `clearStartupSource` aggressive wipe on variable/achievement changes (design tradeoff); `extractZipEntries` synchronous via `unzipSync` (could move to a worker for large zips). `normalizeIdentifier` duplication kept per existing intent in this doc.

### 2026-05-27 — Claude Code (claude-opus-4-7) — session 186
- **Codebase audit pass + 6 high-priority bug fixes.**
  - **Process**: Full read of `src/domain/`, `src/state/projectStore.ts`, `src/App.tsx`, and grep-scan of UI for hardcoded strings, duplicated helpers, and pointer-event handling.
  - **MIT LICENSE added** at the repo root (Vinicius de Araujo, 2026) ahead of eventual public release. Includes a trademark notice clarifying that "ChoiceScript" remains a Choice of Games LLC mark.
  - **Fix 1 — Paragraph breaks in exported option bodies** (`choicescript.ts`): `generateNodeChoiceScript` used `option.body?.split("\n").filter(Boolean)` for both `choice` and `fake_choice` option bodies, silently squashing blank lines (ChoiceScript paragraph breaks) into one paragraph in the exported `.txt`. Extracted `emitOptionBodyLines()` that trims leading/trailing blank lines but keeps internal blanks intact. Added 3 tests (paragraph break in choice body, in fake_choice body, leading/trailing blank trim).
  - **Fix 2 — Selective preserved-source wipe in `updateMetadata`** (`projectStore.ts`): `updateMetadata` previously called `clearStartupSource` on every call, including for `wordGoal` changes — silently discarding a user's hand-edited preserved startup.txt for unrelated UI tweaks. Now only clears when `title` or `author` is in the patch.
  - **Fix 3 — Strip `lints` on Tauri native save** (`App.tsx`): `handleNativeSave`/`handleNativeSaveAs` serialised the full `lintedProject` including the computed `lints[]` array, bloating saved `.json` files. New `serializeProjectForDisk` helper drops `lints` (resets to `[]`) before JSON.stringify.
  - **Fix 4 — Worker race in `convertCurrentSceneToVisual`** (`projectStore.ts`): The Worker dispatched a parse for the active scene, but `worker.onmessage` wrote parsed nodes/edges into `cur.sceneTitle` (the then-current title). If the user navigated to another scene during conversion, the parse landed in the WRONG scene. Captures `dispatchedScene` at dispatch time, validates the target still has preserved source when the result arrives, and only updates active `nodes`/`edges` if the user is still on the dispatched scene (else just updates the `sceneData` entry).
  - **Fix 5 — `duplicateNode` Y offset typo** (`projectStore.ts`): Used `y: node.y + node.w + 24` — placed clones far below proportional to width (e.g., 320px wide → +344 Y). Replaced with `node.y + estimateNodeRenderedHeight(node) + 24` using a conservative new helper that approximates rendered height from node content.
  - **Fix 6 — Achievement parser consuming next `*achievement`** (`projectStore.ts` `parseAchievements` + `choicescriptImport.ts` `parseStartup`): Both sites read the next 1-2 raw lines after an `*achievement` declaration as preDesc/postDesc without checking they aren't command lines. When an achievement had no descriptions, the next `*achievement` line was silently consumed. Routed candidates through new helpers (`achievementDescriptionLine` / `importAchievementDescriptionLine`) that return null for blank lines or lines starting with `*`. Added 1 test for back-to-back achievement declarations.
  - **Fix 7 — `bytesToBase64` quadratic concat** (`choicescriptImport.ts`): Rewrote to prefer `btoa` with chunked `String.fromCharCode` (browsers) and fall back to a preallocated-array `.join("")` (test/Node). Much faster on large imported assets.
  - **Fix 8 — Magic `"n1"` root id removed** (`graphLayout.ts`, `choicescript.ts`): `layoutStoryNodes` (root + barycenter), `generateSceneChoiceScript` (sort order), and `lintSceneGraph` (orphan check) all hardcoded `node.id === "n1"`. Imported projects with non-standard ids saw their real root flagged as orphan and emitted in y/x order rather than first. Replaced with `nodes[0]?.id`. Added 1 test verifying with an imported-style id (`"imported_root_42"`).
  - **Tests**: 387 passing (+5 new across the fixes). `npm run build` clean (898 KB main bundle, expected). `npm run dev` serves HTTP 200 with correct HTML.
  - **Commits in this session**: `3b89b54` (LICENSE), `f82c01c` (paragraph breaks), `61e6cce` (updateMetadata + lints strip), `4e8243e` (worker race + duplicate Y), `c87110b` (achievement preDesc), `2968341` (root id + base64).
  - **Out-of-scope / deferred** (catalogued but not fixed this session):
    - i18n: `connectNodes` hardcodes `"Go to ${target.title}"` and `createStoryNode` / `simpleCommandNode` hardcode English defaults like `"Imported text input."`, `"Continue"`, `"Author note."`. Plumbing `lang` into the store is invasive; defer.
    - `clearStartupSource` / `clearStatsSource` still called for variable/achievement mutations — design decision (regenerate metadata into startup.txt on every change vs. preserve user edits). Current behaviour is conservative for correctness but loses preserved source on power-user edits.
    - Duplicate helpers (`stripCommandPrefix`, `commandName`/`sourceCommand`, `generatedNodeLabel`) across `choicescript.ts`, `choicescriptImport.ts`, `projectStore.ts`, `graphLayout.ts`. `normalizeIdentifier` duplication is intentional per agents.md.
    - `createZipArchive` uses STORE method (no compression). fflate's `zipSync` could shrink exports significantly.
    - `extractZipEntries` is synchronous (`unzipSync`) — large zips block main thread.

### 2026-05-27 — Claude Code (claude-opus-4-7) — session 185
- **Added comprehensive bilingual README (EN + PT-BR).**
  - **Goal**: project had no top-level README, only `agents.md` (AI context) and `CLAUDE.md` (Claude Code workflow). Created human-facing onboarding docs in English and Portuguese, mutually linked at the top.
  - **`README.md`** (English): highlights, screenshots/demo placeholder, tech stack, getting started, npm scripts table, architecture diagram, key invariants, full domain model summary, complete node-type table (all 24 types + edge kinds), editing workflow walkthrough, import/export package layout, linter category summary, playtest options, persistence semantics, keyboard shortcut table, Tauri desktop setup, Cloudflare Pages deploy settings, project layout tree, contributing rules (mirrors `agents.md` invariants), roadmap, license/credits.
  - **`README.pt-BR.md`**: full Portuguese translation of the same sections; preserves all code blocks and shell commands verbatim; uses Brazilian Portuguese.
  - Both READMEs cross-link at the top via a language selector line.
  - Note: legacy `.jsx` files at repo root + `ChoiceForge.html` are explicitly called out as legacy in both READMEs.
  - **Files changed**: `README.md` (new), `README.pt-BR.md` (new), `agents.md`.
  - **Tests**: 382 passing (no code changes — docs only).

### 2026-05-20 — Claude Code (claude-sonnet-4-6) — session 184
- **Tauri v2 desktop app scaffold.**
  - **Goal**: Wrap the web app as a cross-platform desktop app (Windows/macOS/Linux) using Tauri v2, with native file open/save for `.json` project files. Web version (`npm run dev` / `npm run build`) is fully unchanged.
  - **Scaffold files created**:
    - `src-tauri/Cargo.toml` — Rust package, depends on `tauri@2`, `tauri-plugin-dialog@2`, `tauri-plugin-fs@2`
    - `src-tauri/build.rs` — Tauri build script
    - `src-tauri/src/main.rs` — entry point (sets `windows_subsystem = "windows"` for release)
    - `src-tauri/src/lib.rs` — Tauri builder with dialog + fs plugins
    - `src-tauri/tauri.conf.json` — window: 1400×900 min 960×640, identifier `com.choiceforge.app`
    - `src-tauri/capabilities/default.json` — grants `dialog:allow-open`, `dialog:allow-save`, `fs:allow-read-text-file`, `fs:allow-write-text-file`
  - **Platform abstraction** (`src/platform/fileSystem.ts`):
    - `isTauri()` — detects Tauri via `__TAURI_INTERNALS__`
    - `nativeOpenProject()` — opens file dialog filtered to `.json`, returns `{path, content}`
    - `nativeSaveProject(content, currentPath?)` — saves to existing path or shows Save As dialog
    - `nativeSaveProjectAs(content)` — always shows Save As dialog
    - `setWindowTitle(title)` — updates native window title
  - **TopBar.tsx**: Added optional `onNativeOpen`, `onNativeSave`, `onNativeSaveAs`, `currentFilePath` props. In Tauri mode the "Save" web button is replaced by "Open" + "Save"/"Save As" native buttons. Web mode is unchanged.
  - **App.tsx**: Added `currentFilePath` state + ref, three `useCallback` native handlers, `handleNativeSave` in `useEffect` deps. Ctrl+S routes to `handleNativeSave()` when in Tauri, otherwise falls back to `actions.saveNow()`. Window title updates on open/save.
  - **vite.config.ts**: Added Tauri-specific `clearScreen: false`, `strictPort: true`, `TAURI_ENV_` prefix, and conditional build target.
  - **package.json**: Added `tauri:dev`, `tauri:build`, `tauri:icons` scripts. Installed `@tauri-apps/cli@^2`, `@tauri-apps/api@^2`, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`.
  - **`.gitignore`**: Added `src-tauri/target/` and `src-tauri/Cargo.lock`.
  - **How to run desktop**: Install Rust first (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`), then `npm run tauri:dev`.
  - **Icons**: Run `npm run tauri:icons src-tauri/app-icon.png` (provide a 512×512 PNG) to generate all required icon sizes before `tauri:build`.
  - **Files changed**: `src-tauri/` (new), `src/platform/fileSystem.ts` (new), `vite.config.ts`, `package.json`, `src/App.tsx`, `src/components/TopBar.tsx`, `.gitignore`, `agents.md`.
  - **Tests**: 382 passing (no domain changes).

### 2026-05-20 — Claude Code (claude-sonnet-4-6) — session 183
- **Critical bug fix + comprehensive HelpGuide.**
  1. **Auto-height key bug fixed (`GraphCanvas.tsx`)**: The `autoHeightKeyRef` guard used `data.nodes.map(n => n.id).join(",")` as its key. Every time the user added a node, the key changed, the effect fired, found the new (default-sized) node as an underestimate, and called `onLayoutNodes()` — nuking all manual node placement. Fixed the key to `data.sceneTitle`. The effect now triggers only once per scene navigation, exactly as intended.
  2. **`HelpGuide.tsx` created** — full 6-tab comprehensive guide modal:
     - **Canvas**: navigation, adding nodes, connecting, selection, filtering, layout/resize
     - **Node Types**: all 24 node types with live `NodeIcon` + color tint from `typeColors`, plus plain-English descriptions
     - **Inspector**: Content/Logic/Raw tab breakdown, node status values, color tags, notes
     - **Project**: scenes, variables, achievements, assets, search & replace, dashboard/stats
     - **Import/Export**: .json/.txt/.zip/Folder import, source preservation, export zip, linter
     - **Shortcuts**: full shortcut reference (reuses the groups from the old `KeyboardShortcutOverlay`)
  3. **`TopBar.tsx`**: Added `onHelp: () => void` prop. Added a circular `?` button after the Play button in `top-actions`.
  4. **`App.tsx`**: Replaced `shortcutsOpen`/`KeyboardShortcutOverlay` with `helpOpen`/`HelpGuide`. The `?` key shortcut and CommandPalette `shortcuts` command now open `HelpGuide`.
  5. **`styles.css`**: Added `.hg-*` CSS for backdrop, modal, tabs, section rows, node grid, shortcut grid, and the help button.
  - **Files changed**: `GraphCanvas.tsx`, `HelpGuide.tsx` (new), `TopBar.tsx`, `App.tsx`, `styles.css`, `agents.md`.
  - **Tests**: 382 passing (no domain changes).

### 2026-05-19 — Claude Code (claude-sonnet-4-6) — session 182
- **Four improvements: code generator fix, auto-height layout, resizable nodes.**
  1. **Code generator bug fixed (`choicescript.ts` line 27)**: `gosub_scene` nodes store their entry label in `node.body`. The body exclusion list in `generateNodeChoiceScript` didn't include `gosub_scene`, so the entry label was accidentally emitted as prose text before the `*gosub_scene` command. Added `node.type !== "gosub_scene"` to the exclusion guard. Fix is 1 character change; all 382 tests still pass.
  2. **Auto-height re-layout after initial render (`GraphCanvas.tsx`)**: Added a `useEffect` + `requestAnimationFrame` that fires once per unique node-ID set. After the DOM settles it measures real `offsetHeight` for all rendered nodes; if any exceeds `nodeHeightEstimate` by more than 10px it calls `onLayoutNodes(heights)` with the measured values, eliminating the underestimation overlap that survived the collision-resolution pass. Guarded by `autoHeightKeyRef` to prevent infinite re-layout loops.
  3. **Resizable nodes** (`NodeCard.tsx`, `GraphCanvas.tsx`, `App.tsx`, `styles.css`):
     - `NodeCard.tsx`: Added `overrideWidth?: number` prop (used for live preview during drag) and `onResizeStart?: (event, id) => void` prop. A `.node-resize` handle div renders at the right edge when `onResizeStart` is provided.
     - `GraphCanvas.tsx`: Added `resize` state (`{nodeId, startX, startW, currentW}`). During pointermove the `currentW` is updated locally (no store writes, no linting). On pointerup, `onResizeNode(id, finalW)` commits the single width update. Canvas cursor becomes `col-resize` during resize drag. `onResizeStart` is disabled when `sourcePreserved` is true.
     - `App.tsx`: `onResizeNode={(id, w) => actions.updateNode(id, { w })}` wired in.
     - `styles.css`: `.node-resize` handle (6px wide, col-resize cursor, visible on hover/selected, accent tint on hover).
  4. **Importer**: Reviewed thoroughly. The importer is solid — `parseChoiceBlock`, `parseInlineChoiceBlock`, `parseFakeChoiceBlock`, and `buildBodyNodeChain` handle all common patterns. No structural bugs found that warrant changes; improvements to `selectable_if` handling and nested structures would be API-incompatible or add marginal value.
  - **Files changed**: `choicescript.ts`, `GraphCanvas.tsx`, `NodeCard.tsx`, `App.tsx`, `styles.css`, `agents.md`.
  - **Tests**: 382 passing (no new tests needed — changes are UI/UX and a UI-visible code-gen correction).

### 2026-05-19 — Claude Code (claude-sonnet-4-6) — session 181
- **Fix residual node overlap in auto-layout (`graphLayout.ts`).**
  - Root cause 1: Barycenter calculation used predecessor top-Y instead of vertical centre (Y + height/2). Nodes were biased upward and edges came out at odd angles.
  - Root cause 2: No post-placement collision resolution — if `estimateLayoutNodeHeight` underestimates the actual rendered height, nodes in the same column would visually overlap.
  - Fix 1: Changed `predYs` → `predCentres` using `pos.y + heightOf(predNode) / 2`. Edges now flow more horizontally.
  - Fix 2: Added a second pass over each column (sorted by Y) that pushes any node overlapping its predecessor down by the required shift, cascading through the rest of the column.
  - **Files changed**: `graphLayout.ts`, `agents.md`.
  - **Tests**: 382 passing (no change — layout is pure domain logic but existing tests still cover it).

### 2026-05-19 — Claude Code (claude-sonnet-4-6) — session 180
- **Achieved 100% lint key test coverage (342 → 382 tests, 40 new).**
  - Fixed two failing tests from session 179: `gosub_invalid_id` and `goto_invalid_id` were using `"noexist"` (a valid identifier) — these keys fire for syntactically invalid identifiers, not missing labels. Fixed to use `"123bad"` (starts with digit, fails the identifier regex).
  - Added 38 new tests covering every previously untested lint key:
    - **if-branch**: `if_branch_after_else`, `if_branch_missing_target`, `if_branch_self_loop`
    - **gosub/gosub_scene**: `gosub_no_flow`, `gosub_scene_no_flow`, `gosub_scene_entry_missing`
    - **image/sound**: `image_no_filename`, `image_unknown`, `sound_no_filename`, `sound_unsupported_ext`, `sound_unknown`
    - **label/return**: `return_no_gosub`, `label_invalid_id`, `label_no_name`, `label_collision`
    - **temp/params/variables**: `name_reserved`, `temp_repeat`, `duplicate_params`
    - **input**: `input_no_target`, `input_invalid_id`, `input_needs_number`, `input_invalid_min`, `input_invalid_max`, `input_empty_min`, `input_empty_max`
    - **set/scene**: `set_fairmath_nopercent`, `scene_unreachable`
    - **stat_chart**: `stat_chart_invalid_type`, `stat_chart_invalid_var`, `stat_undef_var`, `stat_chart_needs_number`, `stat_chart_nonpercent`, `stat_chart_raw_number`
    - **assets**: `asset_empty_path`, `asset_unsafe_path`, `asset_path_conflict`, `asset_data_issue`, `duplicate_asset_id`, `duplicate_asset_path`, `duplicate_exported_asset`
  - Key design notes: `label_no_name` and `input_empty_min`/`input_empty_max` are source-text-only paths (use `SceneGraph.sourceText`). `label_collision` is triggered by a label using a `cf_*` generated name. `gosub_no_flow` uses a gosub title referencing a generated label (`cf_n2`) so the label check passes.
  - `comm -23` diff of emitted keys vs tested keys now produces empty output — full coverage.
  - **Files changed**: `domain.test.ts`, `agents.md`.
  - **Tests**: 382 passing (40 new, 2 fixed).

### 2026-05-18 — Claude Code (claude-sonnet-4-6) — session 179
- **Additional key-coverage tests for graph-node validators (14 new tests).**
  - Added tests for: `page_break_no_label`, `checkpoint_no_name`, `goto_scene_no_target`, `goto_scene_invalid_id`, `gosub_scene_no_target`, `gosub_scene_invalid_id`, `temp_invalid_id`, `temp_no_initial`, `orphan_node`, `dead_end`, `duplicate_option_text`, `params_no_names`, `params_invalid_id`, `if_noop`.
  - Caught a subtle logic constraint: `if_noop` only fires when there is NO `*else` branch (a no-op occurs when all explicit branches land on the flow target and the fallthrough also does). With an `*else` branch, `if_all_same_target` covers the redundant case instead.
  - **Files changed**: `domain.test.ts`.
  - **Tests**: 325 passing (14 new).

### 2026-05-18 — Claude Code (claude-sonnet-4-6) — session 178
- **Bug fixes discovered while adding tests: regex cross-line boundary bug + cond_empty param mismatch.**
  - **`extractAchievementCommandTargets` regex bug**: `/^\s*\*achieve(?:\s+(.+?))?\s*$/gim` used `\s+` which matches newlines. For body text like `"*achieve\n*achieve bad-id"`, the regex would match the two-line string as a single `*achieve bad-id` call, silently dropping the empty-argument `*achieve`. Fixed to `/^[ \t]*\*achieve(?:[ \t]+(\S[^\n]*?))?[ \t]*$/gim` (horizontal whitespace only). Same bug in `stripAchieveCommands` — same fix applied.
  - **`cond_empty` param key mismatch**: Graph-node `lintCondition` emitted `params: { kind: condition.type }` but the `lintMessages.ts` template uses `{command}` not `{kind}`. Fixed to `params: { command: condition.type }`.
  - **Added 6 tests**: `cond_empty` from graph-node lintCondition (verifies `command` param), `set_no_target/invalid_id/empty_value/invalid_op`, `input_bounds_order`, `input_text_needs_string`, `achieve_no_id/achieve_invalid_id`.
  - **Files changed**: `choicescript.ts`, `domain.test.ts`.
  - **Tests**: 311 passing (6 new, 2 bug fixes).

### 2026-05-18 — Claude Code (claude-sonnet-4-6) — session 177
- **Test coverage for new lint keys (startup/condition validators).**
  - Added 21 new tests covering all keys introduced in session 176: `startup_empty_title`, `startup_empty_author`, `startup_needs_scene_list`, `scene_list_invalid_id`, `scene_list_repeat`, `scene_list_missing_scene`, `scene_list_omits_scene`, `startup_omits_var`, `startup_omits_ach`, `create_invalid_id`, `create_reserved`, `create_empty_value`, `create_repeat`, `create_extra_var`, `ach_src_invalid_id`, `ach_invalid_vis`, `ach_invalid_points_src`, `ach_src_empty_title`, `ach_src_repeat`, `ach_src_extra`, `cond_empty`.
  - Each test verifies that the `key` field and relevant `params` entries are correctly emitted.
  - **Files changed**: `domain.test.ts`.
  - Also added `create_invalid_value` test (boolean type mismatch, verifies name/type/value params).
  - Added 10 more tests for schema/graph-node validator keys: `var_empty_name`, `var_invalid_id`, `var_empty_initial`, `var_invalid_initial`, `ach_empty_id`, `ach_invalid_id`, `ach_empty_title`, `ach_empty_locked_desc`, `ach_empty_unlocked_desc`, `ach_invalid_points`, `scene_empty_name`, `scene_invalid_id`, `duplicate_scene_name`, `duplicate_var_name`, `duplicate_ach_id`, `set_no_assignments`, `choice_single_option`, `option_missing_target`, `label_node_empty`, `goto_no_target`, `if_branch_no_cond`.
  - **Tests**: 305 passing (32 new total).

### 2026-05-18 — Claude Code (claude-sonnet-4-6) — session 176
- **Completed full lint message localization pass (second batch).**
  - Audited all remaining un-keyed `issues.push` calls in `choicescript.ts`. Added `key` + `params` to ~75 additional messages across: graph-node validators (`set_no_assignments`, `if_noop`, `goto_scene_*`, `gosub_scene_*`, `image_*`, `sound_*`, `goto_*`, `gosub_*`, `return_no_gosub`, `page_break_no_label`, `checkpoint_no_name`, `temp_*`, `params_*`, `achieve_*`), schema validators (scene, variable, achievement, asset), preserved-source validators (`temp_*`, `params_*`, `set_*`, `input_*`, `label_*`, `jump_*`), node structure validators (`label_node_empty`, `label_collision`, `choice_*`, `option_*`, `if_*`), condition validator (`cond_empty`), and startup.txt validators (`startup_empty_title`, `startup_empty_author`, `scene_list_*`, `startup_needs_scene_list`, `startup_omits_*`, `create_*`, `ach_src_*`, `ach_invalid_vis`, `ach_invalid_points_src`).
  - Added PT/ES translations for all new keys in `lintMessages.ts` (from 29 keys to 141 keys).
  - Remaining un-keyed messages are internal graph-integrity assertions (`edge starts from missing node`, `edge points to missing node`, `node has empty id`, `duplicate node id`) that are impossible in normal usage.
  - **Files changed**: `choicescript.ts`, `lintMessages.ts`.
  - **Tests**: 273 passing (no new tests).

### 2026-05-18 — Claude Code (claude-sonnet-4-6) — session 175
- **Lint localization coverage, import confirmation, and parser edge-case verification.**
  - **Lint localization**: audited all `key:` usage in `choicescript.ts`. 12 messages lacked a `key` (and thus were always English): duplicate scene/variable/achievement/asset names, duplicate exported asset paths, `*params` duplicate parameter, duplicate choice option text, all `*stat_chart` error/warning messages. Added `key` + `params` to each and added PT/ES translations in `lintMessages.ts`.
  - **Import confirmation**: `importChoiceForgeProject` in `App.tsx` replaced full projects without any warning. Added `confirmReplaceProject(project, lang)` helper: skips confirm for trivially empty projects (`nodes ≤ 1 && no variables && no achievements`), shows a localized `window.confirm` otherwise. Wired into all 4 full-replacement branches (`.zip` with project.json, `.zip` ChoiceScript archive, `.json`, multi-file). Single-scene `.txt` import is a merge, so no confirm needed.
  - **Parser verification (items 4 & 5)**: wrote 4 new tests covering: `*gosub` inside choice option body, `*label` inside choice option body, `*if` block containing a nested `*choice`, `*if` block with `*goto_scene` terminals in branches. All 4 pass, confirming the parser handles these patterns via `buildBodyNodeChain` + `BODY_STRUCTURED_COMMANDS`.
  - **Files changed**: `choicescript.ts`, `lintMessages.ts`, `App.tsx`, `domain.test.ts`.
  - **Tests**: 273 passing (4 new).

### 2026-05-18 — Claude Code (claude-sonnet-4-6) — session 174
- **Canvas quality improvements: edge midpoints, fit-view bounds, SVG overflow, auto-fit after layout.**
  - **Edge midpoints**: `estimateNodeHeight` in `GraphCanvas.tsx` used flat 40 px for prompt and wrong 90/56 body (body is always 2-line clamped). Refactored into `nodeHeightEstimate(node, density)` helper with the same proportional prompt formula as `graphLayout.ts` and correct `node-wc` (~24 px only for `passage` + rich). `estimateNodeHeight` becomes a thin wrapper.
  - **Fit-view bounds**: `fitNodesToViewport` used `const nodeH = density === "minimal" ? 44 : 120` — fixed 120 px for all non-minimal nodes, cutting off tall choice/if nodes. Now calls `nodeHeightEstimate(n, density)` per node for an accurate bounding box.
  - **SVG overflow**: edges SVG was a fixed `3000×2000` canvas — any node outside that area had invisible arrows. Now dynamically sized to `max(3000, maxNodeX + 300) × max(2000, maxNodeH + 300)`.
  - **Auto-fit after layout**: clicking "Auto Layout" now auto-fits the viewport after the store state propagates. Uses a `pendingFitRef` that is set in the button handler and consumed in a `useEffect` that watches `data.nodes`.
  - **Files changed**: `GraphCanvas.tsx`.
  - **Tests**: 269 passing.

### 2026-05-18 — Claude Code (claude-sonnet-4-6) — session 173
- **Fix prompt height underestimation (root cause of remaining overlap after import).**
  - **Root cause**: `estimateLayoutNodeHeight` used a flat 40 px for any prompt. But `.node-prompt` has `white-space: pre-wrap` at 13 px / 1.5 line-height — a 4-line prompt actually renders at ~90 px. With `verticalGap = 100`, two such nodes in the same column could easily overlap.
  - **Fix**: proportional calculation: count explicit `\n` line breaks in `node.prompt`, then estimate wrapping at `(node.w - 24) / 7` chars/line. Result: `12 + lineCount × 20` px.
  - **Files changed**: `graphLayout.ts`.
  - **Tests**: 269 passing.

### 2026-05-18 — Claude Code (claude-sonnet-4-6) — session 172
- **DOM-measured layout + fix indented command import.**
  - **Layout: DOM measurement on manual re-layout.**
    - Root cause of persistent overlap: pure-TypeScript height estimation (without DOM access) is inherently imprecise. After every formula tweak, some node type still rendered taller than estimated.
    - Fix: when the user clicks "Auto Layout", GraphCanvas now reads actual `offsetHeight` from each rendered `.node[data-node-id]` element before calling the layout function. These measured heights are passed through `onLayoutNodes(nodeHeights)` → store `layoutNodes(nodeHeights)` → `layoutSceneGraph(graph, nodeHeights)` → `layoutStoryNodes(nodes, edges, nodeHeights)`. Inside `layoutStoryNodes`, a `heightOf(node)` helper uses the measured value when available, falling back to `estimateLayoutNodeHeight` for nodes not yet rendered (import auto-layout).
    - `data-node-id` attribute added to NodeCard outer div to make each node queryable.
    - No visual changes. The first auto-layout after import still uses estimates; subsequent manual re-layouts use exact DOM heights.
  - **Import: fix indented top-level commands being silently dropped.**
    - Root cause: `createImportedSceneGraph` main loop had `if (!command || /^\s+\S/.test(line))` — the regex matched ANY line with leading whitespace, including indented commands like `  *input_text myvar`. These were pushed to `pending` as prose text instead of being parsed.
    - Fix: removed the `/^\s+\S/.test(line)` condition. Safe because by the time the main loop sees a line, all block parsers (`collectIndentedBlock`, `collectIfChain`) have already consumed and advanced `index` past their indented body lines. Any remaining indented line is legitimately at the outer scope.
    - `*input_text`, `*input_number`, `*rand`, `*goto`, `*label`, etc. now parsed correctly even with leading spaces.
  - **Files changed**: `graphLayout.ts`, `projectStore.ts`, `NodeCard.tsx`, `GraphCanvas.tsx`, `choicescriptImport.ts`.
  - **Tests**: 269 passing.

### 2026-05-18 — Claude Code (claude-sonnet-4-6) — session 171
- **Fix option/fakeOption height: account for rich-density extras (opt.body, opt.cond, reuse tag).**
  - **Root cause**: default density is "rich" (`useState<Density>("rich")`). In rich mode, each option/fakeOption row shows extra elements not in the height estimator: `opt-body` (~20px/opt when body exists), `cond-badge` (~26px/opt when condition), reuse tag (~16px/opt). For a fake_choice with 12 options all having body text, that's 240px unaccounted — more than the 100px vertical gap → overlap.
  - **Secondary bug**: `estimateNodeHeight` in GraphCanvas.tsx had no `fakeOptions` handling at all (always 0 for fake_choice nodes), causing wrong edge midpoints and fit-view behavior.
  - **Fix in graphLayout.ts**: per-option loop now adds `opt.cond` (+26px), `opt.reuse/hideReuse` (+16px), `opt.body` (+20px) for both options and fakeOptions.
  - **Fix in GraphCanvas.tsx**: rewrote `estimateNodeHeight` with full per-option calculation matching the layout estimator, density-aware, including fakeOptions.
  - **Files changed**: `graphLayout.ts`, `GraphCanvas.tsx`.
  - **Tests**: 269 passing.

### 2026-05-18 — Claude Code (claude-sonnet-4-6) — session 170
- **Fix root cause of visual overlap: column y-centering around predecessor positions.**
  - **Root cause identified**: every column started placing nodes at `y = startY = 70` regardless of where predecessors were. A node at y=800 in column 5 had its successor placed at y=70 in column 6 → edge goes sharply upward, crossing everything. This looked like "overlap" and created masses of crossing arrows.
  - **Fix**: After computing barycenters, compute the total height of all nodes in the column, then start the column at `max(startY, round(meanBc - totalColHeight/2))` so the column is vertically centered around its predecessors' mean y. For a linear chain every node stays near y=70 as before. For a branched column (e.g. merge node with predecessors spread from y=70 to y=800), the column centers at y≈435 instead of y=70.
  - **Files changed**: `graphLayout.ts` (centering logic in position assignment loop).
  - **Tests**: 269 passing.

### 2026-05-18 — Claude Code (claude-sonnet-4-6) — session 169
- **Recalibrate height estimation from actual NodeCard CSS.**
  - Read `NodeCard.tsx` + `styles.css` and discovered:
    1. `.narrative-clip` uses `-webkit-line-clamp: 2` — body always renders as exactly 2 lines (~56px with padding), not proportional to body length. Previous proportional formula massively overestimated long bodies.
    2. `.opt` / `.opts` item height depends on `opt.text` wrapping: old `38px flat` assumed 1 line; option texts can be 30–100 chars wrapping to 2–3 lines at `font-size:12px` in the option's inner width.
  - New formula: body fixed at 56px; options iterate per-item with `15 + ceil(text.length / optCharsPerLine) * 16px`; overall ×1.15 safety margin.
  - **Files changed**: `graphLayout.ts` (`estimateLayoutNodeHeight` rewrite).
  - **Tests**: 269 passing.

### 2026-05-18 — Claude Code (claude-sonnet-4-6) — session 168
- **Fix node overlap and edge crossings in horizontal layout.**
  - **Overlap root cause**: `estimateLayoutNodeHeight` used a fixed 90px for `node.body` regardless of content length. Long narrative passages (200–1000 chars) render 200–500px tall, so nodes in the same column were placed on top of each other. Fix: body height is now proportional — `ceil(body.length / charsPerLine) * 18`, min 60px.
  - **Crossing root cause**: nodes within each column were sorted by their pre-layout `node.y` value (all 0 for fresh imports), so ordering was arbitrary. Fix: barycenter sort — each column's nodes are ordered by the mean Y of their already-placed predecessors. Standard graph-drawing heuristic for crossing minimisation.
  - Also added `predecessors` map (tracking which nodes point TO each node) alongside the existing `outgoing` / `incoming` maps. `verticalGap` bumped from 90 → 100.
  - **Files changed**: `graphLayout.ts` (predecessors map, barycenter sort, proportional body height).
  - **Tests**: 269 passing.

### 2026-05-18 — Claude Code (claude-sonnet-4-6) — session 167
- **Revert to always-horizontal layout — user prefers wide over tall.**
  - User explicitly rejected comic-strip/vertical approaches. Horizontal layout (depth = columns, left→right) is the priority even for 200-node linear chains. Wide canvas is acceptable; vertical is not.
  - Removed all `isDeep` / `COMIC_COLS` / grid-wrap branching from `layoutStoryNodes`. Now always uses the single horizontal layout for all scene sizes.
  - **Files changed**: `graphLayout.ts` (removed comic-strip block, layout is always horizontal).
  - **Tests**: 269 passing.

### 2026-05-18 — Claude Code (claude-sonnet-4-6) — session 166
- **Comic-strip layout for deep imported scenes (replaces vertical-only layout).**
  - **Problem**: Single-column vertical layout for 200-node linear files is "muito confuso, nada intuitivo" — 100,000px tall, one node wide.
  - **Fix**: For scenes with > 8 depth levels (`isDeep`), switched to **comic-strip layout**: nodes laid out left→right across `COMIC_COLS=5` columns, then wrapping down to the next row. Row heights use `max(300, cellHeight × 1.5) + 80` to absorb estimation inaccuracy between rows. For ≤ 8 depth levels, the existing horizontal layout is unchanged.
  - **Result for chap1.txt**: 200 nodes fill ~5 columns × 40 rows ≈ 2,700px wide × ~25,000px tall — much more readable than the single column.
  - **Files changed**: `graphLayout.ts` (replaced vertical layout with comic-strip in `layoutStoryNodes`).
  - **Tests**: 269 passing.

### 2026-05-18 — Claude Code (claude-sonnet-4-6) — session 165
- **Replace grid-wrap with top-to-bottom layout for deep scenes.**
  - **Problem**: The previous grid wrap (8 cols × N rows) caused node overlap because `estimateLayoutNodeHeight` underestimates tall fakeOptions nodes. The grid strategy required cross-row height comparison, which amplified estimation error.
  - **New approach**: When depth levels > 8 (`isDeep`), switch to a **vertical layout** where depth becomes the row axis (top→bottom) rather than the column axis (left→right). Nodes at the same depth spread horizontally within their row (for branching), and for linear chains (1 node per depth) it produces a clean single column. Row spacing = `rowHeight × 1.5 + verticalGap` to absorb estimation inaccuracy.
  - **Result for chap1.txt**: 200 nodes in a single vertical column, flowing top to bottom like reading the story. Width ≈ 380px, height ≈ 100,000px (navigable via minimap).
  - **Files changed**: `graphLayout.ts` (replaced grid-wrap logic with vertical layout).
  - **Tests**: 269 passing.

### 2026-05-18 — Claude Code (claude-sonnet-4-6) — session 164
- **Wrap layout for linear imported scenes (layout fix for chap1.txt-style files).**
  - **Problem**: chap1.txt (4722 lines, 60+ `*fake_choice` blocks) produces a linear chain of 200+ nodes via flow edges. The layout algorithm assigns each node its own depth column → 200 columns → canvas 100,000px wide. Completely unusable.
  - **Analysis**: `canAutoFlow(fake_choice) = true`, so every fake_choice → next-passage flow edge is created. The depth BFS correctly assigns depth 0,1,2,...,N-1 to a linear chain. But N columns at 530px each = enormous width.
  - **Fix**: Added wrapping to `layoutStoryNodes`. When `orderedColumns.length > WRAP_COLS` (8), columns are placed in a grid: 8 per row, rows stacked vertically with a 200px gap. Column X-positions are computed from the max width of all columns sharing the same grid column index. Row Y-starts are computed from the max height of the previous row's columns. For branching projects (depth ≤ 8), behavior is unchanged.
  - **Files changed**: `graphLayout.ts` (new shouldWrap logic in layoutStoryNodes).
  - **Tests**: 269 passing, build clean.

### 2026-05-18 — Claude Code (claude-sonnet-4-6) — session 163
- **Fix lintProject freezing the main thread on 213KB sourceText files.**
  - **Root cause 1 (primary)**: `lintProject` runs via `useMemo` on every state change. It does 4+ separate `.split(/\r?\n/).forEach(...)` passes over every scene's `sourceText`. A 213KB file = ~6000 lines being scanned by regex multiple times on every keystroke or UI interaction.
  - **Fix**: Added `LARGE_SOURCE_LINT_LIMIT = 40_000` (40KB) constant. All line-by-line sourceText scans in `lintUnusedVariables`, `lintCheckpoints`, and `lintSceneReachability` are skipped if `sourceText.length > limit`. The `lintPreservedScriptSource` call is also skipped (replaces with a single info issue: "scene too large to lint in-browser").
  - **Root cause 2**: `saveProjectSnapshot` has no try-catch; a `QuotaExceededError` from a large project would crash unhandled. Also, large sourceTexts (>30KB) included in `JSON.stringify` make localStorage writes very slow.
  - **Fix**: Added `stripLargeSourceTexts` to remove sourceTexts > 30KB before serializing to localStorage. Wrapped `localStorage.setItem` in try-catch.
  - **Files changed**: `choicescript.ts` (LARGE_SOURCE_LINT_LIMIT constant + 4 guards), `projectStore.ts` (stripLargeSourceTexts + try-catch in saveProjectSnapshot).
  - **Tests**: 269 passing, build clean.

### 2026-05-18 — Claude Code (claude-sonnet-4-6) — session 162
- **Fix large scene white screen: never auto-parse sourceText scenes on navigation.**
  - **Root cause**: The Worker was being spawned on every navigation to a sourceText (imported) scene, even though the text editor view (`GeneratedDocumentView`) was already shown for those scenes — no graph parse needed. A 213KB file was OOM-crashing the tab even in the Worker.
  - **Architectural fix**: sourceText scenes are NEVER parsed automatically. Navigation is instant — the text view is shown immediately from raw `sourceText`. Parsing only happens when the user explicitly clicks "Convert to visual editing", and only then via the Worker (so the main thread stays responsive even for large files).
  - **Changes**:
    - `selectScene`: plain navigation, no parse triggered
    - `convertCurrentSceneToVisual`: uses Worker when scene has unparsed sourceText; clears sourceText after Worker resolves
    - `GeneratedDocumentView`: new `isConverting` prop shows "Converting…" on the button while Worker runs
    - `App.tsx`: `useEffect` closes text view when conversion completes; `isConvertingScene` passed to both views
    - `GraphCanvas`: overlay shows "Converting scene…" (replaces "Loading scene…")
  - **Tests**: 269 passing, build clean.

### 2026-05-18 — Claude Code (claude-sonnet-4-6) — session 161
- **Move lazy scene parse to Web Worker (real fix for white screen / freeze).**
  - **Problem**: `setTimeout(0)` didn't help — the browser still can't paint before a sync multi-second parse blocks the main thread. The only real fix is a Worker.
  - **Fix**: Created `src/workers/sceneParser.ts`. When `isParsingScene` is true, a Worker is spawned, does `importChoiceScriptSceneText` + `layoutSceneGraph` on a background thread, then posts the result back. The main thread is free throughout, the loading spinner stays visible, and the canvas populates when the worker responds. Worker is terminated after use.
  - **Files changed**: `src/workers/sceneParser.ts` (new), `projectStore.ts` (replaced setTimeout with Worker in `isParsingScene` effect).
  - **Tests**: 269 passing, build clean (Vite bundles worker as separate chunk).

### 2026-05-18 — Claude Code (claude-sonnet-4-6) — session 160
- **Show loading spinner while large scenes parse (two-phase lazy load).**
  - **Problem**: The lazy scene parse (`createImportedSceneGraph` + `layoutSceneGraph`) runs synchronously on the JS main thread. Clicking a large scene froze the browser for several seconds with a blank/white canvas — no indication it was loading.
  - **Fix**: Split `selectScene` into two React renders. Phase 1: navigate immediately to the scene with empty nodes (canvas is visible but empty). Phase 2: after the next event-loop tick (`setTimeout(0)`), run the actual parse and update state. A `useEffect` in the store triggers the deferred parse when `isParsingScene` is true. A visual overlay (spinner + "Loading scene…" text) is shown on the canvas during parsing. The overlay uses `pointer-events: none` so it doesn't block interaction.
  - **Files changed**: `projectStore.ts` (added `isParsingScene` state + deferred-parse `useEffect` + modified `selectScene`), `GraphCanvas.tsx` (new `isParsingScene` prop + overlay JSX), `App.tsx` (pass `isParsingScene` to GraphCanvas), `styles.css` (new `.canvas-parse-overlay` + `.canvas-parse-spinner` + `@keyframes spin`).
  - **Tests**: 269 passing, build clean.

### 2026-05-18 — Claude Code (claude-sonnet-4-6) — session 159
- **Fix CSS specificity bug making tag-filter color dots invisible.**
  - **Root cause**: `.zoom-controls button` (specificity 0,1,1) overrode `.zoom-color-dot` (0,1,0), setting `background: transparent` on the dots and wiping out `background: var(--ct)`. No color was visible at any zoom/opacity/scale.
  - **Fix**: Changed `.zoom-controls button` selector to `.zoom-controls button:not(.zoom-color-dot)` (and same for hover state). This exempts dots from the reset and lets their own rule apply.
  - **Files changed**: `styles.css` (lines 1330-1334).
- **Viewport culling for large scenes (performance fix).**
  - **Problem**: `GraphCanvas.tsx` rendered `NodeCard` for every node in the scene, even those far off-screen. A scene with 1000+ nodes rendered 1000+ React components on every frame, freezing the browser.
  - **Fix**: Added inline viewport culling filter before the `NodeCard` map. Nodes outside viewport + 350px buffer are skipped. During active drag or selection-box operations, culling is disabled to avoid nodes popping in/out during move.
  - **Files changed**: `GraphCanvas.tsx` (1 line change at the `data.nodes.map` call, line 510).
- **Lazy scene parsing on navigation (import performance fix).**
  - **Problem**: `importChoiceScriptArchive` called `createImportedSceneGraph` for all N scenes, even though only the first scene was displayed. Large projects with many or large scenes were slow/frozen during import.
  - **Fix**: Import now only calls `createImportedSceneGraph` for the active (first) scene. All other scenes are stored as `{ nodes: [], edges: [], sourceText }` — a shell with the raw text preserved. When the user navigates to a scene (`selectScene`), it detects the empty-but-sourced shell and parses+lays out that scene on demand. Word counts and scene list still work because they use `sourceText`.
  - **Files changed**: `choicescriptImport.ts` (importChoiceScriptArchive eager parse → active-only), `projectStore.ts` (selectScene adds lazy parse branch).
  - **Tests**: 269 passing, build clean.

### 2026-05-18 — Claude Code (claude-sonnet-4-6) — session 158
- **Tag-filter dots: replace opacity with scale-transform; add "tag" label.**
  - **Problem**: At 0.55 opacity, small 12px circles vanish visually — the user saw a single gray blob in the toolbar. Using opacity to indicate "inactive" is a bad approach for small colored elements.
  - **Fix**: Removed opacity entirely. Dots are now 14px at full color, with `transform: scale(0.78)` for the inactive state (visually smaller but fully colored). Hover and active states restore `scale(1)`. Added a `"tag"` text label (9px, muted) before the dots to clarify their purpose. CSS class `.zoom-tag-label` added.
  - **Files changed**: `GraphCanvas.tsx` (added `<span className="zoom-tag-label">tag</span>`), `styles.css` (new `.zoom-tag-label` rule, replaced opacity approach with scale transform on `.zoom-color-dot`).
- **Lazy layout for non-active imported scenes (major import performance fix).**
  - **Problem**: `layoutProjectGraphs` laid out ALL scenes during import, including non-active scenes. A 20-scene CS project → 20 calls to `layoutStoryNodes`. For large projects this still froze the browser (even after the Math.max spread fix) because the total node count across all scenes could be enormous.
  - **Fix**: In the `layoutProjectGraphs` forEach, added `scene.name !== project.sceneTitle || !graph.sourceText` condition so non-active scenes with `sourceText` (all imported CS scenes) are skipped. Only the active scene is laid out immediately. Other scenes keep their raw grid coordinates (acceptable since they display in preserved/read-only mode). Visual ChoiceForge projects (no sourceText) are unaffected.
  - **Files changed**: `graphLayout.ts` (1 condition added in forEach).
  - **Tests**: 269 passing, build clean.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 157
- **Fix remaining Math.max/min spread crashes for large scenes (follow-up to session 156).**
  - **Root cause discovered**: The graphLayout.ts fix was necessary but not sufficient. 9 additional `Math.max/min(...largeArray.map(...))` spread calls existed across `GraphCanvas.tsx` and `projectStore.ts`. The minimap one ran on EVERY render, meaning even after a successful import the canvas would crash immediately when displaying any large scene.
  - **GraphCanvas.tsx** — fixed 4 groups: `fitNodesToViewport` (lines 901-904), minimap rendering (lines 985-988, critical — runs every render), and all 6 selection-alignment functions (alignLeft/Right/Center, alignTop/Middle/Bottom). Each replaced with `for...of` loops or `.reduce()`.
  - **projectStore.ts** — fixed paste-node bounding box (lines 424-427).
  - **styles.css** — increased default `.zoom-color-dot` opacity from 0.35 to 0.55 so filter dots are visible before hover/selection (addresses user feedback that dots were unclear when not active).
  - **Files changed**: `GraphCanvas.tsx`, `projectStore.ts`, `styles.css`.
  - **Tests**: 269 passing, no regressions. Build clean.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 156
- **Fix `RangeError: Invalid array length` crash when importing large scenes.**
  - **Root cause**: `graphLayout.ts` line 60 used `Math.max(0, ...depth.values())` and line 85 used `Math.max(...sortedNodes.map(n => n.w), 260)`. Both spread large arrays/iterators as function arguments. JavaScript's call stack limit (~65K arguments) causes `RangeError` when a scene has thousands of nodes — which occurs when importing many/large ChoiceScript files or editing a large scene in text mode (which re-runs layout on save).
  - **Fix**: Replaced spread-based `Math.max` with safe iterative alternatives: `forEach`-based loop for `maxDepth` and `reduce` for `maxWidth`. Neither has argument-count limits.
  - **Files changed**: `graphLayout.ts` (2 lines).
- **Clarify color-tag filter buttons in the canvas toolbar.**
  - **Problem**: Six 12px colored dots at 35% opacity near the bottom-left toolbar. When clicked, they dim all nodes that don't match the tag. The `title` said "Filter by red tag" — not clear that they HIDE other nodes or how to turn the filter off.
  - **Fix**: Updated tooltip text to "Show only [color]-tagged nodes (dims others)" / "Filtering by [color] tag — click to remove this filter". Added a `×` clear button (`.zoom-color-clear`) that appears only when any tag filter is active, giving an obvious dismiss target. Updated `is-active` CSS to include a colored box-shadow glow so active dots are clearly distinct from inactive.
  - **Files changed**: `GraphCanvas.tsx` (title + clear button), `styles.css` (active glow + new `.zoom-color-clear`).
- **Tests**: 269 passing, no regressions. Build clean.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 155
- **Add i18n keys to 5 high-visibility lint messages (both graph and preserved-source linters).**
  - `unused_var`: `variable "${name}" is declared but never read` (line 366 — hidden global variable warning).
  - `passage_too_long`: `passage "${name}" is very long (${wc} words)` — includes a second `wc` param for the word count.
  - `gosub_scene_no_return`: `*gosub_scene calls scene "${name}" which has no *return` — both graph node (line 716) and preserved source (line 1006) paths.
  - `unreferenced_label`: `*label "${name}" is never referenced by any *goto or *gosub` — both graph node (line 860) and preserved source (line 1121) paths.
  - `gosub_no_return`: `scene "${name}" has *gosub nodes but no *return node` (line 865).
  - Added Portuguese and Spanish translations for all 5 keys in `lintMessages.ts`. `passage_too_long` uses both `{name}` and `{wc}` template params; `translateLintMsg` already supports multi-param objects.
  - **Files changed**: `choicescript.ts` (7 `issues.push` calls updated), `lintMessages.ts` (5 new entries), `domain.test.ts` (7 new tests).
  - **Tests**: 269 passing (was 262), no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 154
- **Guard `inputMin`/`inputMax` variable scanning to rand/input_number node types only.**
  - **Problem**: Session 153 added `inputMin`/`inputMax` scanning to four variable-tracking functions. However, `image` nodes reuse `inputMin` for alignment text (`"left"`, `"right"`, `"none"`). Since `"left"` passes `isValidChoiceScriptIdentifier`, a variable named `left` would be falsely counted as used via the image alignment field.
  - **Fix**: Added `node.type === "rand" || node.type === "input_number"` type guard to all four `inputMin`/`inputMax` scanning sites, so alignment text from `image` nodes is never scanned as a variable reference.
  - **Files changed**: `choicescript.ts` (4 guard additions), `domain.test.ts` (1 new test).
  - **Tests**: 262 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 153
- **Track `inputMin`/`inputMax` variable references in all four variable scanners.**
  - **Problem**: When a `rand` or `input_number` graph node uses variable names for its min/max bounds (e.g., `inputMin: "lo"`, `inputMax: "hi"`), those variable references were not counted or tracked by `lintUnusedVariables.scanNode`, `lintUnusedTempVars.scanNode`, `computeVariableUses.scanNode`, or `computeVariableLocations.scanGraph`. Variables used only as rand bounds would be falsely flagged as unused and show zero uses in the inspector.
  - **Fix**: Added `isValidChoiceScriptIdentifier` checks on `node.inputMin` and `node.inputMax` in all four scanners, recording them as reads (or uses) when they are valid identifiers.
  - **Files changed**: `choicescript.ts` (8 lines added across 4 functions), `domain.test.ts` (2 new tests).
  - **Tests**: 261 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 152
- **Fix `normalizeSourceExpressionIdentifiers` regex including hyphen in identifier character class.**
  - **Problem**: The regex `[a-zA-Z_][a-zA-Z0-9_-]*` (note the `-` in the character class) matched hyphenated tokens like `score-5` as a single identifier. `normalizeSourceIdentifier("score-5")` would return `"score_5"`. This means `*if score-5 > 0` would have `score-5` tokenized as `score_5`, causing a false "undeclared variable: score_5" warning even when `score` is declared.
  - **Fix**: Removed the hyphen from the character class: `[a-zA-Z_][a-zA-Z0-9_]*`. Hyphens are arithmetic operators in ChoiceScript, not valid identifier characters. This makes the tokenizer correctly treat `score-5` as identifier `score` followed by operator `-` and literal `5`.
  - **Files changed**: `choicescript.ts` (1 character), `domain.test.ts` (1 new test).
  - **Tests**: 259 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 151
- **Align `generateStartupChoiceScript` scene filter to use `!scene.isStart` instead of `scene.name !== "startup"`.**
  - **Problem**: `generateStartupChoiceScript` filtered scenes using `!scene.special && scene.name !== "startup"` while all other code (linter, reachability) used `!scene.isStart && !scene.special`. These diverge if the startup scene ever has a non-"startup" name or if name-based filtering is accidentally applied to a different scene.
  - **Fix**: Changed to `!scene.isStart && !scene.special` for semantic consistency.
  - **Files changed**: `choicescript.ts` (1 line).
  - **Tests**: 258 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 150
- **Align `*temp` no-initial-value lint severity: error→warning in preserved source.**
  - **Problem**: The graph linter emits a **warning** ("*temp has no initial value (defaults to 0)") for a `*temp` node with no initial value. `lintPreservedTempLine` was emitting an **error** ("*temp has an empty initial value") for the same ChoiceScript construct. In ChoiceScript, `*temp` with no initial value is valid (defaults to 0), so a warning matches the correct severity.
  - **Fix**: Changed level from `"error"` to `"warning"` in `lintPreservedTempLine` and aligned the message wording with the graph-linter version.
  - **Files changed**: `choicescript.ts` (1 line), `domain.test.ts` (1 new test).
  - **Tests**: 258 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 149
- **Fix `lintUnusedTempVars` to scan `*selectable_if` conditions and `*set` value expressions in `sourceText`.**
  - **Problem**: When a scene graph has both visual nodes and a `sourceText` blob, `lintUnusedTempVars` scanned the source for `*if`/`*elseif` conditions but missed `*selectable_if` and `*set` value expressions. A temp variable read only in those constructs in `sourceText` would be falsely flagged as unused.
  - **Fix**: Added `|| cmd === "selectable_if"` and a `*set` value-expression branch to the `sourceText` scan loop in `lintUnusedTempVars`, matching the pattern used in `lintUnusedVariables.scanSource`, `computeVariableUses.scanSource`, and `computeVariableLocations.scanSource`. Also switched to `sourceConditionExpression` for correctness.
  - **Files changed**: `choicescript.ts` (6 lines added), `domain.test.ts` (2 new tests).
  - **Tests**: 257 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 148
- **Add `gosub_scene_missing` i18n key and backfill more `undef_var` keys.**
  - **Problem**: Five more lint paths were missing `key`/`params` fields:
    1. `*gosub_scene` pointing to a missing scene in both graph and preserved source had no key (unlike `*goto_scene` which already had `goto_scene_missing`).
    2. `*set uses an undeclared variable` in `lintPreservedSetLine` was missing `key: "undef_var"`.
    3. `*{command} uses an undeclared variable` in `lintPreservedInputCommand` was missing `key: "undef_var"`.
    4. Option body (both `choice` and `fake_choice`) was missing `key: "undef_var"` (option text already had it).
  - **Fix**: Added `gosub_scene_missing` to `lintMessages.ts` (PT/ES translations), emitted it from both graph and preserved source gosub_scene missing-scene checks. Added `key: "undef_var", params: { name }` to the remaining four paths.
  - **Files changed**: `lintMessages.ts` (1 new entry), `choicescript.ts` (6 edits), `domain.test.ts` (2 new tests).
  - **Tests**: 255 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 147
- **Add `key: "undef_var"` to four condition/value-expression lint paths.**
  - **Problem**: `lintExpression`, `lintSourceExpression`, `*set` value expression in `lintSet`, and `*set` value expression in `lintPreservedSetLine` all emitted "undeclared variable" warnings without the `key`/`params` fields needed for `translateLintMsg`. Only prose-text variable references had the key.
  - **Fix**: Added `key: "undef_var", params: { name }` to each of the four issue pushes.
  - **Files changed**: `choicescript.ts` (4 edits), `domain.test.ts` (2 new tests).
  - **Tests**: 253 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 146
- **Fix `lintSet` falsely flagging `*set` on temp variables as undeclared.**
  - **Problem**: `lintSet` (graph linter) fetched `variable = variableTypes.get(set.var)` where `variableTypes` only holds global project variables. The guard `!variables.has(set.var) || !variable` triggered on any temp variable (which is in `variables` but not in `variableTypes`), producing a false "undeclared" error and skipping type/operator checks.
  - **Fix**: Restructured the check to return early only on `!variables.has(set.var)`. Type/operator checks now guard on `variable &&` or `variable?.type` so they silently skip when the target is a temp (type unknown). This matches the behavior of `lintPreservedSetLine` which already handles this correctly.
  - **Files changed**: `choicescript.ts` (5-line restructure in `lintSet`), `domain.test.ts` (1 new test).
  - **Tests**: 251 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 145
- **Scan `*selectable_if` conditions in all three preserved-source scanners.**
  - **Problem**: `lintUnusedVariables.scanSource`, `computeVariableUses.scanSource`, and `computeVariableLocations.scanSource` checked for `*if` and `*elseif` conditions but skipped `*selectable_if`. Variables read only in `*selectable_if` conditions in preserved-source scenes would be falsely flagged as unused and under-counted in usage stats.
  - **Fix**: Added `|| command === "selectable_if"` to the condition branch in each of the three scanners. Also switched from `sourceCommandValue` to `sourceConditionExpression` in all three, so the option text after `#` is stripped before expression parsing (prevents option text words being miscounted as variable references).
  - **Files changed**: `choicescript.ts` (3 edits), `domain.test.ts` (2 new tests).
  - **Tests**: 250 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 144
- **Backfill i18n `key`/`params` on five more lint issues.**
  - **Problem**: Five lint paths were emitting issues without the `key`/`params` fields needed for `translateLintMsg` to produce localized messages:
    1. `*params` shadow in graph linter (line ~828) — missing `key: "temp_shadows"` unlike the `*temp` node path.
    2. `*achieve` undeclared in preserved source — missing `key: "undef_ach"`.
    3. `*goto_scene` pointing to a missing scene in preserved source — missing `key: "goto_scene_missing"`.
    4. Duplicate `*label` in preserved source (`lintPreservedLabelLine`) — missing `key: "duplicate_label"`.
    5. Jump-to-missing-label in preserved source — emitted a generic message; now correctly emits `goto_missing_label` for `*goto` and `gosub_missing_label` for `*gosub`. Required adding `command` field to the `referencedLabels` tracking array and updating `lintPreservedJumpLine`'s array type.
  - **Files changed**: `choicescript.ts` (5 targeted edits), `domain.test.ts` (6 new tests).
  - **Tests**: 248 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 143
- **Fix `extractExpressionNames` to match EXPRESSION_RESERVED case-insensitively.**
  - **Problem**: `EXPRESSION_RESERVED` holds lowercase tokens (`"and"`, `"or"`, `"not"`, `"modulo"`, etc.), but `extractExpressionNames` compared the raw matched token directly, so uppercase forms like `MODULO`, `AND`, `NOT` would not be filtered and could be reported as undeclared variables.
  - **Fix**: Changed the filter from `!EXPRESSION_RESERVED.has(name)` to `!EXPRESSION_RESERVED.has(name.toLowerCase())`.
  - **Files changed**: `choicescript.ts` (1 character change), `domain.test.ts` (1 new test).
  - **Tests**: 242 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 142
- **Lint empty `*set` value expression as an error.**
  - **Problem**: `lintSet` (graph linter for all `sets` assignments) checked that the variable exists and the operator is valid, but never checked whether `set.val` is non-empty. A `VariableSet { var: "score", op: "=", val: "" }` would pass through silently. The generator produces `*set score =` (with no value) which is invalid ChoiceScript.
  - **Fix**: Added `if (!set.val.trim())` check at the top of `lintSet`, emitting an error and returning early before type and expression checks. Applied to all callers since all sets go through `lintSet`.
  - **Files changed**: `choicescript.ts` (4 lines added), `domain.test.ts` (1 new test).
  - **Tests**: 241 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 141
- **Fix lint message translations to include `{name}` placeholder for node/scene context.**
  - **Problem**: `orphan_node`, `dead_end`, `scene_unreachable`, and `empty_passage_body` all pass `params: { name }` but their PT/ES translation strings had no `{name}` placeholder. When a user viewed lint messages in Portuguese or Spanish, the translated strings omitted the specific node or scene name, making it harder to act on the warning.
  - **Fix**: Updated `lintMessages.ts` translations for all four keys to include `"{name}"` in the template string. The `translateLintMsg` function already handles `{name}` substitution — no code changes needed.
  - **Files changed**: `src/data/lintMessages.ts` (4 translation entries updated).
  - **Tests**: 240 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 140
- **Parity: detect unused `*temp` variables in preserved source.**
  - **Problem**: `lintUnusedTempVars` (graph linter) flags `*temp` variables that are declared but never read within a scene. This check only ran for visual-graph scenes; preserved-source scenes completely skipped it.
  - **Implementation**: Added `tempVarLines` map (temp name → declaration line) in the pre-pass of `lintPreservedScriptSource`. Added `tempReadVars` set populated during the main loop: prose lines add via `extractVariableReferences`; `*if`/`*elseif`/`*selectable_if` conditions add via `extractExpressionNames`; `*set` value expressions add the same way. After the loop, any temp in `tempVarLines` that's not in `tempReadVars` emits `unused_temp` info with the same key and params as the graph-node version.
  - **Files changed**: `choicescript.ts` (~25 lines added), `domain.test.ts` (3 new tests).
  - **Tests**: 240 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 139
- **Parity: `*temp` and `*params` shadow-global checks in preserved source.**
  - **Problem**: `lintPreservedTempLine` and `lintPreservedParamsLine` checked for reserved-word clashes and local-variable duplicates, but not for shadowing a global variable. `lintSceneGraph` already emits `temp_shadows` for `*temp` and `*params` nodes that shadow globals. Preserved-source scenes using `*temp` or `*params` would silently skip this check.
  - **Fix**: The `variables` parameter in both functions starts as the global variable set and gets mutated to add locals. Before adding the new name, check if it's already in `variables` AND not already in `localVariables` (i.e., it's a global, not a previously-declared local). If so, emit `temp_shadows` warning with the same key and params as the graph-node version.
  - **Files changed**: `choicescript.ts` (6 lines added), `domain.test.ts` (2 new tests).
  - **Tests**: 237 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 138
- **Parity: `*rand` same-bounds warning in preserved source; fairmath range check in `*create`; `*image` alignment in preserved source.**
  - **`*rand` same-bounds in preserved source**: `lintInputNode` (graph linter) warns when a `*rand` has `min === max` (always produces one value). `lintPreservedInputCommand` (preserved-source linter) handled `min > max` (error) but missed `min === max` (warning). Added parity check at end of `lintPreservedInputCommand` for `command === "rand" && min === max`.
  - **Files changed**: `choicescript.ts` (4 lines added), `domain.test.ts` (1 new test).
  - **Tests**: 235 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 137
- **Add fairmath range check to `*create` in preserved startup; add alignment validation to `*image` in preserved source.**
  - **`lintPreservedCreateLine` fairmath range**: `lintProjectMetadata` already warns when a graph-based variable with `fairmath: true` has an initial value outside 0–100. `lintPreservedCreateLine` (called when startup.txt is preserved source) only checked that the initial value was a valid number, not that it was in range. Added parity check: if `projectVariable` has `fairmath: true` and the numeric initial value is outside [0, 100], emit a `fairmath_range` warning.
  - **`lintPreservedScriptSource` image alignment**: `*image filename alignment [alt]` — the graph-node linter validates alignment as one of `none`, `left`, `right`. The preserved-source linter only extracted and checked the filename. Added extraction of the second token as alignment and validation against the same valid set.
  - **Files changed**: `choicescript.ts` (12 lines added), `domain.test.ts` (4 new tests).
  - **Tests**: 234 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 136
- **Fix `*set` value-expression reads missing in three source scanners; add `*gosub_scene` checks to preserved-source linter.**
  - **`*set` value reads in source**: `lintUnusedVariables`, `computeVariableUses`, and `computeVariableLocations` all had `scanSource` functions that tallied the `*set` write target but never scanned the value expression. So `*set result score + 5` in preserved source counted `result` as written but silently skipped `score` as a read. Variables exclusively read through `*set` RHS expressions in imported scenes were falsely flagged as "declared but never read". Fixed all three functions by adding the same value-expression extraction logic (using `maybeOp`/`rest` parsing with explicit-operator detection) already present in `lintPreservedSetLine`.
  - **`*gosub_scene` in `lintPreservedScriptSource`**: The preserved-source scene linter checked that `*gosub_scene` pointed to an existing scene but did not check (a) whether the target scene has a `*return`, or (b) whether the entry label (if any) exists in the target. Added parity checks matching the graph-node `gosub_scene` linter: inspects `targetGraph.sourceText` for `*return`, and scans both visual label nodes and source `*label` lines for the entry label.
  - **Files changed**: `choicescript.ts` (~35 lines added), `domain.test.ts` (4 new tests).
  - **Tests**: 230 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 135
- **Parity: `computeAchievementLocations` and `computeAchievementUses` scan option bodies and preserved source.**
  - **Problem**: Both functions only called `extractAchievementCommandTargets` on `node.body`. Option bodies (`option.body`, `fakeOption.body`) and preserved source text (`graph.sourceText`, `startupSource`) were silently skipped. A `*achieve` command inside a choice option body or imported source would not appear in the location map or use count shown in the UI.
  - **Fix `computeAchievementLocations`**: Added `node.options?.forEach` and `node.fakeOptions?.forEach` loops in `scanGraph` (matching the `computeVariableLocations` pattern). Added `scanSource` function that splits preserved source text line-by-line and calls `addLoc` for every `*achieve` command found. Called for each `graph.sourceText` and `startupSource`.
  - **Fix `computeAchievementUses`**: Expanded `scanNode` to also call `scanText` on `option.body` and `fakeOption.body` for both options and fakeOptions.
  - **Files changed**: `choicescript.ts` (18 lines added).
  - **Tests**: 226 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 134
- **Extend `*gosub_scene` entry label check to cover preserved-source scenes; fix `computeVariableLocations` to scan source text.**
  - **`*gosub_scene` label check**: The existing check only looked at `targetGraph.nodes` for label nodes, missing labels in preserved-source scenes (where `sourceText` holds the actual ChoiceScript). Added extraction of `*label` lines from `targetGraph.sourceText` via regex and merged with visual label names. Now correctly validates entry labels for both visual-graph and preserved-source target scenes.
  - **`computeVariableLocations` source scan**: Added a `scanSource` function (mirroring `computeVariableUses`'s approach) that processes preserved source text line-by-line, tracking reads from prose references, conditions, and writes from `*set`/`*input_*`/`*rand`. Called for each scene's `sourceText`, plus `startupSource` and `statsSource`. Preserved-source variables now appear in variable location tracking used by the UI.
  - **Files changed**: `choicescript.ts` (~30 lines added).
  - **Tests**: 226 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 133
- **Validate `*image` alignment value; fix false-positives from ChoiceScript built-in functions in expressions; reserved-word parity in `*create`; undeclared-variable scan in `*set` RHS for preserved source.**
  - **`*image` alignment lint**: Added check that `node.inputMin` (used as alignment) must be one of `none`, `left`, `right`. If not, emits a `warning`. The generator defaults to `"none"` so the generated ChoiceScript is valid even without a lint error, but the author should be aware of invalid alignment values.
  - **EXPRESSION_RESERVED set**: `extractExpressionNames` previously filtered `["and", "or", "not", "true", "false"]` but not `modulo`, `round`, `round_down`, `log`, `abs`, `length`, `auto`. These all appear as bare identifiers in ChoiceScript expressions but are not variable names. Changed to a module-level `EXPRESSION_RESERVED` constant with all built-ins.
  - **`*create` reserved-word check**: Added `isChoiceScriptReserved` call in `lintPreservedCreateLine` for parity with temp/params/global variable checks.
  - **`*set` RHS undeclared-variable scan**: `lintPreservedSetLine` now scans the value expression for undeclared variables, matching `lintSet`'s graph-node behavior.
  - **Files changed**: `choicescript.ts`, `domain.test.ts` (multiple tests).
  - **Tests**: 226 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 132
- **Fix false-positive: `modulo` and built-in functions falsely flagged as undeclared variables in expressions.**
  - **Problem**: `extractExpressionNames` had a local `reserved` set with only `and`, `or`, `not`, `true`, `false`. ChoiceScript also has `modulo` (arithmetic operator) and built-in functions `round`, `round_down`, `log`, `abs`, `length`, `auto`. An expression like `score modulo 2 = 0` would emit "condition uses an undeclared variable: modulo". Same for `round(score)`, `abs(delta)`, etc.
  - **Fix**: Replaced the local `reserved` set with a module-level `EXPRESSION_RESERVED` constant that includes the full set of ChoiceScript operators and built-ins that appear as bare identifiers in expressions.
  - **Files changed**: `choicescript.ts` (new `EXPRESSION_RESERVED` constant, `extractExpressionNames` updated), `domain.test.ts` (1 new test).
  - **Tests**: 225 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 131
- **Parity improvements: reserved-word checks in `*create`; undeclared-variable scan in preserved `*set` RHS.**
  - **Problem 1**: `lintPreservedCreateLine` (startup.txt linting) didn't check for reserved words in variable names, unlike `lintProjectMetadata`, `lintPreservedTempLine`, and `lintPreservedParamsLine` which all gained that check in session 125/128.
  - **Fix 1**: Added `isChoiceScriptReserved` call in `lintPreservedCreateLine` after the identifier-validity check.
  - **Problem 2**: `lintPreservedSetLine` checked the *target* variable of a `*set` but not the value expression. `lintSet` (the graph-node version) already checks the RHS for undeclared variable references. So `*set score score + bonus` in preserved source would silently skip the `bonus` check.
  - **Fix 2**: After the existing fairmath check, reconstruct the value expression from the parsed parts and run `extractExpressionNames(normalizeSourceExpressionIdentifiers(valueExpr))` against the known variables set, emitting a `warning` for each undeclared name found.
  - **Files changed**: `choicescript.ts` (3+5 lines added), `domain.test.ts` (1 new test).
  - **Tests**: 224 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 130
- **Fix `computeVariableUses` and `computeVariableLocations` to scan choice option bodies.**
  - **Problem**: Both functions scanned `option.text` and `option.sets` but skipped `option.body` (the inline prose shown after a choice is selected). Variables referenced as `${score}` in an option body were not counted as "used" and not tracked as read locations. This caused misleading variable-use counts in the UI and could cause false "variable never read" warnings for variables that appear only in option bodies.
  - **Fix**: Added `extractVariableReferences(opt.body ?? "").forEach(tally)` in `computeVariableUses` and `addLoc(...)` equivalent in `computeVariableLocations` for both `options` and `fakeOptions` forEach loops.
  - **Files changed**: `choicescript.ts` (4 lines added — 2 in computeVariableUses, 2 in computeVariableLocations), `domain.test.ts` (1 new test).
  - **Tests**: 223 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 129
- **Support `@!{name}` and `@!!{name}` capitalization interpolation patterns throughout.**
  - **Problem**: ChoiceScript supports three `@` interpolation variants: `@{name}` (raw), `@!{name}` (capitalize first letter), `@!!{name}` (all caps). `extractVariableReferences` only matched `@{name}`, missing the `!` and `!!` variants. Any variable referenced exclusively via `@!{hero}` or `@!!{hero}` would be falsely flagged as "never read" by unused-variable detection, and undeclared variables used this way would not trigger an "undeclared variable" warning. `countBodyWords` had the same gap — `@!{…}` and `@!!{…}` were counted as word tokens rather than replaced by a space placeholder.
  - **Fix**: Changed the `at` regex in `extractVariableReferences` to `@!{0,2}\{([a-zA-Z_][\w]*)\b` (matches 0, 1, or 2 `!` before the `{`). Changed `countBodyWords` pattern from `@\{[^}]+\}` to `@!{0,2}\{[^}]+\}`.
  - **Files changed**: `choicescript.ts` (2 regex changes), `domain.test.ts` (2 new tests).
  - **Tests**: 222 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 128
- **Fix incorrect `error` for `*stat_chart text` with a number variable; add reserved-word checks to preserved source temp/params.**
  - **Problem 1**: `lintPreservedStatsSource` raised an `error` for `*stat_chart text varname` when `varname` is a number variable. ChoiceScript actually accepts `text` for any variable type — it just renders the raw value. The restriction was wrong and would flag valid ChoiceScript.
  - **Fix 1**: Changed the check to `warning` level with a helpful message ("displays X as a raw number — use percent or opposed_pair for a bar chart"). Also scoped it to only fire for `number` type (boolean and string with `text` are now silent).
  - **Problem 2**: `lintPreservedTempLine` and `lintPreservedParamsLine` didn't check for ChoiceScript reserved words, unlike their graph-node counterparts (already fixed in session 125).
  - **Fix 2**: Added `isChoiceScriptReserved()` call in both preserved-source functions after the identifier-validity check, mirroring the graph-node lint added in session 125.
  - **Files changed**: `choicescript.ts` (1 check changed in lintPreservedStatsSource, 2 reserved-word checks added in lintPreservedTempLine and lintPreservedParamsLine), `domain.test.ts` (1 test assertion updated).
  - **Tests**: 220 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 127
- **Lint scene with `*gosub` but no `*return` node.**
  - **Problem**: The existing check at `node.type === "return" && !hasGosub` warned when a `*return` appeared in a scene with no `*gosub`. The symmetric case — a `*gosub` in a scene with no `*return` — was missing. Without a `*return`, the gosub'd subroutine can never return to the caller, leaving the player stuck in a dead flow.
  - **Fix**: After the main node loop in `lintSceneGraph`, added `if (hasGosub && !graph.nodes.some((n) => n.type === "return"))` and emit a `warning` at scene scope.
  - **Files changed**: `choicescript.ts` (+4 lines after humanLabels loop), `domain.test.ts` (2 new tests).
  - **Tests**: 220 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 126
- **Lint `*image` and `*sound` nodes with unsupported file extensions.**
  - **Problem**: ChoiceScript only supports specific image formats (jpg, jpeg, png, gif, webp) and audio formats (mp3, ogg, wav, aac, m4a, mp4). An author referencing `hero.svg` or `theme.flac` would produce a game that silently fails to load the asset in the browser. The existing asset linting only checked whether the file was registered in `project.assets`, not whether the extension was supported.
  - **Fix**: Added `IMAGE_EXTENSIONS`, `AUDIO_EXTENSIONS` sets and `fileExtension(filename)` helper. In `lintSceneGraph` for `image` and `sound` nodes with a non-empty target, check the extension against the appropriate set and emit a `warning` if not supported. Same check added in `lintPreservedScriptSource` for `*image` and `*sound` command lines. Refactored the existing asset-registry check to share the extracted filename variable.
  - **Files changed**: `choicescript.ts` (3 new constants + helper, updated image/sound checks in both lintSceneGraph and lintPreservedScriptSource), `domain.test.ts` (3 new tests).
  - **Tests**: 218 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 125
- **Lint variable/temp/params names that clash with ChoiceScript reserved words.**
  - **Problem**: ChoiceScript treats `true`, `false`, `not`, `and`, `or`, and `modulo` as keywords/operators. A variable named any of these passes `isValidChoiceScriptIdentifier` (it's lowercase alphanumeric) but would cause ChoiceScript parse errors at runtime since the engine would interpret the identifier as a literal or operator rather than a variable name.
  - **Fix**: Added `CHOICESCRIPT_RESERVED` set and `isChoiceScriptReserved(name)` helper. In `lintProjectMetadata`, after the existing invalid-identifier check for global variables, added an `error`-level check for reserved names. In the `temp` node branch of `lintSceneGraph`, added the same reserved-word check (before the existing "shadows global" check). In the `*params` forEach, added the same check.
  - **Files changed**: `choicescript.ts` (`CHOICESCRIPT_RESERVED` constant + `isChoiceScriptReserved` helper + 3 check insertions), `domain.test.ts` (3 new tests).
  - **Tests**: 215 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 124
- **Lint `*set` node with no assignments.**
  - **Problem**: A `*set` node with an empty `sets` array (no variable assignments configured) generates no ChoiceScript output but still appears as a node in the graph, silently doing nothing. Authors may accidentally leave an empty set node behind after editing, and there was no diagnostic to catch this.
  - **Fix**: In `lintSceneGraph`, after the existing `node.sets?.forEach(lintSet)` call, added a check for `node.type === "set" && (!node.sets || node.sets.length === 0)` and emits a `warning` with message `*set node "..." has no assignments`.
  - **Files changed**: `choicescript.ts` (+4 lines in lintSceneGraph), `domain.test.ts` (2 new tests: empty sets → warning, populated sets → no warning).
  - **Tests**: 212 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 123
- **Warn when `*if` without `*else` has all branches leading to the same node as the false path (no-op condition).**
  - **Problem**: An `*if` node with no `*else` where all branch targets equal the false-path (flow edge) continuation is logically a no-op — the game reaches the same node regardless of whether the condition is true or false. The existing check in `lintIfNode` only caught the "all branches same with `*else`" case.
  - **Fix**: After calling `lintIfNode`, in `lintSceneGraph`, find the `flow` edge for the `*if` node (`ifFlowTarget`). If no `*else` branch and all branch targets equal `ifFlowTarget`, emit a `warning` level issue with "no-op condition" message.
  - **Files changed**: `choicescript.ts` (~11 lines added in lintSceneGraph's if-node block), `domain.test.ts` (2 new tests: no-op detected; different targets not flagged).
  - **Tests**: 210 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 122
- **Report unreferenced `*label` declarations in preserved source (info level).**
  - **Problem**: The preserved source linter checked that `*goto`/`*gosub` targets exist (`jump points to a missing label`) but not the reverse — `*label` declarations that are never referenced. The visual graph linter already had this symmetric check (info level, "is never referenced by any *goto or *gosub"). Preserved source lacked parity.
  - **Fix**: After the existing `referencedLabels.forEach` check, build `referencedLabelSet` from the referenced labels array, then iterate `labels` map and emit `info` for any label not in the set. Matches the exact message and level used by the visual graph linter.
  - **Files changed**: `choicescript.ts` (+6 lines in `lintPreservedScriptSource`), `domain.test.ts` (2 new tests).
  - **Tests**: 208 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 121
- **Fix bug: `generateStartupChoiceScript` always goto_scenes the first playable scene.**
  - **Problem**: `generateStartupChoiceScript` ended with `*goto_scene ${project.sceneTitle}`. `project.sceneTitle` tracks the currently active editor scene, not necessarily the first playable scene. If the user was editing scene 3 ("epilogue") and exported, the generated `startup.txt` would have `*goto_scene epilogue`, skipping scenes 1 and 2. Since ChoiceScript executes startup.txt top-to-bottom and `*goto_scene` immediately jumps there, this caused the game to start mid-story.
  - **Fix**: Extracted `playableScenes` from the already-computed filter (`!special && name !== "startup"`). Used `playableScenes[0]?.name` as the goto target, falling back to `project.sceneTitle` only if no playable scenes exist (degenerate case). The `*scene_list` now uses the same `playableScenes` array, eliminating duplication.
  - **Files changed**: `choicescript.ts` (~3 lines changed in generateStartupChoiceScript), `domain.test.ts` (1 new test demonstrating the bug scenario).
  - **Tests**: 206 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 120
- **Implement `image_unknown` lint and add `sound_unknown` lint; check asset references.**
  - **Problem**: The `image_unknown` key already existed in `lintMessages.ts` (translated to PT/ES) but the corresponding lint check was never implemented — `*image` and `*sound` nodes referencing files not in `project.assets` passed validation silently. If an author writes `*image ghost.png` but that file isn't registered as an asset, the exported zip will be broken.
  - **Fix**: Added `isKnownAsset(assets, target)` helper (matches by exact path, by fileName, or by basename). In `lintSceneGraph`, for `image` and `sound` nodes with a non-empty target, if the project has any assets registered, check against the asset registry and warn if not found. Same check added to `lintPreservedScriptSource` for `*image` and `*sound` command lines. Only fires when `project.assets.length > 0` to avoid false positives for projects managing assets externally. Also added `sound_unknown` translation to `lintMessages.ts`.
  - **Files changed**: `choicescript.ts` (+isKnownAsset helper, +4 lint calls in lintSceneGraph, +4 lint lines in lintPreservedScriptSource), `lintMessages.ts` (+sound_unknown entry, kept existing image_unknown), `domain.test.ts` (4 new tests).
  - **Tests**: 205 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 119
- **Warn when `*gosub_scene` calls a scene with no `*return`.**
  - **Problem**: `*gosub_scene` calls a subroutine scene and expects to resume after it via a `*return`. If the called scene has no `*return` node, the game will either crash or hang. We already warned when the calling scene had no flow-continuation edge, but we didn't check the target scene itself.
  - **Fix**: Inside the `gosub_scene` validation block in `lintSceneGraph`, after verifying the target scene exists, look it up via `getSceneGraph`. For visual scenes: check if any node has `type === "return"`. For preserved-source scenes: scan each line via `sourceCommand` for `"return"`. Emit a `warning` if neither is found.
  - **Files changed**: `choicescript.ts` (+7 lines inside the gosub_scene `else` block), `domain.test.ts` (3 new tests: no return warns, has return doesn't warn, preserved source without return warns).
  - **Tests**: 201 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 118
- **Lint variable interpolations in choice option text and choice/node prompts.**
  - **Problem**: `lintChoiceNode` and `lintFakeChoiceNode` scanned `option.body` for `${var}` / `@{var}` references but not `option.text` (the visible label shown to the player). `lintSceneGraph`'s main loop scanned `node.body` but not `node.prompt` (the preamble text before `*choice`/`*fake_choice`). Authors can and do use variable interpolation in option labels (`Ask about ${topic}.`) and prompts (`You are ${rank}. What do you do?`).
  - **Fix**: Added `extractVariableReferences(option.text)` scan in `lintChoiceNode` and `lintFakeChoiceNode`; added `extractVariableReferences(node.prompt ?? "")` scan in the `lintSceneGraph` node loop. All three emit `warning` level with `undef_var` key (consistent with body text scanning).
  - **Files changed**: `choicescript.ts` (+3 scanning calls, ~9 lines), `domain.test.ts` (4 new tests: choice option text undeclared, declared OK, choice prompt undeclared, fake_choice option text undeclared).
  - **Tests**: 198 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 117
- **Lint preserved source prose for undeclared variable interpolations.**
  - **Problem**: `lintPreservedScriptSource` validated commands (label, goto, set, if, etc.) but never scanned prose text lines for `${var}` / `@{var}` interpolation references. An imported scene with `${undeclared}` in its narrative text went undetected.
  - **Fix**: Added a pre-scan pass at the start of `lintPreservedScriptSource` to collect all `*temp` and `*params` variable names declared anywhere in the source file (forward-declared or not). Then, in the main line loop, for lines where `sourceCommand` returns null (pure prose / option text / body text), extract variable references via `extractVariableReferences` and emit a `warning` for any name not in the global + local variable set. Reuses the existing `undef_var` key for consistent i18n.
  - **Why pre-scan**: A `*temp` declared on line 10 is in scope for prose on line 3 in the ChoiceScript runtime. Checking against `localVariables` (which grows sequentially) would produce false positives for forward-declared temps. The pre-scan collects the final declared set first.
  - **Files changed**: `choicescript.ts` (~20 new lines in `lintPreservedScriptSource`), `domain.test.ts` (4 new tests).
  - **Tests**: 194 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 116
- **Fairmath initial value range check + roundtrip test for *if without *else.**
  - **Fairmath range check**: Added `fairmath_range` warning when a variable has `fairmath: true` but its initial value is outside 0–100. ChoiceScript fairmath operators clamp results, but the initial value itself is not clamped — an out-of-range initial is almost always a mistake. Translated to PT/ES. 4 new tests.
  - **Roundtrip test**: Added end-to-end test: imports `*if without *else` ChoiceScript, then calls `generateSceneChoiceScript` and verifies the exported code contains `*goto cf_<continuation>` for the false path. Confirms the session-115 code generation fix works end-to-end.
  - **Files changed**: `choicescript.ts` (+6 lines in lintProjectMetadata), `lintMessages.ts` (+fairmath_range entry), `domain.test.ts` (5 new tests: 4 fairmath range tests + 1 roundtrip test).
  - **Tests**: 190 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 115
- **Fix code generation bug: `*if` without `*else` missing false-path `*goto`.**
  - **Problem**: The code generator excluded `*if` nodes from the auto-flow `*goto` emission. When an `*if` node had no `*else` branch but a flow edge (the continuation node), the generated ChoiceScript had no `*goto` after the `*if` block. The false path silently fell through to whatever was next in the sorted node array — typically the TRUE branch target node. This caused the false path to execute the true branch content.
  - **Fix**: After the `*if` block content is emitted, check for a `kind: "flow"` edge on the node. If present AND the node has no `*else` branch, emit `*goto cf_<flowTarget>`. If an `*else` branch exists, all false cases are handled by the `*else` branch, so no extra goto is needed.
  - **Files changed**: `choicescript.ts` (`generateNodeChoiceScript` — 4 new lines after flowTarget check), `domain.test.ts` (2 new tests: false-path goto is emitted; else branch suppresses spurious goto).
  - **Tests**: 185 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 114
- **Import: `*label` in body nodes; lintCheckpoints extended to cover preserved source.**
  - **`*label` in body nodes**: `"label"` was missing from `BODY_STRUCTURED_COMMANDS`. When `*label` appeared inside an `*if` branch or `*choice` option body, it fell through to the prose buffer and was emitted as literal text. Adding `"label"` to `BODY_STRUCTURED_COMMANDS` causes `buildBodyNodeChain` to create a proper `label` type node and wire it into the chain. Added 2 tests.
  - **`lintCheckpoints` extended to preserved source**: The `lintPreservedScriptSource` function had its own same-scene checkpoint check that was removed when we moved to project-wide checking (session 113). But `lintCheckpoints`' second pass was skipping preserved-source scenes. Fixed by adding a source-text scan in the second pass for `*restore_checkpoint` lines and comparing against the project-wide `savedSlots`. Removed the now-dead `savedCheckpoints`/`restoredCheckpoints` variables and the corresponding command handlers from `lintPreservedScriptSource`. The `*save_checkpoint needs a checkpoint name` error (for unnamed checkpoints) is kept in `lintPreservedScriptSource`.
  - **Files changed**: `choicescriptImport.ts` (BODY_STRUCTURED_COMMANDS +`"label"`), `choicescript.ts` (lintCheckpoints second pass handles sourceText; removed 6 lines from lintPreservedScriptSource), `domain.test.ts` (2 new tests).
  - **Tests**: 183 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 113
- **Three linter improvements: routing-node false-positive fix, cross-scene checkpoint check, new empty-passage lint.**
  - **False positive fix (empty_passage_body)**: The importer creates structural routing nodes (`choice_option_empty`, `if_*_empty`, `*_merge`) as `type: "passage"` with `body: ""`. The new `empty_passage_body` lint fired on these. Fixed by excluding nodes whose title matches `/_(?:empty|merge)$/`. Added regression test that imports a choice and verifies no false positive fires.
  - **Cross-scene checkpoint check (restore_no_save)**: The old `*restore_checkpoint` lint only checked if a matching `*save_checkpoint` existed in the SAME scene — a near-universal false positive since checkpoints are designed to span scenes. Removed the per-scene check. Added a new `lintCheckpoints` function at the project level that first collects all saved checkpoint slots from all scenes (including preserved source), then checks each `*restore_checkpoint` against the project-wide set. Warning message now says "in the project" instead of "in this scene". Added tests for the no-save case and the cross-scene save case.
  - **Files changed**: `choicescript.ts` (removed per-scene restore check + checkpointSlots var, added lintCheckpoints, updated lintProject call, tweaked empty_passage_body filter), `lintMessages.ts` (+1 restore_no_save translation), `domain.test.ts` (3 new tests).
  - **Tests**: 181 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 112
- **Three new linter rules: `*rand` same bounds, empty passage body, write-only `*temp`.**
  - **Rule 1 (`rand_same_bounds`)**: Warns when `*rand` is given `min = max` as numeric literals — always produces the same value, almost certainly a mistake. Added to `lintInputNode`, fires only for `node.type === "rand"` (not `input_number`). Translated to PT/ES.
  - **Rule 2 (`empty_passage_body`)**: Info-level flag when a `passage` node has no body text (empty or whitespace). These are usually placeholder or forgotten nodes. Added to the `lintSceneGraph` node loop. Translated to PT/ES.
  - **Rule 3 (`unused_temp`)**: Info-level flag when a `*temp` variable is declared in a scene but never read — only set but never referenced in any text interpolation, condition, or expression value. New `lintUnusedTempVars` function mirrors the approach of `lintUnusedVariables` (global) but scoped to per-scene temp vars. Reads `graph.sourceText` if present to handle preserved-source scenes. Translated to PT/ES.
  - **Files changed**: `choicescript.ts` (lintInputNode +2 lines, lintSceneGraph +3 lines, new lintUnusedTempVars function ~50 lines), `lintMessages.ts` (+3 translation entries), `domain.test.ts` (7 new tests).
  - **Tests**: 179 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 111
- **Import hardening: choice guards without parens, compound expression fix, if-without-else flow edges.**
  - **Problem 1 (choice guards)**: `parseChoiceHeader` required parens in `*if (cond) #option` and `*selectable_if (cond) #option` forms. Without parens (`*if cond > 50 #option`) the option was dropped. Same for group `*if` guards in all 4 choice block parsers.
  - **Fix 1**: Changed guard regexes from `\((.+)\)` to `(.+)` (capture full condition string), then `stripOuterParens` normalizes either form.
  - **Problem 2 (compound expressions)**: `stripOuterParens` used `startsWith("(") && endsWith(")")` which incorrectly stripped `(a > 5) and (b > 3)` → `a > 5) and (b > 3` (unbalanced). Also `parseIfHeader` used tricky non-greedy `\(?(.+?)\)?$` pattern with the same issue.
  - **Fix 2**: `stripOuterParens` now tracks paren depth — only strips if the opening `(` is paired with the final `)`. `parseIfHeader` simplified to `(.+)$`.
  - **Problem 3 (if-without-else flow)**: An `*if` block with no `*else` branch had no flow edge to the following node for the "false" path. All downstream content was orphaned.
  - **Fix 3**: After processing inline `*if` with no else, add `ifNode.id` to `pendingContinuations` (top-level) or `pendingLinks` (`buildBodyNodeChain`). Also removed the overly-conservative `canAutoFlow(source)` check from `pendingContinuations` processing (the check was always satisfied for real continuation nodes, but blocked the new if-node case).
  - **Files changed**: `choicescriptImport.ts` (stripOuterParens, parseIfHeader, parseChoiceHeader, 4 guard patterns, addNode continuation logic, createImportedSceneGraph if branch, buildBodyNodeChain if branch), `domain.test.ts` (5 new tests).
  - **Tests**: 172 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 110
- **Import hardening: `*set` ordering in branch/option bodies + compact operator parsing.**
  - **Problem 1 (ordering)**: `parseInlineIfBlock`, `parseInlineChoiceBlock`, and `parseInlineFakeChoiceBlock` extracted ALL `*set` commands from branch/option bodies into `branch.sets`/`option.sets` regardless of position. If prose appeared BEFORE a `*set`, the set was still pulled out and placed before the prose in the generated output — silently changing execution order.
  - **Fix 1**: Changed all three parsers to only extract `*set` into `sets` while `bodyLines` is still empty (i.e., no other content has been seen in the current branch/option yet). `*set` after prose stays in `bodyLines` for `buildBodyNodeChain` to process in correct sequence.
  - **Problem 2 (compact op)**: `parseSet` didn't handle compact operator form (`*set courage +1` with no space between op and value). `"courage +1".split(" ")` yields `["courage", "+1"]`; `"+1"` is not a known op, so it was silently stored as `{ op: "=", val: "+1" }`.
  - **Fix 2**: Added compact-operator regex to `parseSet`: `maybeOp.match(/^(%[+-]|[+\-])(.+)$/)` splits `+1` into op `+` and val `1`.
  - **Fix 3**: Added `"set"` to `BODY_STRUCTURED_COMMANDS` so `*set` anywhere in `buildBodyNodeChain` body lines creates a proper set node (with consecutive merging) rather than falling through to prose buffer.
  - **Files changed**: `choicescriptImport.ts` (parseSet, BODY_STRUCTURED_COMMANDS, buildBodyNodeChain, parseInlineIfBlock, parseInlineChoiceBlock, parseInlineFakeChoiceBlock), `domain.test.ts` (5 new tests).
  - **Tests**: 165 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 109
- **Lint message localization (PT/ES) + BottomBar i18n.**
  - **Problem**: All ~90 lint messages in `choicescript.ts` were English-only despite the bilingual UI — explicitly listed as a known v1.0 gap in agents.md.
  - **Approach**: Added optional `key?: string` and `params?: Record<string, string>` fields to `LintIssue` (backward compatible — existing code reading `msg` is unaffected). Tagged ~17 of the most common/important lint messages with keys and parameter dicts. Created `src/data/lintMessages.ts` with a PT and ES translation table (17 keys × 2 languages). Added a `translateLintMsg(key, params, fallback, lang)` helper that applies template substitution (`{name}` etc.) and falls back to the English `msg` if no translation exists.
  - **Files changed**: `types.ts` (2 new `LintIssue` fields, 5 new `I18nLabels` fields for BottomBar UI), `sampleProject.ts` (5 BottomBar UI strings in PT/EN/ES), `choicescript.ts` (~17 lint pushes tagged with `key`/`params`), `lintMessages.ts` (new translation table), `BottomBar.tsx` (uses `translateLintMsg` + new `lang` prop, localized filter dropdown and empty-state text).
  - **Tests**: 160 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 108
- **V1.0 gap assessment + New Project modal.**
  - **Gap assessment**: project is functionally v1.0 ready. All 24+ node types, export, import, linting, undo/redo, snapshots, manuscript, scene map, dashboard, search, command palette, copy/paste, multi-select, keyboard shortcuts — all implemented and working (160 tests). Remaining gaps: (1) lint messages English-only despite bilingual UI, (2) no "start blank" project option (Reset always loads sample), (3) import edge cases for deeply nested patterns, (4) no UI/browser test coverage.
  - **Fix** (highest UX impact for new users): Replaced the "Reset" button in TopBar with a "New" button that opens a `NewProjectModal`. The modal lets users type a project title and author, then choose "Start blank" (clean project with one empty passage + finish) or "Load example" (current sample behavior). Added `newBlankProject(title, author)` action to the store and `createBlankProject()` factory function. Added i18n labels (`newProject`, `projectTitleLabel`, `projectAuthorLabel`, `startBlank`, `loadExample`) in PT/EN/ES to `I18nLabels`.
  - **Files changed**: `types.ts` (5 new I18nLabels fields), `sampleProject.ts` (i18n in PT/EN/ES), `projectStore.ts` (new action + factory), `NewProjectModal.tsx` (new component), `TopBar.tsx` (prop rename), `App.tsx` (modal state + wiring), `directions.css` (`.np-*` styles).
  - **Tests**: 160 passing, no regressions.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 107
- **Import: collapse preceding prose into nested `*choice`/`*fake_choice` prompt (inside `*if` branches and option bodies).**
  - **Problem**: Session 106 absorbed prose-before-choice at the top level (`createImportedSceneGraph`), but inside `buildBodyNodeChain` (used for `*if` branch bodies and `*choice` option bodies), the same situation still called `flushProse()`, creating a separate passage node.
  - **Fix** (`choicescriptImport.ts`, `buildBodyNodeChain`): Replaced `flushProse()` before `choice`/`fake_choice` with prompt-absorption: save `proseBuf`, capture as `promptText`, clear buffer, apply to parsed node's `prompt` field. On parse failure, restore `savedProseBuf` and push block lines back (no behavior change from before).
  - **Tests**: 2 new tests — `*choice` inside `*if` branch with preceding prose (absorbed into prompt, no separate passage); `*fake_choice` inside `*if` branch with preceding prose (same). Total: **160 tests, all passing**.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 106
- **Import: collapse preceding prose into `*choice`/`*fake_choice` prompt field.**
  - **Problem**: Prose immediately before a `*choice` or `*fake_choice` (e.g., "What will you do?") was always flushed as a separate passage node, then connected via a flow edge to the choice. This produced an extra node for what is semantically just the choice's prompt — making imported graphs noisier than necessary.
  - **Fix** (`choicescriptImport.ts`, `createImportedSceneGraph`): For both `choice` and `fake_choice` commands, instead of calling `flushPassage()` (which creates the passage node), the pending buffer is captured as `promptText` and set directly on the choice node's `prompt` field. The code generator already emits `prompt` lines before `*choice`, so the roundtrip is clean. Fallback: if neither choice parser recognizes the block, `promptText` is flushed as a passage node (same as before), followed by the raw block.
  - **Tests**: 3 new tests — inline choice with preceding prose (prompt absorbed, no separate passage for that text); fake_choice with preceding prose (same); choice with no preceding prose (default prompt preserved). Total: **158 tests, all passing**.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 105
- **Manuscript view: inline image and audio rendering.**
  - `*image` and `*sound` nodes previously showed as monochrome structural chips (`*image filename`). Now, if the node's `target` filename matches a project asset with a `dataUrl`, the actual media is rendered inline in the manuscript.
  - `*image` with a matching asset: renders `<img class="ms-image">` with the dataUrl as `src` and the node's `prompt` (or target filename) as `alt`. Falls back to the structural chip when no matching asset is found (e.g., referencing an external file not imported as an asset).
  - `*sound` with a matching asset: renders `<audio class="ms-audio" controls>` so authors can play the track while proofreading. Falls back similarly.
  - Asset matching checks both `asset.fileName` and `asset.path` against `node.target` to handle import variations.
  - `NodeBlock` accepts a new `assets?: AssetSummary[]` prop; `ManuscriptView` passes `data.assets` to every `NodeBlock`.
  - CSS (`directions.css`): `.ms-media`, `.ms-image` (max-width: 100%, rounded corners), `.ms-audio` (full-width).
  - 155 tests, all passing. Clean build.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 104
- **Import: fix `*goto_scene` optional label + `*line_break` paragraph handling.**
  - **`*goto_scene` target bug** (`choicescriptImport.ts`, `simpleCommandNode`): `*goto_scene scene_name starting_label` was calling `normalizeIdentifier(value)` on the full remaining text, converting `"scene_name starting_label"` to `"scene_name_starting_label"`. Fixed to split on whitespace and take only the first token as the scene name.
  - **`*line_break` in top-level prose** (`createImportedSceneGraph`): Unrecognized `*line_break` fell through to `pending.push(line)`, inserting the literal string `*line_break` into the passage body. Added a dedicated case before `simpleCommandNode`: pushes an empty string to `pending`, creating a paragraph break when the passage is assembled.
  - **`*line_break` in `buildBodyNodeChain`**: Same fix — `command === "line_break"` now pushes `""` to `proseBuf` instead of falling through to the literal push at the bottom of the loop.
  - **`*line_break` in pure-prose option bodies** (`addInlineOptionNodes`): When assembling `bodyText` from `bodyLines` via the pure-prose fast path, `*line_break` lines are now mapped to `""` before joining, so they create paragraph breaks in `option.body` without literal text.
  - **Tests**: 3 new tests — `*goto_scene` with optional label uses only the scene name as target; `*line_break` in top-level prose becomes a paragraph break (not literal); `*line_break` in choice option body becomes a blank line in `option.body`. Total: **155 tests, all passing**.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 103
- **Import: merge consecutive top-level `*set` and `*comment` commands into single nodes.**
  - **Problem**: Each `*set` or `*comment` line at top-level created its own separate graph node. Three `*set` lines in a row produced three nodes cluttering the canvas.
  - **Solution** (`choicescriptImport.ts`, `createImportedSceneGraph`): Added two look-ahead blocks before the general `simpleCommandNode` fallback.
    - `command === "set"`: walks forward collecting consecutive `*set` lines (stops at first unparseable line or non-set command), creates one `set` node with all `VariableSet` entries in `sets: [...]`. Title is `*set firstVar +N` for N extra sets, `*set firstVar` for a single one.
    - `command === "comment"`: walks forward collecting consecutive `*comment` lines, joins their bodies with `\n`, creates one `comment` node. Both blocks fall through to existing handling if zero entries are collected (e.g., first line fails to parse).
  - **Tests**: 3 new tests — consecutive sets merge to 1 node with 3 entries; non-consecutive sets stay separate; consecutive comments merge to 1 node. Total: **152 tests, all passing**.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 102
- **Manuscript view: all node types now rendered and exported.**
  - `ManuscriptView.tsx` previously returned `null` for `achieve`, `set`, `comment`, `image`, `sound`, `rand`, `input_text`, `input_number`, `temp`, `params` nodes, making them invisible in the prose reading mode and absent from the downloaded/copied text.
  - Added explicit rendering for `achieve` (shows `*achieve id` + note), `set` (shows each `var op val`), `comment` (shows comment body), and extended the catch-all structural renderer to cover `image`, `sound`, `rand`, `input_text`, `input_number`, `temp`, `params`.
  - `nodeListToLines` (download/copy) likewise gains cases for `achieve` (`[Achievement: id]`), `set` (`[Set: var op val]`), `comment` (`[Comment: text]`), `image` (`[Image: filename]`), and `if` (`[Condition: …]`).
- **Lint fix: `*rand`/`*input_number` variable bounds no longer false-positive.**
  - `lintInputNode` (graph linter) and `lintPreservedInputCommand` (source linter) previously treated any non-numeric `inputMin`/`inputMax` as an invalid bound error — so `*rand result 1 perception` (where `perception` is a variable) wrongly produced an error.
  - Both functions now distinguish numeric literals from identifier bounds: if a bound is a valid identifier, it validates that the variable is declared (warning if not) but does NOT require it to be a number literal. The `min > max` check only fires when both bounds are numeric. Error messages are now more specific (`has an invalid min bound: X` / `min bound (X) exceeds max bound (Y)` instead of `invalid bounds: X Y`).
  - **Tests**: 3 new tests — variable bounds no error, numeric min > max error, undeclared variable bound warning. Also updated the existing preserved-source rand bounds test to match the new message format. Total: **149 tests, all passing**.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 101
- **New node type: `*achieve`** — adds first-class graph support for the ChoiceScript achievement-unlock command.
  - **`types.ts`**: Added `"achieve"` to the `NodeType` union. Stores achievement ID in `node.target`.
  - **`choicescript.ts`**: Code generator emits `*achieve ${node.target}`; linter checks that target is non-empty, a valid identifier, and declared in the project's achievements list.
  - **`projectStore.ts`**: `defaultNodeTitle`, `createStoryNode` (picks first achievement ID), `renameNodeAchievement` (updates both `node.body` inline commands AND `achieve` node `target`/`title`), `removeNodeAchievement` (clears `target` + `title` for `achieve` nodes instead of removing them).
  - **`choicescriptImport.ts`**: `simpleCommandNode` handles `"achieve"` → creates `{ type: "achieve", target: id }`. Added `"achieve"` to `BODY_STRUCTURED_COMMANDS` so `*achieve` inside branch/option bodies becomes a proper node via `buildBodyNodeChain`.
  - **`NodeCard.tsx`**: Added `achieve` to `typeColors` (new amber/gold `--c-achieve` color) and `NodeIcon` (star shape). Target displayed inline (no `.txt` suffix).
  - **`styles.css`**: Added `--c-achieve` / `--c-achieve-tint` color variables for light and dark themes.
  - **`RightPanel.tsx`**: `AchieveNodeFields` component — shows a `<select>` over all declared achievements (with ID + title) when achievements exist, or a plain text input for the ID otherwise.
  - **`GraphCanvas.tsx`**: Added `"achieve"` to `creatableNodeTypes` (toolbar).
  - **`Dashboard.tsx`**: Added `achieve: "var(--c-achieve)"` to the `summarizeNodeTypes` color map.
  - **`PlaytestView.tsx`**: `achieve` node auto-advances on flow edge and registers the achievement ID in `earnedAchievements`.
  - **`sampleProject.ts`**: i18n labels added for PT (`"conquista"`), EN (`"achieve"`), ES (`"logro"`).
  - **Tests**: 6 new tests — import in scene body, import in `*if` branch, import in `*choice` option, lint error for undeclared achievement, no error for valid achievement, code generation. Total: **146 tests, all passing**.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 100
- **Import: nested `*if`/`*elseif`/`*else` blocks inside branch/option bodies.**
  - **Problem**: `*if` blocks appearing inside a `*if` branch body or `*choice` option body were not recognized — the entire `*if` block (including `*elseif`/`*else` continuations and their indented bodies) fell through to the prose buffer as raw text.
  - **`buildBodyNodeChain` upgraded** (`choicescriptImport.ts`): Added `command === "if"` case. Uses index-based look-ahead to collect: (1) the `*if` line + its indented body, then (2) any `*elseif`/`*else` continuations at the same level, each with their own indented body. The collected block is parsed with the existing `parseInlineIfBlock`. On success, creates the if node with `linkAll`, processes each branch via `addInlineBranchNodes` (recursively handles arbitrarily-deep nesting), then resets `prevId = null` and stows branch continuations into `pendingLinks`.
  - **`addInlineOptionNodes` — `isPureProse` guard updated**: Now also excludes `"if"` from being treated as pure prose.
  - **Tests**: 3 new tests — nested `*if`/`*else` inside `*if` branch body with goto terminals (verifies outer branch points to prose node, prose chains to inner if, inner branches lead to correct gotos); nested `*if`/`*elseif`/`*else` inside `*choice` option body with goto terminals in every branch; nested `*if`/`*else` inside `*choice` option body with prose continuing after the nested if (pendingLinks drain into the continuation passage, which then flows to finish). Total: **140 tests, all passing**.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 99
- **Import: nested `*choice`/`*fake_choice` blocks inside `*if` branch bodies (and `*choice` option bodies).**
  - **Problem**: `*choice` or `*fake_choice` blocks appearing inside an `*if` branch body were not recognized — the block lines (including option headers and their bodies) ended up as raw text inside a passage node.
  - **`buildBodyNodeChain` upgraded** (`choicescriptImport.ts`): Now uses index-based iteration (was `for...of`) so it can look ahead to collect indented blocks. Introduces a `pendingLinks: string[]` mechanism analogous to the main loop's `pendingContinuations` — option continuations from a nested choice are held in `pendingLinks` and drained into the next node that gets created in the chain.
    - `*choice` detected → collect indented block → parse with `parseInlineChoiceBlock` → create choice node + option nodes via `addInlineOptionNodes` (recursively); option continuations go to `pendingLinks`; `prevId = null`.
    - `*fake_choice` detected → collect block → try `parseFakeChoiceBlock` then `parseInlineFakeChoiceBlock` → create a single fake_choice node; `prevId = fake_choice_id` (chain continues normally).
    - Fallback: block pushed to prose if parser returns null.
  - **`link` → `linkAll`**: The inner link helper now also drains `pendingLinks` on each new node, connecting all dangling option continuations forward.
  - **Return type extended**: `buildBodyNodeChain` now returns `pendingLastIds: string[]` — option continuations that were not yet resolved when the chain ended.
  - **`mergeBodyContinuations`**: New shared helper used by `addInlineBranchNodes` and `addInlineOptionNodes`. Merges `lastId` + `pendingLastIds` into a single `continuationId`; if multiple, creates an empty passage "merge node" to fan them in.
  - **`addInlineOptionNodes` — `isPureProse` guard updated**: Now also excludes `choice` and `fake_choice` commands, preventing their block lines from being misidentified as pure prose.
  - **Tests**: 3 new tests — nested `*choice` in `*if` branch (goto terminals); nested `*choice` in `*if` branch (prose + terminal options); nested `*fake_choice` in `*if` branch with following prose (fake_choice → passage → finish chained correctly). Total: **137 tests, all passing**.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 98
- **Import: full structured intermediate command coverage in branch/option bodies + per-node word count in inspector.**
  - **`BODY_STRUCTURED_COMMANDS` extended** (`choicescriptImport.ts`): Added `gosub_scene`, `rand`, `input_text`, `input_number`, `save_checkpoint`, `temp`, `image`, `sound` to the set. All of these are handled by `simpleCommandNode`, so any of these commands appearing inside a `*if` branch body or `*choice` option body now create the correct graph node in the chain instead of ending up as raw text in a passage body.
  - **Per-node word count in inspector** (`RightPanel.tsx`): Added a `{N}w` badge to the `ip-meta` line when the selected node has any text content. Word count covers `body`, `prompt`, option texts, and option bodies; strips ChoiceScript variable substitution syntax (`${…}`, `@{…}`) before counting. Only shown when count > 0, so purely structural nodes (goto, finish, label, etc.) stay clean.
  - **Tests**: 3 new tests — `*rand` in `*if` branch body creates rand node; `*image` in `*if` branch body creates image node (chained to passage); `*save_checkpoint` in `*choice` option body creates checkpoint node (chained to goto). Total: **134 tests, all passing**.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 97
- **Import: `*gosub` and `*page_break` in branch/option bodies become structured nodes.**
  - **Problem**: `addInlineBranchNodes` and `addInlineOptionNodes` previously created a single passage node for ALL body lines before the terminal, so `*gosub subroutine` or `*page_break Label` inside a branch body ended up as literal raw text inside the passage body — incorrect and invisible to the graph.
  - **Solution — `buildBodyNodeChain`** (`choicescriptImport.ts`): New shared helper that segments body lines left-to-right into prose runs, structured intermediate commands (`*gosub`, `*page_break`), and a terminal. Creates a chain of nodes for each segment, linked by flow edges. Returns `{ firstId, lastId, hasTerminal }`.
  - **`addInlineBranchNodes` rewritten**: Now delegates entirely to `buildBodyNodeChain`. Falls back to a single empty passage node only if the chain produces nothing.
  - **`addInlineOptionNodes` rewritten**: Preserves the existing "pure prose → store as `option.body`" fast path (no intermediate commands, no terminal). For all other cases (any `*gosub`, `*page_break`, or terminal in the body lines), delegates to `buildBodyNodeChain`.
  - **Removed**: `extractTerminalCommand` and `commandNodeFromTerminal` — no longer needed.
  - **`BODY_TERMINAL_COMMANDS`** / **`BODY_STRUCTURED_COMMANDS`**: Module-level `Set`s used by both the chain builder and the pure-prose guard.
  - **Tests**: 3 new tests — `*gosub` in `*if` branch body becomes a gosub node (chained to finish); `*page_break` in `*if` branch body becomes a page_break node (chained passage → page_break → goto); `*gosub` in `*choice` option body becomes a gosub node (chained to goto). Total: **131 tests, all passing**.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 96
- **Three new lint rules for structural redundancy and dead labels.**
  - **All-same-target `*choice` warning** (`lintChoiceNode`): When all options in a `*choice` node point to the same target node (and all targets are valid), emits a `warning` — the choice is structurally inert and can be simplified. Only fires when there are 2+ valid options (skips nodes already flagged for missing targets to avoid double-warning).
  - **All-same-target `*if` warning** (`lintIfNode`): When a `*if` node has an `*else` branch and all branches point to the same node, emits a `warning` — the condition is irrelevant. Requires `*else` to be present so that all paths are guaranteed to reach the same target (without `*else`, some paths fall through, so the warning would be misleading).
  - **Unreferenced `*label` info** (`lintSceneGraph`): After the main node loop, collects all label names referenced by `*goto` and `*gosub` nodes, then emits an `info` issue for any `*label` node whose label text is never referenced. Helps authors find dead labels left over from refactoring.
  - **Tests**: 6 new tests — warns on all-same-target `*choice`; warns on all-same-target `*if` with `*else`; does not warn when branches differ; does not warn on all-same-target `*if` without `*else`; reports unreferenced label as info; does not report referenced label as unreferenced. Total: **128 tests, all passing**.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 95
- **Variable rename propagation fix + inline fake_choice guard support.**
  - **Bug fix — variable rename in option bodies** (`projectStore.ts`): `renameNodeVariable` was updating `option.cond.expr` and `option.sets` when a variable was renamed, but NOT `option.body` or `fakeOption.body` (added sessions 89-90). A rename like `strength → vigor` would leave `"Your ${strength} is high."` stale in option body text. Fixed by adding `body: option.body ? renameVariableReferences(option.body, from, to) : option.body` to both option and fakeOption maps.
  - **`parseInlineFakeChoiceBlock` guard support** (`choicescriptImport.ts`): Completes the `*if`/`*elseif`/`*else` guard support across all four choice parsers. Tracks `guardCond`, `guardActive`, and `currentIsDeep`. Deep options (4+ spaces under a guard) inherit the guard condition and have their body lines double-stripped. Top-level options clear the guard state. Same pattern as session 94's `parseInlineChoiceBlock` update.
  - **Test**: "imports `*if` guard on inline fake_choice option group with body text" — 3 options, guarded options get condition and body text, top-level option has no condition. Total: 122 tests, all passing.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 94
- **`*if` guards in inline choice + fake_choice parsers.**
  - **`parseInlineChoiceBlock`** (`choicescriptImport.ts`): Extends session 93's label-based guard support to the inline variant (options with body text, no `*goto`). Tracks `guardCond`, `guardActive`, and `currentIsDeep`. Deep options (inside a guard, at 4-5 spaces indent) inherit the guard condition. Body lines of deep options are double-stripped (`removeChoiceOptionIndent` applied twice, handling the extra 2-space indent from the guard level). `*else` clears the guard condition. Top-level options (`isNormalHeader`) clear guard state entirely.
  - **`parseFakeChoiceBlock`** (`choicescriptImport.ts`): Same guard logic applied to pure-header `*fake_choice` blocks (no inline body). Options inside `*if`/`*elseif` guards get the condition; `*else` and top-level options do not.
  - **Tests**: 2 new tests — inline `*choice` with `*if` guard (3 options, body text, passage created), `*fake_choice` with `*if`/`*else` guard (3 options, conditions verified). Total: 121 tests, all passing.

### 2026-05-17 — Claude Code (claude-sonnet-4-6) — session 93
- **`*if` guard on choice option groups + option body → NodeBodyEditor.**
  - **`parseChoiceBlock` guard support** (`choicescriptImport.ts`): Extended the label-based choice block parser to handle `*if (cond)` / `*elseif (cond)` / `*else` lines at option-level indent (≤ 3 spaces). Options indented inside the guard (4+ spaces) inherit the guard's `ChoiceCondition`. `*else` clears the guard (options after it get no condition). Top-level `#option` lines also clear the guard. Key fix: guard is NOT applied to top-level options even if one was active — `!isTopLevel ? guardCond : null`.
  - **Option body → NodeBodyEditor** (`RightPanel.tsx`): Both `choice` and `fake_choice` option body fields switched from plain `<textarea className="ip-opt-body">` to `<NodeBodyEditor>` with `variables` and `achievements` wired. Now has ChoiceScript syntax highlighting, variable/achievement autocomplete, and internal undo history inside the field.
  - **CSS** (`styles.css`): Replaced `.ip-opt-body`/`.ip-opt-body:focus` textarea rules with `.ip-opt-body-editor` overrides that set compact min-height (48px) and smaller font-size (12px) for the CodeMirror container.
  - **Tests**: 2 new tests — `*if` guard on single group, `*if`/`*elseif`/`*else` guard chain. Total: 119 tests, all passing.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 92
- **Option body gaps — find & replace + achievement linting.**
  - **Find & replace** (`projectStore.ts`): `replaceInNode` was skipping `option.body` and `fakeOption.body`. Fixed — both are now included in the text replacement pass, so `findAndReplace` operates on all prose in the project uniformly.
  - **Achievement linting in option bodies** (`choicescript.ts`): `lintChoiceNode` and `lintFakeChoiceNode` now receive `achievements: Set<string>` and call `lintAchievementCommands(option.body ?? "", ...)` for every option. `*achieve` commands buried in option body text are now validated (bad id, invalid identifier format, undeclared achievement).
  - **Tests**: 2 new tests — "lints `*achieve` in choice option body", "lints `*achieve` in fake_choice option body". Total: 117 tests, all passing.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 91
- **Canvas card polish + inline `*fake_choice` body import.**
  - **Passage body clipping** (`NodeCard.tsx`): Added `narrative-clip` class to passage body `<p>` in non-minimal density. The `.narrative-clip` CSS rule (already present) applies `-webkit-line-clamp: 2`, so long passages no longer make extremely tall canvas cards — just a clean 2-line preview.
  - **Option body preview on canvas** (`NodeCard.tsx`): In `rich` density, both `choice` and `fake_choice` option rows now show a single-line italic preview of `option.body` / `fakeOption.body` when set. Truncated at 70 chars with `…`. CSS: `.opt-body` uses `text-overflow: ellipsis` and inherits the grid column layout.
  - **Inline `*fake_choice` body import** (`choicescriptImport.ts`): Added `parseInlineFakeChoiceBlock` to parse `*fake_choice` blocks where options have body text (prose after the `#option` header, before the next option). Cleans leading/trailing blank lines. Drops through to raw passage fallback only when all options have no body. Wired as `parseFakeChoiceBlock(...) ?? parseInlineFakeChoiceBlock(...)` — simple fallback chain.
  - **Test**: "imports inline fake_choice option bodies onto fakeOptions" — verifies both option bodies are captured and no `choice_option_body` passage nodes are created. Total: 115 tests, all passing.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 90
- **`FakeChoiceOption.body` + complete option body integration.**
  - **`FakeChoiceOption.body`** (`types.ts`): Mirror of `ChoiceOption.body` — prose shown after the player selects a `*fake_choice` option. Generator emits body lines between header and the next option (no `*goto`, since `*fake_choice` resumes automatically). RightPanel now shows a resizable textarea for both choice and fake_choice option bodies.
  - **Word count** (`projectStore.ts`, `ManuscriptView.tsx`): `countSceneWords` and the manuscript `countWords` both now include `option.body` and `fakeOption.body` in the text they measure, so the scene subtitle, Dashboard, and manuscript stats are accurate.
  - **Linting** (`choicescript.ts`): `lintUnusedVariables` scans `option.body` / `fakeOption.body` for variable references. `lintChoiceNode` and `lintFakeChoiceNode` also flag `@{}`/`${}` references to undeclared variables inside option bodies.
  - **Manuscript view** (`ManuscriptView.tsx`): Choice options now render their body text below the option header, indented and italicised (`.ms-option-body .ms-para`). The text export (`nodeListToLines`) includes option body paragraphs too.
  - **CSS** (`directions.css`): `.ms-option` changed from `flex/align-items:baseline` to `flex-direction:column`; added `.ms-option-head`, `.ms-option-body`, `.ms-option-body .ms-para`.
  - **Tests**: 3 new tests — fake_choice body generation, undeclared variable in option body, unused variable exemption via option body. Total: 114 tests, all passing.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 89
- **`ChoiceOption.body` — inline option body text for `*choice` nodes.**
  - **Types**: Added `body?: string` to `ChoiceOption` in `types.ts`. Body text is narrative prose displayed after the player selects an option, before the flow jumps to `option.to`.
  - **Generator** (`choicescript.ts`): In the `*choice` block, body lines are now emitted between the option header and the `*goto`. Lines are split on `\n` and filtered for blanks, each prefixed with four spaces (`    `).
  - **RightPanel**: Added a resizable `<textarea class="ip-opt-body">` inside each option row, after the reuse selector. Empty value → `undefined` (no body stored). CSS: `ip-opt-body` styled to match the panel's visual language.
  - **Importer** (`choicescriptImport.ts`): `addInlineOptionNodes` now detects pure-prose inline bodies (no terminal command, no lines starting with `*`) and inlines them directly on the option instead of creating a `choice_option_body` passage node. An empty continuation passage node is created as the `to` target. Complex bodies (with terminal commands or CS directives) still follow the existing node-creation path.
  - **Tests**: 2 new tests — "inlines pure prose body text directly onto choice options" verifies the importer path; "generates option body text inline between header and goto" verifies the generator. Total: 111 tests, all passing.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 88
- **Search result excerpts + match highlighting; dynamic TopBar breadcrumb.**
  - **Search excerpts**: `searchProject` in `LeftPanel.tsx` was setting `detail: target` where `target` was the full node body (potentially hundreds of words). The result list would show the beginning of the text, never the part that actually matched. Fixed with `snippetAround(text, query, 90)` — extracts ~90 chars centred around the first match, with `…` ellipsis markers when text is truncated. Full text is kept in `searchText` so `addResult`'s relevance check still works.
  - **Match highlighting**: `SearchResults` now receives the raw `query` string and renders `result.detail` through `highlightMatch()`, which wraps the first matched substring in `<mark class="search-highlight">`. `.search-highlight` uses a translucent `--accent-1` background to make the match visible without breaking the line height.
  - **TopBar breadcrumb**: replaced the hardcoded `"primeira_decisao"/"first_decision"` placeholder with `selectedNodeTitle` — a new optional prop passed from `App.tsx` as `selectedNode?.title`. The selected node ID is shown in accent colour with `text-overflow: ellipsis` so long titles don't overflow the top bar.
  - 109 tests, all passing.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 87
- **`*finish` flow connections in SceneMapView.**
  - The scene map previously only showed explicit `goto_scene` / `gosub_scene` arrows, leaving the implicit sequential flow of `*finish` invisible. A scene with `*finish` nodes proceeds to the next playable scene in the `startup.txt` list, but that link couldn't be seen in the map.
  - `Connection.kind` extended to `"goto" | "gosub" | "finish"`.
  - Detection: for each non-startup, non-special scene, if it contains any `*finish` nodes AND has a next playable sibling in the ordered list, a `finish` connection is added (deduplicated with `seen` set).
  - Render: `*finish` arrows use `var(--c-finish)` (teal-green, `oklch(54% 0.12 155)`) with a tight dot-dash pattern (`2 4`) that visually reads as "implicit flow" vs. the solid line of `goto` and long-dash of `gosub`.
  - New CSS variables: `--c-finish` and `--c-finish-tint` added to both light and dark themes.
  - Legend updated with the new connection type.
  - 109 tests, all passing.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 86
- **Double-click `goto_scene`/`gosub_scene` nodes to navigate to target scene.**
  - Added `onNavigateToScene?: (sceneName: string) => void` prop to `NodeCard` and `GraphCanvas`.
  - `NodeCard`: `onDoubleClick` on the card div calls `onNavigateToScene(node.target)` when the node is a `goto_scene` or `gosub_scene` with a target set. `stopPropagation` prevents the canvas from creating a new passage on the same double-click.
  - Added `.is-navigable` class to these cards: `cursor: pointer` and a subtle accent border on hover, signalling interactivity to the user.
  - `App.tsx`: passes `onNavigateToScene` to `GraphCanvas`, looking up the scene by name and delegating to the existing `navigateToScene(id)` function.
  - 109 tests, all passing.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 85
- **Asset injection into OfficialPlayView iframe.**
  - Project assets (images, audio) are stored as data URLs in `project.assets`, but the CS runtime iframe requested them as file paths (e.g., `*image farol_bruma.svg` → runtime sets `<img src="...farol_bruma.svg">`). These requests silently failed.
  - Added `buildAssetPatcherJs(project)` to `OfficialPlayView.tsx`: builds a `{fileName → dataUrl}` map for all image/audio assets, then generates an IIFE that installs a `MutationObserver` on `document.documentElement`. The observer intercepts new/modified `src` attributes on `IMG`, `AUDIO`, and `SOURCE` elements, extracts the basename, and replaces with the matching data URL. Also calls the patch function immediately on the existing DOM for assets already present at script-load time.
  - Injected as an inline `<script>` in `buildSrcdoc`, after the CS engine scripts, only when the asset map is non-empty.
  - Added image node `n15` (`*image farol_bruma.svg`) to the intro scene in `sampleProject.ts` between `n1` (chegada_ao_farol) and `n9` (gosub), demonstrating the asset injection in the sample game. Adjusted x-positions for n9, n10, n11, n12, and n2 rightward to keep the canvas readable.
  - 109 tests, all passing.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 84
- **Fix visual disconnect of gosub subroutine in sample project.**
  - GraphCanvas renders only `data.edges` (explicit edges), NOT the derived edges produced by `deriveNodeEdges`. The derived gosub→label edge (n9→n10) was invisible in the canvas, making nodes n10/n11/n12 appear as floating orphans. Functionally the game worked (generated CS contains `*label revisar_diario` and the subroutine executes), but the graph looked broken.
  - Added explicit `{from: "n9", to: "n10", kind: "goto", label: "*gosub"}` edge to intro.edges. This renders as a dashed goto-colored arrow from the gosub call site to the label entry point, making the subroutine structure visually clear. `mergeGraphEdges` deduplicates it with the derived edge so no double-counting.
  - 109 tests, all passing.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 83
- **Balance sample project variables so all story branches are reachable.**
  - Traced all three paths from intro (A: sala da lente, B: praia, C: radio) and found two dead branches:
    1. `praia_neblina` good branch (`coragem >= 55`) unreachable: path B only accumulated coragem ≈ 51 via fairmath `%+10`, short of the threshold.
    2. `sala_maquinas` bad branch (`pistas < 2`) unreachable: both paths A and C arrived with pistas = 2.
  - **Fix 1 — intro n3 (sala_da_lente)**: Removed `pistas + 1` set and updated body text. Path A (bold/impatient, goes straight to lens) now arrives at `sala_maquinas` with pistas = 1 → hits the bad branch (`tentativa_as_cegas`) → bad ending. Narratively: courage without information fails.
  - **Fix 2 — intro n4 (marcas_na_areia)**: Removed `coragem %+ 10` set. Courage no longer comes from seeing the footprints — it comes from the player's decision at the cave itself.
  - **Fix 3 — praiaNeblina**: Added choice node `n6` (entrada_da_gruta) between n1 and the if-node n2. Options: "Entrar imediatamente" (sets `coragem + 10`) or "Recuar e esperar" (no set). Both options point to n2. Threshold stays at `coragem >= 55`. Results:
    - Enters + coragem was 45 → 55 ≥ 55 → good ending ✓
    - Recua + coragem stays 45 → 45 < 55 → bad ending ✓
  - All six branches now reachable: sala_maquinas good (path C), sala_maquinas bad (path A), praia good (path B + enter), praia bad (path B + retreat), final good (C or B+enter), final bad (A or B+retreat).
  - 109 tests, all passing. Clean build.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 82
- **Stable play panel + scene selector for OfficialPlayView.**
  - `OfficialPlayView.tsx`: Full rewrite to stabilise the iframe across project edits and add direct scene access.
    - `useState(() => buildSrcdoc(project, ""))` — srcdoc computed once at mount; project edits no longer cause the iframe to reload mid-game.
    - `iframeKey` — increments only on explicit **Reload** button click (↺), which rebuilds srcdoc from the latest project state.
    - `projectRef` — always holds the latest project so Reload always picks up current edits.
    - Scene selector dropdown — shown only when there is more than one playable scene; selecting a scene immediately rebuilds and re-mounts the iframe starting at that scene.
    - `buildInitJs` now takes a `forcedScene: string` param. When set: initialises `SceneNavigator` with the full scene list and overrides `window.nav.getStartupScene()` to return the chosen scene directly, bypassing startup. When empty: uses `new SceneNavigator(["startup"])` so the normal startup → scene_list flow runs.
  - `styles.css`: Added `.official-play-actions` (flex row, gap 6px) and `.official-play-scene-select` styles.
  - 109 tests, all passing. Clean build.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 81
- **Fix two more OfficialPlayView runtime errors.**
  - `null.style` crash: `loginDiv()` in `window.onload` accesses `document.getElementById("email").style` and `getElementById("logout").style` without null checks. These are the CoG account email/logout links inside `#identity`. Added `<a id="email" href="#" style="display:none"></a>` and `<a id="logout" href="#" style="display:none"></a>` to `#identity` in `buildSrcdoc`.
  - `non-existent command 'achievements'`: `generateStatsChoiceScript` was emitting `*achievements` but the CS engine (open-source version) command is `*check_achievements` (mapped to `Scene.prototype.check_achievements`). Fixed in `src/domain/choicescript.ts`. This also corrects exported stats files.
  - 109 tests, all passing. Clean build.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 80
- **Fix OfficialPlayView crash + missing menu buttons.**
  - **Root cause of crash**: `ui.js` top-level code (line ~3912) unconditionally does `document.getElementById("dynamic").innerHTML += "..."` while parsing. In a `srcdoc` iframe, the `<body>` isn't parsed yet when `<script src="ui.js">` runs, so `#dynamic` is null → TypeError. Fix: added `<style id="dynamic"></style>` to `<head>` BEFORE the `ui.js` script tag, so it exists when ui.js runs.
  - **Root cause of missing buttons**: All nav buttons were set `style="display:none"`. The CS engine only shows/hides `achievementsButton` and `bugButton` dynamically; the other buttons (`statsButton`, `menuButton`, `restartButton`) are expected to be visible by default in the HTML. Fix: removed `style="display:none"` from those three buttons.
  - Restructured the header into `#identity` (spans for title/author) + `#headerLinks` (button group), matching the real CS template structure. Fixed `onclick="menuButtonClicked()"` (non-existent) to `onclick="textOptionsMenu()"` (the real function).
  - 109 tests, all passing. Clean build.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 79
- **Official ChoiceScript runtime embedded in the editor as a side panel (replaces artisanal graph playtest as the main Play button).**
  - Downloaded all CS engine files to `public/play/`: `scene.js`, `navigator.js`, `ui.js`, `util.js`, `persist.js`, `alertify.min.js`, `style.css`, `alertify.css`.
  - `src/components/OfficialPlayView.tsx` (new): renders the official CS engine in an `<iframe srcdoc="...">`. Key details:
    - `compileScene(text)` pre-compiles each scene's raw ChoiceScript text into the format `allScenes` expects: `{ crc: 0, lines: string[], labels: Record<string,number> }`. The CS engine's `execute()` checks `typeof allScenes != 'undefined'` and uses `loadSceneFast()` which requires compiled scene data, NOT raw text.
    - `buildInitJs(project)` generates the init script setting `window.nav`, `window.stats`, `window.allScenes`, `window.achievements`, etc. Startup text uses `*goto_scene firstPlayableScene` override (unless startup.txt is imported). Stats scene (`choicescript_stats`) included in `allScenes` so Show Stats button works.
    - `buildSrcdoc(project)` wraps all CS engine scripts (loaded from absolute `/play/*.js` paths) + inline init.js into a full HTML document. Uses `safeJson()` to escape `</` in JSON (prevents HTML parser from closing script tags prematurely).
    - No service worker needed — `srcdoc` iframes inherit parent origin and can load same-origin scripts.
    - `key` prop on `<iframe>` forces full reload when project structure changes.
  - `src/App.tsx`: replaced `PlaytestView` import/usage with `OfficialPlayView`. Play button now shows the real CS game engine.
  - `styles.css`: added `.official-play`, `.official-play-head`, `.official-play-iframe` CSS rules.
  - 109 tests, all passing. Clean build.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 78
- **Playtest: interpolate option text. Use-tracker: count set.val reads. Linter: warn on never-read variables.**
  - `PlaytestView.tsx / choice + fake_choice option rendering`: Changed `{option.text}` to `{interpolate(option.text, stats)}` so ChoiceScript `@{var ...}` and `${var}` substitutions in option labels are resolved during play. The play trail also records the interpolated text. Both real choice and fake_choice rendering updated.
  - `choicescript.ts / computeVariableUses`: Extended `scanNode` to call `extractExpressionNames(set.val)` for every `*set` operation (node.sets, option.sets, fakeOption.sets, branch.sets) and `extractVariableReferences(option.text)` for option/fakeOption text. Previously a `*set strength rival + 10` did not count `rival` as a read use.
  - `choicescript.ts / computeVariableLocations`: Same gap fixed in `scanGraph` — `set.val` expression variable references and option/fakeOption text variable references now produce "read" location entries with correct scene/node info.
  - `choicescript.ts / lintUnusedVariables` (new function): Scans all scene graphs and preserved source texts for variable READ references (body/prompt interpolations, condition expressions, set.val expressions, option text). Emits `warning: variable "x" is declared but never read` for any declared variable with zero reads — UNLESS it is shown in the stats screen (`showInStats !== false`), which reads it implicitly. Called from `lintProject` after scene reachability.
  - `domain.test.ts`: 3 new tests. 109 tests, all passing. Clean build.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 77
- **Playtest: option reuse tracking (`*hide_reuse` / `*disable_reuse` / `*allow_reuse`).**
  - `PlaytestView.tsx / PlaySnapshot`: Added `usedOptions: string[]` field so undo (`goBack`) can restore which options had been used before the undone action.
  - `PlaytestView.tsx`: Added `usedOptions` state (`Set<string>`) keyed by `${nodeId}:${optionIndex}`. Reset in `restart()` and the `[project]` effect. Serialised as `[...usedOptions]` in `pushSnapshot`, restored as `new Set(prev.usedOptions)` in `goBack`.
  - `PlaytestView.tsx / choice option rendering`: Before rendering each option, check `usedOptions.has(optKey)`. If `option.reuse === "hide"` and already used → return null (option disappears). If `option.reuse === "disable"` and already used → button is disabled (grayed out). Default (`undefined` / `"allow"`) → always clickable. When an option is clicked, `optKey` is added to `usedOptions`.
  - Same logic applied to `fake_choice` option rendering.
  - 106 tests, all passing. Clean build.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 76
- **Variable rename propagation fixes + goto/gosub jump-to-label button.**
  - `projectStore.ts / renameVariableReferences`: Extended to also rename `@{varname` patterns (ChoiceScript conditional substitution), not just `${varname}` interpolation. Previously renaming `score` would leave `@{score high mid low}` unchanged.
  - `projectStore.ts / renameNodeVariable`: Added `prompt` field to renamed fields (choice/fake_choice prompts with `${var}` interpolation were silently skipped). Introduced `renameSet` helper that updates both `set.var` (the variable being assigned) and `set.val` (the value expression, which can reference other variables like `rival + 10`). Applied to node sets, option sets, fake-option sets, and branch sets. Also imported `VariableSet` type to keep the helper correctly typed.
  - `RightPanel.tsx / CommandNodeFields`: Added `onSelectNode` prop and passed it from `ContentTab`. In the `*goto` / `*gosub` inspector, added a `→` jump button (same style as the `*goto_scene` jump button) that calls `onSelectNode(targetLabelNode.id)` when the selected label exists in the current scene — allows one-click navigation from a goto node to its target label node.
  - 106 tests, all passing. Clean build.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 75
- **Linter: `*set` value variable refs + `*gosub_scene` entry label validation. Inspector: variable autocomplete in set value field.**
  - `choicescript.ts / lintSet`: Added `extractExpressionNames(set.val)` scan after the existing type/op checks. Any identifier in the value expression that isn't a declared variable (global, temp, or params) produces a `warning` — catches patterns like `*set score ghost_var + 10` where the referenced variable is undeclared.
  - `choicescript.ts / lintSceneGraph (gosub_scene handler)`: After confirming the target scene exists, the linter now reads `project.sceneData[target]` and checks whether the specified entry label (`node.body`) is present among the target scene's `*label` nodes. Emits a `warning` when the scene has labels but the requested one is absent (skips the check when the target scene has no labels yet, to avoid false positives during drafting).
  - `RightPanel.tsx / SetFields`: Replaced the plain `<input>` for number/string set values with `<ConditionInput>` — the same autocomplete-capable component used for `*if` condition fields. Typing a partial variable name shows a dropdown of matching declared variables. The wrapper `.cond-wrap` now has `flex: 1` inside `.ip-set-row`.
  - `styles.css`: Added `.ip-set-row .cond-wrap { flex: 1; min-width: 60px; }` so the autocomplete wrapper fills the row exactly as the previous plain input did.
  - `domain.test.ts`: Added 3 new tests — warns when set value references undeclared variable; does not warn when set value references a declared variable; warns when gosub_scene entry label is absent from target scene. 106 tests, all passing. Clean build.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 74
- **Dashboard project-wide KPIs + `*temp` variable visibility in playtest.**
  - `Dashboard.tsx`: Replaced single-scene `choiceCount`/`optionCount`/`endingCount` computations with `allProjectNodes` — a flat list built from `data.nodes` (active scene) plus all nodes from non-special `sceneData` entries. `choiceCount` now includes both `*choice` and `*fake_choice`; `optionCount` sums `options` and `fakeOptions`. KPI label changed from "endings in this scene" to "endings" to reflect the new project-wide scope.
  - `PlaytestView.tsx / clearTempVars` (new helper): Strips keys from the stats map that are not in `project.variables`, isolating temp vars for removal on scene transitions.
  - `PlaytestView.tsx / goto_scene handler`: Added `setStats(current => clearTempVars(current, project.variables))` so temp vars are dropped when the author navigates to a new scene (matching ChoiceScript's scene-local temp semantics).
  - `PlaytestView.tsx / finish handler`: Same clearTempVars call when the runtime advances to the next scene in the list.
  - `PlaytestView.tsx / sidebar`: Added `tempVarEntries` computation (stats keys not in `project.variables`) and a `pt-temp-section` block rendered below global vars when any temp vars are live. Temp var rows use `.is-temp` class (muted opacity, `--c-set` accent) to visually distinguish them from global vars. Flash animation still applies on `changedVars`.
  - `styles.css`: Added `.playtest-stat.is-temp`, `.playtest-stat.is-temp code`, and `.pt-temp-section` rules.
  - 103 tests, all passing. Clean build.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 73
- **Playtest arithmetic expression evaluation + copy-to-clipboard in generated file viewer.**
  - `PlaytestView.tsx / parseValue`: Signature changed to `(value, variable, stats)`. Booleans now delegate to `evaluateExpression`; numbers try `Number()` first, then fall through to `evaluateNumericExpression` for compound expressions like `score + 10`.
  - `PlaytestView.tsx / applySets`: Passes `next` (the in-progress state snapshot) to `parseValue` so multi-step `*set` sequences within a single node can reference variables set earlier in the same block.
  - `PlaytestView.tsx / initialStats`: Updated call site to pass `{}` as the third argument (no prior stats during initialisation).
  - `PlaytestView.tsx / evaluateNumericExpression` (new): Recursive-descent parser (primary → mulDiv → addSub) that substitutes variable values before tokenising; handles `+`, `-`, `*`, `/`, parentheses, and negative literals. Longest-name-first substitution prevents partial substring matches. Division by zero returns 0.
  - `PlaytestView.tsx / evaluateExpression`: Extended with `parseMulDiv` and `parseAddSub` layers between `parseNot` and `parseComparison`, so boolean expressions can contain arithmetic sub-expressions (e.g. `score + bonus > 50`).
  - `PlaytestView.tsx / tokenizeExpression`: Updated regex to include `+`, `*`, `/`, `-(?!\d)` (subtraction), and `-?\d+(?:\.\d+)?` (numeric literals including negatives). Negative lookahead `(?!\d)` disambiguates subtraction operator from negative number literal.
  - `PlaytestView.tsx / parsePrimary` (inside `evaluateExpression`): Paren-closing changed from hard `take()` to `if (peek() === ")") take()` to survive unclosed parens without throwing.
  - `GeneratedDocumentView.tsx / copy button`: Added a "Copy" button in `generated-doc-actions` that calls `navigator.clipboard.writeText(visibleContent)` and briefly shows "Copied!" (1.8 s) after success. Appears for both editable and read-only views; copies the live draft content when in editable mode.
  - 103 tests, all passing. Clean build.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 72
- **Playtest: interactive `*fake_choice` + `*sound` auto-advance. Import tests: `*achievement` and `*selectable_if`/reuse modes.**
  - `PlaytestView.tsx / useEffect`: Added `node.type === "sound"` to the comment/label auto-advance branch. Sound nodes now silently advance to their flow target without showing a Continue button (same as comment nodes — no interactive content in the playtest).
  - `PlaytestView.tsx / showContinue`: Added `node?.type !== "fake_choice"` to the exclusion list. `*fake_choice` nodes now require the reader to pick an option rather than showing a Continue button.
  - `PlaytestView.tsx / fake_choice render`: Replaced unconditionally-disabled buttons with a full interactive implementation. Each option evaluates its condition: `*if` conditions hide the option; `*selectable_if` conditions show it as disabled. Clicking a visible option pushes a snapshot, applies option `*set` commands, appends a trail entry, clears `pageBlocks`, and advances to the flow target — matching ChoiceScript's actual `*fake_choice` semantics where all options converge on the same continuation.
  - `domain.test.ts`: Added `imports *achievement declarations from startup.txt into project achievements` — verifies `id`, `title`, `points`, `hidden`, `preDesc`, `postDesc` for visible and hidden achievements.
  - `domain.test.ts`: Added `imports *selectable_if and reuse-mode option prefixes from choice blocks` — verifies `cond.type === "selectable_if"`, `cond.expr`, and `reuse` values (`hide`, `disable`, `allow`) round-trip correctly through the importer.
  - 103 tests, all passing. Clean build.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 71
- **`*sound` node type (parallel to `*image`).**
  - `types.ts / NodeType`: Added `"sound"` as a new node type.
  - `sampleProject.ts / I18nLabels.nodeTypes`: Added `sound` label in all three languages (PT: "som", EN: "sound", ES: "sonido").
  - `choicescript.ts / generateNodeChoiceScript`: Emits `*sound ${filename}` when `node.type === "sound"` and `node.target` is non-empty; silently skips when empty (same pattern as `*image`).
  - `choicescript.ts / lintSceneGraph`: Warns `"*sound needs a filename"` when a `sound` node has an empty `target`.
  - `choicescript.ts / lintPreservedScriptSource`: Added `sound` command block — warns when the filename is missing in preserved source.
  - `choicescriptImport.ts / isChoiceForgeBodyStop`: Added `"*sound "` prefix so sound commands end a passage body during import.
  - `choicescriptImport.ts / parseImportedNode`: Parses `*sound filename` raw CS lines into `{ type: "sound", title: "*sound filename", target: filename }` nodes.
  - `choicescriptImport.ts / patchNodeFromImportedCommand`: Handles re-import of ChoiceForge-exported `sound` nodes (round-trip).
  - `choicescriptImport.ts / defaultImportedWidth`: `sound` gets width 280 (same bucket as `image`).
  - `NodeCard.tsx / typeColors`: `sound` shares `--c-passage` / `--c-passage-tint` colours with `image`.
  - `NodeCard.tsx / NodeIcon`: Added speaker SVG icon for `sound` nodes.
  - `NodeCard.tsx`: Canvas card shows `node.target` filename (same as `image`); `goto_scene`-style `.txt` suffix excluded.
  - `GraphCanvas.tsx / creatableNodeTypes`: Added `"sound"` so it appears in the canvas toolbar.
  - `RightPanel.tsx / ContentTab`: Added inspector branch for `sound` — shows an audio-asset picker (`<select>`) when audio assets (mp3/ogg/wav/aac/flac/m4a) are present, falls back to a plain `<input>`. Changing the value updates `target` and `title`.
  - `Dashboard.tsx / nodeTypeColors`: Added `sound` → `--c-passage`.
  - `projectStore.ts / defaultNodeTitle`: Added `sound: "*sound"`.
  - `projectStore.ts / createDefaultNode`: Added `sound` branch returning `{ title: "*sound", target: "" }`.
  - `projectStore.ts / defaultNodeWidth`: Added `"sound"` to the 280px bucket.
  - `domain.test.ts`: Added 4 tests: generates `*sound` command; skips when filename empty; warns on missing filename; imports `*sound` lines as sound nodes. 101 tests, all passing. Clean build.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 70
- **Single-option choice lint + comment-to-description import + canvas filter hardening.**
  - `choicescript.ts / lintChoiceNode`: Added `warning` when a `*choice` or `*fake_choice` node has exactly 1 option (ChoiceScript runtime requires ≥ 2; 0 options remains an error). Both node types get the same rule.
  - `choicescriptImport.ts / parseStartup`: When parsing `*create` declarations, the function now looks at the immediately preceding line; if it is a `*comment`, its text becomes the variable's `desc` field (instead of defaulting to the variable name). Enables the common CS convention of documenting variables with a comment above them.
  - `domain.test.ts`: Added `warns when a *choice node has only one option` and `importChoiceScriptArchive maps *comment before *create to variable desc`. 97 tests, all passing.
  - `GraphCanvas.tsx`: Extracted `errorIds`/`warnIds` sets and passed them into `nodeMatchesFilter` calls; added `has:error`/`has:warning` filter predicates; plain text search now also checks `node.id`. Filter input placeholder and tooltip describe the full filter syntax.
  - Clean build.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 69
- **Canvas node filter: structured filter syntax.**
  - `GraphCanvas.tsx / nodeMatchesFilter`: Extended text search to support prefix filters. New accepted patterns:
    - `type:<X>` — matches nodes whose `type` contains X (e.g. `type:choice`, `type:passage`, `type:if`)
    - `tag:<X>` or `color:<X>` — matches nodes whose `colorTag` contains X (e.g. `tag:red`)
    - `status:todo` / `:todo`, `status:done` / `:done` — matches nodes by writing status
    - `has:note` — matches nodes with a private note set
    - `has:error` — matches nodes with a lint error
    - `has:warning` / `has:warn` — matches nodes with a lint warning
    - Plain text search now also matches `node.id`
  - `nodeMatchesFilter` now receives `errorIds` and `warnIds` sets (derived from `data.lints`) to support `has:error` / `has:warning`.
  - Filter input `placeholder` updated to show the syntax hint; `title` tooltip lists all supported prefixes.
  - `KeyboardShortcutOverlay.tsx`: Updated "Filter / search nodes" description to mention `type:`, `tag:`, `has:error` syntax.
  - 95 tests, all passing. Clean build.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 68
- **`opposed_pair` import round-trip fix + per-scene word count goals.**
  - `projectStore.ts / parseStatChartRows`: Replaced the simple per/text-only parser with a state-machine identical to `choicescriptImport.ts`. Added `StatChartRow` union type (`percent | text | opposed_pair`). The new `applyStatsText` branches on `chartType === "opposed_pair"` to set `opposedLow` and `fairmath: false`; `text`/`percent` rows now also clear `opposedLow`. This fixes `opposed_pair` variables losing their configuration when editing the generated `choicescript_stats.txt` and saving back.
  - `domain.test.ts`: Added test `importChoiceScriptArchive maps opposed_pair stat chart entries to opposedLow and desc` covering both the high label → `desc` and low label → `opposedLow` mappings, and verifying that `text` rows clear `opposedLow`. 95 tests, all passing.
  - `projectStore.ts / ProjectActions`: Added `updateSceneMetadata(id, patch: { wordGoal?, notes? }) => void` — a lightweight action that patches metadata-only fields without clearing `startupSource` (unlike `updateScene`, which resets it to force regeneration after renames). Used for word goal updates from the Dashboard.
  - `Dashboard.tsx`: Added optional `onUpdateSceneGoal` prop. Each scene row in the "words by scene" card now renders a compact `<SceneGoalInput>` — an inline number input (same style as the existing `.scene-goal-input`) that commits on blur or Enter. Already-set goals appear pre-filled; the goal marker and percentage remain on the bar when a goal is set.
  - `directions.css / .bar-row`: Widened grid from `140px 1fr 60px` to `140px 1fr 60px auto` so the new 4th goal-input column appears only where needed (auto collapses to 0 for rows without a 4th element).
  - `App.tsx`: Wired `onUpdateSceneGoal={(id, goal) => actions.updateSceneMetadata(id, { wordGoal: goal })}` into `<Dashboard>`.
  - Clean build.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 67
- **Lint console level+scene filters + `opposed_pair` linter fix + duplicate shortcut cleanup.**
  - `choicescript.ts / lintPreservedStatsSource`: Fixed linter incorrectly flagging `opposed_pair` label sub-lines as invalid row types. Added `opposedPairLabelsLeft` counter: after parsing an `opposed_pair varname` row, the next two indented lines are skipped as expected label lines. Added test asserting no errors for a valid `opposed_pair` block.
  - `BottomBar.tsx`: Added `filterScene` and `filterLevel` state. The console now shows a filter bar (`.con-filters`) with a level select (`all levels` / `errors only` / `warnings only`) and, when there are issues from more than one scene, a scene select. A `×` clear button and a "N shown" counter appear when any filter is active. Filters apply to the visible list only — the pills in the summary continue to show global totals. Added "no issues match" empty state.
  - `KeyboardShortcutOverlay.tsx`: Removed duplicate "F → Fit view" entry. Renamed the two remaining fit entries to "Fit all nodes to view" / "Fit selected nodes to view" and "Filter / search nodes" for clarity.
  - `styles.css`: Added `.con-filters`, `.con-filter-select`, `.con-filter-clear`, `.con-filter-count`, `.con-empty`.
  - 94 tests, all passing. Clean build.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 66
- **`*stat_chart opposed_pair` support.**
  - `types.ts / VariableSummary`: Added optional `opposedLow?: string` field — the low-end label for the opposed pair (high-end label is the existing `desc`).
  - `choicescript.ts / generateStatsChoiceScript`: When a visible variable has `opposedLow !== undefined` and `type === "number"`, emits the multi-line `opposed_pair` format (`  opposed_pair varName\n    High Label\n    Low Label`), falling back to `variable.name` as the low label when `opposedLow` is empty. Otherwise falls through to the existing `percent` / `text` logic.
  - `LeftPanel.tsx / VariablesList`: Expanded the stat-chart `<select>` from 3 to 4 options: `off` / `text` / `%` / `pair` (pair disabled for non-number types). Selecting "pair" sets `opposedLow: ""` and shows a compact `.stat-chart-low-input` text input below the select for the low-end label; switching away clears `opposedLow`.
  - `styles.css`: Added `.stat-chart-cell` (flex column), `.stat-chart-low-input`.
  - `domain.test.ts`: Added two tests — one asserting full `opposed_pair` output; one asserting the variable name is used as the low-label fallback when `opposedLow` is empty. 93 tests, all passing. Clean build.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 65
- **Playtest achievement tracking + `*achieve` line stripping.**
  - `choicescript.ts`: Exported `extractAchievementCommandTargets` (was private). Added new export `stripAchieveCommands(text)` — removes `*achieve` lines and collapses excess blank lines.
  - `PlaytestView.tsx`: Added `earnedAchievements: string[]` to state and `PlaySnapshot` (so back navigation restores them). `restart()` clears the list. When passage nodes auto-advance, `*achieve` command IDs are extracted from `node.body` and merged into `earnedAchievements` (dedup by ID). Same extraction happens for `set` nodes. The body text stored in `pageBlocks` and rendered in the terminal passage branch has `*achieve` lines stripped via `stripAchieveCommands`. Added an achievements section in the playtest sidebar (`.pt-achievements`) that appears once any achievement is earned, showing points and title for each.
  - `styles.css`: Added `.pt-achievements`, `.pt-achievement-row`, `.pt-ach-points`.
  - 91 tests, all passing. Clean build.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 64
- **Per-variable stat chart visibility (`showInStats`).**
  - `types.ts / VariableSummary`: Added optional `showInStats?: boolean` field (default `true` / shown when undefined).
  - `choicescript.ts / generateStatsChoiceScript`: Filters `project.variables` to `statVars` (those with `showInStats !== false`) before writing the `*stat_chart` block. If no visible variables remain the block is omitted entirely.
  - `LeftPanel.tsx / VariablesList`: Replaced the `fairmath` checkbox in the "stats" column with a `<select>` offering three options — `off` (sets `showInStats: false, fairmath: false`), `text` (sets `showInStats: undefined, fairmath: false`), `%` (sets `showInStats: undefined, fairmath: true`; disabled unless `type === "number"`). The column header "stats" is unchanged.
  - `styles.css`: Added `.stat-chart-select` (mono font, compact width, paper-1 background).
  - `domain.test.ts`: Added two new tests — one asserting hidden variables are excluded and visible ones remain; one asserting the `*stat_chart` block is omitted entirely when all variables are hidden. 91 tests, all passing. Clean build.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 63
- **Achievement reordering.**
  - `projectStore.ts / ProjectActions`: Added `moveAchievement(id: string, direction: "up" | "down") => void` to the interface.
  - `projectStore.ts / useProjectStore`: Implemented `moveAchievement` — finds the achievement by id, swaps it with its neighbor in the `achievements` array, then commits with `clearStatsSource(clearStartupSource(...))` (affects both `startup.txt` and `choicescript_stats.txt` ordering).
  - `LeftPanel.tsx`: Added `onMoveAchievement` to `LeftPanelProps`, destructuring, `AchievementsList` call site, and `AchievementsList` component signature. Added ↑/↓ `.var-move-btn` buttons inside each `ach-row` (reuses existing `.var-move-cell` / `.var-move-btn` styles). Buttons are disabled when the achievement is already first/last.
  - `App.tsx`: Wired `onMoveAchievement={actions.moveAchievement}`.
  - No new styles needed (reuses `.var-move-cell` / `.var-move-btn` from session 59). 89 tests, all passing. Clean build.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 62
- **Node type conversion in the inspector.**
  - `RightPanel.tsx`: Added `CONVERTIBLE` map defining allowed target types per source type: `passage → [choice, fake_choice, page_break, comment]`, `choice → [passage, fake_choice]`, `fake_choice → [passage, choice]`, `comment → [passage]`, `page_break → [passage]`. Added `getConvertibleTypes(from)` helper. Added `buildTypeConversionPatch(node, to, fallbackNodeId)` pure function implementing all conversion rules with appropriate field mapping (e.g., `passage.body → choice.prompt`, `choice.options → fake_choice.fakeOptions`, etc.). Added a `convert →` row in the inspector header (between color dots and meta row), visible when the current node type has at least one valid conversion and source is not preserved. Selecting a type triggers the patch immediately via `onUpdateNode`. Added `NodeType` to the import line.
  - `styles.css`: Added `.ip-convert-row`, `.ip-convert-label`, `.ip-convert-select`.
  - No store changes, no domain changes, no test changes. Clean build.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 61
- **`gosub_scene` entry-label autocomplete from target scene.**
  - `RightPanel.tsx / CommandNodeFields`: When a `gosub_scene` node has a target scene set, the inspector now resolves the target scene's graph from `project.sceneData` (falling back to `project.nodes` when the target is the active scene). It filters for `label` nodes and extracts their names via `stripCommandPrefix`. If any labels are found, the free-text input is replaced with a `<select>` listing them (plus a `— none —` option). Falls back to the plain `<input>` when the target scene has no labels or hasn't been visited yet. Changing the target scene clears the label selection (`body: ""`).
- **`image` node asset picker.**
  - `RightPanel.tsx / ContentTab`: The `image` node filename field is now a `<select>` listing all image-typed assets (filtered by extension: png, jpg, gif, webp, svg, avif) when at least one such asset exists in the project. Shows a "missing" option if the current value doesn't match any asset. Falls back to the plain `<input>` when no image assets are imported.
  - 89 tests, all passing. Clean build.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 60
- **Lint warning badges on canvas node cards.**
  - `NodeCard.tsx`: Added `hasWarning?: boolean` prop. Updated className to use `hasWarning` instead of `node.warning` (the latter was always undefined). Added a `⚠` badge element (`.node-flag.node-flag-warn`) when `hasWarning && !hasError`.
  - `GraphCanvas.tsx`: Added `warnNodeIds` computed from `data.lints` where `level === "warning"` and `lint.node` is set. Passed `hasWarning={!errorNodeIds.has(node.id) && warnNodeIds.has(node.id)}` to each `NodeCard`. Error takes priority over warning.
  - `styles.css`: Added `.node-flag-warn` overriding background to `var(--warn)` and color to `var(--ink)`.
- **Per-scene word count goals.**
  - `types.ts`: Added `wordGoal?: number` to `SceneSummary`. Persists via the existing `updateScene` action (no store changes needed).
  - `LeftPanel.tsx`: Added a `scene-goal-row` below the synopsis input for non-special scenes. Contains a dashed number input for the goal (updates `scene.wordGoal` via `onUpdateScene`) and a thin progress bar tracking words vs. goal. Progress bar turns green when goal is met.
  - `Dashboard.tsx`: Words-by-scene bar chart now shows a `bar-goal-marker` (vertical tick) at the goal position when a scene has a goal. The bar turns green when the goal is reached. The value label appends the completion percentage when a goal is set.
  - `styles.css`: Added `.scene-goal-row`, `.scene-goal-input`, `.scene-goal-track`, `.scene-goal-fill`, `.bar-goal-marker`.
  - 89 tests, all passing. Clean build.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 59
- **Variable reordering in the Variables tab.**
  - `projectStore.ts`: Added `moveVariable(name, direction: "up" | "down")` to `ProjectActions` interface and implementation. Finds the variable by name, swaps it with the neighbour in the `variables` array, then commits via `commitProject` + `clearStartupSource` (because variable order affects the generated `*create` block in `startup.txt`).
  - `LeftPanel.tsx`: Added `onMoveVariable` prop to `LeftPanelProps`, destructured it, and passed it down to `VariablesList`. Updated `VariablesList` to accept `onMoveVariable`. Added a new leading column in `vars-table` containing `↑` / `↓` buttons (`.var-move-btn` inside `.var-move-cell`). First row's `↑` and last row's `↓` are `disabled`. `colSpan` on the cross-reference expansion row updated from 7 to 8.
  - `App.tsx`: Wired `onMoveVariable={actions.moveVariable}` on `<LeftPanel>`.
  - `styles.css`: Added `.var-move-cell`, `.var-move-btn`, `.var-move-btn:hover`, `.var-move-btn:disabled`.
  - 89 tests, all passing. Clean build.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 58
- **Achievement cross-reference navigation in the Achievements tab.**
  - `choicescript.ts`: New exported type `AchievementLocation { sceneName, nodeId, nodeTitle }` and function `computeAchievementLocations(project)` → `Map<string, AchievementLocation[]>`. Scans all `sceneData` graphs for `*achieve <id>` commands in `node.body` using `extractAchievementCommandTargets`. Duplicate (scene+node) entries suppressed.
  - `LeftPanel.tsx`: Imported `computeAchievementLocations` and `AchievementLocation`. Added `onNavigateToNode?` to `AchievementsList` props. Added `achievementLocations` memo and `expandedAch` state. The use-count in each achievement card's footer is now a `.var-uses-btn` button; clicking it toggles an inline `AchievementLocationList` below the card. New `AchievementLocationList` component reuses `.var-locs` / `.var-loc-row` CSS from the variable cross-reference, labelling each entry with a `*achieve` kind badge.
  - No CSS additions needed — reuses the `.var-locs-*` rules from session 56.
  - 89 tests, all passing. Clean build.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 57
- **Playtest history / back navigation.**
  - `PlaytestView.tsx`: Added `PlaySnapshot` type capturing the full playtest state (`sceneName`, `nodeId`, `stats`, `returnStack`, `pageBlocks`, `playTrail`). Added `historyStack: PlaySnapshot[]` state. Added `pushSnapshot()` helper that appends the current state to the stack. Added `goBack()` helper that pops the last snapshot and restores all state fields at once.
  - Snapshot is pushed before every user-driven state transition: `advance()` (Continue button), `submitInput()` (input_text/input_number form submit), and choice option click handler. Automatic `useEffect` advances (passage auto-flow, `set`/`temp`/`rand`/`goto` auto-advance) do NOT push snapshots, so back always returns to the last deliberate decision point.
  - `restart()` clears `historyStack` alongside the other state.
  - A "← back" button appears in the playtest header whenever `historyStack.length > 0`, coloured in `accent-1`. Its title tooltip shows how many steps are available.
  - `styles.css`: Added `align-items: center` to `.playtest-actions` and a `.playtest-back-btn` colour rule.
  - No domain model or test changes.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 56
- **Variable cross-reference navigation in the Variables tab.**
  - `choicescript.ts`: New exported function `computeVariableLocations(project)` returns `Map<string, VarLocation[]>`. `VarLocation` carries `{ sceneName, nodeId, nodeTitle, kind: "write" | "read" }`. The function scans all `sceneData` graphs (not just the active scene): `*set` nodes and `inputVar` fields produce `"write"` entries; variable references in `body`, `prompt`, `option.cond.expr`, `branch.expr` produce `"read"` entries. Duplicate (scene+node+kind) entries are suppressed so the list stays concise.
  - `LeftPanel.tsx`: Imported `computeVariableLocations` and `VarLocation`. Added `onNavigateToNode?: (sceneName: string, nodeId: string) => void` to `LeftPanelProps` and `VariablesList`. The `uses` count in each variable row is now a `<button className="var-uses-btn">` that, when clicked, toggles an inline expansion row (`var-locs-row`) showing all usage locations. Locations are grouped by scene, each rendered as a clickable `var-loc-row` button that fires `onNavigateToNode`. Zero-use variables keep the count non-interactive (greyed). New helper components `VarLocationList` and `groupVarLocsByScene` added at the bottom of the file.
  - `App.tsx`: Wired `onNavigateToNode` in the `<LeftPanel>` call — navigates to the target scene then focuses the node after a tick (to let the scene switch settle).
  - `styles.css`: Replaced `.var-uses` static span with `.var-uses-btn` interactive button styles (hover, active state). Added `.var-locs-row`, `.var-locs`, `.var-locs-scene`, `.var-locs-scene-name`, `.var-loc-row`, `.var-loc-kind`, `.var-loc-kind-write`, `.var-loc-kind-read`, `.var-loc-title`.
  - 89 tests, all passing. Clean build.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 55
- **Manuscript view: TOC sidebar, scene synopses, multi-line prompt fixes.**
  - `ManuscriptView.tsx`: Added `sectionWordCounts` (Map from scene name to word count) to drive per-scene word counts in the TOC. Restructured `ms-body` to a flex row: a fixed-width `<nav className="ms-toc">` sidebar (project scope only) and a `<div className="ms-content">` scrollable column. Each TOC entry is a `<button>` that scrolls to the scene divider via `getElementById` + `scrollIntoView`. Scene synopsis (from `scene.notes`) appears below the scene name in both the TOC and at the scene divider in the content column.
  - `ManuscriptView.tsx`: Fixed multi-line choice prompts in the reading view — split `node.prompt` on `\n`, filter blanks, emit one `<p className="ms-prompt">` per line (mirrors PlaytestView fix from session 53).
  - `ManuscriptView.tsx`: Fixed multi-line prompts in the plain-text export (`nodeListToLines`) — each line gets its own `> line` prefix instead of one block.
  - `directions.css`: Updated `.ms-body` to `display: flex; overflow: hidden`. Added `.ms-toc`, `.ms-toc-head`, `.ms-toc-btn`, `.ms-toc-name`, `.ms-toc-synopsis`, `.ms-toc-wc`, `.ms-scene-synopsis`. Updated `.ms-content` to `flex: 1; overflow-y: auto`. Added `.ms-content > div` rule for per-section max-width centering and vertical gap.
  - No domain model changes, no test changes.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 54
- **Inspector navigation: jump-to-target buttons + incoming connections.**
  - `RightPanel.tsx / ContentTab`: Added `onSelectNode?: (id: string) => void` prop to `ContentTab` and threaded it from `RightPanel`. In the choice node content tab, each option row now has a `→` button next to the target `<select>` that calls `onSelectNode(option.to)` to select and re-center that node on the canvas.
  - `RightPanel.tsx / LogicTab`: In the `*if` branch list, each branch row now has a `→` button next to the branch target `<select>` that calls `onSelectNode(branch.to)`.
  - New `IncomingConnections` component: mirrors the existing `OutgoingEdges` component but shows edges where `edge.to === node.id`. Each incoming edge renders a clickable button (`flow-target`) that navigates to the source node. Added to the bottom of both the `if` node and generic logic tab views. Returns `null` when there are no incoming edges.
  - No domain model changes, no test changes, no generator changes.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 53
- **Multi-line choice and fake_choice prompts.**
  - `RightPanel.tsx`: Replaced `<input className="ip-prompt">` with `<NodeBodyEditor>` (wrapped in `.ip-prompt-editor`) for both `choice` and `fake_choice` content tabs. The prompt editor has variable/achievement autocomplete and spellcheck, matching the passage body editor. A word-count badge appears when the prompt is non-empty.
  - `styles.css`: Added `.ip-prompt-editor` overrides to constrain the CodeMirror min-height to 64px (vs. 120px for passage body editors). Added `white-space: pre-wrap` to `.node-prompt` so multi-line prompts render correctly on canvas cards.
  - `PlaytestView.tsx`: Fixed prompt rendering to split on `\n` and emit one `<p className="playtest-prompt">` per line (filter out blank lines), so multi-paragraph choice prompts display correctly in playtest. Previously, all lines appeared collapsed into one paragraph.
  - Generator (`choicescript.ts`) already handled multi-line prompts correctly — it emits `node.prompt` before `*choice` / `*fake_choice`, and newlines in the prompt produce valid ChoiceScript output. No generator changes needed.
  - No domain model changes, no test changes needed.

### 2026-05-16 — Claude Code (claude-sonnet-4-6) — session 52
- **`@{variable opt1 opt2}` support: linter + playtest interpolation + auto-advance cleanup.**
  - `extractVariableReferences` in `choicescript.ts` (already landed mid-session) now also extracts the first identifier from `@{var ...}` patterns via `/@\{([a-zA-Z_][\w]*)\b/g`, so undeclared variables inside `@{}` substitutions trigger the usual "undeclared variable" lint warning.
  - `interpolate()` in `PlaytestView.tsx` updated to expand `@{var opt1 opt2}` at playtest time:
    - 1 option: always returns the single option (unconditional).
    - 2 options: truthy → opt0, falsy → opt1.
    - 5+ options with a number variable: maps value 0–100 in 20-unit bands to the matching option (index clamped at 4).
    - Otherwise: truthy → opt0, falsy → last option.
    - `${var}` substitution still runs after `@{}` expansion.
  - `comment` and `label` nodes added to the useEffect auto-advance logic in `PlaytestView.tsx`: they now silently follow their flow edge instead of rendering a "Continue" button.
  - Two new tests in `domain.test.ts`: one asserts a warning when `@{strength strong weak}` is in a passage body and `strength` is undeclared; one asserts no warning when `strength` is declared.
  - 89 tests, all passing.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 51
- **Project snapshots — named, persistent restore points.**
  - `SnapshotMeta` interface exported from `projectStore.ts`: `{ id, name, createdAt, wordCount, sceneCount }`.
  - Storage: index at `choiceforge.snapshots.v1` (array of metas); data at `choiceforge.snapshot.data.<id>` (full project JSON). Separated so individual entries can be deleted without rewriting all of them.
  - Up to 5 snapshots; oldest data key is removed from localStorage when the limit is exceeded.
  - Three new actions on `ProjectActions`: `saveSnapshot(name)`, `restoreSnapshot(id)`, `deleteSnapshot(id)`.
  - `projectRef` added to `useProjectStore` so `saveSnapshot` always reads current project inside the memoized actions object without adding it to deps.
  - `snapshotIndex` returned from `useProjectStore()` alongside `{ project, lintedProject, actions }`.
  - New component `SnapshotPanel.tsx`: backdrop modal with name input, save button, list of entries (name, formatted date, word count, scene count), Restore → confirm-step → confirm restore, del button.
  - Restore wraps through `setTrackedProjectState` so it is undoable.
  - TopBar: "Snapshots" button opens the panel; i18n-aware label (PT: "Snapshots", ES: "Capturas", EN: "Snapshots").
  - CSS in `directions.css`: `.snap-backdrop`, `.snap-panel`, `.snap-head`, `.snap-title`, `.snap-close`, `.snap-desc`, `.snap-save-row`, `.snap-name-input`, `.snap-list`, `.snap-empty`, `.snap-entry`, `.snap-meta`, `.snap-name`, `.snap-detail`, `.snap-actions`, `.snap-confirm-restore`.
  - Clean build; no domain changes, tests not required.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 50
- **Passage word-count badge on canvas node cards.**
  - In `NodeCard.tsx`, passage nodes in `isRich` (dense) mode now show a `node-wc` div at the bottom of the card with the word count (e.g., `"42 words"`).
  - Word count strips `${...}` and `@{...}` substitutions before splitting; computed via `countCardWords()` helper at the bottom of the file.
  - When the count exceeds 600, the badge uses `node-wc-long` class (amber text, matching the linter warning colour) to give a visual cue at a glance.
  - CSS: `.node-wc` (right-aligned, 10px mono) + `.node-wc.node-wc-long` (amber).
- **Linter: warn on overlong passage nodes (>600 words).**
  - In `lintSceneGraph`, passage nodes with `body` word count > 600 emit a `warning`: `passage "title" is very long (N words)`.
  - `countBodyWords()` private helper added to `choicescript.ts` (same substitution-stripping logic as the card badge).
  - Test added: "warns when a passage node exceeds 600 words" — verifies 601-word passage triggers the warning and 600-word passage does not.
  - All 87 tests pass; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 49
- **SelectionBar: bulk color-tag assignment.**
  - `COLOR_TAG_KEYS` extracted from inside `GraphCanvas` to module scope so both `GraphCanvas` and `SelectionBar` can reference it without duplication.
  - After the done/todo status buttons, the SelectionBar now shows: a separator, 6 color-dot buttons (one per tag color), and a `×` clear-tag button.
  - Each dot calls `onBulkUpdateNodes(ids, { colorTag: tag })` via the existing `onBulkUpdateNodes` prop.
  - The `×` button calls `onBulkUpdateNodes(ids, { colorTag: undefined })` to strip all tags from the selection.
  - CSS: `.sel-bar-color-dot` — 14px circle, uses `--ct` CSS var for background (same pattern as `zoom-color-dot`), `opacity: 0.6` → `1` on hover with ink border.
  - Clean build; no domain changes, tests not required.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 48
- **Minimap drag-to-pan.**
  - `centerOnPointer` renamed to `panToPointer` in the `Minimap` component.
  - `onPointerDown` now calls `e.currentTarget.setPointerCapture(e.pointerId)` before panning, so the pointer is captured to the SVG element for the duration of the drag.
  - Added `onPointerMove={(e) => { if (e.buttons > 0) panToPointer(e); }}` so dragging across the minimap continuously pans the canvas.
  - CSS: `.minimap svg { cursor: grab; }` + `.minimap svg:active { cursor: grabbing; }` (was `crosshair`).
- **`A` hotkey: add passage at viewport center.**
  - Pressing `A` (without Ctrl/Meta, outside a text input) creates a new `passage` node centered in the current viewport.
  - Position formula: `x = round((viewportW/2 − pan.x)/zoom − 150)`, `y = round((viewportH/2 − pan.y)/zoom − 30)`.
  - Bails early if `sourcePreserved` to avoid mutation on imported read-only projects.
  - `onAddNode` added to the keyDown `useEffect` dependency array.
  - `KeyboardShortcutOverlay.tsx`: `A` → "Add passage at viewport center" added to the Canvas group.
  - Clean build; no domain changes, so tests not required.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 47
- **Linter: duplicate choice option text warning.**
  - In `lintChoiceNode`: a `seenOptionText` Set is built as options are validated; if a non-empty option text appears twice (case-insensitive), a `warning` lint issue is emitted: `duplicate option text "…" in "…"`.
  - Same pattern in `lintFakeChoiceNode` with `seenFakeText`.
  - All 86 tests still pass.
- **Inspector: image node preview.**
  - When an `image` node is selected, the ContentTab looks up the asset by `node.target` in `project.assets`.
  - If found and has a `dataUrl`: shows a `.ip-image-preview` block with the actual image thumbnail (max 180px tall) and the filename below.
  - If `node.target` is set but the asset is not found: shows a `.ip-image-missing` warning in amber mono text.
  - Fields (filename, alignment, alt text) remain below the preview.
  - CSS: `.ip-image-preview`, `.ip-image-thumb`, `.ip-image-name`, `.ip-image-missing` added to `styles.css`.
  - Zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 46
- **Canvas filter: navigate between matches with ‹ / › buttons (or Enter / Shift+Enter).**
  - `filterResultIdx` state added; reset to 0 via `useEffect` whenever `canvasFilter` changes.
  - `filterMatches` derived array computed when filter is active.
  - `goToFilterResult(delta)` function: cycles through matches, calls `onPan` to centre the target node in the viewport, and selects it via `setSelectedId`.
  - Filter bar updated: when matches exist, shows `‹` / `›` nav buttons around a `currentIdx+1/total` counter. When filter is active with zero matches, shows `0/N` in error colour.
  - `Enter` / `Tab` in the filter input advances to next; `Shift+Enter` / `Shift+Tab` goes to previous.
  - CSS: `.canvas-filter-nav`, `.canvas-filter-empty` added to `styles.css`.
  - Zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 45
- **Scene Map: todo badge and progress bar on each card.**
  - `doneCounts` map computed in `SceneMapView` (same pattern as LeftPanel): iterates each scene's nodes from `data.sceneData` (active scene uses `data.nodes`) to count `status === "done"` vs total.
  - `todoN` (total − done) shown as an amber `.map-card-todo` tag in the meta row alongside lint counts, when > 0.
  - A 3px progress bar (`.map-progress-track` / `.map-progress-fill`) appears at the card bottom when any nodes are done, filling proportionally to done/total. Shown only when `done > 0` (same as scene list behaviour).
  - `CARD_H` bumped from 96 → 116 so SVG arrow endpoints clear the taller cards.
  - `.map-card` changed from `height: 96px` to `min-height: 96px` to allow natural content growth.
  - CSS: `.map-card-todo`, `.map-progress-track`, `.map-progress-fill` added to `directions.css`.
  - Zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 44
- **Playtest: variable flash highlight on change.**
  - `changedVars: Set<string>` state + `flashTimerRef` track which variables are currently highlighted.
  - `flashVars(names: string[])` helper sets the changed set and clears it after 1.4 s via a debounced timeout (rapid successive changes restart the timer).
  - Called from every path that mutates stats: `set` node, `rand` node, `temp` node, `if`/`elseif` branch sets, `passage` node sets, choice option sets (in `onClick`), `advance` (node-level sets), `submitInput` (input nodes).
  - Cleared on restart and project change.
  - In the stats sidebar, changed rows receive `is-changed` class which triggers a CSS `@keyframes pt-var-flash` animation: a warm highlight fades back to the base background over 1.4 s.
  - `useRef` added to React imports.
  - CSS: `@keyframes pt-var-flash` and `.playtest-stat.is-changed` added to `styles.css`.
  - Zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 43
- **Focused writing mode for passage nodes.**
  - A small `⛶` expand button appears in the passage inspector header row (right of the word count). Clicking it opens a full-screen overlay (`WritingFocusOverlay`) rendered via `createPortal(…, document.body)` so it sits above everything.
  - The overlay has a blurred/dimmed backdrop, a centred 860×85vh modal with the node title, live word count, and a large `NodeBodyEditor` that fills the available height (the usual 320px `max-height` on the scroller is removed in this context).
  - Clicking the scrim outside the modal or pressing Escape closes the overlay. All edits propagate back to the node in real time through the same `onUpdateNode` callback.
  - `useEffect(() => setWritingFocus(false), [node.id])` closes the overlay automatically when the selected node changes.
  - `import { createPortal } from "react-dom"` and `useEffect` added to `RightPanel.tsx` imports.
  - CSS: `.wf-expand-btn`, `.wf-overlay`, `.wf-modal`, `.wf-head`, `.wf-title`, `.wf-wc`, `.wf-close`, `.wf-body` + nested `.node-body-editor` overrides added to `styles.css`.
  - `ip-label-row` gained `gap: 6px` so the new button fits cleanly.
  - Zero TS errors; clean build.
  - Updated "Not Yet Implemented": removed "Inline node-body editor with syntax highlighting" (NodeBodyEditor already uses CodeMirror with ChoiceScript syntax highlighting and variable/achievement autocomplete).

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 42
- **PlaytestView: choice history trail in the stats sidebar.**
  - New `TrailEntry` discriminated union (`{ kind: "scene"; name }` | `{ kind: "choice"; text; num }`).
  - `playTrail` state initialised to `[{ kind: "scene", name: project.sceneTitle }]` and reset on restart/project change.
  - Scene transitions (`goto_scene`, `finish`) append a `scene` entry in the auto-advance useEffect.
  - Choice selections append a `choice` entry inline in the option `onClick`.
  - Rendered below the variable list in `.playtest-stats` as a `.pt-trail` block: scene entries shown in mono/muted as "→ name", choice entries shown as "#N text" with full text in a `title` tooltip and text-overflow ellipsis.
  - The list caps at `max-height: 220px` with `overflow-y: auto` to stay compact even after many steps.
  - CSS: `.pt-trail`, `.pt-trail-head`, `.pt-trail-list`, `.pt-trail-scene`, `.pt-trail-choice` added to `styles.css`.
  - Zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 41
- **PlaytestView: accumulated page text + navigate-to-editor.**
  - Passage nodes with a flow target now auto-advance instead of requiring a "Continue" click per node. Their body and note are pushed to `pageBlocks: PageBlock[]` state; the accumulated text renders above the first interactive node (choice, page_break, input, etc.) separated by a thin horizontal rule.
  - `pageBlocks` is cleared on: project change, Restart, choice selection, and page_break "Continue".
  - A `onNavigateToNode?: (sceneName, nodeId) => void` prop was added. When provided, a small "↗ editor" button appears in the node header row; clicking it closes the playtest and selects the node in the editor (same `navigateToScene` + `setSelectedId` + `setPlayOpen(false)` pattern as Dashboard/Manuscript).
  - `passage` excluded from `showContinue` so no Continue button flashes during auto-advance.
  - `restart` logic extracted into a named function so both Restart button and project-reset effect reuse it cleanly.
  - CSS: `.playtest-goto-btn`, `.playtest-history`, `.playtest-history-block + .playtest-history-block`, `.playtest-history-sep` added to `styles.css`.
  - Zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 40
- **Manuscript view: clickable node titles and todo status badges.**
  - `ManuscriptViewProps` gained `onNavigateToNode?: (sceneName: string, nodeId: string) => void`. Passed from `App.tsx` using the same `navigateToScene` + `setSelectedId` + `setView("editor")` pattern as the Dashboard todo list.
  - `NodeBlock` now accepts `sceneName` and `onNavigate` props. The title `<h2>` becomes clickable when `onNavigate` is set (`.ms-node-title-link`), hovering turns it accent-colored with a matching border underline.
  - Nodes with `status === "todo"` show a small amber `.ms-todo-badge` pill ("todo") inline in the title row, visible in both scene and project scope.
  - Choice/fake_choice blocks now also render the title element (consistent with passage blocks).
  - CSS: `.ms-node-title-link`, `.ms-node-title-link:hover`, `.ms-todo-badge` added to `directions.css`; `gap: 6px` added to `.ms-node-title` flex row.
  - Zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 39
- **Variable name autocomplete in condition expression inputs.**
  - New `ConditionInput` component (bottom of `RightPanel.tsx`): wraps a plain `<input>` with a live dropdown. As the author types, the last identifier-shaped word before the cursor is matched against all declared variable names (`startsWith`, case-insensitive); up to 7 suggestions appear in a floating list. Clicking (or `mousedown` to avoid blur race) inserts the completion and restores cursor position via `requestAnimationFrame`. Dropdown closes on blur with a 150ms delay to allow click events to register.
  - Replaces the three bare `<input>` condition fields: (1) `*if`/`*elseif` branch expressions in `LogicTab`, (2) "advanced condition" raw field in `ChoiceConditionBuilder`, (3) same in `FakeChoiceConditionBuilder`.
  - `useRef` added to React import in `RightPanel.tsx`.
  - CSS: `.cond-wrap`, `.cond-suggestions`, `.cond-suggestion`, `.cond-suggestion:hover` added to `styles.css`.
  - Zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 38
- **Added scene-level notes (synopsis) field.**
  - `src/domain/types.ts`: `notes?: string` added to `SceneSummary`. Optional, no migration required. All 86 tests still pass.
  - `src/components/LeftPanel.tsx`: a one-line `<input class="scene-notes">` appears below the progress bar in each scene row. Placeholder `"synopsis…"` fades in on hover; typing saves directly via `onUpdateScene`. Click is stopped from propagating so the notes field doesn't switch scenes.
  - `src/components/SceneMapView.tsx`: when a scene has notes, a `map-card-notes` div appears above the stats row, showing up to 2 lines with `-webkit-line-clamp`.
  - CSS: `.scene-notes`, `.scene-notes::placeholder`, `.scene-notes:focus` in `styles.css`; `.map-card-notes` in `directions.css`.
  - Zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 37
- **Added bulk status toggle to the multi-select bar.**
  - `projectStore.ts`: new `bulkUpdateNodes(ids, patch)` action — applies the same patch to all listed node IDs in a single `commitProject` call, creating one undo history entry for the whole batch.
  - `GraphCanvas.tsx`: `onBulkUpdateNodes` prop added to `GraphCanvasProps` and destructured; threaded into `SelectionBar`. `NodeStatus` imported. Two new buttons at the end of the bar: `✓` (mark all done) and `○` (mark all todo), separated from alignment buttons by a `.sel-bar-div`. `.sel-bar-status` CSS class for slightly larger font on unicode symbols.
  - `App.tsx`: `onBulkUpdateNodes={actions.bulkUpdateNodes}` wired on `<GraphCanvas>`.
  - Zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 36
- **Added color tag canvas filter.**
  - 6 small colored dot buttons appended to the zoom-controls bar (after the snap toggle, separated by a thin vertical divider).
  - Clicking a dot toggles that color tag in an `activeColorTags: Set<NodeColorTag>` state; multiple tags can be active simultaneously.
  - When any tag is active, nodes without a color tag or with a non-matching color tag are dimmed (`.is-dimmed`) — composing with the existing text filter so both can be active at once.
  - Inactive dots are rendered at low opacity (0.35), hovered at 0.75, active at full opacity with an ink-colored ring border.
  - `NodeColorTag` and `COLOR_TAG_VALUES` imported into `GraphCanvas.tsx`; `COLOR_TAG_KEYS` constant list; `zoom-divider`, `zoom-color-dot`, `zoom-color-dot.is-active` CSS added.
  - Zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 35
- **`*if` branch condition expressions on canvas edges.**
  - For edges of kind `if`/`elseif`/`else`, the source node's `branches` array is searched for the matching branch; the condition expression (`branch.expr`) is shown as the edge label instead of the stored `*if`/`*elseif` label. `else` branches show `"else"`. Long expressions are truncated at 22 chars with "…".
  - Same foreignObject approach as choice labels; label width widened to 130 for if/elseif/else edges.
  - No schema changes — computed at render time.
- **Live word count in passage node inspector.**
  - A `N words` counter appears right-aligned next to the "body" label, updating as the author types. Skips `${var}` and `@{...}` interpolations for an accurate prose word count.
  - `ip-label-row` flex row + `ip-word-count` CSS added to `styles.css`.
  - Zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 34
- **Added option text labels on choice edges in the canvas.**
  - For every edge of `kind === "choice"`, the source node's `options` array is searched for the option whose `to` matches the edge target; the option text is shown as a label on the edge midpoint (truncated to 22 chars with "…" if longer).
  - Uses the existing `.edge-label` style (monospaced, paper background, colored border). The foreignObject is 130px wide for choice labels vs. 100px for other labels.
  - No schema or store changes needed — label is computed at render time from the live node data.
  - `if`/`elseif`/`else`/`*goto`/`*gosub` edges already had stored `edge.label` values; unchanged.
  - Zero TS errors; clean build.

### 2026-05-15 — Claude Code (claude-sonnet-4-6) — session 33
- **Added global todo list panel to Dashboard.**
  - `src/components/Dashboard.tsx`: added `onNavigateToNode?: (sceneName: string, nodeId: string) => void` prop; imported `useMemo`; computed `todoItems` by scanning `data.nodes` (current scene) and all `data.sceneData` entries, filtering for `status === "todo"`; added `groupByScene()` helper that preserves scene encounter order; rendered a "todo nodes" card at the bottom of `dash-grid` showing items grouped by scene name, each row clickable to navigate.
  - `src/App.tsx`: wired `onNavigateToNode` on the `<Dashboard>` render — looks up the scene by name, calls `navigateToScene`, `setSelectedId`, and `setView("editor")` to land the user directly on the target node.
  - `directions.css`: added `.dash-todo-empty`, `.dash-todo-list`, `.dash-todo-scene`, `.dash-todo-scene-name`, `.dash-todo-item`, `.dash-todo-type`, `.dash-todo-title` rules.
  - Zero TS errors; clean build.

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
