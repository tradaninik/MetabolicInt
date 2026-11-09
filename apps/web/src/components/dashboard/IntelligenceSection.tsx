'use client';

// P4 - the dashboard "Smart Analysis" card.
//
// Client surface of the intelligence engine: it GETs /api/intelligence (the
// IntelligenceReport contract from @mi/engine), renders score / positives /
// priorities / trends / plan / meds / tests, and owns the "Personalize"
// questionnaire sheet (GET + PUT /api/intelligence/survey). Display-only:
// plain fetch() with tolerant catches, no server-only APIs, and no navigation
// except the /labs CTA shown when there are no labs yet.

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type {
  ActivityPlan,
  DietPlan,
  FollowUpTest,
  IntelligenceReport,
  LmRow,
  NinetyDayPhase,
  PriorityFinding,
  Severity,
  SurveyAnswers,
  TrendCallout,
  TrendPoint,
  TrendVerdict,
} from '@mi/engine';
import { FAMILY_HISTORY_OPTIONS, SYMPTOM_OPTIONS } from '@mi/engine';

// --- local types + static data ----------------------------------------------

type TabId = 'priorities' | 'trends' | 'plan' | 'meds' | 'tests';

const TABS: { id: TabId; label: string }[] = [
  { id: 'priorities', label: 'Priorities' },
  { id: 'trends', label: 'Trends' },
  { id: 'plan', label: 'Plan' },
  { id: 'meds', label: 'Meds' },
  { id: 'tests', label: 'Tests' },
];

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  moderate: '#d97706',
  watch: '#0284c7',
};

const VERDICT_PILL: Record<TrendVerdict, string> = {
  improving: 'bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200',
  worsening: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  stable: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
  new: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
};

const VERDICT_STROKE: Record<TrendVerdict, string> = {
  improving: '#0a8e5f',
  worsening: '#dc2626',
  stable: '#737373',
  new: '#7c3aed',
};

const FOLLOW_UP_GROUPS: { priority: FollowUpTest['priority']; title: string }[] = [
  { priority: 'soon', title: 'Book soon' },
  { priority: 'routine', title: 'In 2-3 months' },
  { priority: 'annual', title: 'Annual care' },
];

// --- survey form definition (data-driven; rendered by SurveySheet) ----------

type AnswerValue = string | number | string[] | undefined;
type OptionDef = { value: string; label: string };
// `numeric` marks single-selects whose SurveyAnswers value is a number (stressLevel).
type SingleQuestionDef = { id: string; prompt: string; type: 'single'; numeric?: boolean; options: OptionDef[] };
type MultiQuestionDef = { id: string; prompt: string; type: 'multi'; options: OptionDef[] };
type NumberQuestionDef = { id: string; prompt: string; type: 'number'; min: number; max: number; suffix: string };
type QuestionDef = SingleQuestionDef | MultiQuestionDef | NumberQuestionDef;
type SectionDef = { title: string; whenFemale?: boolean; questions: QuestionDef[] };

const STRESS_OPTIONS: OptionDef[] = [
  { value: '1', label: 'Calm' }, { value: '2', label: '2' }, { value: '3', label: 'Busy' },
  { value: '4', label: '4' }, { value: '5', label: 'High' },
];

