import { prisma } from '@/lib/prisma';
import { hba1cTrend, computeAdherence, istNow, DAY_TAG_LABELS } from '@/lib/clinical-db';

// Phase 2c: the "for your next visit" block inside the printable report -
// labs trend, medication timekeeping (last 7 days), recent day-context tags.
// Renders nothing when the user has none of that data yet.
export default async function VisitSummary({ userId }: { userId: string }) {
  const asOf = istNow();
  const to = asOf.slice(0, 10);
  const from = new Date(Date.parse(to + 'T00:00:00Z') - 6 * 86400000).toISOString().slice(0, 10);

  const [labs, meds, logs, tags] = await Promise.all([
    prisma.lab.findMany({ where: { userId, testType: 'hba1c' }, orderBy: { performedAt: 'asc' } }),
    prisma.medication.findMany({ where: { userId } }),
    prisma.medicationLog.findMany({ where: { userId, logDate: { gte: from } } }),
    prisma.dayContextTag.findMany({ where: { userId }, orderBy: { tagDate: 'desc' }, take: 10 }),
  ]);

  const trend = hba1cTrend(
    labs.map((l) => ({ value: l.value, unit: l.unit, performedAt: l.performedAt })),
  );
  const adherence = computeAdherence(
    meds.map((m) => ({ id: m.id, scheduleTimes: m.scheduleTimes, isActive: m.isActive })),
    logs.map((l) => ({
      medicationId: l.medicationId,
      logDate: l.logDate,
      slotTime: l.slotTime,
      status: l.status,
    })),
    { from, to, asOf },
  );

  if (trend.length === 0 && adherence.expected === 0 && tags.length === 0) return null;

  const label = (t: string) => (DAY_TAG_LABELS as Record<string, string>)[t] ?? t;

  return (
    <div>
      {trend.length > 0 && (
        <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <h3 className="text-sm font-semibold">Lab results - HbA1c</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {trend.map((p) => (
              <li key={p.date} className="flex justify-between">
                <span className="tabular-nums">{p.date}</span>
                <span className="tabular-nums">
                  {p.a1cPercent}% (eAG {p.eagMgDl} mg/dL / {p.eagMmolL} mmol/L)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {adherence.expected > 0 && (
        <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <h3 className="text-sm font-semibold">Medication times - last 7 days</h3>
          <p className="mt-1 text-sm">
            Marked as taken: {adherence.taken} of {adherence.expected} scheduled times
            ({adherence.pct ?? 0}%). Skipped {adherence.skipped}, unmarked {adherence.pending}.
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Dose amounts are never stored - only whether scheduled times were kept.
          </p>
        </div>
      )}

      {tags.length > 0 && (
        <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <h3 className="text-sm font-semibold">Day context (recent notes)</h3>
          <p className="mt-1 text-sm">{tags.map((t) => t.tagDate + ': ' + label(t.tag)).join(' | ')}</p>
        </div>
      )}
    </div>
  );
}