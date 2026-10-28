'use client';

import { useCallback, useEffect, useState } from 'react';
import PrakritiResult, { type ProfileView } from './PrakritiResult';

interface QuizQuestion {
  id: string;
  domain: string;
  text: string;
  options: { tag: string; label: string }[];
}

// S2-B: ProfileView moved to PrakritiResult (gains profileLabel/isTie).
// The quiz keeps quizVersion around so the result can say "based on the
// current questionnaire (v1)". history comes from the GET payload (newest
// first, latest 10) — after a retake we re-load so the list stays truthful.

export interface HistoryItem {
  takenAt: string;
  vata: number;
  pitta: number;
  kapha: number;
  vataPct?: number;
  pittaPct?: number;
  kaphaPct?: number;
  profileLabel?: string;
  isTie?: boolean;
}

export default function PrakritiQuiz() {
  const [state, setState] = useState<'loading' | 'quiz' | 'result' | 'error'>('loading');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [quizVersion, setQuizVersion] = useState<number | null>(null);
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
      setHistory(Array.isArray(data.history) ? data.history : []);
      setQuizVersion(typeof data.quizVersion === 'number' ? data.quizVersion : null);
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
      // Re-load so the history list and latest profile both come from the
      // same GET (single source of truth; the POST response is not used for state).
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  if (state === 'loading') return <p className="text-sm text-neutral-500">Loading...</p>;
  if (state === 'error') return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;

  if (state === 'result' && profile) {
    return (
      <PrakritiResult
        profile={profile}
        history={history}
        quizVersion={quizVersion}
        onRetake={() => { setAnswers({}); setState('quiz'); }}
      />
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