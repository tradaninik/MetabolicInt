# Mission D — Dependency Audit Report (v2, regenerated)

> **v2 note:** the original copy of this report was lost when my workspace
> reset between sessions. This regeneration covers the same ground from the
> session record; every number below is a shipped fact you can verify in your
> local repo (patches 0014 / 0015) and in `npm-audit-baseline.json`, which
> you already have.

## Goal

Shrink the `npm audit` surface of the monorepo with **zero functional risk**:
no new dependencies, no breaking changes, no migrations, no API changes.
Every bump had to stay inside the semver ranges already declared in
`package.json` so the four gates (tests, tsc ×3, lint, build) could prove
nothing broke.

## Baseline

Snapshot taken before any change: **18 advisories** across the workspace.
The full machine-readable snapshot is preserved as
`session2-screens/npm-audit-baseline.json` (already in your folder).

## Batch 1 — critical direct bumps (patch 0014, commit 2ac26d2)

Semver-safe bumps of the three direct dependencies that carried the
critical/high advisories:

| Package | From | To |
|---------|------|-----|
| next | 15.5.x | **15.5.28** |
| eslint-config-next (dev) | 15.5.x | **15.5.28** (kept matched to next) |
| next-auth | 4.24.x | **4.24.15** |

Both `apps/web/package.json` and the lockfile were updated together so
`npm ci` reproduces the audited tree exactly.

## Batch 2 — transitive, lockfile-only (patch 0015, commit 2e4f548)

The remaining fixable advisories lived in **transitive** dependencies. Batch
2 resolved them by regenerating the lockfile only — `package.json` files are
untouched in this commit, which is exactly what you want to see in review:
no direct dependency changed, only the pinned versions of nested packages
moved inside their allowed ranges.

## Result: 18 → 8 advisories

After both batches the audit count dropped from 18 to **8**. The remaining
advisories are not addressable inside the current semver ranges — the only
levers left are the major-version bumps below, which are deliberate
**proposals, not applied changes**.

## Major-bump proposals (decision items for you)

1. **next 15 → 16.** Would clear the advisories pinned to the 15.x line and
   its toolchain, but Next 16 has real breaking changes (async request APIs,
   config and codemod surface). Needs a dedicated session with the four
   gates run per step, exactly like the 15.5.28 bump but with actual code
   changes possible.
2. **vitest 2 → 5.** The root workspace pins `vitest ^2.1.4` (typescript 5.6
   alongside it). Vitest 5 changes config and some APIs; with 619+3 tests
   green, the suite itself is the safety net, but the migration touches every
   test run, so it should not ride along with a feature batch.

Both proposals are parked until you say go. If you approve either one, the
work pattern is: bump, fix what the gates catch, gate green, ship as its own
commit series — same protocol as everything else.

## Gates (unchanged after both batches)

619 passed + 3 skipped (51 files) · tsc ×3 silent · lint 0 problems (after
S2-E) · `next build` "Compiled successfully", 56 pages. No migration, no new
package.json dependencies, no API surface changes.
