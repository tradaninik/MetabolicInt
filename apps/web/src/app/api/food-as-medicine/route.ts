import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  rankHealingFoods,
  lensesOf,
  ritucharyaSeason,
  ritucharyaCard,
  LENS_META,
  EVIDENCE_GRADE_META,
  CATEGORY_META,
  FOOD_AS_MEDICINE_DISCLAIMER,
  STORIES_DISCLAIMER,
  type Dosha,
  type LensId,
} from '@mi/engine';
import { HEALING_FOODS } from '@mi/food-db';

export const dynamic = 'force-dynamic';

const LENS_IDS: LensId[] = ['ayurveda', 'science', 'stories'];

// P4c / U16 - Food as Medicine multi-lens API (educational, non-medical).
// GET returns the ranked knowledge base plus lens/evidence meta and disclaimers, for the
// explorer UI and future programmatic (mobile) access.
//   ?lens=ayurveda|science|stories  sets the lens preference; under the science lens,
//   grade-D entries are actively demoted (spec §3.6). Default: no preference.
// Prakriti personalization uses the latest stored PrakritiProfile (migration 0004);
// no profile means neutral ordering and the quiz CTA client-side.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const lensParam = new URL(req.url).searchParams.get('lens');
  if (lensParam !== null && lensParam !== 'all' && !LENS_IDS.includes(lensParam as LensId)) {
    return NextResponse.json(
      { error: 'Unknown lens. Use all, ayurveda, science or stories.' },
      { status: 400 },
    );
  }
  const lensPreference = lensParam && lensParam !== 'all' ? (lensParam as LensId) : undefined;

  const latest = await prisma.prakritiProfile.findFirst({
    where: { userId: session.user.id },
    orderBy: { takenAt: 'desc' },
  });
  const rawDosha = latest?.primaryDosha;
  const prakriti: Dosha | undefined =
    rawDosha === 'vata' || rawDosha === 'pitta' || rawDosha === 'kapha' ? rawDosha : undefined;

  const ranked = rankHealingFoods(HEALING_FOODS, { prakriti, lensPreference });

  // Current season computed in IST, matching the app's other time formatting (no DST).
  const month = Number(
    new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', month: 'numeric' }).format(new Date()),
  );
  const season = ritucharyaSeason(month);

  return NextResponse.json({
    foods: ranked.map((r) => ({ ...r, lenses: lensesOf(r.food) })),
    lenses: LENS_META,
    grades: EVIDENCE_GRADE_META,
    categories: CATEGORY_META,
    disclaimer: FOOD_AS_MEDICINE_DISCLAIMER,
    storiesDisclaimer: STORIES_DISCLAIMER,
    prakriti: prakriti ?? null,
    season: { id: season, name: ritucharyaCard(season).name },
  });
}