const SURVEY_SECTIONS: SectionDef[] = [
  { title: 'Your food pattern', questions: [
    { id: 'dietPattern', prompt: 'What does your plate look like?', type: 'single', options: [{ value: 'veg', label: 'Vegetarian' }, { value: 'egg', label: 'Eggs, no meat' }, { value: 'nonveg', label: 'Non-veg' }] },
    { id: 'riceFrequency', prompt: 'How often does white rice anchor your meal?', type: 'single', options: [{ value: 'daily', label: 'Most days' }, { value: 'most-days', label: 'A few days a week' }, { value: 'occasionally', label: 'Rarely' }] },
    { id: 'sweetsFrequency', prompt: 'Sweets and mithai?', type: 'single', options: [{ value: 'daily', label: 'Almost daily' }, { value: 'weekly', label: 'About weekly' }, { value: 'rarely', label: 'Rarely' }] },
    { id: 'teaCoffeeSugar', prompt: 'Tea / coffee with sugar?', type: 'single', options: [{ value: 'none', label: 'No sugar' }, { value: 'some', label: 'Some' }, { value: 'heavy', label: 'Sweet, daily' }] },
    { id: 'eatingOutFrequency', prompt: 'Eating out or ordered-in meals?', type: 'single', options: [{ value: 'often', label: 'Weekly or more' }, { value: 'sometimes', label: 'A few times a month' }, { value: 'rarely', label: 'Rarely' }] },
    { id: 'cookingOil', prompt: 'Main cooking oil at home?', type: 'single', options: [{ value: 'groundnut', label: 'Groundnut' }, { value: 'sunflower', label: 'Sunflower / safflower' }, { value: 'coconut', label: 'Coconut' }, { value: 'ghee-heavy', label: 'Mostly ghee' }, { value: 'mustard', label: 'Mustard' }, { value: 'olive-blend', label: 'Olive / blend' }, { value: 'mixed', label: 'Mixed' }] },
  ] },
  { title: 'Movement & day', questions: [
    { id: 'walkMinutesPerDay', prompt: 'Minutes of walking on a usual day?', type: 'number', min: 0, max: 180, suffix: 'min' },
    { id: 'strengthPerWeek', prompt: 'Strength or resistance sessions per week?', type: 'number', min: 0, max: 7, suffix: 'days' },
    { id: 'sittingHours', prompt: 'Hours seated on a workday?', type: 'number', min: 0, max: 16, suffix: 'hrs' },
  ] },
  { title: 'Sleep & stress', questions: [
    { id: 'sleepQuality', prompt: 'How is your sleep?', type: 'single', options: [{ value: 'good', label: 'Restful' }, { value: 'disturbed', label: 'Wakes often' }, { value: 'poor', label: 'Poor' }] },
    { id: 'stressLevel', prompt: 'Stress on most days?', type: 'single', numeric: true, options: STRESS_OPTIONS },
  ] },
  { title: 'Symptoms you notice', questions: [
    { id: 'symptoms', prompt: 'Any of these in the past month? (tap all that apply)', type: 'multi', options: SYMPTOM_OPTIONS.map((s) => ({ value: s, label: s })) },
  ] },
  { title: 'Family history', questions: [
    { id: 'familyHistory', prompt: 'In your close family? (tap all that apply)', type: 'multi', options: FAMILY_HISTORY_OPTIONS.map((s) => ({ value: s, label: s })) },
  ] },
  { title: 'Your #1 goal', questions: [
    { id: 'primaryGoal', prompt: 'What matters most right now?', type: 'single', options: [{ value: 'sugar', label: 'Blood sugar' }, { value: 'weight', label: 'Weight' }, { value: 'cholesterol', label: 'Cholesterol' }, { value: 'energy', label: 'Energy' }, { value: 'fitness', label: 'Fitness' }] },
  ] },
  { title: "Women's health", whenFemale: true, questions: [
    { id: 'menopause', prompt: 'Where are you in your menopause journey?', type: 'single', options: [{ value: 'pre', label: 'Still regular' }, { value: 'peri', label: 'Changing / perimenopause' }, { value: 'post', label: 'Post-menopause' }] },
  ] },
];

const ROOT_CLASS =
  'rounded-xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5 dark:border-neutral-800 dark:bg-neutral-900';
const BTN_SECONDARY =
  'rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900';

// --- main component ----------------------------------------------------------

