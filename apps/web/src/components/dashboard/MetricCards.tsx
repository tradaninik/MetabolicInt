// Six metric cards (dashboard revamp item 2, approved v1 layout).
// Server component — every number arrives precomputed from engine-service
// (patterns.ts math), each with its own evidence basis and source stamp.
// No population references: every "usual" is the user's own history.

import type { MetricCards } from '@/lib/engine-service';

const DAY_MS = 86_400_000;

function istClock(t: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(t));
}

function istHourLabel(t: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: true,
  }).format(new Date(t));
}

function relDay(t: number, now: number): string {
  const days = Math.floor((now - t) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

function CardShell({
  title, children, highlight = false,
}: { title: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <section
      className={`rounded-2xl border p-4 ${
        highlight
          ? 'border-amber-200 bg-yellow-50 dark:border-amber-900/50 dark:bg-yellow-950/20'
          : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'
      }`}
    >
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

export default function MetricCardsRow({ cards, now }: { cards: MetricCards; now: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <GlucoseLatestCard g={cards.glucose} />
      <TimeInRangeCard tir={cards.timeInRange} />
      <StepsCard s={cards.steps} />
      <SleepCard s={cards.sleep} />
      <WeightCard w={cards.weight} now={now} />
      <MedsCard m={cards.meds} now={now} />
    </div>
  );
}

// 1 ── Glucose · Latest (highlighted: it is the reading the rest of the page explains)
function GlucoseLatestCard({ g }: { g: MetricCards['glucose'] }) {
  if (!g.latest) {
    return (
      <CardShell title="Glucose · Latest" highlight>
        <p className="mt-2 text-sm text-neutral-500">No reading yet — log one to start your pattern.</p>
      </CardShell>
    );
  }
  const { latest, usual, deviation, alert, afterMeal } = g;
  return (
    <CardShell title="Glucose · Latest" highlight>
      <p className="mt-1.5 text-3xl font-semibold tabular-nums leading-none">
        {Math.round(latest.value)}
        <span className="ml-1 text-xs font-normal text-neutral-500">mg/dL</span>
      </p>
      {deviation !== null && usual.n >= 3 ? (
        alert ? (
          <p className={`mt-1.5 text-xs font-medium ${deviation > 0 ? 'text-red-600 dark:text-red-400' : 'text-brand-600 dark:text-brand-400'}`}>
            {deviation > 0 ? '▲' : '▼'} {Math.abs(deviation)} {deviation > 0 ? 'above' : 'below'} your usual {istHourLabel(latest.takenAt)} pattern
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-neutral-500">within your usual {istHourLabel(latest.takenAt)} range</p>
        )
      ) : (
        <p className="mt-1.5 text-xs text-neutral-400">
          usual pattern forming · {usual.n}/3 same-hour readings
        </p>
      )}
      <p className="mt-1 text-[11px] leading-snug text-neutral-400">
        {latest.source} · {istClock(latest.takenAt)}
        {afterMeal && ` · ${afterMeal.hours} h after ${afterMeal.slot}`}
      </p>
    </CardShell>
  );
}

// 2 ── Time in range
function TimeInRangeCard({ tir }: { tir: MetricCards['timeInRange'] }) {
  return (
    <CardShell title="Time in Range">
      {tir.pct === null ? (
        <p className="mt-2 text-sm text-neutral-500">No readings in the last {tir.days} days.</p>
      ) : (
        <>
          <p className="mt-1.5 text-3xl font-semibold tabular-nums leading-none">
            {tir.pct}
            <span className="text-xs font-normal text-neutral-500">%</span>
          </p>
          <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full" role="img"
            aria-label={`${tir.pct}% of ${tir.total} readings in range`}>
            {tir.below > 0 && (
              <div className="bg-red-400" style={{ width: `${tir.belowPct}%` }} />
            )}
            <div className="bg-brand-500" style={{ width: `${tir.pct}%` }} />
            {tir.above > 0 && (
              <div className="bg-amber-400" style={{ width: `${tir.abovePct}%` }} />
            )}
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-neutral-400">
            {tir.low}–{tir.high} mg/dL · {tir.total} readings · {tir.days} days
          </p>
        </>
      )}
    </CardShell>
  );
}

// 3 ── Steps today + 7-day sparkline
function StepsCard({ s }: { s: MetricCards['steps'] }) {
  const max = Math.max(...s.last7.map((d) => d.steps), 1);
  return (
    <CardShell title="Steps Today">
      <p className="mt-1.5 text-3xl font-semibold tabular-nums leading-none">
        {s.today.toLocaleString('en-IN')}
      </p>
      <div className="mt-2 flex h-8 items-end gap-1" aria-hidden>
        {s.last7.map((d, i) => {
          const isToday = i === s.last7.length - 1;
          return (
            <div
              key={d.dayStart}
              className={`w-full rounded-sm ${isToday ? 'bg-brand-600' : 'bg-brand-200 dark:bg-brand-900'}`}
              style={{ height: `${Math.max((d.steps / max) * 100, 4)}%` }}
            />
          );
        })}
      </div>
      {s.pctVsUsual !== null && s.usualAvg !== null && s.usualAvg > 0 ? (
        <p className={`mt-1.5 text-xs font-medium ${s.pctVsUsual < -20 ? 'text-red-600 dark:text-red-400' : 'text-neutral-500'}`}>
          {s.pctVsUsual > 0 ? '▲' : '▼'} {Math.abs(s.pctVsUsual)}% vs your {s.usualAvg.toLocaleString('en-IN')} avg
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-neutral-400">building your 7-day average…</p>
      )}
      {s.latestAt && (
        <p className="mt-1 text-[11px] text-neutral-400">
          {s.latestSource ?? 'manual'} · synced {istClock(s.latestAt)}
        </p>
      )}
    </CardShell>
  );
}

// 4 ── Sleep last night
function SleepCard({ s }: { s: MetricCards['sleep'] }) {
  if (s.lastHours === null) {
    return (
      <CardShell title="Sleep Last Night">
        <p className="mt-2 text-sm text-neutral-500">No sleep logged yet.</p>
      </CardShell>
    );
  }
  const short = s.deltaHours !== null && s.deltaHours <= -0.75;
  return (
    <CardShell title="Sleep Last Night">
      <p className="mt-1.5 text-3xl font-semibold tabular-nums leading-none">
        {s.lastHours.toFixed(1)}
        <span className="text-xs font-normal text-neutral-500">h</span>
      </p>
      {s.usualAvg !== null ? (
        <p className={`mt-1.5 text-xs ${short ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-neutral-500'}`}>
          {short ? `▼ ${Math.abs(s.deltaHours!).toFixed(1)} h vs usual` : 'usual'} {s.usualAvg.toFixed(1)} h
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-neutral-400">building your usual…</p>
      )}
      {s.wokeAt && <p className="mt-1 text-[11px] text-neutral-400">woke {istClock(s.wokeAt)}</p>}
    </CardShell>
  );
}

// 5 ── Weight trend
function WeightCard({ w, now }: { w: MetricCards['weight']; now: number }) {
  if (w.latestKg === null) {
    return (
      <CardShell title="Weight">
        <p className="mt-2 text-sm text-neutral-500">No weight logged yet.</p>
      </CardShell>
    );
  }
  const down = w.delta30d !== null && w.delta30d < 0;
  return (
    <CardShell title="Weight">
      <p className="mt-1.5 text-3xl font-semibold tabular-nums leading-none">
        {w.latestKg.toFixed(1)}
        <span className="text-xs font-normal text-neutral-500">kg</span>
      </p>
      {w.delta30d !== null ? (
        <p className={`mt-1.5 text-xs font-medium ${down ? 'text-brand-600 dark:text-brand-400' : 'text-amber-600 dark:text-amber-400'}`}>
          {down ? '▼' : '▲'} {Math.abs(w.delta30d).toFixed(1)} kg over 30 days
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-neutral-400">trend appears after a second entry</p>
      )}
      <p className="mt-1 text-[11px] text-neutral-400">
        {relDay(w.latestAt ?? now, now)} · manual
      </p>
    </CardShell>
  );
}

// 6 ── Meds today
function MedsCard({ m, now }: { m: MetricCards['meds']; now: number }) {
  if (m.scheduled === 0) {
    return (
      <CardShell title="Meds Today">
        <p className="mt-2 text-sm text-neutral-500">
          No active schedule —{' '}
          <a href="/meds" className="text-brand-600 hover:underline">add one</a>.
        </p>
      </CardShell>
    );
  }
  const preview = m.slots.slice(0, 2);
  return (
    <CardShell title="Meds Today">
      <p className="mt-1.5 text-3xl font-semibold tabular-nums leading-none">
        {m.taken}
        <span className="text-lg font-normal text-neutral-400"> / {m.scheduled} taken</span>
      </p>
      <ul className="mt-1.5 space-y-0.5 text-[11px] leading-snug text-neutral-500">
        {preview.map((slot) => (
          <li key={`${slot.name}-${slot.slotTime}`} className="flex items-baseline justify-between gap-1">
            <span className="truncate">{slot.name}</span>
            <span className="shrink-0 tabular-nums text-neutral-400">
              {slot.slotTime}
              {slot.status === 'planned' && ' · planned'}
              {slot.status === 'skipped' && ' · skipped'}
            </span>
          </li>
        ))}
        {m.slots.length > 2 && (
          <li className="text-neutral-400">+{m.slots.length - 2} more slots</li>
        )}
      </ul>
      {m.lastLoggedAt && (
        <p className="mt-1 text-[11px] text-neutral-400">logged {istClock(m.lastLoggedAt)}</p>
      )}
    </CardShell>
  );
}
