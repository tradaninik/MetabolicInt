// P4b / U14 - Ritucharya seasonal guidance (educational, traditional reference).
// Fixed month pins: Jan shishira, Feb-Mar vasant, Apr-May grishma,
// Jun-Aug varsha, Sep-Oct sharad, Nov-Dec hemant. Not medical advice.

export type RitucharyaSeason = 'shishira' | 'vasant' | 'grishma' | 'varsha' | 'sharad' | 'hemant';

export interface RitucharyaCard {
  season: RitucharyaSeason;
  name: string;
  window: string;
  focus: string;
  diet: string[];
  routine: string[];
  shopping: string[];
}

export function ritucharyaSeason(month: number): RitucharyaSeason {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('month must be an integer between 1 and 12');
  }
  if (month === 1) return 'shishira';
  if (month <= 3) return 'vasant';
  if (month <= 5) return 'grishma';
  if (month <= 8) return 'varsha';
  if (month <= 10) return 'sharad';
  return 'hemant';
}

const CARDS: Record<RitucharyaSeason, RitucharyaCard> = {
  shishira: {
    season: 'shishira',
    name: 'Shishira - late winter',
    window: 'January',
    focus: 'Cold and dry at their peak. The traditional focus is staying warm, keeping meals warm and nourishing, and protecting sleep.',
    diet: [
      'Warm, freshly cooked meals - soups, stews, khichdi',
      'Ghee and sesame oil in moderation',
      'Warming spices: ginger, cinnamon, black pepper',
      'Go easy on cold drinks, ice cream and large raw salads',
    ],
    routine: [
      'Keep meal times consistent through the month',
      'Warm oil massage (abhyanga) is the classical winter practice',
      'Dress in layers - cover head and ears on windy days',
    ],
    shopping: [
      'Root vegetables (carrot, sweet potato, radish)',
      'Rice, oats and whole wheat',
      'Ghee',
      'Fresh ginger',
      'Sesame oil',
      'Dates and soaked almonds',
    ],
  },
  vasant: {
    season: 'vasant',
    name: 'Vasant - spring',
    window: 'February - March',
    focus: 'Kapha naturally rises as winter thaws. The traditional focus is lighter food and more movement.',
    diet: [
      'Light, warm, slightly dry foods - barley, millet, roasted grains',
      'Bitter and astringent greens',
      'A classical spring habit: a teaspoon of honey in warm water in the morning',
      'Cut back on heavy, fried, very sweet and cold foods',
    ],
    routine: [
      'Wake a little earlier than you did in winter',
      'Brisk morning walks and more daily movement',
      'Dry massage (udvartana) is the classical spring practice',
    ],
    shopping: [
      'Barley and millet',
      'Leafy greens',
      'Fresh ginger',
      'Honey',
      'Black pepper',
      'Moong dal',
    ],
  },
  grishma: {
    season: 'grishma',
    name: 'Grishma - summer',
    window: 'April - May',
    focus: 'Heat peaks and strength dips. The traditional focus is staying cool, hydrated and gentle with yourself.',
    diet: [
      'Cooling foods - cucumber, coconut water, sweet juicy fruits',
      'Rice and milk-based dishes if you tolerate dairy',
      'Small, frequent meals; go easy on very spicy, sour or fermented food',
      'Drink water through the day - do not wait to feel thirsty',
    ],
    routine: [
      'Avoid the midday sun',
      'Gentle activity in the early morning or evening',
      'A short midday rest is the classical summer practice',
    ],
    shopping: [
      'Cucumber',
      'Coconut water',
      'Melons and pomegranate',
      'Rice',
      'Fennel and coriander seeds',
      'Buttermilk (if you tolerate dairy)',
    ],
  },
  varsha: {
    season: 'varsha',
    name: 'Varsha - monsoon',
    window: 'June - August',
    focus: 'Damp and cloudy - digestion is traditionally at its weakest. Keep everything light, warm and freshly cooked.',
    diet: [
      'Warm, light, freshly cooked meals - soups and khichdi',
      'Slightly sour and salty tastes are classical here',
      'Boiled or filtered water; go easy on raw salads and street food',
      'Go easy on heavy dairy and very oily food',
    ],
    routine: [
      'Keep feet dry and change out of wet clothes quickly',
      'Gentle indoor movement on low-energy days',
      'Avoid daytime napping - classical monsoon advice',
    ],
    shopping: [
      'Moong dal',
      'Rice',
      'Ginger and black pepper',
      'Seasonal squash (lauki, tinda)',
      'Ajwain',
      'Warm soup ingredients',
    ],
  },
  sharad: {
    season: 'sharad',
    name: 'Sharad - autumn',
    window: 'September - October',
    focus: 'After the rains, accumulated heat can flare. The traditional focus is cooling and settling pitta.',
    diet: [
      'Sweet, bitter and astringent tastes - rice, wheat, ghee',
      'Amla, pomegranate and other gentle fruits',
      'Go easy on sour, fermented and very spicy food, and curd at night',
      'Eat at regular times - autumn favours routine',
    ],
    routine: [
      'Evening walks are the classical autumn practice',
      'Avoid the midday sun',
      'Keep meals regular and unhurried',
    ],
    shopping: [
      'Rice and wheat flour',
      'Amla',
      'Pomegranate',
      'Ghee',
      'Fennel',
      'Seasonal apples',
    ],
  },
  hemant: {
    season: 'hemant',
    name: 'Hemant - early winter',
    window: 'November - December',
    focus: 'Classically the strength season - digestion is at its best. Nourish well, and keep any seasonal sweets small and inside your glucose targets.',
    diet: [
      'Warm, nourishing, well-cooked meals - the classical season for richer food',
      'Nuts, seeds, whole grains and seasonal roots',
      'If you enjoy seasonal sweets: small portions, with a meal, and log them in your glucose tracker',
      'Do not skip meals - the long nights call for regular fuel',
    ],
    routine: [
      'Get mid-morning sunlight',
      'Warm oil massage is the classical winter practice',
      'Wind down a little earlier - respect the longer nights',
    ],
    shopping: [
      'Almonds and sesame seeds',
      'Whole wheat and rice',
      'Carrots and other roots',
      'Ghee',
      'Seasonal citrus (in moderation)',
      'Milk and warm spices (if you tolerate dairy)',
    ],
  },
};

export function ritucharyaCard(season: RitucharyaSeason): RitucharyaCard {
  const card = CARDS[season];
  if (!card) throw new Error('Unknown season: ' + String(season));
  return card;
}