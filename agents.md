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
