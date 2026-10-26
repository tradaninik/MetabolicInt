'use client';

// P5-b - static offline fallback (public; must render with no session and no
// network). The service worker serves this when a navigation fails AND has
// no cached copy. Deliberately calm and honest: data is safe, come back.

import Link from 'next/link';

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <span className="text-4xl" aria-hidden>
        📴
      </span>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">You&apos;re offline</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        This page isn&apos;t saved on your phone yet. Pages you visit while online stay available
        offline - and meals you log offline sync automatically once you&apos;re back on the network.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Try the dashboard
      </Link>
      <p className="mt-8 text-xs text-neutral-500">
        Educational tool - not medical advice.
      </p>
    </main>
  );
}
