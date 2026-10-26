import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-brand-500" aria-hidden />
          <span className="text-lg font-semibold tracking-tight">Metabolic Intelligence</span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">
            Sign in
          </Link>
          <Link
            href="/onboarding"
            className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white transition hover:bg-brand-700"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="mt-20 flex flex-col items-start gap-6">
        <span className="mi-disclaimer">Educational · Not medical advice</span>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Stop counting carbs. Start understanding <span className="text-brand-600">your</span> metabolism.
        </h1>
        <p className="max-w-2xl text-lg text-neutral-600 dark:text-neutral-300">
          Current apps tell you <em>&ldquo;you ate 80g of carbs.&rdquo;</em> We tell you{' '}
          <em>&ldquo;when YOU eat this meal, your glucose typically rises 45 mg/dL — and a 15-minute
          walk cuts that to 22 mg/dL.&rdquo;</em> A personal metabolic model that learns from every meal.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/onboarding"
            className="rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            Build my metabolic model
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-neutral-300 px-6 py-3 font-semibold text-neutral-800 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
          >
            See the demo dashboard
          </Link>
        </div>

        {/* Hero visual (P7-b): the same fresh meal spread as the dashboard
            banner; lazy because it sits at or below the first fold. */}
        <div className="w-full overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/hero-dashboard.webp"
            alt="Fresh, colorful Indian meal spread"
            width={1344}
            height={768}
            loading="lazy"
            decoding="async"
            className="h-56 w-full object-cover sm:h-72"
          />
        </div>
      </section>

      <section className="mt-24 grid gap-6 sm:grid-cols-3">
        {[
          {
            title: 'Regional Indian intelligence',
            body: 'South Indian, North Indian, Bengali, Gujarati, Punjabi, Tamil, Kerala cuisine — each with its own glycemic profile. A dosa is not a chapati.',
          },
          {
            title: 'Predicts, doesn’t just log',
            body: 'Forecasts your glucose, weight, and HbA1c trajectory with confidence intervals — before problems occur.',
          },
          {
            title: 'Explainable, not a black box',
            body: 'Every recommendation cites the meals, sleep, and activity it used. You see why the model says what it says.',
          },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-neutral-200 p-6 transition hover:border-brand-400 dark:border-neutral-800 dark:hover:border-brand-600"
          >
            <h3 className="mb-2 font-semibold">{f.title}</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="mt-auto pt-16 text-xs text-neutral-500">
        Built as a v1 foundation. Predictions are produced by a deterministic engine and are
        not a substitute for professional medical advice.
      </footer>
    </main>
  );
}
