import Link from 'next/link';
import { prisma } from '../../../lib/prisma';

function giBadge(gi: number) {
  const cls = gi >= 70 ? 'bg-red-100 text-red-700' : gi >= 56 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{gi}</span>;
}

export default async function AdminFoods({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const foods = await prisma.food.findMany({
    where: q
      ? { OR: [{ name: { contains: q } }, { id: { contains: q } }] }
      : undefined,
    orderBy: { name: 'asc' },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Food catalog</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Serving as the reference dataset for meal logging. Edit values carefully — they drive predictions.
      </p>

      <form className="mb-4 flex gap-2" action="/admin/foods">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search by name or id (e.g., dosa, rajma)…"
          className="w-64 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        />
        <button className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-medium text-white">Search</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Region</th>
              <th className="px-4 py-2">kcal/100g</th>
              <th className="px-4 py-2">Carbs</th>
              <th className="px-4 py-2">GI</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {foods.map((f) => (
              <tr key={f.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-900">
                <td className="px-4 py-2">{f.name}</td>
                <td className="px-4 py-2 capitalize text-neutral-500">{f.region.replace(/_/g, ' ')}</td>
                <td className="px-4 py-2 font-mono text-xs">{f.kcalPer100g}</td>
                <td className="px-4 py-2 font-mono text-xs">{f.carbsPer100g}</td>
                <td className="px-4 py-2">{giBadge(f.gi)}</td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/admin/foods/${f.id}`} className="text-xs font-medium text-brand-600 hover:underline">Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {foods.length === 0 && <p className="mt-4 text-sm text-neutral-500">No foods matched “{q}”.</p>}
    </div>
  );
}