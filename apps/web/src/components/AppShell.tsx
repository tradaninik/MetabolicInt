'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import MedicalDisclaimer from './MedicalDisclaimer';
import OfflineQueueStatus from './OfflineQueueStatus';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/prakriti', label: 'Know Your Body' },
  { href: '/healing-foods', label: 'Food as Medicine' },
  { href: '/log', label: 'Log a meal' },
  { href: '/my-foods', label: 'My Foods' },
  // P8 Day 3: the 300-recipe diabetic-friendly catalog browser.
  { href: '/recipes', label: 'Recipes' },
  // P6-b: coach + insights unified into the single Insights tab (/coach redirects).
  { href: '/insights', label: 'Insights' },
  { href: '/indian', label: 'Indian MI' },
  { href: '/glucose', label: 'Glucose' },
  { href: '/labs', label: 'Labs' },
  { href: '/meds', label: 'Meds' },
  { href: '/predict', label: 'Predict' },
  { href: '/family', label: 'Family' },
  { href: '/doctor', label: 'Doctor' },
  { href: '/reports', label: 'Reports' },
  { href: '/settings', label: 'Settings' },
  { href: '/admin', label: 'Admin' },
];

// P5-b - thumb-reach navigation. Four primary tabs live in the fixed bottom
// bar (44px+ targets); everything else is one tap away in the More sheet.
// The old horizontal 17-item strip (~28px targets, unreadable on the phone)
// is gone. Desktop keeps the full sidebar as before.
const PRIMARY_TABS = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { href: '/log', label: 'Log meal', icon: '🍽️' },
  { href: '/healing-foods', label: 'Foods', icon: '🌿' },
  { href: '/insights', label: 'Insights', icon: '📈' },
];
const MORE_LINKS = NAV.filter((n) => !PRIMARY_TABS.some((t) => t.href === n.href));

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathway = usePathname();
  const { data: session } = useSession();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950 lg:flex">
        <Link href="/dashboard" className="mb-8 flex items-center gap-2">
          <BrandMark className="h-7 w-7 rounded-lg" />
          <span className="flex flex-col leading-tight">
            <span className="font-semibold tracking-tight">MetabolicInt</span>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
              Personal metabolic model
            </span>
          </span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-lg px-3 py-2 text-sm transition ${
                pathway.startsWith(n.href)
                  ? 'bg-brand-100 font-medium text-brand-800 dark:bg-brand-900/40 dark:text-brand-200'
                  : 'text-neutral-600 hover:bg-neutral-200/60 dark:text-neutral-400 dark:hover:bg-neutral-900'
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 border-t border-neutral-200 pt-4 text-xs dark:border-neutral-800">
          <div className="truncate text-neutral-500">{session?.user?.email}</div>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="mt-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80 lg:hidden">
          <Link href="/dashboard" className="flex items-center gap-2">
            <BrandMark className="h-6 w-6 rounded-md" />
            <span className="font-semibold tracking-tight">MetabolicInt</span>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="text-xs text-neutral-500"
          >
            Sign out
          </button>
        </header>
        <main className="flex-1 px-4 py-6 pb-32 sm:px-6 lg:px-8 lg:pb-6">
          {children}
          <MedicalDisclaimer />
        </main>
      </div>

      {/* Mobile bottom tab bar (P5-b) */}
      <BottomTabBar pathname={pathway} />
      <OfflineQueueStatus />
    </div>
  );
}

function BottomTabBar({ pathname }: { pathname: string }) {
  const [moreOpen, setMoreOpen] = useState(false);

  // Close the sheet on route change (a More link was tapped).
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const cellBase =
    'flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] leading-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95 lg:hidden"
      >
        <div className="grid grid-cols-5">
          {PRIMARY_TABS.map((t) => {
            const active = pathname === t.href || pathname.startsWith(t.href + '/');
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={`${cellBase} ${
                  active
                    ? 'font-semibold text-brand-700 dark:text-brand-300'
                    : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                <span className="text-lg" aria-hidden>
                  {t.icon}
                </span>
                {t.label}
              </Link>
            );
          })}
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-label="More pages"
            onClick={() => setMoreOpen(true)}
            className={`${cellBase} ${
              moreOpen
                ? 'font-semibold text-brand-700 dark:text-brand-300'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            <span className="text-lg" aria-hidden>
              ⋯
            </span>
            More
          </button>
        </div>
      </nav>
      {moreOpen && <MoreSheet onClose={() => setMoreOpen(false)} />}
    </>
  );
}

function MoreSheet({ onClose }: { onClose: () => void }) {
  // Escape closes; focus starts on the sheet header so keyboard users land inside.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 lg:hidden" role="dialog" aria-modal="true" aria-label="More pages">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-neutral-900/40"
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-neutral-800 dark:bg-neutral-950">
        <div className="sticky top-0 flex items-center justify-between border-b border-neutral-100 bg-white px-4 py-3 dark:border-neutral-900 dark:bg-neutral-950">
          <h2 className="text-sm font-semibold">All pages</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
          >
            Close
          </button>
        </div>
        <nav aria-label="More" className="grid grid-cols-2 gap-1 p-3">
          {MORE_LINKS.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex min-h-[44px] items-center rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900"
            >
              {n.label}
            </Link>
          ))}
          <Link
            href="/install"
            className="flex min-h-[44px] items-center rounded-lg px-3 py-2 text-sm text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/40"
          >
            📲 Install app
          </Link>
        </nav>
        <div className="border-t border-neutral-100 p-3 dark:border-neutral-900">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/' })}
            className="min-h-[44px] w-full rounded-lg px-3 py-2 text-left text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Brand mark per the approved v1 mockup: a heart inside the rounded
 * brand-colored square (inline SVG, no new dependencies). `className`
 * sizes the square (h-7 w-7 desktop, h-6 w-6 mobile header).
 */
function BrandMark({ className }: { className: string }) {
  return (
    <div className={`flex items-center justify-center bg-brand-500 ${className}`} aria-hidden>
      <svg viewBox="0 0 24 24" className="h-[60%] w-[60%] text-white" fill="currentColor" aria-hidden="true">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    </div>
  );
}
