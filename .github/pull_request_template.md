<!-- Thanks for contributing to ChoiceForge! Please read CONTRIBUTING.md first. -->

## Summary

<!-- 1-3 bullets describing what changed and why. -->

## Linked issue

<!-- Closes #N, or "no issue — minor fix" if trivial. -->

## Verification

- [ ] `npm test` passes (current baseline: 387 tests)
- [ ] `npx tsc --noEmit` is clean
- [ ] `npm run build` succeeds
- [ ] Manually exercised the affected flow in `npm run dev` (for UI changes)

## Invariant checklist

If you touched `src/domain/` or `src/state/`, confirm:

- [ ] `src/domain/choicescript.ts` is still pure (no React, no DOM, no side-effects)
- [ ] Every project mutation goes through `commitProject`
- [ ] Global rename/delete operations touch every saved graph in `sceneData`, not just the active scene
- [ ] User-typed identifiers go through `normalizeIdentifier` before persisting
- [ ] Exported `.txt` still passes the official ChoiceScript runtime (if generator changed)

## Notes for reviewer

<!-- Anything the reviewer should know that isn't obvious from the diff. -->
