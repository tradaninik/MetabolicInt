import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Dashboard revamp item 7 - provenance + instant-refresh wiring scan.
//
// Three invariants, pinned the same way appshell-wiring.test.ts pins AppShell:
// 1. Every dashboard save path calls router.refresh() after a successful POST
//    (QuickAdd and CheckInCard are the two interactive savers on /dashboard;
//    AddToPlanButton is device-local by design and says so in its copy).
// 2. No fake real-time streams: the dashboard revamp components never poll -
//    no setInterval / EventSource / WebSocket anywhere under components/dashboard,
//    and the dashboard page itself stays a server component.
// 3. Source/updated stamps: the header stamp, the per-card source line in
//    MetricCards, the chart's readings-basis suffix, and the provenance
//    footer line all stay wired (regression guard against quiet removals).

const SRC = join(__dirname, '..', '..', '..', 'src');
const DASH_DIR = join(SRC, 'components', 'dashboard');

function read(rel: string): string {
  const p = join(SRC, rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
}

function listFiles(dir: string, ext: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, ext));
    else if (entry.name.endsWith(ext)) out.push(full);
  }
  return out;
}

const STREAM_PRIMITIVES = ['setInterval', 'EventSource', 'WebSocket', 'new EventTarget'];

describe('Dashboard revamp item 7: instant refresh wiring', () => {
  it('components/dashboard exists (guard against a moved tree)', () => {
    expect(existsSync(DASH_DIR)).toBe(true);
    expect(listFiles(DASH_DIR, '.tsx').length).toBeGreaterThan(3);
  });

  it('QuickAdd calls router.refresh() after every successful save', () => {
    const quickAdd = read('components/QuickAdd.tsx');
    expect(quickAdd.includes('useRouter'), 'QuickAdd must use the router').toBe(true);
    // Three save flows (quick value, repeat meal, combo) - each must refresh.
    const refreshes = quickAdd.split('router.refresh()').length - 1;
    expect(refreshes).toBeGreaterThanOrEqual(3);
  });

  it('CheckInCard calls router.refresh() after saving a reading', () => {
    const checkIn = read('components/CheckInCard.tsx');
    expect(checkIn.includes('router.refresh()')).toBe(true);
  });

  it('AddToPlanButton stays device-local (no server write => no refresh needed)', () => {
    const btn = read('components/dashboard/AddToPlanButton.tsx');
    expect(btn.includes('localStorage'), 'plan button persists on this device until the planner ships').toBe(true);
    expect(btn.includes('fetch('), 'no server write before the Phase C planner exists').toBe(false);
  });
});

describe('Dashboard revamp item 7: no fake real-time streams', () => {
  it('no polling/streaming primitives anywhere under components/dashboard', () => {
    const offenders: string[] = [];
    for (const f of listFiles(DASH_DIR, '.tsx')) {
      const src = readFileSync(f, 'utf8');
      for (const prim of STREAM_PRIMITIVES) {
        if (src.includes(prim)) offenders.push(`${f.split('src').at(-1)}: ${prim}`);
      }
    }
    expect(offenders, `fake-stream primitives found: ${offenders.join(', ')}`).toEqual([]);
  });

  it('the dashboard page stays a server component (stamps recompute per render)', () => {
    const page = read('app/dashboard/page.tsx');
    expect(page.includes("'use client'"), 'the page must not become a client component').toBe(false);
    expect(page.includes('loadDashboardData'), 'the page must load its data server-side').toBe(true);
  });
});

describe('Dashboard revamp item 7: source / updated stamps everywhere', () => {
  it('header renders the global Updated stamp (time + source)', () => {
    const page = read('app/dashboard/page.tsx');
    expect(page.includes('updatedStamp')).toBe(true);
    expect(page.includes('relativeTime')).toBe(true);
    expect(page.includes('sourceLabel')).toBe(true);
  });

  it('MetricCards render the per-card source line', () => {
    const cards = read('components/dashboard/MetricCards.tsx');
    expect(cards.includes('{latest.source}'), 'glucose card shows reading provenance').toBe(true);
    expect(cards.includes('synced'), 'steps card shows its sync stamp').toBe(true);
  });

  it('glucose chart carries its readings-basis suffix', () => {
    const chart = read('components/dashboard/GlucoseTodayChart.tsx');
    expect(chart.includes('readings.length'), 'today view reports its reading count').toBe(true);
    expect(chart.includes('latestToday'), 'today view reports the latest reading time/source').toBe(true);
  });

  it('the provenance footer line is rendered verbatim (approved v1 copy)', () => {
    const page = read('app/dashboard/page.tsx');
    expect(
      page.includes('data shown is yours, entered manually or imported · values update instantly on save'),
    ).toBe(true);
  });

  it('the "Updated" stamp helpers stay parameter-pure (no hidden clock reads)', () => {
    const stamp = read('lib/dashboard-stamp.ts');
    // relativeTime and latestUpdate must take now/candidates as parameters -
    // a Date.now() inside them would make renders non-deterministic.
    expect(stamp.includes('export function relativeTime(t: number, now: number)')).toBe(true);
    expect(stamp.includes('export function latestUpdate(candidates: UpdateCandidate[])')).toBe(true);
  });
});
