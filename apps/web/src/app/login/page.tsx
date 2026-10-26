'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { MEDICAL_DISCLAIMER_SHORT } from '@/lib/disclaimer';

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginShell() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <div className="h-8 w-8 rounded-lg bg-brand-500" aria-hidden />
      <p className="mt-4 text-neutral-500">Loading…</p>
    </main>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl,
    });
    setLoading(false);
    if (res?.error) {
      setError('Incorrect email or password.');
    } else if (res?.ok) {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  function fillDemo() {
    setEmail('demo@metabolic.dev');
    setPassword('demo1234');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-brand-500" aria-hidden />
        <span className="font-semibold tracking-tight">Metabolic Intelligence</span>
      </Link>

      <h1 className="text-2xl font-semibold">Welcome back</h1>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Sign in to your metabolic model.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 outline-none focus:border-brand-500 dark:border-neutral-700"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 outline-none focus:border-brand-500 dark:border-neutral-700"
            placeholder="••••••••"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <button
        onClick={fillDemo}
        className="mt-3 w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
      >
        Use demo account
      </button>

      <p className="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
        New here?{' '}
        <Link href="/onboarding" className="font-medium text-brand-600 hover:underline">
          Create an account
        </Link>
      </p>

      {/* P5-a: install-first path - many users set the app up from their phone. */}
      <p className="mt-3 text-center text-sm text-neutral-600 dark:text-neutral-400">
        On your phone?{' '}
        <Link href="/install" className="font-medium text-brand-600 hover:underline">
          Install the app
        </Link>
      </p>

      <p className="mt-8 text-center text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        {MEDICAL_DISCLAIMER_SHORT}
      </p>
    </main>
  );
}
