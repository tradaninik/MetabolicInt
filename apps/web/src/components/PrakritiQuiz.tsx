'use client';

import { useCallback, useEffect, useState } from 'react';

interface QuizQuestion {
  id: string;
  domain: string;
  text: string;
  options: { tag: string; label: string }[];
}

interface ProfileView {
  answers: Record<string, string>;
  vata: number;
  pitta: number;
  kapha: number;
  vataPct?: number;
  pittaPct?: number;
  kaphaPct?: number;
  primary: string;
  secondary: string;
  takenAt: string;
}

const DOSHA_LABEL: Record<string, string> = { vata: 'Vata', pitta: 'Pitta', kapha: 'Kapha' };
const DOSHA_BAR: Record<string, string> = {
  vata: 'bg-sky-500',
  pitta: 'bg-amber-500',
  kapha: 'bg-emerald-500',
};

export default function PrakritiQuiz() {
  const [state, setState] = useState<'loading' | 'quiz' | 'result' | 'error'>('loading');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const res = await fetch('/api/ayurveda/prakriti');
      if (!res.ok) throw new Error('Could not load your profile - please sign in and try again.');
      const data = await res.json();
      setQuestions(data.questions ?? []);
      setProfile(data.profile ?? null);
      setAnswers(data.profile?.answers ?? {});
      setState(data.profile ? 'result' : 'quiz');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setState('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/ayurveda/prakriti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Could not save your answers.');
      setProfile(data.profile);
      setState('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  if (state === 'loading') return <p className="text-sm text-neutral-500">Loading...</p>;
  if (state === 'error') return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;

  if (state === 'result' && profile) {
    const rows = [
      { key: 'vata', count: profile.vata, pct: profile.vataPct },
      { key: 'pitta', count: profile.pitta, pct: profile.pittaPct },
      { key: 'kapha', count: profile.kapha, pct: profile.kaphaPct },
    ];
    return (
      <div>
        <h2 className="text-sm font-semibold">
          Your profile: {DOSHA_LABEL[profile.primary] ?? profile.primary} primary · {DOSHA_LABEL[profile.secondary] ?? profile.secondary} secondary
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Last taken {new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(profile.takenAt))}
        </p>
        <div className="mt-4 space-y-3">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-sm text-neutral-500">{DOSHA_LABEL[r.key]}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div className={`h-full ${DOSHA_BAR[r.key]}`} style={{ width: `${r.pct ?? Math.round((r.count / 12) * 100)}%` }} />
              </div>
              <span className="w-20 text-right text-sm tabular-nums">
                {r.count}/12{r.pct !== undefined ? ` (${r.pct}%)` : ''}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          In the Ayurvedic tradition everyone carries all three doshas - this is only a look at your current mix.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => { setAnswers({}); setState('quiz'); }}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Retake the quiz
          </button>
          <a
            href="/dashboard"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    );
  }

  const domains: string[] = [];
  for (const q of questions) if (!domains.includes(q.domain)) domains.push(q.domain);
  const answered = Object.keys(answers).length;
  const total = questions.length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-neutral-500">{answered} of {total} answered</p>
        {profile && <p className="text-xs text-neutral-500">Retaking keeps your previous result in history.</p>}
      </div>
      <div className="space-y-6">
        {domains.map((domain) => (
          <div key={domain}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{domain}</h3>
            <div className="mt-2 space-y-4">
              {questions.filter((q) => q.domain === domain).map((q) => (
                <div key={q.id}>
                  <p className="text-sm font-medium">{q.text}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {q.options.map((o) => {
                      const selected = answers[q.id] === o.tag;
                      return (
                        <button
                          key={o.tag}
                          type="button"
                          onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: o.tag }))}
                          className={`rounded-xl border p-3 text-left text-sm ${selected
                            ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40'
                            : 'border-neutral-200 hover:border-brand-300 dark:border-neutral-800'}`}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={submitting || answered < total}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Saving...' : 'See my profile'}
        </button>
        {answered < total && <p className="text-xs text-neutral-400">Answer all {total} questions to continue.</p>}
      </div>
    </div>
  );
}