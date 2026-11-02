import { type ReactNode } from "react";
import { Leaf, Sparkles } from "lucide-react";

export function StatCard({
  icon, value, label, sub, accent = false,
}: { icon: ReactNode; value: string; label: string; sub?: string; accent?: boolean }) {
  return (
    <div className="mi-card flex flex-col gap-1 p-3">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent ? "bg-teal-100 text-teal-950" : "bg-teal-50 text-teal-800"}`}>
        {icon}
      </div>
      <p className="num whitespace-nowrap text-xl font-extrabold tracking-tight">{value}</p>
      <p className="text-[.8125rem] font-semibold">{label}</p>
      {sub && <p className="num text-xs text-ink-3">{sub}</p>}
    </div>
  );
}

export function SectionHead({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="mb-2 mt-1 flex items-center justify-between px-0.5">
      <h2 className="text-[1.0625rem] font-bold tracking-tight">{title}</h2>
      {right}
    </div>
  );
}

export function PageHeader({
  back, onBack, title, sub, right,
}: { back?: string; onBack?: () => void; title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <header className="px-0.5 pb-3 pt-2">
      {back && onBack && (
        <button onClick={onBack} className="tap -ml-2 flex min-h-12 items-center gap-1 text-sm font-semibold text-ink-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 5.5L8 12l6.5 6.5" />
          </svg>
          {back}
        </button>
      )}
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight">{title}</h1>
          {sub && <p className="num mt-0.5 text-sm text-ink-3">{sub}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}

export function ForYou({ children, note }: { children: ReactNode; note: string }) {
  return (
    <section className="rounded-2xl bg-teal-50 p-4 shadow-[0_1px_2px_rgba(28,43,51,.05),0_2px_8px_rgba(28,43,51,.04)]">
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-teal-950">
        <Sparkles className="h-4 w-4" aria-hidden />
        For you
      </div>
      <p className="mt-2 text-base leading-normal">{children}</p>
      <p className="mt-2 text-xs text-ink-3">{note}</p>
    </section>
  );
}

export function AyuCard() {
  return (
    <section className="flex items-start gap-3 rounded-2xl bg-amberu-50 p-4">
      <Leaf className="mt-0.5 h-5 w-5 shrink-0 text-amberu-700" aria-hidden />
      <div>
        <b className="text-[.6875rem] font-bold uppercase tracking-widest text-amberu-800">
          Ayurveda · optional
        </b>
        <p className="mt-0.5 text-sm">
          Warm methi (fenugreek) water in the morning is a traditional way to support steady sugars.
        </p>
      </div>
    </section>
  );
}
