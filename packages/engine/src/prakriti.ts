// P4b / U11 - Prakriti self-assessment scoring (educational, non-medical).
// Pure engine: answers map questionId -> dosha tag.
//
// S2-B1 tie semantics: when the top count is shared by 2+ doshas the result's
// `profileLabel` names EVERY sharer ("Vata–Pitta profile" / "Vata–Pitta–Kapha profile")
// and `isTie` is true — a tie must never imply dominance. `primary`/`secondary`
// keep the legacy deterministic order (vata > pitta > kapha) ONLY for backward
// compatibility with stored rows; the UI leads with `profileLabel`, never with
// "primary" on a tie. Percentages are shares of the user's 12 answers, never a
// biological constitution claim.

export type Dosha = 'vata' | 'pitta' | 'kapha';

/** Questionnaire revision. Bump when any question/option/tag changes; returned with every result (S2-B1). */
export const QUIZ_VERSION = 1;

export interface PrakritiOption {
  tag: Dosha;
  label: string;
}

export interface PrakritiQuestion {
  id: string;
  domain: string;
  text: string;
  options: PrakritiOption[];
}

export const PRAKRITI_QUESTIONS: PrakritiQuestion[] = [
  { id: 'frame', domain: 'Body & activity', text: 'My body frame is mostly', options: [
    { tag: 'vata', label: 'Light and thin - gaining weight is hard for me' },
    { tag: 'pitta', label: 'Medium and muscular' },
    { tag: 'kapha', label: 'Solid and sturdy - I gain weight easily' } ] },
  { id: 'movement', domain: 'Body & activity', text: 'With exercise I prefer', options: [
    { tag: 'vata', label: 'Light and varied activity' },
    { tag: 'pitta', label: 'Purposeful and competitive workouts' },
    { tag: 'kapha', label: 'Gentle, regular movement' } ] },
  { id: 'skin', domain: 'Skin & hair', text: 'My skin is usually', options: [
    { tag: 'vata', label: 'Dry, rough and cool' },
    { tag: 'pitta', label: 'Warm, sensitive, prone to redness' },
    { tag: 'kapha', label: 'Thick, smooth and moist' } ] },
  { id: 'hair', domain: 'Skin & hair', text: 'My hair is', options: [
    { tag: 'vata', label: 'Dry, thin or frizzy' },
    { tag: 'pitta', label: 'Fine and oily - early thinning or greying' },
    { tag: 'kapha', label: 'Thick, wavy and lustrous' } ] },
  { id: 'appetite', domain: 'Appetite & digestion', text: 'My appetite is', options: [
    { tag: 'vata', label: 'Irregular - hungry one day, not the next' },
    { tag: 'pitta', label: 'Strong - I get irritable if a meal is late' },
    { tag: 'kapha', label: 'Steady but mild - I can skip meals easily' } ] },
  { id: 'digestion', domain: 'Appetite & digestion', text: 'My digestion feels', options: [
    { tag: 'vata', label: 'Variable - gas or bloating at times' },
    { tag: 'pitta', label: 'Quick and strong - acidity now and then' },
    { tag: 'kapha', label: 'Slow and heavy after meals' } ] },
  { id: 'sleep', domain: 'Sleep & energy', text: 'My sleep is', options: [
    { tag: 'vata', label: 'Light and easily disturbed' },
    { tag: 'pitta', label: 'Moderate but short' },
    { tag: 'kapha', label: 'Deep and long - mornings are hard' } ] },
  { id: 'energy', domain: 'Sleep & energy', text: 'My energy through the day is', options: [
    { tag: 'vata', label: 'Bursts followed by dips' },
    { tag: 'pitta', label: 'Sharp and driven - I can overdo it' },
    { tag: 'kapha', label: 'Steady and enduring once I get going' } ] },
  { id: 'mind', domain: 'Mind & memory', text: 'My mind is usually', options: [
    { tag: 'vata', label: 'Quick, imaginative and restless' },
    { tag: 'pitta', label: 'Focused, sharp and competitive' },
    { tag: 'kapha', label: 'Calm, steady and slow to change' } ] },
  { id: 'memory', domain: 'Mind & memory', text: 'My memory works like this', options: [
    { tag: 'vata', label: 'Learn fast, forget fast' },
    { tag: 'pitta', label: 'Clear and precise' },
    { tag: 'kapha', label: 'Slow to learn, never forgets' } ] },
  { id: 'weather', domain: 'Weather & stress', text: 'Weather-wise I feel best when it is', options: [
    { tag: 'vata', label: 'Warm - cold and wind bother me' },
    { tag: 'pitta', label: 'Cool - heat bothers me' },
    { tag: 'kapha', label: 'Warm and dry - damp cold bothers me' } ] },
  { id: 'stress', domain: 'Weather & stress', text: 'Under stress I tend to', options: [
    { tag: 'vata', label: 'Worry and feel scattered' },
    { tag: 'pitta', label: 'Become irritable and impatient' },
    { tag: 'kapha', label: 'Withdraw and seek comfort food' } ] },
];

