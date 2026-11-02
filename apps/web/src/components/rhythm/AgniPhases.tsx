/**
 * AgniPhases — Ayurvedic phase list mapped onto the measured curve (mockup R1, card 3).
 * Always carries the "educational, not medical advice" disclaimer (Design DNA).
 */
import type { RhythmData } from './types';

export function AgniPhases({ data }: { data: RhythmData }) {
  return (
    <section className="rounded-[14px] border border-[#e5e7eb] bg-white p-3.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#9ca3af]">
        Agni phases · mapped to your curve
      </span>

      <ul className="mt-1">
        {data.phases.map((phase) => (
          <li key={phase.id} className="flex items-start gap-2.5 border-b border-[#f3f4f6] py-2 last:border-b-0">
            <span className="text-[20px] leading-tight" aria-hidden>{phase.emoji}</span>
            <span className="min-w-0 flex-1">
              <b className="block text-[13px] font-semibold text-[#111827]">{phase.name}</b>
              <span className="text-[11.5px] text-[#6b7280]">{phase.description}</span>
            </span>
            <span className="flex-none whitespace-nowrap rounded-full bg-[#f3f4f6] px-2 py-[2px] text-[11px] font-semibold text-[#6b7280]">
              {phase.range}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-2.5 flex items-start gap-2 rounded-[10px] bg-[#e8f5ef] p-2.5 text-[12px] leading-relaxed text-[#08724c]">
        <span aria-hidden>🔗</span>
        <span>
          {data.phaseBridge.text}{' '}
          <b>{data.phaseBridge.confidence}% conf</b>
        </span>
      </div>

      <p className="mt-2 text-[10.5px] leading-relaxed text-[#9ca3af]">
        Agni is an Ayurvedic framework — educational, not medical advice.
      </p>
    </section>
  );
}
