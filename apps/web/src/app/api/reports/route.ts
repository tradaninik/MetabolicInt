import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { csvCell } from '@/lib/export-format';

// CSV export — opens directly in Excel/Sheets. Lightweight, no heavy deps.
// Cells escape through the shared, unit-tested csvCell (lib/export-format.ts):
// RFC 4180 quoting + OWASP formula-injection neutralization. No local copy.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const format = url.searchParams.get('format') || 'csv';

  const [meals, glucose, weight, sleep, activity] = await Promise.all([
    prisma.foodEntry.findMany({ where: { userId: session.user.id }, orderBy: { loggedAt: 'desc' }, take: 500, include: { food: true } }),
    prisma.glucoseReading.findMany({ where: { userId: session.user.id }, orderBy: { takenAt: 'desc' }, take: 500 }),
    prisma.weightEntry.findMany({ where: { userId: session.user.id }, orderBy: { takenAt: 'desc' }, take: 200 }),
    prisma.sleepEntry.findMany({ where: { userId: session.user.id }, orderBy: { wokeAt: 'desc' }, take: 200 }),
    prisma.activityEntry.findMany({ where: { userId: session.user.id }, orderBy: { at: 'desc' }, take: 200 }),
  ]);

  const rows: string[][] = [];
  rows.push(['Section', 'Date', 'Detail', 'Value', 'Unit']);
  for (const m of meals) rows.push(['Meal', m.loggedAt.toISOString(), m.food.name, `${m.kcal}`, 'kcal']);
  for (const g of glucose) rows.push(['Glucose', g.takenAt.toISOString(), '', `${g.value}`, 'mg/dL']);
  for (const w of weight) rows.push(['Weight', w.takenAt.toISOString(), '', `${w.kg}`, 'kg']);
  for (const s of sleep) rows.push(['Sleep', s.wokeAt.toISOString(), '', `${s.hours}`, 'h']);
  for (const a of activity) rows.push(['Activity', a.at.toISOString(), a.type, `${a.durationMin}`, 'min']);

  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="metabolic-report-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
