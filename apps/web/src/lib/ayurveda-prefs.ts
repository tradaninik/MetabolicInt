// S2-B3/B4 — Ayurveda personalisation preference + wellness-card state.
// Device-local ONLY (B4 rule: zero new tables, zero Turso migration this
// session; mirrors the Add-to-plan localStorage pattern). If cross-device
// sync is ever wanted, that becomes a written UserSettings.prefsJson
// turso-migrate proposal FIRST.
//
// Reading medical data (glucose, sleep logs) to select Ayurvedic content is
// deliberately NOT done anywhere in this module — traditional content reacts
// to the user's stated preferences only, never to medical measurements.

import { useEffect, useState } from 'react';

const PREF_KEY = 'mi.ayurveda.personalisation';

/** Default ON; any localStorage failure (private mode etc.) degrades to ON. */
export function isAyurvedaEnabled(): boolean {
  try {
    return window.localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setAyurvedaEnabled(v: boolean): void {
  try {
    window.localStorage.setItem(PREF_KEY, v ? 'on' : 'off');
  } catch {
    /* ignore — device may block storage */
  }
}

/** Mounted-safe hook for client components. */
export function useAyurvedaEnabled(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabledState] = useState(true);
  useEffect(() => {
    setEnabledState(isAyurvedaEnabled());
  }, []);
  const set = (v: boolean) => {
    setAyurvedaEnabled(v);
    setEnabledState(v);
  };
  return [enabled, set];
}

/** IST 'YYYY-MM-DD' — the wellness dismissals reset with the IST day,
 *  exactly like the dashboard's Add-to-plan pattern. */
export function istDateKey(t: number = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(t));
}

// --- wellness-card state helpers (all best-effort; storage failures degrade) ---

export function wellnessVariantKey(category: string): string {
  return `mi.ayurveda.wellness.variant.${category}`;
}

export function wellnessDismissKey(category: string, day: string): string {
  return `mi.ayurveda.wellness.off.${category}.${day}`;
}

export function lsGetNumber(key: string, fallback: number): number {
  try {
    const raw = window.localStorage.getItem(key);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

export function lsSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function lsHas(key: string): boolean {
  try {
    return window.localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}
