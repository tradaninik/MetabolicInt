'use client';

// P5-a - Install page (public; deliberately reachable before login so the
// app can be installed first and signed into from the home-screen icon).
//
// Platform-aware guidance, no new dependencies:
//   - Android/Chromium: captures beforeinstallprompt and offers a real
//     Install button.
//   - iOS Safari: no install prompt API exists - step-by-step
//     Share > Add to Home Screen instructions.
//   - Desktop browsers: point at the address-bar install icon.
//   - Already-installed (standalone display): a calm "you're in" state.
// The QR code is a pre-generated static SVG (public/install-qr.svg) that
// encodes this page's production URL - verified to scan - so desktop
// visitors can jump to install instructions on their phone.

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Platform = 'android-chrome' | 'ios-safari' | 'desktop' | 'standalone' | 'other';

/** Minimal UA sniff, only to pick guidance copy. Cosmetic, never security. */
function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'other';
  const ua = navigator.userAgent;
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return 'standalone';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (isIOS) return 'ios-safari';
  if (/Android/.test(ua)) return 'android-chrome';
  return 'desktop';
}

export default function InstallPage() {
  const [platform, setPlatform] = useState<Platform>('other');
  const [deferred, setDeferred] = useState<{ prompt: () => Promise<void> } | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    const onBip = (e: Event) => {
      // Chromium fires this some time after load; hold the event for our button.
      e.preventDefault();
      setDeferred({ prompt: () => (e as BeforeInstallPromptEvent).prompt() });
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function installNow() {
    if (!deferred) return;
    try {
      await deferred.prompt();
    } finally {
      // One prompt per event; a new one fires on next visit if not installed.
      setDeferred(null);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <Link href="/" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
        ← Back to Metabolic
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Install Metabolic on your phone</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Installed, Metabolic opens like any app - full screen, its own icon, no browser bar - and
        your logged data stays exactly where it is.
      </p>

      {/* Page hero (P7-b): pre-optimized WebP, 12KB. Eager: it is the page visual. */}
      <div className="mt-6 flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/install-hero.webp"
          alt="Illustration of a phone with the Metabolic app icon on its home screen"
          width={200}
          height={200}
          loading="eager"
          decoding="async"
          className="rounded-2xl"
        />
      </div>

      {/* QR: only useful from a desktop screen (scan with the phone). */}
      {platform === 'desktop' && (
        <section className="mt-6 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">Open this page on your phone</h2>
          <div className="mt-3 flex items-center gap-4">
            {/* Static pre-generated asset - not a remote image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/install-qr.svg"
              alt="QR code linking to the Metabolic install page"
              className="shrink-0 rounded-lg border border-neutral-200 bg-white dark:border-neutral-700"
              style={{ height: 140, width: 140 }}
            />
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Point your phone camera here, then follow the steps it opens.
            </p>
          </div>
        </section>
      )}

      {platform === 'standalone' || installed ? (
        <section className="mt-6 rounded-2xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-900 dark:bg-brand-950/30">
          <h2 className="text-sm font-semibold text-brand-900 dark:text-brand-100">You&apos;re all set</h2>
          <p className="mt-1 text-sm text-brand-800 dark:text-brand-300">
            This looks like the installed app already. Sign in from here any time.
          </p>
          <Link
            href="/login"
            className="mt-3 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Sign in
          </Link>
        </section>
      ) : (
        <div className="mt-6 space-y-4">
          {platform === 'android-chrome' && (
            <section className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
              <h2 className="text-sm font-semibold">Android</h2>
              {deferred ? (
                <>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                    Tap Install and confirm the prompt.
                  </p>
                  <button
                    onClick={installNow}
                    className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                  >
                    Install app
                  </button>
                </>
              ) : (
                <div>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                    If the button doesn&apos;t appear, use the browser menu (⋮) → <b>Add to Home screen</b>{' '}
                    / <b>Install app</b>.
                  </p>
                  <p className="mt-3 text-xs font-medium text-neutral-500">
                    Still not showing? A calm, quick check:
                  </p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs text-neutral-600 dark:text-neutral-400">
                    <li>
                      Being signed in doesn&apos;t matter - installing works with or without an account.
                    </li>
                    <li>Use Chrome or Edge on your Android phone - other browsers may not offer install.</li>
                    <li>
                      Make sure you&apos;re on the real Metabolic site URL, opened straight in the browser
                      (not inside another app).
                    </li>
                  </ul>
                </div>
              )}
            </section>
          )}

          {platform === 'ios-safari' && (
            <section className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
              <h2 className="text-sm font-semibold">iPhone / iPad (Safari)</h2>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
                <li>Tap the <b>Share</b> button (the square with an arrow, at the bottom of Safari).</li>
                <li>Scroll down and tap <b>Add to Home Screen</b>.</li>
                <li>Tap <b>Add</b> - the Metabolic icon appears with your other apps.</li>
              </ol>
              <p className="mt-2 text-xs text-neutral-500">
                Added this way, the app opens full screen with no browser bars.
              </p>
            </section>
          )}

          {platform === 'desktop' && (
            <section className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
              <h2 className="text-sm font-semibold">Desktop</h2>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                Chrome and Edge show a small install icon (screen with a down-arrow) at the right end
                of the address bar. Click it to install Metabolic as a desktop app.
              </p>
            </section>
          )}

          {platform === 'other' && (
            <section className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
              <h2 className="text-sm font-semibold">Any phone browser</h2>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                Open the browser menu and look for <b>Add to Home screen</b> or{' '}
                <b>Install app</b>. That&apos;s all installing takes.
              </p>
            </section>
          )}
        </div>
      )}

      <p className="mt-8 text-xs leading-relaxed text-neutral-500">
        Educational tool - not medical advice. Installing works the same whether you have an account
        yet or not.
      </p>
    </main>
  );
}

/** The DOM lib doesn't type this event; declared locally, used once. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}
