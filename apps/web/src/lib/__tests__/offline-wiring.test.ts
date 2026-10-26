import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// P5-b - Offline wiring scan.
//
// The offline machinery lives in a service worker and a client lib that vitest
// (node env) can't execute. What CAN be pinned cheaply are the invariants the
// whole design rests on - structural rules that would be easy to break in a
// refactor and would silently degrade offline behavior:
//   1. sw.js never intercepts /api/* (logged data must be fresh, always).
//   2. the offline queue posts the exact /api/meals contract fields.
//   3. the Background Sync tag matches between the queue lib and sw.js.
//   4. the offline fallback page exists and the SW precaches it.
//   5. shell cache name is versioned (stale-cache killer on deploy).

const WEB = join(__dirname, '..', '..', '..');
const SW = join(WEB, 'public', 'sw.js');
const QUEUE = join(WEB, 'src', 'lib', 'offlineQueue.ts');
const STATUS = join(WEB, 'src', 'components', 'OfflineQueueStatus.tsx');
const OFFLINE_PAGE = join(WEB, 'src', 'app', 'offline', 'page.tsx');

const sw = readFileSync(SW, 'utf8');
const queue = readFileSync(QUEUE, 'utf8');
const status = readFileSync(STATUS, 'utf8');
const offlinePage = readFileSync(OFFLINE_PAGE, 'utf8');

describe('P5-b offline wiring invariants', () => {
  it('service worker never intercepts /api requests', () => {
    // The guard line itself - exact rule, not just the substring.
    expect(sw).toContain("if (url.pathname.startsWith('/api/')) return;");
  });

  it('offline queue posts the /api/meals contract', () => {
    expect(queue).toContain("await fetch('/api/meals',");
    // Contract fields present in the queue's stored body type (and thus the replay).
    for (const field of ['foodId', 'portionType', 'portionValue', 'loggedAt']) {
      expect(queue.includes(field), `${field} in queue body`).toBe(true);
    }
  });

  it('Background Sync tag matches between the page and the worker', () => {
    expect(queue).toContain("sync.register('mi-meal-sync')");
    expect(sw).toContain("event.tag !== 'mi-meal-sync'");
    // The SW messages open clients; the status badge listens and flushes.
    expect(sw).toContain("'MI_SYNC_MEALS'");
    expect(status).toContain("'MI_SYNC_MEALS'");
  });

  it('offline fallback page exists and is precached', () => {
    expect(offlinePage.length).toBeGreaterThan(200);
    expect(sw).toContain("'/offline'");
  });

  it('shell cache is versioned past v2', () => {
    // Convention is mi-shell-vN (note the v), e.g. v2 -> v3 in P5-b.
    const m = sw.match(/mi-shell-v(\d+)/);
    expect(m, 'cache name must follow mi-shell-vN').toBeTruthy();
    expect(Number(m![1])).toBeGreaterThanOrEqual(3);
  });
});
