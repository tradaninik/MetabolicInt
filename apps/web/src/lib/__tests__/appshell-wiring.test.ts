import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';

// S-1 - AppShell wiring scan.
//
// Regresion guard for the bug where /my-foods rendered without the sidebar,
// mobile nav and medical-disclaimer footer because the page never wrapped
// itself in AppShell (pre-existing since the page was created, only noticed
// in production). Every authed page must render AppShell - either in the page
// itself or in an ancestor layout (the admin pages are covered by
// admin/layout.tsx). Public pages are allowlisted.

const WEB_ROOT = join(__dirname, '..', '..', '..', 'src', 'app');

const PUBLIC_PAGES = new Set([
  'page.tsx', // marketing/landing at /
  join('login', 'page.tsx'),
  join('onboarding', 'page.tsx'),
  join('install', 'page.tsx'), // P5-a - reachable pre-login so the app can be installed first
  join('offline', 'page.tsx'), // P5-b - static offline fallback, must work with no session
]);

function listPages(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listPages(full));
    else if (entry.name === 'page.tsx') out.push(full);
  }
  return out;
}

/** Does this directory chain (page dir and every ancestor up to app/) hold a
 *  layout that renders AppShell? The admin pages rely on this. */
function ancestorLayoutUsesAppShell(pagePath: string): boolean {
  let dir = dirname(pagePath);
  for (;;) {
    const layoutPath = join(dir, 'layout.tsx');
    if (existsSync(layoutPath) && /AppShell/.test(readFileSync(layoutPath, 'utf8'))) {
      return true;
    }
    const parent = dirname(dir);
    if (parent === dir) return false;
    dir = parent;
    // Stop at the app root - the root layout is Providers, not AppShell.
    if (relative(WEB_ROOT, dir).startsWith('..')) return false;
  }
}

describe('AppShell wiring (S-1): every authed page renders the app shell', () => {
  it('app directory exists (guard against a moved tree)', () => {
    expect(existsSync(WEB_ROOT)).toBe(true);
  });

  it('every non-public page imports/renders AppShell itself or via an ancestor layout', () => {
    expect(listPages(WEB_ROOT).length, 'found no pages - test is broken, not the app').toBeGreaterThan(10);
    const offenders: string[] = [];
    for (const page of listPages(WEB_ROOT)) {
      const rel = relative(WEB_ROOT, page);
      if (PUBLIC_PAGES.has(rel)) continue;
      const source = readFileSync(page, 'utf8');
      const pageUsesShell = /AppShell/.test(source);
      if (!pageUsesShell && !ancestorLayoutUsesAppShell(page)) {
        offenders.push(rel);
      }
    }
    expect(
      offenders,
      `pages missing AppShell (add the wrap, or extend PUBLIC_PAGES only if the page is truly public):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('public allowlist entries still exist (keep the allowlist honest)', () => {
    for (const rel of PUBLIC_PAGES) {
      expect(existsSync(join(WEB_ROOT, rel)), `${rel} is allowlisted but does not exist`).toBe(true);
    }
  });
});
