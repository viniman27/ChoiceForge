# ChoiceForge — Claude Context

## The authoritative context file is `agents.md` at the project root.

Read `agents.md` fully before touching any code. It contains:
- Full architecture description
- Domain model (ChoiceScript concepts)
- Key invariants that must never be broken
- Coding conventions
- What is done vs. not yet implemented
- Gotchas and known edge cases
- Canvas implementation details

---

## Workflow rules (enforced per session)

1. **After every interaction**, update `agents.md` with a session note under `## Session Log` (add the section if missing), then `git commit` and `git push`.
2. **Never break passing tests.** Run `npm test` before any commit that touches `src/domain/`.
3. **`choicescript.ts` is pure.** No React, no DOM, no side-effects. See agents.md → Key Invariants.
4. **All mutations go through `commitProject`.** See agents.md → Adding a New Scene Action.
5. **No comments in code** unless the WHY is non-obvious.

---

## Quick orientation

```
src/
  domain/
    types.ts            ← All TypeScript types (source of truth)
    choicescript.ts     ← Pure: code generator + linter
    choicescriptImport.ts ← Pragmatic CS importer
    graphLayout.ts      ← Auto-layout algorithm
  state/
    projectStore.ts     ← useProjectStore() — all mutations here
  data/
    sampleProject.ts    ← Sample projects + i18n strings
  components/
    App.tsx             ← Root layout + import/export logic
    TopBar.tsx          ← Save, import/export, play, settings
    BottomBar.tsx       ← Lint console
    LeftPanel.tsx       ← Scenes / Variables / Achievements / Assets tabs
    GraphCanvas.tsx     ← Custom canvas (no React Flow)
    NodeCard.tsx        ← Node rendering + typeColors (source of truth for colors)
    RightPanel.tsx      ← Node inspector (Content / Logic / Raw tabs)
    GeneratedDocumentView.tsx ← Full-file CodeMirror editor
    PlaytestView.tsx    ← Internal graph smoke-test playtest
    Dashboard.tsx       ← Project stats overview
tests/
  domain.test.ts        ← 58 tests, all passing (Node built-in runner)
```

## Running

```bash
npm test          # run all tests
npm run dev       # Vite dev server
npm run build     # type-check + build
npm run cf:deploy # deploy to Cloudflare Pages
```
