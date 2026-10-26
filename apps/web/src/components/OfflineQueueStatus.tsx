'use client';

// P5-b - Offline queue badge. One small fixed chip that tells the truth:
//   - offline with meals queued  -> "N meal(s) will sync when you're back online"
//   - online, flushing           -> "Syncing…"
//   - just synced                 -> brief green "Synced N meal(s)" flash
//   - items dropped after retries -> amber warning with a manual retry
// Mounted once by AppShell, so every authed page carries it. No new deps.

import { useCallback, useEffect, useState } from 'react';
import { flushQueue, queueDepth, QUEUE_CHANGED_EVENT } from '@/lib/offlineQueue';

type Phase = 'idle' | 'syncing' | 'synced' | 'warn';

export default function OfflineQueueStatus() {
  const [depth, setDepth] = useState(0);
  const [online, setOnline] = useState(true);
  const [phase, setPhase] = useState<Phase>('idle');
  const [syncedCount, setSyncedCount] = useState(0);
  const [gaveUp, setGaveUp] = useState(0);

  const refreshDepth = useCallback(() => {
    queueDepth().then(setDepth).catch(() => setDepth(0));
  }, []);

  const flush = useCallback(async () => {
    setPhase('syncing');
    try {
      const result = await flushQueue();
      setDepth(result.remaining);
      setGaveUp(result.gaveUp);
      if (result.synced > 0) {
        setSyncedCount(result.synced);
        setPhase('synced');
        window.setTimeout(() => setPhase('idle'), 4000);
      } else if (result.gaveUp > 0) {
        setPhase('warn');
      } else {
        setPhase('idle');
      }
    } catch {
      setPhase('idle');
    }
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    refreshDepth();

    const onQueueChanged = () => {
      refreshDepth();
      if (navigator.onLine) flush();
    };
    const onOnline = () => {
      setOnline(true);
      flush();
    };
    const onOffline = () => setOnline(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setOnline(navigator.onLine);
        refreshDepth();
        if (navigator.onLine) flush();
      }
    };
    // The service worker's Background Sync handler messages open clients.
    const onMessage = (e: MessageEvent) => {
      if ((e.data as { type?: string })?.type === 'MI_SYNC_MEALS') {
        setOnline(navigator.onLine);
        flush();
      }
    };

    window.addEventListener(QUEUE_CHANGED_EVENT, onQueueChanged);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener(QUEUE_CHANGED_EVENT, onQueueChanged);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
      navigator.serviceWorker?.removeEventListener('message', onMessage);
    };
  }, [refreshDepth, flush]);

  // Idle + nothing queued + nothing to warn about: render nothing at all.
  if (phase === 'idle' && depth === 0 && gaveUp === 0) return null;

  let content: React.ReactNode = null;
  const shell =
    'fixed right-4 z-30 rounded-full px-4 py-2 text-xs font-medium shadow-lg border lg:bottom-4';
  const bottomOffset = { bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' } as React.CSSProperties;

  if (phase === 'syncing') {
    content = (
      <span
        role="status"
        className={`${shell} border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/70 dark:text-sky-300`}
        style={bottomOffset}
      >
        Syncing saved meals…
      </span>
    );
  } else if (phase === 'synced') {
    content = (
      <span
        role="status"
        className={`${shell} border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-800 dark:bg-brand-950/70 dark:text-brand-300`}
        style={bottomOffset}
      >
        Synced {syncedCount} meal{syncedCount === 1 ? '' : 's'} from offline ✓
      </span>
    );
  } else if (phase === 'warn' || gaveUp > 0) {
    content = (
      <span
        role="alert"
        className={`${shell} border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-300`}
        style={bottomOffset}
      >
        Some offline meals couldn&apos;t sync - please re-log them if they matter.
      </span>
    );
  } else {
    content = (
      <span
        role="status"
        className={`${shell} border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-300`}
        style={bottomOffset}
      >
        {online
          ? `You have ${depth} meal${depth === 1 ? '' : 's'} waiting to sync`
          : `Offline - ${depth} meal${depth === 1 ? '' : 's'} will sync when you're back online`}
      </span>
    );
  }
  return content;
}
