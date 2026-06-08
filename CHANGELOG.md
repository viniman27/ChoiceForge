# Changelog

All notable changes to ChoiceForge are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project does not yet follow strict SemVer.

The full session-by-session log lives in [`agents.md`](./agents.md) and includes file paths, rationale, and test counts for every change.

---

## [0.1.0] — 2026-05-27

First public release with desktop installers.

### Desktop release pipeline
- `.github/workflows/desktop-release.yml`: tag-triggered GitHub Actions workflow that cross-builds macOS (universal Intel+Apple Silicon) `.dmg` and Windows x64 `.msi` installers via `tauri-apps/tauri-action`, then drafts a GitHub Release with both attached. Manual `workflow_dispatch` also supported.
- Tauri scaffold completed: app icons generated from `public/favicon.svg`, `bundle.targets` explicit, category/short/long description/homepage metadata filled in so the bundlers don't fail.
- First-launch behaviour: unsigned builds, so macOS asks for right-click → Open and Windows SmartScreen asks for confirmation. Code signing is on the roadmap.

### Dependency triage
- Closed three major-version Dependabot PRs with explanations (TypeScript 5→6, Vite 4→8, @vitejs/plugin-react 4→5) — those need a coordinated upgrade and don't go in a first public release.
- Accepted four safe bumps: `@codemirror/view 6.42.1→6.43.0`, `react group 19.2.5→19.2.6`, `actions/setup-node v4→v6`, `actions/checkout v4→v6`.

### Documentation
- README (EN + PT-BR) rewritten with hero, three big CTAs (Try in browser / Download desktop / Source), and a 'Pick how you want to use it' table. Desktop App promoted to a first-class section.
- `docs/cloudflare-pages.md` → `docs/deploying.md`: generalised to host-agnostic instructions with a 'common gotchas' section.

---

## [Unreleased]

## [0.6.0] — 2026-06-08

