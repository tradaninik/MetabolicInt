/**
 * /rhythm-preview — additive preview route for the Rhythm kit (Phase A).
 * Same pattern as your /insights-preview route: sample data, no production imports.
 * Server component: zero client JS shipped for these presentational pieces.
 */
import { RhythmHome } from '@/components/rhythm/RhythmHome';
import { RhythmLocked } from '@/components/rhythm/RhythmLocked';
import { RhythmCard } from '@/components/rhythm/RhythmCard';
import { sampleRhythm, sampleRhythmForming } from '@/components/rhythm/sampleData';

function SectionLabel({ n, title, note }: { n: string; title: string; note: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-[15px] font-bold text-[#111827]">
        <span className="mr-1.5 text-[#08724c]">{n}</span>
        {title}
      </h2>
      <p className="mt-0.5 text-[12px] text-[#6b7280]">{note}</p>
    </div>
  );
}

export default function RhythmPreviewPage() {
  return (
    <main className="min-h-screen bg-[#f6f7f9] px-4 py-6 font-sans antialiased">
      <div className="mx-auto max-w-[420px] lg:max-w-[900px]">
        <header className="mb-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#08724c]">
            Preview kit · additive
          </p>
          <h1 className="mt-1 text-[22px] font-bold tracking-tight text-[#111827]">Metabolic Rhythm</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#6b7280]">
            Your body&rsquo;s daily pattern, measured from your own CGM, meals, sleep and steps — honest confidence on
            every number. Sample data below; the real-data wiring table lives in{' '}
            <code className="rounded bg-white px-1 py-px text-[11px] text-[#374151] ring-1 ring-[#e5e7eb]">
              components/rhythm/README.md
            </code>
            .
          </p>
        </header>

        {/* 1 — dashboard card (integration ①, ships un-wired) */}
        <SectionLabel
          n="1"
          title="Dashboard card — as it will slot in"
          note="Compact version for the production dashboard, after Health Score. Import it to promote (optional)."
        />
        <div className="max-w-[390px]">
          <RhythmCard data={sampleRhythm} />
        </div>
        <div className="mt-3 max-w-[390px]">
          <RhythmCard forming={sampleRhythmForming} />
        </div>

        {/* 2 + 3 — full screens, side by side on desktop */}
        <div className="mt-8 grid gap-8 lg:grid-cols-2 lg:items-start">
          <div>
            <SectionLabel
              n="2"
              title="Rhythm home — unlocked"
              note="What opens when you tap the card. Full 24h pattern, eating window, Agni mapping, tonight."
            />
            <div className="mx-auto w-full max-w-[390px] rounded-[22px] border border-[#e5e7eb] bg-[#f6f7f9] p-3 shadow-sm">
              <RhythmHome data={sampleRhythm} />
            </div>
          </div>
          <div>
            <SectionLabel
              n="3"
              title="Rhythm home — forming"
              note="Shown until enough data exists. No guesses, just progress and a preview."
            />
            <div className="mx-auto w-full max-w-[390px] rounded-[22px] border border-[#e5e7eb] bg-[#f6f7f9] p-3 shadow-sm">
              <RhythmLocked forming={sampleRhythmForming} />
            </div>
          </div>
        </div>

        <footer className="mt-8 border-t border-[#e5e7eb] pt-4 text-[11px] leading-relaxed text-[#9ca3af]">
          Phase A of the Rhythm kit — additive only, zero new dependencies, no edits to existing files. Next phases:
          Meal Story (R2), Food Radar (R3), Weekly Rhythm (R4). Everything here is educational, not medical advice.
        </footer>
      </div>
    </main>
  );
}
