# Changelog

All notable changes to ChoiceForge are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project does not yet follow strict SemVer because nothing is published.

The full session-by-session log lives in [`agents.md`](./agents.md) and includes file paths, rationale, and test counts for every change.

---

## [Unreleased]

### Added
- **Bilingual README** (`README.md` English, `README.pt-BR.md` Portuguese) with full project overview, getting-started, architecture, all 24 node types, editing workflow, import/export, linter, playtest, Tauri desktop setup, Cloudflare Pages deploy, and contributing rules.
- **MIT License** (`LICENSE`) with a trademark notice clarifying that "ChoiceScript" remains a Choice of Games LLC trademark and the MIT grant does not extend to it.
- **CONTRIBUTING.md** with the eight non-negotiable invariants, code style, testing expectations, and the new-node-type / new-scene-action checklists.
- **GitHub Actions CI** (`.github/workflows/ci.yml`) runs type check, tests, and build on every push to `main` and on PRs.
- **GitHub issue templates** for bug reports and feature requests, plus a PR template with an invariant checklist.
- **Dependabot config** with weekly npm / monthly actions / weekly cargo updates and grouped PRs for CodeMirror, Tauri, and React ecosystems.
- **Shared parsing helpers** consolidated into `src/domain/parsing.ts` (`commandName`, `commandValue`, `stripCommandPrefix`, `gosubTarget`, `generatedNodeLabel` — previously duplicated 2–4× across the codebase).
- **Per-language defaults** for newly added nodes (`createStoryNode`): seed prose for `passage`, `choice`, `fake_choice`, `comment`, `input_text`, `input_number`, `page_break` now respects the editor's UI language (PT/EN/ES).
- **DEFLATE compression** for exported `.zip` packages via `fflate.zipSync` (level 6 for text, level 0 for already-compressed asset types). Replaces the hand-rolled STORE-only zip builder.

### Fixed
- **Paragraph breaks in exported choice option bodies** (`generateNodeChoiceScript`): `option.body?.split("\n").filter(Boolean)` was silently dropping blank lines and squashing paragraph breaks into one paragraph in the exported `.txt`. Now preserves internal blank lines via a new `emitOptionBodyLines()` helper that also trims leading/trailing blanks.
- **`updateMetadata` no longer discards preserved `startupSource`** for unrelated changes (e.g., `wordGoal`). Only clears when `title` or `author` is in the patch.
- **Tauri native save** strips the runtime-derived `lints[]` array before writing to disk — fixes bloated `.json` exports.
- **Worker race in `convertCurrentSceneToVisual`**: parsed nodes/edges previously landed in whatever scene happened to be active when the worker finished, not the scene that was actually parsed. Now captures the dispatched scene name and only writes back if the user is still on that scene.
- **`duplicateNode` Y offset**: was using `node.w` (width!) in the vertical offset, placing duplicates far below proportional to width. Now uses a conservative height estimate.
- **Achievement parser** (`parseAchievements` in both `choicescriptImport.ts` and `projectStore.ts`): no longer consumes the next `*achievement` line as `preDesc` when an achievement has no descriptions. Guard against `*command` lines.
- **`bytesToBase64`**: quadratic string concat replaced with chunked `btoa` (browser) / preallocated array join (fallback). Much faster on large imported assets.
- **Magic root id `"n1"` removed** from `graphLayout.ts`, `generateSceneChoiceScript`, and `lintSceneGraph` orphan check. Imported projects with non-standard ids no longer see their real root flagged as orphan or emitted out of order.
- **`connectNodes` default option text** is now the target node's title (was the English-only `"Go to {title}"`).

### Performance
- **Bundle splitting** via `manualChunks` in `vite.config.ts`: CodeMirror, React, and fflate ship as separate chunks. Main app bundle dropped from 904 KB to 344 KB (under Vite's 500 KB warning threshold).

### Testing
- **UI test layer** — Vitest + Testing Library scaffold (`vitest.config.ts`, `tests/ui/setup.ts`). New scripts: `test:ui`, `test:ui:watch`, `test:ui:coverage`, `test:all`. CI runs both domain and UI suites.
- **44 UI tests** across:
  - `NewProjectModal`: language switching, blank-project flow, close button, Enter-to-submit.
  - `useProjectStore` (renderHook): initial state, metadata updates that preserve startup source on unrelated changes, language-aware `addNode` defaults (EN/PT/ES), `duplicateNode` Y positioning, variable lifecycle with rename propagation, scene lifecycle, undo/redo, `connectNodes` default option text.
  - `LeftPanel`: i18n correctness for search results / no-results / replace status across EN/PT/ES (the `labels.words === "words"` heuristic regression), no React key warning when variables tab renders.
  - `RightPanel`: empty-state hint i18n, source-preserved banner localization (EN/PT/ES), private-notes localization, `Convert` button callback, disabled inputs in sourcePreserved mode, title-edit callback flow.
- **`addScene` / `duplicateScene` bug** caught by tests: both actions appended new scenes to the end of the array, placing them after `choicescript_stats` instead of before. Fixed via a new `lastIndex` helper.

### Internal
- 387 domain-layer tests pass via `node --test` (was 382 before this changelog window).
- 44 UI tests pass via `npm run test:ui`. Total: **431 tests** across both layers.
- `tsconfig.json` adds `allowImportingTsExtensions: true` to support Node's `--experimental-strip-types` runner with the new shared helpers module.

---

## Earlier history

See `agents.md → Session Log` for the full per-session diary going back to the initial scaffold. Highlights from before this changelog was started:

- Tauri v2 desktop scaffold with native file open/save dialogs.
- Comprehensive in-app `HelpGuide` modal with 6 tabs.
- Resizable nodes on the canvas.
- Auto-height re-layout after initial render.
- 100% lint-key test coverage (382 tests).
- Custom canvas with pan, zoom, fit view, minimap, edge-drop quick node creation.
- Pragmatic ChoiceScript importer that handles common `*choice`, `*fake_choice`, `*if`, `*goto`, `*goto_scene`, `*gosub`, `*set`, `*input_*`, `*temp`, `*params`, `*achieve`, etc.
- Official ChoiceScript runtime embedded for in-editor playtest.
- Bilingual UI (PT/EN/ES) via `I18nLabels`.
