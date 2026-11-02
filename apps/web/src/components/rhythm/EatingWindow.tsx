/**
 * EatingWindow — median daily eating window with close time (mockup R1, card 2).
 */
import type { RhythmData } from './types';

const GREEN = '#0a8e5f';
const GREEN_DARK = '#08724c';

function hourLabel(h: number): string {
  const hr = Math.floor(h) % 24;
  const min = Math.round((h - Math.floor(h)) * 60);
  const mm = min ? `:${String(min).padStart(2, '0')}` : '';
  const ap = hr < 12 ? 'AM' : 'PM';
  const hr12 = hr % 12 === 0 ? 12 : hr % 12;
  return `${hr12}${mm} ${ap}`;
}

export function EatingWindow({ data }: { data: RhythmData }) {
  const { eatingWindow: w } = data;
  const left = `${(w.openHour / 24) * 100}%`;
  const width = `${((w.closeHour - w.openHour) / 24) * 100}%`;
  const closeLeft = `${(w.closeHour / 24) * 100}%`;

  return (
    <section className="rounded-[14px] border border-[#e5e7eb] bg-white p-3.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#9ca3af]">Eating window</span>

      <div className="relative mt-8 h-3 rounded-full bg-[#e8ebee]">
        <div className="absolute inset-y-0 rounded-full" style={{ left, width, background: GREEN }} />
        <div className="absolute -inset-y-[3px] w-0.5" style={{ left: closeLeft, background: GREEN_DARK }} />
        <span
          className="absolute -top-[15px] -translate-x-1/2 whitespace-nowrap rounded-[5px] bg-[#e8f5ef] px-[5px] py-px text-[9px] font-bold text-[#08724c]"
          style={{ left: closeLeft }}
        >
          {w.closeLabel}
        </span>
      </div>

      <div className="mt-1.5 flex justify-between">
        {['6 AM', '12 PM', '6 PM', '12 AM'].map((t) => (
          <span key={t} className="text-[10px] text-[#9ca3af]">{t}</span>
        ))}
      </div>

      <div className="mt-2.5 flex items-baseline gap-2">
        <b className="text-[14px] font-semibold text-[#111827]">{w.hours} h</b>
        <span className="text-[12px] text-[#6b7280]">
          {hourLabel(w.openHour)} → {hourLabel(w.closeHour)}
        </span>
        <span className="ml-auto text-[12px] font-semibold text-[#08724c]">closes {w.closeLabel}</span>
      </div>

      <span className="mt-2 block text-[11px] text-[#9ca3af]">
        From {w.daysObserved} days of meal logs · median window
      </span>
    </section>
  );
}
