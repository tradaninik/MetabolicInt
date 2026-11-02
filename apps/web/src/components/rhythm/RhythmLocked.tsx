/**
 * RhythmLocked — "Your rhythm is forming" state (mockup R5).
 * Honest by design: progress checklist, no early guesses, faint preview only.
 */
import type { RhythmForming } from './types';

const GREEN = '#0a8e5f';
const GREEN_DARK = '#08724c';
const GRAY_L = '#9ca3af';

const W = 330;
const H = 80;
const mgdlToY = (v: number) => 8 + ((125 - v) / 30) * 62;

function dashedPath(curve: { hour: number; mgdl: number }[]): string {
  return curve
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${((p.hour / 24) * W).toFixed(1)},${mgdlToY(p.mgdl).toFixed(1)}`)
    .join(' ');
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export function RhythmLocked({ forming }: { forming: RhythmForming }) {
  const pct = Math.min(100, Math.round((forming.daysCollected / forming.daysRequired) * 100));

  return (
    <div className="flex flex-col gap-3">
      {/* hero */}
      <section className="rounded-2xl border-[1.5px] border-dashed border-[#cfd4da] bg-white px-[18px] py-[22px] text-center">
        <div className="mx-auto mb-3 flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-[#e8f5ef]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={GREEN_DARK} strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="4" y="10" width="16" height="10" rx="2.5" />
            <path d="M8 10V7a4 4 0 018 0v3" />
          </svg>
        </div>
        <h1 className="text-[20px] font-bold tracking-tight text-[#111827]">Your rhythm is forming</h1>
        <p className="mt-1 text-[13px] text-[#6b7280]">
          {forming.daysCollected} of {forming.daysRequired} days of data collected — about{' '}
          {forming.daysRequired - forming.daysCollected} days to go
        </p>
        <div className="mx-0 mt-4 h-2 overflow-hidden rounded-full bg-[#e8ebee]">
          <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: GREEN }} />
        </div>
        <div className="mt-[7px] flex justify-between text-[11px] text-[#6b7280]">
          <span><b className="font-semibold text-[#08724c]">{forming.daysCollected} / {forming.daysRequired} days</b></span>
          <span>unlocks {forming.unlocksOn}</span>
        </div>
      </section>

      {/* checklist */}
      <section className="rounded-[14px] border border-[#e5e7eb] bg-white px-3.5 py-1">
        {forming.checks.map((c) => {
          const done = c.done >= c.required;
          return (
            <div key={c.id} className="flex items-center gap-2.5 border-b border-[#f3f4f6] py-2.5 last:border-b-0">
              {done ? (
                <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full" style={{ background: GREEN }}>
                  <CheckIcon />
                </span>
              ) : (
                <span className="h-[22px] w-[22px] flex-none rounded-full border-[1.5px] border-dashed border-[#cfd4da]" />
              )}
              <span className="min-w-0 flex-1">
                <b className="block text-[13px] font-semibold text-[#111827]">{c.label}</b>
                <span className="text-[11px] text-[#6b7280]">{c.hint}</span>
              </span>
              <span className={`text-[11px] font-semibold ${done ? 'text-[#08724c]' : 'text-[#b45309]'}`}>
                {c.done} of {c.required}{!done && ` · ${c.required - c.done} to go`}
              </span>
            </div>
          );
        })}
      </section>

      {/* what you'll get */}
      <section className="rounded-[14px] border border-[#e5e7eb] bg-white p-3.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#9ca3af]">What you&rsquo;ll get</span>
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 block w-full" role="img"
          aria-label="Faint preview of the future rhythm curve">
          <path d={dashedPath(forming.previewCurve)} fill="none" stroke="#d1d5db" strokeWidth="2"
            strokeDasharray="5 5" strokeLinecap="round" />
          <rect x={(12 / 24) * W} y="8" width={(2 / 24) * W} height="62" rx="5" fill={GREEN} opacity="0.05" />
          <rect x={(20 / 24) * W} y="8" width={(2 / 24) * W} height="62" rx="5" fill="#b45309" opacity="0.05" />
        </svg>
        <span className="mt-1.5 block text-[11px] text-[#9ca3af]">
          Preview — your carb-friendly window, evening rise, eating window and Agni mapping
        </span>
      </section>

      {/* honesty note */}
      <div className="flex items-start gap-2 rounded-xl border border-[#dfeae5] bg-[#f4f8f6] p-3 text-[12px] leading-relaxed text-[#3f5a50]">
        <span aria-hidden>🛡️</span>
        <span>
          We won&rsquo;t guess your rhythm early. When it unlocks, every estimate carries a confidence label — and you can
          always tap through to the meals and nights behind it.
        </span>
      </div>

      {/* actions (preview-safe: plain buttons, no handlers) */}
      <div className="flex flex-col gap-2.5">
        <button type="button" className="flex h-12 items-center justify-center rounded-xl text-[15px] font-semibold text-white"
          style={{ background: GREEN }}>
          Log breakfast — it counts
        </button>
        <button type="button" className="flex h-12 items-center justify-center rounded-xl border border-[#e5e7eb] bg-white text-[15px] font-semibold text-[#111827]">
          Preview the full rhythm
        </button>
      </div>

      <p className="text-center text-[11px] text-[#9ca3af]">Updates nightly · your data stays yours</p>
    </div>
  );
}
