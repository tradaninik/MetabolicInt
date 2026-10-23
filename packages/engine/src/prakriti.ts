// P4b / U11 - Prakriti self-assessment scoring (educational, non-medical).
// Pure engine: answers map questionId -> dosha tag. Deterministic tie-break: vata > pitta > kapha.

export type Dosha = 'vata' | 'pitta' | 'kapha';

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

export interface PrakritiResult {
  vata: number;
  pitta: number;
  kapha: number;
  vataPct: number;
  pittaPct: number;
  kaphaPct: number;
  primary: Dosha;
  secondary: Dosha;
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
  return {
    vata: counts.vata,
    pitta: counts.pitta,
    kapha: counts.kapha,
    vataPct: pct.vataPct,
    pittaPct: pct.pittaPct,
    kaphaPct: pct.kaphaPct,
    primary: ranked[0],
    secondary: ranked[1],
  };
}