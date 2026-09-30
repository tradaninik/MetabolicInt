import { prisma } from '../../lib/prisma';

export default async function AdminHome() {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [totalUsers, usersOnboarded, mealsThisWeek, glucoseThisWeek, allFoods] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { onboardingComplete: true } }),
      prisma.foodEntry.count({ where: { loggedAt: { gte: weekAgo } } }),
      prisma.glucoseReading.count({ where: { takenAt: { gte: weekAgo } } }),
      prisma.food.findMany({ select: { region: true } }),
    ]);

  // Count foods per region in memory. The catalog is small (~140 rows), and this
  // avoids groupBy aggregate typing entirely — deliberately boring and safe.
  const counts = new Map<string, number>();
  for (const f of allFoods) counts.set(f.region, (counts.get(f.region) ?? 0) + 1);
  const foodsByRegion = [...counts.entries()]
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count);

  const cards = [
    { label: 'Total users', value: totalUsers },
    { label: 'Onboarded', value: usersOnboarded },
    { label: 'Meals logged (7d)', value: mealsThisWeek },
    { label: 'Glucose readings (7d)', value: glucoseThisWeek },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Admin</h1>
      <p className="mb-6 text-sm text-neutral-500">Operational stats only — no health data is shown here.</p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="text-2xl font-semibold">{c.value}</div>
            <div className="mt-1 text-xs text-neutral-500">{c.label}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-8 mb-3 text-sm font-medium text-neutral-500">Food catalog by region</h2>
      <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <tbody>
            {foodsByRegion.map((r) => (
              <tr key={r.region} className="border-b border-neutral-100 last:border-0 dark:border-neutral-900">
                <td className="px-4 py-2 capitalize">{r.region.replace(/_/g, ' ')}</td>
                <td className="px-4 py-2 text-right font-mono">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}