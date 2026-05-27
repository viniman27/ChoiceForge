# Contributing to ChoiceForge

Thanks for your interest in ChoiceForge — a visual node-based editor for [ChoiceScript](https://www.choiceofgames.com/make-your-own-games/choicescript-intro/).

This document is the short version. The **authoritative architecture, invariants, and gotchas** live in [`agents.md`](./agents.md) — read that file in full before touching code. It is written for both human contributors and AI assistants.

---

## Quick start

```bash
git clone https://github.com/<your-fork>/ChoiceForge.git
cd ChoiceForge
nvm install              # picks up .nvmrc (Node >= 24.15.0)
npm install
npm run dev              # http://localhost:5173
```

Before submitting a pull request:

```bash
npm test                 # 387 tests via node --test
npx tsc --noEmit         # type check
npm run build            # Vite production build
```

CI runs the same three commands on every push and PR (`.github/workflows/ci.yml`).

---

## Workflow

1. **Pick or open an issue** before writing non-trivial code so the design can be discussed.
2. **Branch from `main`**, e.g. `git checkout -b fix/option-body-paragraphs`.
3. **Make focused commits.** Each commit should leave the tree green (`npm test` passes).
4. **Update `agents.md`** under `## Session Log` with a short note describing your change, including the files touched and the test counts before/after.
5. **Push and open a PR** against `main`. Describe the *why* in the PR body; reference the issue.

---

## The non-negotiables

These are pulled from `agents.md`. Breaking them will be the first thing a reviewer (human or AI) catches.

1. **`src/domain/choicescript.ts` is pure.** No React imports, no DOM access, no side-effects, no `window`/`document`.
2. **All project state mutations go through `commitProject`** (defined in `projectStore.ts`). It runs `syncDerivedEdges → updateSceneCounts → persistActiveScene`. Skipping it leaves derived data stale.
3. **`startup` and `special` scenes are locked.** They cannot be renamed, deleted, or navigated as a graph. The store enforces this — don't paper over the guard.
4. **Exported `.txt` files must be valid ChoiceScript.** If you change the generator (`generateNodeChoiceScript`, `generateStartupChoiceScript`, etc.), verify the output runs against the official ChoiceScript runtime with zero errors.
5. **Scene, variable, and achievement names are identifiers.** Always pass them through `normalizeIdentifier` (lowercase, underscores, no leading digits) before persisting.
6. **Node IDs are stable references.** Deleting a node must clean up `option.to`, `branch.to`, and edges referencing it. The store's `deleteNode` already does this — don't bypass it.
7. **Global rename/delete operations must touch every saved graph in `sceneData`**, not just the active scene.
8. **i18n strings come from `I18nLabels` in `src/data/sampleProject.ts`.** Don't hardcode user-visible text in components — thread it through the labels object passed down from `App.tsx`.

---

## Code style

- **TypeScript everywhere.** No new `.jsx` files. (The `.jsx` files at the repo root are legacy from the original prototype.)
- **Immutable updates.** Return new arrays and objects; never mutate in place. Use `structuredClone` for deep copies.
- **No comments unless the *why* is non-obvious** (a hidden invariant, a workaround for a known bug, surprising behaviour). Self-documenting names beat narration. Don't restate what the code already says.
- **No half-finished implementations.** A bug fix shouldn't drag in unrelated refactors. A one-shot operation shouldn't add a helper used nowhere else. Don't design for hypothetical future requirements — three similar lines beat a premature abstraction.
- **No backwards-compatibility shims** when you can just change the code. Don't leave dead exports, renamed `_unused` parameters, or `// removed: …` comments.

---

## Tests

The test suite (`tests/domain.test.ts`) covers the pure domain layer (generator, importer, linter, layout) using Node's built-in test runner. There is no UI/integration test layer yet.

Before adding domain code, look at the existing tests for the same area and follow the same shape:

```ts
import { test } from "node:test";
import assert from "node:assert";
import { generateNodeChoiceScript } from "../src/domain/choicescript.ts";

test("describes the specific behaviour you're checking", () => {
  const node = { /* minimal fixture */ };
  const cs = generateNodeChoiceScript(node);
  assert.ok(cs.includes("..."), `unexpected:\n${cs}`);
});
```

If your change touches `src/domain/`, you must add at least one test that would fail without your change.

UI changes don't need automated tests today, but you should manually exercise the affected flow in the dev server (`npm run dev`) and confirm there are no regressions in adjacent flows.

---

## Adding a new node type

`agents.md → Adding a New Node Type` has the full checklist. Summary:

1. Add to `NodeType` union in `types.ts`.
2. Add `defaultNodeTitle()` and `defaultNodeWidth()` entries in `projectStore.ts`.
3. Implement creation in `createStoryNode()`.
4. Implement code generation in `generateNodeChoiceScript()`.
5. Add lint rules in `lintProject()` if the node has validatable fields.
6. Add `deriveNodeEdges()` case if the node has outgoing edges derived from its data.
7. Add a visual card variant in `NodeCard.tsx`.
8. Add an inspector panel in `RightPanel.tsx`.
9. Add the PT/EN/ES label to `I18nLabels.nodeTypes` and both sample projects.

---

## Adding a new scene action

All scene mutations go through `ProjectActions` in `projectStore.ts`. Use the pattern:

```ts
newAction: (param) => {
  setTrackedProjectState((current) => {
    const saved = commitProject(current);
    // compute next state…
    return commitProject({ ...saved, /* changes */ });
  });
},
```

If your action might affect non-active scenes (e.g., a global rename), use `mapSceneGraphs(saved, (graph) => …)` to update every entry in `sceneData`.

---

## Reporting bugs

Open an issue with:

- **Steps to reproduce** (preferably starting from `New Project → Load Example`)
- **Expected behaviour**
- **Actual behaviour** (console output, screenshot, exported `.zip` if relevant)
- **Browser + OS + Node version**

For ChoiceScript-runtime issues, include the exported `.txt` file and the line of the official runtime error.

---

## License

By contributing, you agree that your contributions are licensed under the project's MIT License (see [`LICENSE`](./LICENSE)).

ChoiceScript is a trademark of Choice of Games LLC. ChoiceForge is a fan-made independent editor and is not affiliated with or endorsed by Choice of Games.