export default function IntelligenceSection() {
  const [report, setReport] = useState<IntelligenceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('priorities');
  const [positivesOpen, setPositivesOpen] = useState(false);
  const [surveyOpen, setSurveyOpen] = useState(false);
  // Bumped after a survey save so the report is re-fetched.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetch('/api/intelligence')
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | { report?: IntelligenceReport; error?: string }
          | null;
        if (res.ok && body?.report) return body.report;
        if (res.status === 401) {
          throw new Error(body?.error ?? 'Please sign in to see your smart analysis.');
        }
        throw new Error(body?.error ?? 'Could not load your smart analysis right now.');
      })
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setReport(null);
        setLoadError(err instanceof Error ? err.message : 'Could not load your smart analysis right now.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const openSurvey = () => setSurveyOpen(true);

  if (loading) {
    return (
      <section aria-label="Smart analysis" className={ROOT_CLASS}>
        <div className="sr-only" role="status">Loading your smart analysis...</div>
        <IntelligenceSkeleton />
      </section>
    );
  }

  if (!report) {
    return (
      <section aria-label="Smart analysis" className={ROOT_CLASS}>
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {loadError ?? 'Could not load your smart analysis right now.'}
          </p>
          <button type="button" onClick={() => setReloadKey((k) => k + 1)} className={`mt-3 ${BTN_SECONDARY}`}>
            Try again
          </button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Smart analysis" className={ROOT_CLASS}>
      {/* Header row: title + glyph, Personalize button, collapsed coverage caption */}
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-2">
          <SparkGlyph />
          <h2 className="text-base font-semibold text-neutral-900 dark:text-white sm:text-lg">Smart Analysis</h2>
        </div>
        <div className="flex min-w-0 flex-col items-end gap-1.5">
          <button type="button" onClick={openSurvey} className={BTN_SECONDARY}>Personalize</button>
          <p className="max-w-full truncate text-right text-xs text-neutral-500 sm:max-w-[280px] dark:text-neutral-400">
            as of {report.asOf} | {report.dataCoverage.labResults} results across{' '}
            {report.dataCoverage.panelDates.length} panels
          </p>
        </div>
      </header>

      {report.hasLabs ? (
        <>
          {/* Score strip */}
          <div className="mt-4 flex items-center gap-4 sm:gap-5">
            <ScoreRing value={report.score.overall} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <p className="text-base font-semibold text-neutral-900 dark:text-white sm:text-lg">{report.headline}</p>
                <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-900/40 dark:text-brand-200">
                  {report.score.label}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">{report.summary}</p>
            </div>
          </div>

          {/* Positives strip */}
          {report.positives.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-lg border border-brand-200 bg-brand-50/60 dark:border-brand-800 dark:bg-brand-950/20">
              <button
                type="button"
                onClick={() => setPositivesOpen((v) => !v)}
                aria-expanded={positivesOpen}
                aria-controls="intel-positives"
                className="flex min-h-[44px] w-full items-center justify-between gap-2 px-3.5 py-2 text-left"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-brand-800 dark:text-brand-200">
                  <CheckGlyph /> What's going well ({report.positives.length})
                </span>
                <ChevronGlyph open={positivesOpen} />
              </button>
              {positivesOpen && (
                <ul id="intel-positives" className="space-y-1.5 border-t border-brand-200/70 px-3.5 py-2.5 dark:border-brand-800/70">
                  {report.positives.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                      <span className="mt-0.5 shrink-0"><CheckGlyph /></span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Tab chips (single scrollable row) */}
          <div role="tablist" aria-label="Smart analysis sections" className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`intel-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`intel-panel-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                  tab === t.id
                    ? 'bg-brand-600 text-white hover:bg-brand-700'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Active tab panel only */}
          <div role="tabpanel" id={`intel-panel-${tab}`} aria-labelledby={`intel-tab-${tab}`} className="mt-4 min-h-[420px]">
            {tab === 'priorities' && <PrioritiesPanel priorities={report.priorities} />}
            {tab === 'trends' && <TrendsPanel trends={report.trends} />}
            {tab === 'plan' && <PlanPanel dietPlan={report.dietPlan} activityPlan={report.activityPlan} />}
            {tab === 'meds' && <MedsPanel rows={report.lifestyleVsMeds} activeMeds={report.dataCoverage.activeMeds} />}
            {tab === 'tests' && (
              <TestsPanel
                followUps={report.followUps}
                ninetyDay={report.ninetyDay}
                questionnaireGaps={report.questionnaireGaps}
                onPersonalize={openSurvey}
              />
            )}
          </div>
        </>
      ) : (
        <EmptyLabsCard onPersonalize={openSurvey} />
      )}

      <p className="mt-5 border-t border-neutral-200 pt-3 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        {report.disclaimer}
      </p>

      <SurveySheet
        open={surveyOpen}
        onClose={() => setSurveyOpen(false)}
        onSaved={() => {
          setSurveyOpen(false);
          setReloadKey((k) => k + 1);
        }}
        patientLine={report.patientLine}
      />
    </section>
  );
}

// --- loading skeleton (same min-height as the loaded card, no layout jump) ---

function IntelligenceSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden="true">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-md bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-5 w-36 rounded bg-neutral-200 dark:bg-neutral-800" />
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="h-9 w-24 rounded-lg bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-3 w-52 max-w-full rounded bg-neutral-200 dark:bg-neutral-800" />
        </div>
      </div>
      <div className="mt-5 flex items-center gap-4 sm:gap-5">
        <div className="h-[76px] w-[76px] shrink-0 rounded-full bg-neutral-200 dark:bg-neutral-800" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-3 w-full rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-3 w-5/6 rounded bg-neutral-200 dark:bg-neutral-800" />
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <div className="h-11 w-24 rounded-full bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-11 w-20 rounded-full bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-11 w-16 rounded-full bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-11 w-16 rounded-full bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-11 w-16 rounded-full bg-neutral-200 dark:bg-neutral-800" />
      </div>
      <div className="mt-4 min-h-[420px] space-y-3">
        <div className="h-32 rounded-lg bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-32 rounded-lg bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-3 w-2/3 rounded bg-neutral-200 dark:bg-neutral-800" />
      </div>
    </div>
  );
}

// --- score ring (radius 34, stroke 8, colour by band) ------------------------

function ScoreRing({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const color =
    clamped >= 80 ? '#16b077' : clamped >= 65 ? '#0a8e5f' : clamped >= 50 ? '#d97706' : '#dc2626';
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped / 100);
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" role="img" aria-label={`Overall metabolic score ${clamped} out of 100`} className="shrink-0">
      <circle cx="38" cy="38" r={radius} fill="none" strokeWidth="8" className="stroke-[#e5e5e5] dark:stroke-[#404040]" />
      <circle
        cx="38" cy="38" r={radius} fill="none" strokeWidth="8" stroke={color} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={dashOffset} transform="rotate(-90 38 38)"
      />
      <text x="38" y="36" textAnchor="middle" dominantBaseline="central" fontSize="18" fontWeight="700" fill={color}>
        {clamped}
      </text>
      <text x="38" y="52" textAnchor="middle" fontSize="8" className="fill-neutral-400 dark:fill-neutral-500">of 100</text>
    </svg>
  );
}

