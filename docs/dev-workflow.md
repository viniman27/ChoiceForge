# Development Workflow

ChoiceForge uses a two-branch model:

- **`main`** — production. Every commit auto-deploys to https://choiceforge.pages.dev. Tags here trigger desktop releases.
- **`dev`** — staging / next-version work. Every commit auto-deploys to https://dev.choiceforge.pages.dev for preview.

## Day-to-day

```bash
git checkout dev
git pull
# ...make changes, commit...
git push origin dev
```

Cloudflare Pages picks up the push and redeploys `dev.choiceforge.pages.dev` automatically (1–2 min). CI runs the test suite on push and on PRs targeting `dev`.

## Promoting `dev` → `main` (cutting a release)

When `dev` is stable and ready to ship:

```bash
git checkout main
git pull
git merge --no-ff dev -m "Merge dev → main for vX.Y.Z release"
# Bump version in package.json, src-tauri/Cargo.toml, src-tauri/tauri.conf.json
# Update CHANGELOG.md
# Update agents.md session log
git add -A
git commit -m "vX.Y.Z — <short summary>"
git push origin main
git tag -a vX.Y.Z -m "vX.Y.Z — <summary>"
git push origin vX.Y.Z
```

The tag push triggers `.github/workflows/desktop-release.yml`, which:
1. Builds macOS universal `.dmg` + Windows `.msi` installers
2. Signs them with the minisign key
3. Drafts a GitHub Release with all assets + `latest.json`
4. Existing desktop installs see the new version via the auto-updater banner

After verifying the draft, publish it:

```bash
gh release edit vX.Y.Z --draft=false
```

Cloudflare web auto-deploys from the merged main → `choiceforge.pages.dev` picks up the new bundle in 1–2 min.

## Hotfix flow

If a critical bug ships in production:

```bash
git checkout main
git checkout -b hotfix/<short-name>
# fix, test, commit
git push origin hotfix/<short-name>
# Open PR → main; after merge, follow the release flow above
git checkout dev
git merge main  # carry the hotfix back into dev
git push origin dev
```

The hotfix branch also gets its own preview URL: `hotfix-<short-name>.choiceforge.pages.dev`.

## Preview URLs

Every non-main branch automatically gets two Cloudflare URLs:

- **Per-commit (ephemeral):** `<commit-hash-7>.choiceforge.pages.dev` — useful for testing a specific snapshot
- **Per-branch (stable):** `<branch-name>.choiceforge.pages.dev` — always the latest of that branch

URLs are public but unlisted. For team-only access, configure Cloudflare Access (Zero Trust) on the project — out of scope of this doc.
