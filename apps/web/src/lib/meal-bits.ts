// Pure client-safe meal helpers (IST time-of-day, meal classification).
// Mirrors the server-side derivation in src/lib/pairing.ts - keep in sync.
// No imports here: safe for client components.

export const IST_OFFSET_MS = 5.5 * 3_600_000;
export const CHECKIN_MIN_NET_CARB_G = 15;

export type MealType = 'breakfast' | 'lunch' | 'tiffin' | 'dinner' | 'snack';

export function istHourOf(t: number): number {
  return (((t + IST_OFFSET_MS) / 3_600_000) % 24 + 24) % 24;
}

export function classifyMealType(startedAt: number, netCarbsG: number): MealType {
  if (netCarbsG < CHECKIN_MIN_NET_CARB_G) return 'snack';
  const h = istHourOf(startedAt);
  if (h >= 5 && h < 11) return 'breakfast';
  if (h >= 11 && h < 15.5) return 'lunch';
  if (h >= 15.5 && h < 18.5) return 'tiffin';
  if (h >= 18.5 && h < 24) return 'dinner';
  return 'snack'; // late-night / pre-dawn
}