// --- sparkline (viewBox 0 0 100 28, preserveAspectRatio none, non-scaling) ---

function Sparkline({ series, color }: { series: TrendPoint[]; color: string }) {
  const { points, lastX, lastY } = useMemo(() => {
    const n = series.length;
    if (n === 0) return { points: '', lastX: 50, lastY: 14 };
    const values = series.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min;
    // 4 units of padding inside the 100 x 28 box: x in [4, 96], y in [4, 24].
    const xs = series.map((_, i) => (n === 1 ? 50 : 4 + (i * 92) / (n - 1)));
    const ys = series.map((p) => (span === 0 ? 14 : 24 - ((p.value - min) / span) * 20));
    return {
      points: xs.map((x, i) => `${x.toFixed(2)},${ys[i].toFixed(2)}`).join(' '),
      lastX: xs[n - 1],
      lastY: ys[n - 1],
    };
  }, [series]);

  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="block h-11 w-full" aria-hidden="true">
      <polyline
        points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r="1.5" fill={color} />
    </svg>
  );
}

// --- tab panels ---------------------------------------------------------------

function PrioritiesPanel({ priorities }: { priorities: PriorityFinding[] }) {
  if (priorities.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">No priorities flagged right now - keep logging.</p>;
  }
  return (
    <div className="space-y-3">
      {priorities.map((p) => (
        <article
          key={`${p.rank}-${p.area}`}
          className="rounded-lg border border-neutral-200 border-l-4 p-4 dark:border-neutral-800"
          style={{ borderLeftColor: SEVERITY_COLOR[p.severity] }}
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">#{p.rank}</span>
            <h4 className="text-sm font-medium text-neutral-900 dark:text-white">{p.title}</h4>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">{p.areaLabel}</span>
          </div>
          <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">{p.finding}</p>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-medium text-brand-700 hover:underline dark:text-brand-300 [&::-webkit-details-marker]:hidden">
              Evidence &amp; why it matters
            </summary>
            <div className="mt-2 space-y-2.5 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/50">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Evidence</p>
                <ul className="mt-1 space-y-1">
                  {p.evidence.map((e, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-neutral-400 dark:bg-neutral-500" aria-hidden="true" />
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Why it matters</p>
                <p className="mt-0.5 text-sm text-neutral-700 dark:text-neutral-300">{p.whyItMatters}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Trend</p>
                <p className="mt-0.5 text-sm text-neutral-700 dark:text-neutral-300">{p.trendNote}</p>
              </div>
            </div>
          </details>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-brand-50/60 px-3 py-2.5 dark:bg-brand-950/20">
            <span className="text-xs font-semibold uppercase tracking-wide text-brand-800 dark:text-brand-200">Do now</span>
            <span className="min-w-0 flex-1 text-sm text-neutral-800 dark:text-neutral-200">{p.doNow}</span>
            <span className="rounded-full border border-brand-200 bg-white px-2.5 py-0.5 text-xs text-brand-800 dark:border-brand-800 dark:bg-neutral-900 dark:text-brand-200">
              {p.window}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}

function TrendsPanel({ trends }: { trends: TrendCallout[] }) {
  if (trends.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Not enough history to show trends yet.</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {trends.map((t) => (
        <article key={t.key} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-medium text-neutral-900 dark:text-white">{t.label}</h4>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${VERDICT_PILL[t.verdict]}`}>{t.verdict}</span>
          </div>
          <div className="mt-3">
            <Sparkline series={t.series} color={VERDICT_STROKE[t.verdict]} />
          </div>
          <p className="mt-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">{t.changeNote}</p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{t.interpretation}</p>
        </article>
      ))}
    </div>
  );
}

function PlanPanel({ dietPlan, activityPlan }: { dietPlan: DietPlan; activityPlan: ActivityPlan }) {
  return (
    <div>
      {/* (a) Everyday plate */}
      <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Everyday plate</h4>
      <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">{dietPlan.philosophy}</p>
      <div className="mt-2.5 rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-2.5 dark:border-brand-800 dark:bg-brand-950/20">
        <p className="text-xs font-semibold text-brand-800 dark:text-brand-200">The plate rule</p>
        <p className="mt-0.5 text-sm text-neutral-800 dark:text-neutral-200">{dietPlan.plateRule}</p>
      </div>
      {dietPlan.dailyTargets.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {dietPlan.dailyTargets.map((t) => (
            <span key={t.label} className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs dark:bg-neutral-800">
              <span className="text-neutral-500 dark:text-neutral-400">{t.label}</span>
              {' | '}
              <span className="font-medium text-neutral-800 dark:text-neutral-200">{t.value}</span>
            </span>
          ))}
        </div>
      )}
      {dietPlan.swaps.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Simple swaps</p>
          {/* sm+: compact 3-column From / To / Why (div grid, no <table>) */}
          <div className="mt-2 hidden sm:block">
            <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-3 border-b border-neutral-200 pb-1.5 dark:border-neutral-800">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">From</span>
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">To</span>
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">Why</span>
            </div>
            <ul>
              {dietPlan.swaps.map((s) => (
                <li
                  key={`${s.from}=>${s.to}`}
                  className="grid grid-cols-[1fr_1fr_1.4fr] gap-3 border-b border-neutral-100 py-2 text-sm last:border-0 dark:border-neutral-800/70"
                >
                  <span className="text-neutral-600 dark:text-neutral-400">{s.from}</span>
                  <span className="font-medium text-neutral-900 dark:text-white">{s.to}</span>
                  <span className="text-neutral-600 dark:text-neutral-400">{s.why}</span>
                </li>
              ))}
            </ul>
          </div>
          {/* mobile: each swap is a stacked card */}
          <ul className="mt-2 space-y-2 sm:hidden">
            {dietPlan.swaps.map((s) => (
              <li key={`${s.from}=>${s.to}`} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                <p className="text-sm font-medium text-neutral-900 dark:text-white">
                  {s.from} <span aria-hidden="true">-&gt;</span> {s.to}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{s.why}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {dietPlan.sampleDay.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">A sample day</p>
          <div className="mt-2 space-y-2">
            {dietPlan.sampleDay.map((slot) => (
              <div key={slot.slot} className="rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-800/50">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{slot.slot}</p>
                <p className="mt-0.5 text-sm text-neutral-800 dark:text-neutral-200">{slot.options.join(' | ')}</p>
                {slot.note && <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{slot.note}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* (b) Move better */}
      <h4 className="mt-6 text-xs font-semibold uppercase tracking-wide text-neutral-400">Move better</h4>
      <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">{activityPlan.baseline}</p>
      {activityPlan.weekly.length > 0 && (
        <ul className="mt-2 divide-y divide-neutral-100 dark:divide-neutral-800/70">
          {activityPlan.weekly.map((d) => (
            <li key={d.day} className="flex items-center gap-3 py-2">
              <span className="w-10 shrink-0 text-xs font-semibold uppercase tracking-wide text-neutral-400">{d.day}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-neutral-800 dark:text-neutral-200">{d.focus}</p>
                {d.detail && <p className="text-xs text-neutral-500 dark:text-neutral-400">{d.detail}</p>}
              </div>
              <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-900/40 dark:text-brand-200">
                {d.minutes} min
              </span>
            </li>
          ))}
        </ul>
      )}
      {activityPlan.targets.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {activityPlan.targets.map((t) => (
            <li key={t} className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
              <span className="mt-0.5 shrink-0"><CheckGlyph /></span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}
      {activityPlan.safetyNotes.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5 dark:border-amber-900/60 dark:bg-amber-950/30">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Safety notes</p>
          <ul className="mt-1 space-y-1">
            {activityPlan.safetyNotes.map((n) => (
              <li key={n} className="text-xs text-amber-800 dark:text-amber-300">{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MedsPanel({ rows, activeMeds }: { rows: LmRow[]; activeMeds: number }) {
  return (
    <div>
      {activeMeds === 0 && (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          No medications logged yet - the notes below tell you what to discuss with your doctor.
        </p>
      )}
      {rows.length === 0 && <p className="text-sm text-neutral-500 dark:text-neutral-400">Nothing to compare yet.</p>}
      <div className="space-y-3">
        {rows.map((row) => (
          <article key={row.area} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">{row.areaLabel}</h4>
            <div className="mt-2.5 space-y-2.5">
              <div className="rounded-lg border border-brand-200 bg-brand-50/60 p-3 dark:border-brand-800 dark:bg-brand-950/20">
                <p className="text-xs font-semibold text-brand-800 dark:text-brand-200">Lifestyle lever</p>
                <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">{row.lifestyle}</p>
                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{row.lifestyleEffect}</p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-800/40">
                <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">On your medication list</p>
                <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">{row.medication}</p>
                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{row.medicationNote}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function TestsPanel({
  followUps,
  ninetyDay,
  questionnaireGaps,
  onPersonalize,
}: {
  followUps: FollowUpTest[];
  ninetyDay: NinetyDayPhase[];
  questionnaireGaps: string[];
  onPersonalize: () => void;
}) {
  return (
    <div>
      {/* (a) Tests to schedule, grouped by priority */}
      <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Tests to schedule</h4>
      {followUps.length === 0 && (
        <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">No follow-up tests flagged.</p>
      )}
      {FOLLOW_UP_GROUPS.map((g) => {
        const items = followUps.filter((f) => f.priority === g.priority);
        if (items.length === 0) return null;
        return (
          <div key={g.priority} className="mt-3">
            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{g.title}</p>
            <ul className="mt-1.5 space-y-1.5">
              {items.map((f) => (
                <li key={f.name} className="rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-800">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-medium text-neutral-900 dark:text-white">{f.name}</span>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{f.when}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{f.why}</p>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {/* (b) 90-day plan as a vertical timeline */}
      <h4 className="mt-6 text-xs font-semibold uppercase tracking-wide text-neutral-400">90-day plan</h4>
      <ol className="mt-3 border-l-2 border-neutral-200 dark:border-neutral-800">
        {ninetyDay.map((ph) => (
          <li key={ph.phase} className="relative pb-5 pl-5 last:pb-1">
            <span
              className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-600 dark:border-neutral-900"
              aria-hidden="true"
            />
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">{ph.phase}</p>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{ph.days}</span>
            </div>
            <p className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">{ph.focus}</p>
            <ul className="mt-1.5 space-y-1">
              {ph.actions.map((a) => (
                <li key={a} className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                  <span className="mt-0.5 shrink-0"><CheckGlyph /></span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 inline-block rounded-lg bg-brand-50/60 px-2.5 py-1.5 text-xs text-brand-800 dark:bg-brand-950/20 dark:text-brand-200">
              <span className="font-semibold">Target:</span> {ph.target}
            </p>
          </li>
        ))}
      </ol>
      {/* (c) questionnaire gaps */}
      {questionnaireGaps.length > 0 && (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
          <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Make this plan more yours</h4>
          <ul className="mt-1.5 space-y-1">
            {questionnaireGaps.map((gap) => (
              <li key={gap} className="text-xs text-amber-800 dark:text-amber-300">{gap}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onPersonalize}
            className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Personalize this plan
          </button>
        </div>
      )}
    </div>
  );
}

// --- no-labs empty state ------------------------------------------------------

function EmptyLabsCard({ onPersonalize }: { onPersonalize: () => void }) {
  return (
    <div className="mt-5 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/60 p-5 text-center dark:border-neutral-700 dark:bg-neutral-800/40">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/40">
        <LabGlyph />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-neutral-900 dark:text-white">No lab results yet</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-neutral-600 dark:text-neutral-400">
        Import your latest lab report to unlock the full smart analysis.
      </p>
      <Link
        href="/labs"
        className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
      >
        Import lab report
      </Link>
      <p className="mx-auto mt-4 max-w-md text-xs text-neutral-500 dark:text-neutral-400">
        The questionnaire still helps - your answers about food, movement and goals sharpen the plan the
        moment your labs arrive.
      </p>
      <button type="button" onClick={onPersonalize} className={`mt-3 ${BTN_SECONDARY}`}>Personalize</button>
    </div>
  );
}

// --- survey sheet (bottom sheet on mobile, centered modal on desktop) --------

function SurveySheet({
  open,
  onClose,
  onSaved,
  patientLine,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  patientLine: string;
}) {
  // SurveyAnswers-shaped draft, indexed by question id for the data-driven form.
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isFemale = patientLine.includes('woman');

  // Escape closes; page scroll locks while open (MoreSheet pattern).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  // Pull the saved answers every time the sheet opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingAnswers(true);
    setSaveError(null);
    fetch('/api/intelligence/survey')
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as { answers?: SurveyAnswers | null } | null;
        if (!res.ok) throw new Error('load failed');
        const base: SurveyAnswers = body?.answers ?? {};
        return base;
      })
      .then((base) => {
        if (!cancelled) setAnswers({ ...base });
      })
      .catch(() => {
        if (!cancelled) setAnswers({});
      })
      .finally(() => {
        if (!cancelled) setLoadingAnswers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function writeAnswer(id: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  async function saveAnswers() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/intelligence/survey', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) throw new Error('save failed');
      setSaving(false);
      onSaved();
    } catch {
      setSaving(false);
      setSaveError('Could not save your answers - please try again.');
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Personalize your plan">
      <button
        type="button"
        aria-label="Close survey"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-neutral-900/40"
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-xl dark:border-neutral-800 dark:bg-neutral-950 sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[560px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b border-neutral-100 bg-white px-4 py-3 dark:border-neutral-900 dark:bg-neutral-950">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Personalize your plan</h2>
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              About two minutes. Answers sharpen every tab of this card.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Skip / close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            <XGlyph />
          </button>
        </div>
        <div className="px-4 pb-4 pt-4">
          {loadingAnswers && (
            <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">Loading your previous answers...</p>
          )}
          <div>
            {SURVEY_SECTIONS.filter((s) => !s.whenFemale || isFemale).map((section) => (
              <fieldset key={section.title} className="mt-5 first:mt-0">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  {section.title}
                </legend>
                <div className="mt-1">
                  {section.questions.map((q) => (
                    <div key={q.id} className="mt-4 first:mt-0">
                      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{q.prompt}</p>
                      {q.type === 'single' && <SingleQuestion q={q} current={answers[q.id]} onSelect={writeAnswer} />}
                      {q.type === 'multi' && <MultiQuestion q={q} current={answers[q.id]} onToggle={writeAnswer} />}
                      {q.type === 'number' && <NumberQuestion q={q} current={answers[q.id]} onSet={writeAnswer} />}
                    </div>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </div>
        <div className="sticky bottom-0 border-t border-neutral-100 bg-white px-4 py-3 dark:border-neutral-900 dark:bg-neutral-950">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Skip anything you're not sure about - partial answers still help.
            </p>
            <div className="flex items-center gap-3">
              {saveError && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{saveError}</p>}
              <button
                type="button"
                onClick={saveAnswers}
                disabled={saving}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save answers'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- survey controls ----------------------------------------------------------

function surveyChipClass(selected: boolean): string {
  return `min-h-[36px] rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
    selected
      ? 'border-brand-600 bg-brand-600 text-white hover:bg-brand-700'
      : 'border-neutral-300 text-neutral-600 hover:border-brand-300 dark:border-neutral-700 dark:text-neutral-300'
  }`;
}

function SingleQuestion({
  q,
  current,
  onSelect,
}: {
  q: SingleQuestionDef;
  current: AnswerValue;
  onSelect: (id: string, value: AnswerValue) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {q.options.map((opt) => {
        const selected = q.numeric ? current === Number(opt.value) : current === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            onClick={() => {
              // Radio behaviour: tapping the active chip keeps it selected.
              if (selected) return;
              onSelect(q.id, q.numeric ? Number(opt.value) : opt.value);
            }}
            className={surveyChipClass(selected)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function MultiQuestion({
  q,
  current,
  onToggle,
}: {
  q: MultiQuestionDef;
  current: AnswerValue;
  onToggle: (id: string, value: AnswerValue) => void;
}) {
  const list: string[] = Array.isArray(current) ? current : [];
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {q.options.map((opt) => {
        const on = list.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(q.id, on ? list.filter((x) => x !== opt.value) : [...list, opt.value])}
            className={surveyChipClass(on)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function NumberQuestion({
  q,
  current,
  onSet,
}: {
  q: NumberQuestionDef;
  current: AnswerValue;
  onSet: (id: string, value: AnswerValue) => void;
}) {
  const value = typeof current === 'number' ? current : '';
  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        type="number"
        inputMode="numeric"
        min={q.min}
        max={q.max}
        value={value}
        aria-label={q.prompt}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') {
            onSet(q.id, undefined);
            return;
          }
          const n = Number(raw);
          if (Number.isFinite(n)) onSet(q.id, Math.min(q.max, Math.max(q.min, n)));
        }}
        className="w-28 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      <span className="text-xs text-neutral-500 dark:text-neutral-400">{q.suffix}</span>
    </div>
  );
}

// --- inline SVG glyphs (no emojis in this file) -------------------------------

function SparkGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="shrink-0 text-brand-600 dark:text-brand-400">
      <path d="M10 1.5c.5 4.1 2.9 6.5 7 7-4.1.5-6.5 2.9-7 7-.5-4.1-2.9-6.5-7-7 4.1-.5 6.5-2.9 7-7Z" />
      <path d="M15.9 12.2c.3 2 1.5 3.2 3.4 3.5-1.9.3-3.1 1.5-3.4 3.5-.3-2-1.5-3.2-3.4-3.5 1.9-.3 3.1-1.5 3.4-3.5Z" opacity="0.65" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-brand-600 dark:text-brand-400">
      <path d="M3.5 8.5 6.5 11.5 12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronGlyph({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 text-neutral-500 transition-transform dark:text-neutral-400 ${open ? 'rotate-180' : ''}`}
    >
      <path d="M3 5.5 7 9.5l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 2.5 11.5 11.5M11.5 2.5 2.5 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function LabGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="text-brand-700 dark:text-brand-300">
      <path d="M5.5 2.5h4.5l4.5 4.5V16a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 16V4a1.5 1.5 0 0 1 1.5-1.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10 2.5V7h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7 10.5h5M7 13.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}