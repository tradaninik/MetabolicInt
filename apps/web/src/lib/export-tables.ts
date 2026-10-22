// P3-1 data export: user-scoped table registry + collectors.
// Type-only Prisma import (erased at runtime) keeps this unit-testable
// without a DB or DATABASE_URL; tests inject a stub PrismaClient.
import type { PrismaClient } from '@prisma/client';
import { redactSecrets } from './export-format';

export interface ExportTableDef { key: string; label: string; }

// All 21 user-data tables: every schema model except the shared Food
// catalog (Food exports as the user's customFoods slice).
export const EXPORT_TABLE_DEFS: readonly ExportTableDef[] = [
  { key: 'user', label: 'Profile' },
  { key: 'userSettings', label: 'Settings' },
  { key: 'userLearnedModel', label: 'Learned model' },
  { key: 'foodEntries', label: 'Food entries' },
  { key: 'glucoseReadings', label: 'Glucose readings' },
  { key: 'activityEntries', label: 'Activity entries' },
  { key: 'sleepEntries', label: 'Sleep entries' },
  { key: 'weightEntries', label: 'Weight entries' },
  { key: 'bloodPressureEntries', label: 'Blood pressure' },
  { key: 'labs', label: 'Labs' },
  { key: 'medications', label: 'Medications' },
  { key: 'medicationLogs', label: 'Medication logs' },
  { key: 'dayContextTags', label: 'Day context tags' },
  { key: 'insightCards', label: 'Insight cards' },
  { key: 'coachThreads', label: 'Coach threads' },
  { key: 'coachMessages', label: 'Coach messages' },
  { key: 'careRelationships', label: 'Care relationships' },
  { key: 'doctorPatientLinks', label: 'Doctor-patient links' },
  { key: 'achievements', label: 'Achievements' },
  { key: 'savedCombos', label: 'Saved combos' },
  { key: 'customFoods', label: 'Custom foods' },
];

export const EXPORT_TABLE_KEYS: readonly string[] = EXPORT_TABLE_DEFS.map((d) => d.key);

export type ExportLoader = (prisma: PrismaClient, userId: string) => Promise<unknown[]>;

// Owner-scoped loaders. Single-row tables become 0/1-element arrays so
// every table shares the rows[] shape (CSV + JSON envelope).
const LOADERS: Readonly<Record<string, ExportLoader>> = {
  user: async (p, uid) => {
    const u = await p.user.findUnique({ where: { id: uid } });
    return u ? [redactSecrets(u as unknown as Record<string, unknown>)] : []; // passwordHash never leaves
  },
  userSettings: async (p, uid) => {
    const s = await p.userSettings.findUnique({ where: { userId: uid } });
    return s ? [s] : [];
  },
  userLearnedModel: async (p, uid) => {
    const m = await p.userLearnedModel.findUnique({ where: { userId: uid } });
    return m ? [m] : [];
  },
  foodEntries: (p, uid) => p.foodEntry.findMany({ where: { userId: uid } }),
  glucoseReadings: (p, uid) => p.glucoseReading.findMany({ where: { userId: uid } }),
  activityEntries: (p, uid) => p.activityEntry.findMany({ where: { userId: uid } }),
  sleepEntries: (p, uid) => p.sleepEntry.findMany({ where: { userId: uid } }),
  weightEntries: (p, uid) => p.weightEntry.findMany({ where: { userId: uid } }),
  bloodPressureEntries: (p, uid) => p.bloodPressureEntry.findMany({ where: { userId: uid } }),
  labs: (p, uid) => p.lab.findMany({ where: { userId: uid } }),
  medications: (p, uid) => p.medication.findMany({ where: { userId: uid } }),
  medicationLogs: (p, uid) => p.medicationLog.findMany({ where: { userId: uid } }),
  dayContextTags: (p, uid) => p.dayContextTag.findMany({ where: { userId: uid } }),
  insightCards: (p, uid) => p.insightCard.findMany({ where: { userId: uid } }),
  coachThreads: (p, uid) => p.coachThread.findMany({ where: { userId: uid } }),
  coachMessages: (p, uid) => p.coachMessage.findMany({ where: { thread: { userId: uid } } }),
  careRelationships: (p, uid) => p.careRelationship.findMany({ where: { OR: [{ caregiverId: uid }, { wardId: uid }] } }),
  doctorPatientLinks: (p, uid) => p.doctorPatientLink.findMany({ where: { OR: [{ doctorId: uid }, { patientId: uid }] } }),
  achievements: (p, uid) => p.achievement.findMany({ where: { userId: uid } }),
  savedCombos: (p, uid) => p.savedCombo.findMany({ where: { userId: uid } }),
  customFoods: (p, uid) => p.food.findMany({ where: { createdByUserId: uid } }),
};

/** All tables, keyed in EXPORT_TABLE_DEFS order. */
export async function collectUserExport(prisma: PrismaClient, userId: string): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const def of EXPORT_TABLE_DEFS) out[def.key] = await LOADERS[def.key]!(prisma, userId);
  return out;
}

/** One table's rows; null signals an unknown key (route answers 400). */
export async function collectUserTable(prisma: PrismaClient, userId: string, key: string): Promise<unknown[] | null> {
  const loader = LOADERS[key];
  return loader ? loader(prisma, userId) : null;
}