### Added
- **Variable casing lint** (`name_casing_inconsistent`, warning level) — surfaces references that match a declared variable case-insensitively but use a different casing (`coragem` declared, `${Coragem}` used). The ChoiceScript engine normalises casing internally so it isn't a bug for the runtime, but it is a silent readability bug for anyone reading the code months later. Scans passage bodies, prompts, `*if`/`*elseif`/`*selectable_if`/`*set` expressions, `*input_*`/`*rand` targets, option text/body/conditions/sets, branch expressions, and preserved scene/startup/stats sources. 6 new tests. Inspired by `analysis/variable-casing/` in [M3ales/choicescript-tree](https://github.com/M3ales/choicescript-tree) — M3ales confirmed in conversation that even though CS doesn't care, many cogdemos games have inconsistent casing in practice.
- **Graphviz `.dot` export** — new "**.dot graph**" button in the TopBar, next to **Export**. Emits a `digraph` with one cluster per non-special scene, nodes coloured by type (sRGB hex approximating the editor's OKLCH palette), edges styled by kind (`flow`/`choice`/`if`/`elseif`/`else` solid, `goto` dashed), and cross-scene edges for `*goto_scene`/`*gosub_scene` pointed at the target cluster's first node. Useful for sharing the project structure outside ChoiceForge (`dot -Tsvg project.dot > project.svg`). On desktop opens the native save dialog; on web triggers a browser download. Inspired by `renderer/graph/` in [M3ales/choicescript-tree](https://github.com/M3ales/choicescript-tree). 6 new tests.

### Internal
- Test count: 387 → **399 domain tests** + 99 UI = **498 passing**.
- Two-branch development workflow (`main` for production, `dev` for preview at `dev.choiceforge.pages.dev`) — documented in `docs/dev-workflow.md`.
- Small `DEV` badge appears in the bottom-right corner of preview deploys so it's instantly clear when you're not on production.

## [0.5.1] — 2026-05-28

### Fixed
- **CRITICAL: Quicktest and Randomtest hung at "Running…" forever in v0.5.0** — the new "Download log" feature added `log: allLines.join("\n")` to the iframe `postMessage` payload, but `\n` inside a TypeScript template literal was emitted as a literal newline character into the generated JS source. The browser parsed the srcdoc, hit `log: allLines.join("` followed by an actual line break inside the string literal, threw `SyntaxError: Invalid or unexpected token`, and never executed the `postMessage` call — so the parent never learned the test finished. Both srcdocs now use `"\\n"` so the emitted JS reads `"\n"` correctly. Added `tests/ui/validationViewLifecycle.test.tsx` (3 tests) covering the iframe-mount + message-receive flow so this regression can't reach release again.
- **`Has *stat_chart` check now uses the generated stats output** instead of just `project.statsSource`. Projects with no custom stats source still get a real `*stat_chart` auto-built from `variables` (those with `showInStats !== false`), and the readiness checklist now reflects that — the sample project's row correctly shows ✓ instead of warning about a missing stat chart.

## [0.5.0] — 2026-05-28

### Added
- **`Ready?` tab in Validate for submission** — new default tab with a 6-point CoG submission readiness checklist: no lint errors (required), word count ≥ 25 000, has achievements, has `*stat_chart`, quicktest passes (required), randomtest ≥ 10 000 iterations passes (required). Each row shows a status icon (✓ pass / ! warn / ✗ fail / ○ pending) and a detail line; the test rows have a one-click "Run" / "Run with 10k" button. Live summary banner at top calls out whether required checks pass, recommendations remain, or you're ready to ship. Designed to replace the "run four things separately, mentally track what's done" workflow with a single glance.
- **Download log button** in Quicktest / Randomtest tabs — saves the full test output (including the lines beyond the 5000-line display truncation) to a timestamped `.txt` file. On desktop opens the native save dialog; on web triggers a browser download. Useful for pasting into CoG submission tickets or sharing with co-authors.
- **`nativeSaveBytes(bytes, name, label, extensions)`** helper in `platform/fileSystem.ts` — generic Tauri save dialog + binary write. Used by both the ZIP export and the new log download.

### Changed
- Quicktest and randomtest results now **persist across tab switches within the session** and the same project — switching between `Ready?`, `Quicktest`, and `Randomtest` no longer wipes the last result. Invalidated automatically when the project's scene/node/variable/achievement counts change.

## [0.4.4] — 2026-05-28

### Added
- **DevTools enabled in desktop production builds** — added the `devtools` feature to the `tauri` crate so users can press **F12** (or **Ctrl+Shift+I** on Windows / **Cmd+Option+I** on macOS) to open the WebView inspector. Useful for reading the `[ChoiceForge]` update-check logs and any other runtime diagnostics without needing a dev build. ChoiceForge is an open-source local editor that handles no secrets — making the inspector available everywhere is a reasonable tradeoff for debuggability.

## [0.4.3] — 2026-05-28

### Fixed
- **Desktop export ZIP did nothing** — the export button used the browser `<a download>` pattern (`URL.createObjectURL` + simulated click) which silently no-ops in the Tauri webview. Added `nativeExportZip()` that pops the Tauri save dialog and writes the ZIP bytes through `plugin-fs::writeFile`. New `fs:allow-write-file` capability granted. Web export path unchanged.
- **Randomtest UI hung at "Running…" after a fatal error** — `randomtest.js` sets `processExit = true` and breaks the iteration loop on the first error, never emitting the closing `Time: Xs` line. Our completion handler only watched for `Time:`, so the panel never settled. Now also settles immediately on `RANDOMTEST FAILED`.
- **Sample project's `*restore_checkpoint` demo broke randomtest** — `restore_checkpoint` is forbidden inside randomtest (per CoG runtime). The sample's "Restaurar o checkpoint antes de seguir." option is now guarded with `*if (not(choice_randomtest))`, so randomtest never picks it but quicktest still exhausts both branches.
- **`choice_randomtest` and friends no longer trigger `undef_var` warnings** — added the 18 ChoiceScript runtime / test-harness built-ins (`choice_randomtest`, `choice_quicktest`, `choice_purchase_supported`, `choice_save_allowed`, etc.) to `EXPRESSION_RESERVED` so conditions referencing them lint clean.

### Changed
- **Update check now re-runs on window focus** (debounced to once every 5 minutes). Previously the check fired exactly once at app launch — so if you started the app *before* a new release was published, you'd never see the banner until the next restart. Alt-tabbing back to ChoiceForge now retriggers the check.

## [0.4.2] — 2026-05-28

### Fixed
- **Randomtest crashed with `ReferenceError: nav is not defined`** — the v0.4.1 randomtest srcdoc concatenated `util.js + scene.js + navigator.js + seedrandom.js + randomtest.js` into a single Worker Blob, but never declared the `nav` and `stats` globals that `randomtest.js` expects to be pre-populated by `web/<gameName>/mygame.js`. The Worker hit line 180 (`nav.setStartingStatsClone(stats)`) immediately on load and threw. Injected a shim between `seedrandom.js` and `randomtest.js` that defines `nav = new SceneNavigator([scene_list])` and `stats = {…initial values from project variables…}` — same pattern an exported game's `mygame.js` would use. Randomtest now runs cleanly and reports per-iteration progress + final `RANDOMTEST PASSED / FAILED` line.
- **Randomtest completion / error detection rewritten** — previously matched random words ("error", "fail", "missing") in any output line, producing false positives on completely normal output. Now detects the official `RANDOMTEST PASSED` / `RANDOMTEST FAILED` markers and the trailing `Time:` line for unambiguous completion, and only counts `RANDOMTEST FAILED`, `ERROR:`, and `WARNING ` lines as errors.

### Added
- **Diagnostic logging on every update check** — `checkForUpdate` now logs `[ChoiceForge] checking for updates (current: vX.Y.Z, tauri: true/false)` on every launch and either confirms `no update — github latest is vX.Y.Z` or warns with the failure reason (HTTP status, missing fields, exception). Earlier silent-null returns made it impossible to tell whether the Tauri updater plugin had crashed, the GitHub API was rate-limited, or there genuinely was no new release.
- **`window.__cfCheckForUpdate()` devtools hook** — manual force-check that bypasses the dismissed-version filter, useful when diagnosing why a banner didn't appear.

### Notes for v0.4.0 / v0.4.1 users
- The 6-hour `localStorage` cache was removed in 0.4.1 but it affects when you get the *next* check on your *current* version. If you're on 0.4.0 and the v0.4.1 banner never appeared, the cache was holding "0.4.0 is latest" for up to 6 hours past the v0.4.1 release. Download v0.4.2 manually from [Releases](https://github.com/viniman27/ChoiceForge/releases) once, then auto-update will work normally from then on.

## [0.4.1] — 2026-05-28

### Fixed
- **Quicktest crashed with FATAL on every project** — the v0.4.0 `ValidationView` ran `Scene.execute()` (the normal player runtime) instead of the official `autotester()` exhaustive DFS. The player runtime expects UI input on every `*choice` so it threw on the first choice node in every project. Replaced the srcdoc with a faithful port of `quicktest.html`: per-scene `autotester()` invocation, full stub set (`printFooter`, `printShareLinks`, `clearScreen`, `safeCall`, ~25 others), `gotoSceneLabels` pre-scan, `Scene.prototype.warning` capture, and `Scene.prototype.verifySceneFile` that rejects unknown scene references. Quicktest now actually walks every path through every scene and reports the same errors the Choice of Games review tool would.
- **Update check cache removed** — previously the GitHub Releases poll was cached 6 h in localStorage, so a user on v0.3.0 might not see a freshly published v0.4.0 banner for up to 6 hours. Per user request: "tem versão nova avisa, simples assim". Every launch now hits the API directly with `Cache-Control: no-store`. Legacy cache key cleaned up on first run.

### Added
- **Sample-project quicktest regression test** (`tests/ui/sampleProjectValidation.test.ts`): 6 new tests (lint + quicktest × PT/EN/ES) that pull the sample project through the same engine the in-app Validate panel runs. Any future regression where the sample no longer passes the official autotester fails CI before publish.

## [0.4.0] — 2026-05-28

### Added
- **Validate for submission panel** — new `✓ Validate` button in the top bar opens a modal that runs the official Choice of Games **Quicktest** (exhaustive DFS over every path, catches missing labels / undefined variables / runtime errors) and **Randomtest** (N random playthroughs, default 1000, catches errors in rare paths). Pass these before submitting a game to Choice of Games for review. Runs the actual ChoiceScript engine in an isolated iframe with the project's exported `.txt` files loaded in memory — no upload, no temp files. Randomtest spawns the official worker so iteration count is configurable up to 100 000.

### Fixed
- **Top bar title/author input layout** — inputs no longer get squashed or overlapped at narrow viewport widths. Added `min-width:0` + `overflow:hidden` at the right grid track levels, switched the inputs from `clamp(72px, 9vw, 170px)` fixed widths to `flex:1 1 0` with `min-width:40px` + `max-width:170px`. Focused input expands at the expense of the inactive one. Inputs got `placeholder="title"/"author"` + native `title` attribute so the purpose is obvious even when truncated.

### Changed
- **Import vs Folder buttons** — kept both but added clear tooltips explaining the difference. `Import` is for individual `.json` / `.zip` / `.txt` files; `Folder` picks a directory and imports all `.txt` scenes inside (shortcut for full ChoiceScript game directories).

## [0.3.0] — 2026-05-28

### Added
- **Real desktop auto-updater** via the official `tauri-plugin-updater`. When a newer release is published, the desktop app's update banner now shows **"Install & restart"** instead of just opening the release page. Clicking it downloads the signed update, applies it in place, and relaunches — no manual install needed. Web users continue to see the "View release" link since there's no in-place install for the web build.
- **Update package signing** — every desktop release published via the workflow is now signed with a minisign key (private key stored as GitHub Actions secret `TAURI_SIGNING_PRIVATE_KEY`; public key embedded in `tauri.conf.json`). The installer + `latest.json` manifest are produced together so the updater plugin can verify before applying.

### Documentation
- **Clearer macOS Gatekeeper unblock instructions** — README and release notes now make the **Terminal command** (`xattr -dr com.apple.quarantine /Applications/ChoiceForge.app`) the primary recommendation, with the System Settings path spelled out step-by-step including the warning to click **OK** (not "Move to Trash") on the initial dialog. The "Open Anyway" button only appears in **System Settings → Privacy & Security** for ~1 hour after the block dialog.

## [0.2.0] — 2026-05-28

### Added
- **Desktop autosave to the open `.json` file** (1.5 s debounce after any change). Previously the desktop app only autosaved to the webview's localStorage and the on-disk file stayed stale until you hit Ctrl+S explicitly. Now the file is kept in sync. Web mode is unchanged.
- **Dirty indicator in the desktop window title** (`●` prefix) while there are unsaved-to-disk changes; clears once the autosave completes.
- **In-app update check** — on launch the app checks the GitHub Releases API once (cached 6 h), compares the latest tag against the running version, and shows a top-of-screen banner with "View release" / "Later" / "Turn off" when a newer release is available. Opt-out is permanent; "Later" dismisses for the current version only.
- **HelpGuide expanded with three new tabs**:
  - **Patterns** — six common story structures (linear chain, branching with merge, conditional fallthrough, subroutine, cross-scene flow, loop with exit) as ASCII mini-diagrams.
  - **Cheatsheet** — condensed ChoiceScript syntax reference grouped by category.
  - **FAQ** — 12 entries focused on real gotchas, opening with the question "Do I need to use `*label` nodes?".
- **Enriched Node Types tab** — each of the 24 nodes now shows the generated CS command, a description, "Use when:" guidance, and (for nodes with common misuse) a "Skip when:" warning.

### Changed
- **`unreferenced_label` lint message** is now actionable: instead of just stating the fact, it suggests deleting the `*label` node if it's only a flow target. EN, PT, ES.

### Fixed
- **CodeMirror crash on large imports** (`ranges must be added sorted by from position to startside`). The ChoiceScript highlight builder added decorations in two separate passes per line (`${var}` then `@{var ...}`), violating CodeMirror's RangeSetBuilder strict ordering whenever the two patterns appeared on the same line. All candidate ranges are now collected, sorted by position, and deduped before being fed to the builder. Crashed the canvas whenever a large preserved-source scene tried to render.

### Documentation
- **macOS Gatekeeper workaround** — README install instructions (EN + PT) and the GitHub Release notes template now spell out the actual unblock path on modern macOS (System Settings → Privacy & Security → "Open Anyway", or `xattr -dr com.apple.quarantine`). Right-click → Open is no longer sufficient on macOS 15+.

### Internal
- 387 domain + 89 UI = **476 tests passing** (was 454 in v0.1.0).
- `__APP_VERSION__` injected by Vite (and Vitest) from `package.json` at build time. Bumping the package version now flows through to the update-check banner automatically.

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
- **UI test layer** — Vitest + Testing Library scaffold (`vitest.config.ts`, `tests/ui/setup.ts` with `ResizeObserver` and `Worker` polyfills). New scripts: `test:ui`, `test:ui:watch`, `test:ui:coverage`, `test:all`. CI runs both domain and UI suites.
- **51 UI tests** across:
  - `NewProjectModal`: language switching, blank-project flow, close button, Enter-to-submit.
  - `useProjectStore` (renderHook): initial state, metadata updates that preserve startup source on unrelated changes, language-aware `addNode` defaults (EN/PT/ES), `duplicateNode` Y positioning, variable lifecycle with rename propagation, scene lifecycle, undo/redo, `connectNodes` default option text.
  - `LeftPanel`: i18n correctness for search results / no-results / replace status across EN/PT/ES (the `labels.words === "words"` heuristic regression), no React key warning when variables tab renders.
  - `RightPanel`: empty-state hint i18n, source-preserved banner localization (EN/PT/ES), private-notes localization, `Convert` button callback, disabled inputs in sourcePreserved mode, title-edit callback flow.
  - `i18nBulk`: loops every required `I18nLabels` key (~90 keys) and asserts each is non-empty in PT/EN/ES; verifies `{count}` interpolation placeholders.
  - `appSmoke`: end-to-end mount of `<App />` through jsdom, checks the four left-panel tabs and the Play button render with EN labels.
- **`addScene` / `duplicateScene` bug** caught by tests: both actions appended new scenes to the end of the array, placing them after `choicescript_stats` instead of before. Fixed via a new `lastIndex` helper.

### Internationalisation
- **~90 user-facing strings** across the three main panels and inspector now respect the editor language (PT/EN/ES) — previously hardcoded English regardless of selection. Covers variable table chrome, achievement chrome, scene mini-actions, asset chrome, canvas toolbar and SelectionBar tooltips, EdgeDropPicker hint, filter bar, the entire inspector (per-node-type labels, condition builder, sets/branch/option effects, command nodes, achievement assignment, image/sound fields, finish/return/ending hints, outgoing/incoming connections labels). Two long EN-only hint paragraphs removed since the localised field labels carry the meaning.

### Accessibility
- **`aria-label` / `aria-pressed`** added to icon-only and toggle buttons across LeftPanel (scene/variable/achievement/asset mini-actions), GraphCanvas (snap toggle, tag-filter dots, SelectionBar color-tag buttons), and RightPanel (status todo/done toggle, node color tags). Screen readers can now announce every action with its target.

### Performance
- **`extractZipEntries` async via Worker** (`src/workers/zipParser.ts`): large project imports (> 256 KB) now decompress off the main thread, eliminating the multi-second freeze on multi-MB ChoiceScript archives with images. Falls back to the sync path on worker error or 30 s timeout.

### Robustness
- **PanelErrorBoundary** (`src/components/PanelErrorBoundary.tsx`): LeftPanel, the canvas/editor area, and RightPanel are each wrapped in a class-based error boundary. A render crash in one panel shows an inline error card with retry button instead of taking down the whole app; the other panels stay usable and the autosave remains intact.
- **Round-trip integration tests** (`tests/ui/exportImportRoundtrip.test.ts`): 12 tests run `createExportPackage → unpack → importChoiceScriptArchive` on both the EN and PT sample projects and assert title/author/scenes/variables/achievements all survive. Catches any future regression across the whole generator + importer chain end-to-end.

### Internal
- 387 domain-layer tests pass via `node --test` (was 382 before this changelog window).
- 67 UI tests pass via `npm run test:ui`. Total: **454 tests** across both layers.
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
