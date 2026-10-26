// P5 - Ancient practices: timeless classical eating wisdom for the
// Food-as-Medicine page. This is page-level editorial content (not per-food
// dataset data): the daily and seasonal rhythm the classical texts teach,
// phrased educationally. Same editorial policy as the healing-foods dataset:
//   - descriptive, never prescriptive; no cure/treatment/reverse language
//   - classical claims attributed as "the tradition says", never as fact
//   - every practice notes where it comes from (textual vs household)
//   - the page carries the standing educational disclaimer
// Pure data + helpers: no fetching, no IO, testable.

export interface AncientPractice {
  id: string;
  name: string;
  detail: string;
  source: 'classical text' | 'classical kitchen' | 'household tradition';
}

export const ANCIENT_PRACTICES: AncientPractice[] = [
  {
    id: 'agni-midday-meal',
    name: 'The big meal at midday',
    detail:
      'The classical image of digestion is agni - a fire that follows the sun. It burns highest at midday, so the tradition puts the largest meal there and lets the evening plate get lighter. Modern meal-timing research has its own reasons to like the pattern; the classical reasoning predates all of it by two millennia.',
    source: 'classical text',
  },
  {
    id: 'three-quarters-rule',
    name: 'Fill two quarters, leave one for air',
    detail:
      'The dinacharya chapters teach a plate rule: half the stomach for food, a quarter for water, a quarter left empty. Eating to the point of comfortable lightness rather than fullness is one of the most repeated instructions in the daily-routine chapters - and one of the easiest to actually practice.',
    source: 'classical text',
  },
  {
    id: 'shad-rasa',
    name: 'All six tastes on the plate',
    detail:
      'The tradition counts six tastes - sweet, sour, salty, bitter, pungent and astringent - and asks a complete meal to carry them in proportion. A plate that runs long on sweet-salty-sour and short on bitter and astringent is the imbalance it warns about; karela, methi and jamun are the classical correctives, which is exactly where they sit in this library.',
    source: 'classical text',
  },
  {
    id: 'warm-fresh-food',
    name: 'Warm, freshly cooked, on time',
    detail:
      'The classical kitchen prizes food that is warm, moist, freshly made and eaten at steady times - and is blunt about leftovers, cold food and erratic timing. The reasoning is digestive strength; every Indian kitchen that still cooks fresh practices this without calling it anything.',
    source: 'classical text',
  },
  {
    id: 'eat-settled',
    name: 'Eat sitting, settled, with attention',
    detail:
      'The tradition asks for eating as its own act: seated, unhurried, without argument or screens (the classical list is "not while walking, standing, laughing or distracted"). How you eat is treated as part of what the food does - a stance that aged well.',
    source: 'classical text',
  },
  {
    id: 'ginger-before-meals',
    name: 'Ginger, lime and salt before eating',
    detail:
      'The classical appetite ritual: a thin slice of ginger with a squeeze of lime and a pinch of rock salt, taken a few minutes before the meal to wake the appetite and prime digestion. Small, cheap, and still served in traditional homes before a heavy or festive meal.',
    source: 'classical kitchen',
  },
  {
    id: 'shatapavali-walk',
    name: 'A hundred steps after the meal',
    detail:
      'Shatapavali - the hundred steps - is the household rule across much of India: a short, calm walk after eating, never brisk, and never a nap on a full stomach. It is oral tradition rather than scripture, which makes its agreement with modern post-meal-walk trials all the more charming.',
    source: 'household tradition',
  },
  {
    id: 'ritucharya-seasons',
    name: 'Rotate the plate with the seasons',
    detail:
      'Ritucharya - the seasonal routine - asks the plate to turn with the year: light and bitter through spring, cooling and liquid through high summer, simple and warm through the weak-digestion monsoon, rich and grounding through winter. The seasonal card on your dashboard is this same idea, month by month.',
    source: 'classical text',
  },
];

export const ANCIENT_PRACTICES_NOTE =
  'These are educational summaries of classical practice as commonly taught - the tradition\'s own framing, not medical advice. Where a practice overlaps with something modern research has tested, the Food-as-Medicine entries above carry that evidence with an honest grade.';

/** Source label shown on the practice card. */
export function sourceLabel(source: AncientPractice['source']): string {
  return source === 'classical text'
    ? 'From the classical texts'
    : source === 'classical kitchen'
      ? 'From the classical kitchen'
      : 'From household tradition';
}
