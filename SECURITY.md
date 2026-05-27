# Security Policy

## Supported versions

ChoiceForge is pre-1.0. Security fixes land on `main`; there are no maintained backport branches. If you build from a tag, please move to the latest `main` before reporting an issue.

## Reporting a vulnerability

**Do not open a public GitHub issue for security bugs.**

Please email the maintainer privately:

- **viniciusdearaujo27@gmail.com**

Include:

- A short description of the issue and its impact.
- Steps to reproduce, or a proof-of-concept (preferably a minimal `.zip` / `.json` import that triggers the bug).
- The browser + OS + commit hash you reproduced on.
- Whether you would like credit in the eventual disclosure.

You'll receive an acknowledgement within 7 days. If we agree the report is valid, we'll work with you to ship a fix and coordinate disclosure timing (usually within 30 days of the initial report).

## Scope

In scope:

- The ChoiceForge web app (everything under `src/`).
- The ChoiceForge importer (parsing untrusted `.txt` / `.json` / `.zip` from disk).
- The Tauri desktop scaffold (`src-tauri/`).
- The exported `.zip` package shape.

Out of scope (these are not ChoiceForge bugs):

- The official ChoiceScript runtime embedded for playtest. Report those upstream at [Choice of Games](https://www.choiceofgames.com/).
- Vulnerabilities in upstream npm dependencies that don't reach ChoiceForge's code paths — please open an issue or PR in the upstream project instead. Dependabot already handles routine updates.
- Browser-specific behaviour the spec allows (e.g., uncontrolled fullscreen, autoplay policies).

## Common classes of issue we care about most

ChoiceForge runs entirely client-side and has no auth, no server, and no backend persistence — but it does import untrusted files, so we particularly want to hear about:

- **Import-side denial-of-service** — an `.txt` / `.zip` that hangs or crashes the importer or linter beyond a reasonable budget.
- **HTML / script injection through preserved source** — anywhere the importer's output reaches `dangerouslySetInnerHTML`, `eval`, or `Function`. (There should be none.)
- **Path traversal in asset exports** — anywhere an attacker-controlled asset path could escape `mygame/` in the exported package.
- **localStorage poisoning** — a hostile project shape that breaks the autosave hydrator and causes data loss on next load.

## Bug bounty

ChoiceForge is a side project with no funding. There is no monetary bounty. Reporters will get credit in the eventual `CHANGELOG.md` entry (unless they prefer to remain anonymous) and our genuine thanks.
