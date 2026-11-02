/**
 * TonightCard — one evidenced evening nudge (mockup R1, card 4).
 */
import type { RhythmData } from './types';

export function TonightCard({ data }: { data: RhythmData }) {
  return (
    <section className="rounded-[14px] border border-[#e5e7eb] bg-white p-3.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#9ca3af]">Tonight</span>

      <div className="mt-1 flex items-start gap-3">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#e8f5ef] text-[20px]" aria-hidden>
          🌙
        </div>
        <div className="min-w-0">
          <b className="block text-[14.5px] font-semibold text-[#111827]">{data.tonight.headline}</b>
          <p className="mt-[3px] text-[12.5px] leading-relaxed text-[#6b7280]">{data.tonight.body}</p>
          <span className="mt-[7px] block text-[11px] text-[#9ca3af]">{data.tonight.evidence}</span>
        </div>
      </div>
    </section>
  );
}
