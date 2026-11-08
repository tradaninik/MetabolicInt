'use client';

// S2-B6 — visibility gate for traditional (Ayurvedic) content on surfaces
// that predate the S2-B5 off-switch (dashboard seasonal + agni cards, the
// healing-foods Ancient practices card, each food profile's tradition
// panel). Mirrors the PrakritiWellnessCard mounted-safe pattern: render
// nothing until mounted (no hydration mismatch — the server cannot know a
// device-local preference), then show only when the preference is on.
//
// The wrapped children still render on the server into the RSC payload, so
// server components keep their queries and props untouched — this gate is
// purely presentational. Zero medical content is ever gated (B4 rule: the
// off-switch hides traditional interpretation, never a medical feature).
import { useEffect, useState, type ReactNode } from 'react';
import { isAyurvedaEnabled } from '@/lib/ayurveda-prefs';

export default function AyurvedaGate({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(isAyurvedaEnabled());
  }, []);
  if (!visible) return null;
  return <>{children}</>;
}
