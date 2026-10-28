import { ritucharyaCard, ritucharyaSeason } from '@mi/engine';
import Link from 'next/link';

// U14 Ritucharya: seasonal guidance card for the dashboard (educational, not medical advice).
// Month is computed in IST to match the app's other time formatting.
export default function SeasonalCard() {
  const month = Number(
    new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', month: 'numeric' }).format(new Date()),
  );
  const card = ritucharyaCard(ritucharyaSeason(month));

  return (
    <section className="flex h-full flex-col rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mb-4">
        <h2 className="text-sm font-semibold">This month: {card.name}</h2>
        <p className="text-xs text-neutral-500">Seasonal routine (Ritucharya) · {card.window}</p>
      </div>
      <p className="text-sm text-neutral-700 dark:text-neutral-300">{card.focus}</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <div>
          <h3 className="text-xs font-semibold text-neutral-500">Diet emphasis</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {card.diet.map((item) => (<li key={item}>{item}</li>))}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-neutral-500">Routine</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {card.routine.map((item) => (<li key={item}>{item}</li>))}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-neutral-500">Seasonal shopping list</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {card.shopping.map((item) => (<li key={item}>{item}</li>))}
          </ul>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-neutral-400">
          Educational information only - not medical advice. Traditional Ayurvedic guidance, not a substitute for your clinician.
        </p>
        <Link href="/prakriti" className="text-xs font-medium text-brand-600 hover:underline">
          Take the 12-question quiz
        </Link>
      </div>
    </section>
  );
}