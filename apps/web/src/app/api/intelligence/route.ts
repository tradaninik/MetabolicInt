// P4: Smart Analysis - GET /api/intelligence
// Gathers EVERYTHING the user has logged (labs across all panels, meds +
// adherence, glucose, meals, activity, sleep, weight, BP, survey) and runs
// the deterministic doctor-style engine from @mi/engine. The dashboard's
// IntelligenceSection renders exactly what this returns.
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildIntelligenceReport, type IntelligenceInput, type LabResultLite, type SurveyAnswers } from '@mi/engine';
import { computeAdherence } from '@/lib/clinical-db';

export const dynamic = 'force-dynamic';

// IST "now" (the repo's date convention) - UTC+5:30, no DST.
function istNow(): { date: string; dateTime: string } {
  const now = new Date(Date.now() + 5.5 * 3600_000);
  return {
    date: now.toISOString().slice(0, 10),
    dateTime: now.toISOString().slice(0, 16),
  };
}

function istDaysAgo(days: number): string {
  return new Date(Date.now() + 5.5 * 3600_000 - days * 86_400_000).toISOString().slice(0, 10);
}

function parseJsonArray(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : null;
  } catch {
    return null;
  }
}

function parseSurvey(raw: string | null | undefined): SurveyAnswers | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as SurveyAnswers) : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  try {
    const ist = istNow();
    const labCut = new Date(Date.now() - 730 * 86_400_000); // 24 months of lab history
    const logCut = new Date(Date.now() - 35 * 86_400_000); // vitals windows (engine uses 14d)

    const [user, panels, meds, medLogs, glucose, foodEntries, activity, sleep, weight, bp, surveyRow] =
      await Promise.all([
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.labPanel.findMany({
          where: { userId },
          orderBy: { performedAt: 'desc' },
          include: { results: true },
        }),
        prisma.medication.findMany({ where: { userId } }),
        prisma.medicationLog.findMany({
          where: { userId, logDate: { gte: istDaysAgo(30), lte: ist.date } },
        }),
        prisma.glucoseReading.findMany({
          where: { userId, takenAt: { gte: logCut } },
          orderBy: { takenAt: 'desc' },
          take: 240,
        }),
        prisma.foodEntry.findMany({
          where: { userId, loggedAt: { gte: new Date(Date.now() - 20 * 86_400_000) } },
          orderBy: { loggedAt: 'desc' },
          take: 400,
        }),
        prisma.activityEntry.findMany({
          where: { userId, at: { gte: logCut } },
          orderBy: { at: 'desc' },
        }),
        prisma.sleepEntry.findMany({
          where: { userId, wokeAt: { gte: logCut } },
          orderBy: { wokeAt: 'desc' },
        }),
        prisma.weightEntry.findMany({
          where: { userId, takenAt: { gte: logCut } },
          orderBy: { takenAt: 'desc' },
        }),
        prisma.bloodPressureEntry.findMany({
          where: { userId, takenAt: { gte: logCut } },
          orderBy: { takenAt: 'desc' },
        }),
        prisma.intelligenceSurvey.findUnique({ where: { userId } }),
      ]);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Labs: newest-first panels; keep the 24-month window (older history still
    // feeds trends, so we simply include every stored panel - the window above
    // only guards absurd histories; panels carry plain-date strings anyway).
    const labs: LabResultLite[] = [];
    for (const panel of panels) {
      for (const result of panel.results) {
        labs.push({
          testKey: result.testKey,
          label: null,
          value: result.value,
          unit: result.unit,
          refLow: result.refLow,
          refHigh: result.refHigh,
          flag: result.flag,
          performedAt: result.performedAt,
        });
      }
    }
    void labCut; // (panels are fetched whole; the cut is documentation of intent)

    // Medication adherence over the last 30 days (display-only math, clinical-db).
    let adherencePct: number | null = null;
    const activeMeds = meds.filter((m) => m.isActive);
    if (activeMeds.length > 0) {
      try {
        const result = computeAdherence(
          meds.map((m) => ({ id: m.id, scheduleTimes: m.scheduleTimes, isActive: m.isActive })),
          medLogs.map((l) => ({
            medicationId: l.medicationId,
            logDate: l.logDate,
            slotTime: l.slotTime,
            status: l.status,
          })),
          { from: istDaysAgo(30), to: ist.date, asOf: ist.dateTime },
        );
        adherencePct = result.pct;
      } catch {
        adherencePct = null; // best-effort; the report works without it
      }
    }

    const input: IntelligenceInput = {
      asOf: ist.date,
      profile: {
        name: user.name,
        age: user.age,
        gender: user.gender,
        heightCm: user.heightCm,
        weightKg: user.weightKg,
        waistCm: user.waistCm,
        hba1c: user.hba1c,
        diabetic: user.hba1c != null ? user.hba1c >= 6.5 : null,
        activityLevel: user.activityLevel,
        region: user.region,
        sleepHours: user.sleepHours,
        smoking: user.smoking,
        alcohol: user.alcohol,
        conditions: parseJsonArray(user.conditions),
      },
      labs,
      meds: meds.map((m) => ({ name: m.name, isActive: m.isActive })),
      adherencePct,
      glucose: glucose.map((g) => ({ value: g.value, takenAt: g.takenAt.toISOString() })),
      meals: foodEntries.map((e) => ({
        kcal: e.kcal,
        carbsG: e.carbsG,
        proteinG: e.proteinG,
        fiberG: null,
        loggedAt: e.loggedAt.toISOString(),
      })),
      activity: activity.map((a) => ({ type: a.type, durationMin: a.durationMin, at: a.at.toISOString() })),
      sleep: sleep.map((s) => ({ hours: s.hours, wokeAt: s.wokeAt.toISOString() })),
      weight: weight.map((x) => ({ kg: x.kg, takenAt: x.takenAt.toISOString() })),
      bp: bp.map((x) => ({ systolic: x.systolic, diastolic: x.diastolic, takenAt: x.takenAt.toISOString() })),
      survey: parseSurvey(surveyRow?.answersJson),
    };

    const report = buildIntelligenceReport(input);
    return NextResponse.json({ report });
  } catch (err) {
    console.error('intelligence: failed', err);
    return NextResponse.json({ error: 'Could not build the analysis' }, { status: 500 });
  }
}