const DOSHA_ORDER: Dosha[] = ['vata', 'pitta', 'kapha'];

const DOSHA_DISPLAY: Record<Dosha, string> = { vata: 'Vata', pitta: 'Pitta', kapha: 'Kapha' };

export interface PrakritiResult {
  vata: number;
  pitta: number;
  kapha: number;
  vataPct: number;
  pittaPct: number;
  kaphaPct: number;
  /** Legacy fields, kept for stored rows / API compat. On a tie they follow the
   *  canonical vata > pitta > kapha order but must NOT be presented as dominance — use profileLabel. */
  primary: Dosha;
  secondary: Dosha;
  /** What the UI leads with. Clear winner: "Vata primary · Pitta secondary".
   *  Tie: every sharer named with en-dashes, ordered by count then canonical order
   *  ("Vata–Pitta profile"), implying no dominance. */
  profileLabel: string;
  /** True when the top count is shared by 2+ doshas. */
  isTie: boolean;
  /** Questionnaire revision this scoring belongs to (S2-B1). */
  quizVersion: number;
}

/** Build the no-dominance profile label. `ranked` is sorted count desc, canonical order asc. */
function buildProfileLabel(counts: Record<Dosha, number>, ranked: Dosha[]): { profileLabel: string; isTie: boolean } {
  const top = counts[ranked[0]];
  const sharers = ranked.filter((d) => counts[d] === top);
  if (sharers.length === 1) {
    return {
      profileLabel: `${DOSHA_DISPLAY[ranked[0]]} primary · ${DOSHA_DISPLAY[ranked[1]]} secondary`,
      isTie: false,
    };
  }
  return {
    profileLabel: `${sharers.map((d) => DOSHA_DISPLAY[d]).join('–')} profile`,
    isTie: true,
  };
}

// Whole percentages that always sum to 100, using INTEGER arithmetic only.
// floor(count*100/total), then distribute the leftover by largest remainder (count*100 mod total),
// ties broken vata > pitta > kapha. No floating point anywhere, so equal counts can never
// drift apart (the 5/5/2 case pins 42/42/16, never 42/41/17).
function percentages(counts: Record<Dosha, number>): { vataPct: number; pittaPct: number; kaphaPct: number } {
  const total = counts.vata + counts.pitta + counts.kapha;
  if (total === 0) return { vataPct: 0, pittaPct: 0, kaphaPct: 0 };
  const weighted: Record<Dosha, number> = {
    vata: counts.vata * 100,
    pitta: counts.pitta * 100,
    kapha: counts.kapha * 100,
  };
  const pcts: Record<Dosha, number> = {
    vata: Math.floor(weighted.vata / total),
    pitta: Math.floor(weighted.pitta / total),
    kapha: Math.floor(weighted.kapha / total),
  };
  const remainder: Record<Dosha, number> = {
    vata: weighted.vata % total,
    pitta: weighted.pitta % total,
    kapha: weighted.kapha % total,
  };
  const byRemainder = DOSHA_ORDER.slice().sort(
    (a, b) => remainder[b] - remainder[a] || DOSHA_ORDER.indexOf(a) - DOSHA_ORDER.indexOf(b)
  );
  let leftover = 100 - (pcts.vata + pcts.pitta + pcts.kapha);
  let i = 0;
  while (leftover > 0) {
    pcts[byRemainder[i % 3]] += 1;
    leftover -= 1;
    i += 1;
  }
  return { vataPct: pcts.vata, pittaPct: pcts.pitta, kaphaPct: pcts.kapha };
}

export function scorePrakriti(answers: Record<string, string>): PrakritiResult {
  const counts: Record<Dosha, number> = { vata: 0, pitta: 0, kapha: 0 };
  for (const qid of Object.keys(answers)) {
    const known = PRAKRITI_QUESTIONS.some((q) => q.id === qid);
    if (!known) throw new Error('Unknown question id: ' + qid);
    const tag = answers[qid];
    if (!DOSHA_ORDER.includes(tag as Dosha)) throw new Error('Invalid dosha tag for ' + qid + ': ' + tag);
    counts[tag as Dosha] += 1;
  }
  const ranked = DOSHA_ORDER.slice().sort(
    (a, b) => counts[b] - counts[a] || DOSHA_ORDER.indexOf(a) - DOSHA_ORDER.indexOf(b)
  );
  const pct = percentages(counts);
  const { profileLabel, isTie } = buildProfileLabel(counts, ranked);
  return {
    vata: counts.vata,
    pitta: counts.pitta,
    kapha: counts.kapha,
    vataPct: pct.vataPct,
    pittaPct: pct.pittaPct,
    kaphaPct: pct.kaphaPct,
    primary: ranked[0],
    secondary: ranked[1],
    profileLabel,
    isTie,
    quizVersion: QUIZ_VERSION,
  };
}