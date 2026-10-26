// P5-b - Offline meal queue (IndexedDB, client-only).
//
// When a tray save hits a network failure, the remaining meals are stored
// on-device and replayed against the same /api/meals endpoint the moment
// connectivity returns. Design notes:
//   - The queue stores the exact POST bodies (foodId/portion/when) - the
//     server recomputes macros, so numbers can never drift client-side.
//   - IndexedDB, not localStorage: meal photos are data URLs up to a few MB.
//   - Sessions can expire while offline; a queued 401 keeps the item (the
//     next sign-in retries it). Anything the server hard-rejects is retried
//     up to MAX_ATTEMPTS and then dropped with a surfaced warning - silently
//     looping forever would be worse.
//   - Pure queue logic lives here; the badge UI lives in
//     components/OfflineQueueStatus.tsx. No new dependencies.

export interface QueuedMealBody {
  foodId: string;
  portionType: 'serving' | 'katori' | 'grams';
  portionValue: number;
  photoPath?: string | null;
  notes?: string | null;
  loggedAt?: number;
}

export interface QueuedMeal {
  id: string;
  foodName: string;
  body: QueuedMealBody;
  queuedAt: number;
  attempts: number;
}

const DB_NAME = 'mi-offline';
const DB_VERSION = 1;
const STORE = 'mealQueue';
const MAX_ATTEMPTS = 5;

/** Custom DOM event the status badge listens to (and the log page fires). */
export const QUEUE_CHANGED_EVENT = 'mi-queue-changed';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
        t.oncomplete = () => db.close();
      }),
  );
}

/** Queue meals that failed to POST. Returns how many were stored. */
export async function enqueueMeals(
  items: { foodName: string; body: QueuedMealBody }[],
): Promise<number> {
  const queuedAt = Date.now();
  const rows: QueuedMeal[] = items.map((it, i) => ({
    id: `${queuedAt}-${i}-${Math.random().toString(36).slice(2, 8)}`,
    foodName: it.foodName,
    body: it.body,
    queuedAt,
    attempts: 0,
  }));
  await openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const t = db.transaction(STORE, 'readwrite');
        const store = t.objectStore(STORE);
        for (const row of rows) store.put(row);
        t.oncomplete = () => {
          db.close();
          resolve();
        };
        t.onerror = () => reject(t.error ?? new Error('IndexedDB write failed'));
      }),
  );
  return rows.length;
}

export async function queueDepth(): Promise<number> {
  try {
    return await tx('readonly', (s) => s.count());
  } catch {
    return 0;
  }
}

async function allMeals(): Promise<QueuedMeal[]> {
  return tx('readonly', (s) => s.getAll() as IDBRequest<QueuedMeal[]>);
}

async function deleteMeal(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

async function bumpAttempts(meal: QueuedMeal): Promise<void> {
  await tx('readwrite', (s) => s.put({ ...meal, attempts: meal.attempts + 1 }));
}

export interface FlushResult {
  synced: number;
  remaining: number;
  gaveUp: number;
}

/**
 * Replay queued meals in FIFO order. Network failure stops the replay (the
 * phone went offline again) and keeps the rest queued. Server rejections
 * (401 session expiry, 404 deleted food, ...) count an attempt; after
 * MAX_ATTEMPTS the item is dropped and reported so the UI can warn.
 */
export async function flushQueue(): Promise<FlushResult> {
  let synced = 0;
  let gaveUp = 0;
  let meals: QueuedMeal[];
  try {
    meals = (await allMeals()).sort((a, b) => a.queuedAt - b.queuedAt);
  } catch {
    return { synced: 0, remaining: 0, gaveUp: 0 };
  }
  for (const meal of meals) {
    try {
      const res = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meal.body),
      });
      if (res.ok) {
        await deleteMeal(meal.id).catch(() => {});
        synced++;
        continue;
      }
      // Server answered and said no. 401 will clear after the next sign-in;
      // anything else may be permanent. Either way: count an attempt.
      if (meal.attempts + 1 >= MAX_ATTEMPTS) {
        await deleteMeal(meal.id).catch(() => {});
        gaveUp++;
      } else {
        await bumpAttempts(meal).catch(() => {});
      }
    } catch {
      // Network-level failure - offline again. Stop here, keep the rest.
      break;
    }
  }
  const remaining = await queueDepth();
  if (synced > 0) {
    // Reuse the existing refresh event so RecentMeals and friends update.
    window.dispatchEvent(new Event('meals-updated'));
  }
  window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
  return { synced, remaining, gaveUp };
}

/** Ask the service worker (if any) to poke us via Background Sync when
 *  connectivity returns. Best-effort - Safari has no sync API and that's
 *  fine; the online event and next app launch cover it. */
export async function registerMealSync(): Promise<void> {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sync = (reg as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> };
    }).sync;
    if (sync) await sync.register('mi-meal-sync');
  } catch {
    /* best-effort by design */
  }
}
