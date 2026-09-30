import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '../../../../lib/prisma';

const NUM_FIELDS = [
  ['servingGrams', 'Serving (g)'],
  ['katoriGrams', 'Katori (g)'],
  ['kcalPer100g', 'kcal /100g'],
  ['carbsPer100g', 'Carbs /100g'],
  ['proteinPer100g', 'Protein /100g'],
  ['fatPer100g', 'Fat /100g'],
  ['fiberPer100g', 'Fiber /100g'],
  ['gi', 'Glycemic index (0–100)'],
] as const;

export default async function EditFood({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const food = await prisma.food.findUnique({ where: { id } });
  if (!food) notFound();

  async function updateFood(formData: FormData) {
    'use server';
    const num = (key: string) => {
      const v = parseFloat(String(formData.get(key)));
      return Number.isFinite(v) ? v : undefined; // undefined = leave unchanged
    };
    const name = String(formData.get('name') ?? '').trim();
    await prisma.food.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        servingGrams: num('servingGrams') ?? undefined,
        katoriGrams: num('katoriGrams'),
        kcalPer100g: num('kcalPer100g') ?? undefined,
        carbsPer100g: num('carbsPer100g') ?? undefined,
        proteinPer100g: num('proteinPer100g') ?? undefined,
        fatPer100g: num('fatPer100g') ?? undefined,
        fiberPer100g: num('fiberPer100g') ?? undefined,
        gi: num('gi') ?? undefined,
      },
    });
    revalidatePath('/admin/foods');
    revalidatePath(`/admin/foods/${id}`);
    redirect('/admin/foods');
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Edit food</h1>
      <p className="mb-6 font-mono text-xs text-neutral-500">{food.id} · {food.region.replace(/_/g, ' ')} · {food.category.replace(/_/g, ' ')}</p>

      <form action={updateFood} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">Display name</label>
          <input name="name" defaultValue={food.name}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950" />
        </div>
        {NUM_FIELDS.map(([key, label]) => (
          <div key={key}>
            <label className="mb-1 block text-xs font-medium text-neutral-500">{label}</label>
            <input name={key} type="number" step="0.1" defaultValue={String(food[key] ?? '')}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950" />
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <button className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-medium text-white">Save changes</button>
        </div>
      </form>
    </div>
  );
}