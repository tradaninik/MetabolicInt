'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/log', label: 'Log a meal' },
  { href: '/coach', label: 'AI Coach' },
  { href: '/insights', label: 'Insights' },
  { href: '/indian', label: 'Indian MI' },
  { href: '/glucose', label: 'Glucose' },
  { href: '/predict', label: 'Predict' },
  { href: '/family', label: 'Family' },
  { href: '/doctor', label: 'Doctor' },
  { href: '/reports', label: 'Reports' },
  { href: '/admin', label: 'Admin' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathway = usePathname();
  const { data: session } = useSession();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950 lg:flex">
        <Link href="/dashboard" className="mb-8 flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-brand-500" aria-hidden />
          <span className="font-semibold tracking-tight">Metabolic</span>
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
            <div className="h-6 w-6 rounded-md bg-brand-500" aria-hidden />
            <span className="font-semibold tracking-tight">Metabolic</span>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="text-xs text-neutral-500"
          >
            Sign out
          </button>
        </header>
        <MobileNav />
        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function MobileNav() {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-neutral-200 px-3 py-2 dark:border-neutral-800 lg:hidden">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className="whitespace-nowrap rounded-lg px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-200/60 dark:text-neutral-400 dark:hover:bg-neutral-900"
        >
          {n.label}
        </Link>
      ))}
    </nav>
  );
}
