# MetabolicInt — Diabetes care, the Indian way

Installable PWA (Next.js 16, App Router). "Calm Premium" design system:
deep-teal surfaces, coral only for alerts, 4-step text size (scales every
screen in rem), bottom tab bar with central + FAB, ≥48 px tap targets,
self-hosted Inter, offline shell via service worker.

**→ For production deployment, read [`INSTALL-PROD.md`](./INSTALL-PROD.md).**

## Quick start (local)

```bash
npm install
npm run dev          # http://localhost:3000
```

## Production build

```bash
npm run build        # builds .next/standalone with assets copied in
PORT=3000 HOSTNAME=127.0.0.1 NODE_ENV=production node .next/standalone/server.js
```

## What's inside

- **Home** — today's glucose story, in-range summary, next check reminder
- **Log** — Indian-food meal logging with search, presets, and tray
- **Foods** — searchable Indian food database
- **Insights** — Day / Week / Month / 3-month glucose trends (90 days of
  consistent dummy data; est. HbA1c via ADAG)
- **More** — 4-step text size with live preview, Ayurveda toggle, medical
  settings (nothing medical is ever hidden)
- **PWA** — manifest + icons + app shortcut ("Log a meal"), service worker
  with cache-first offline shell, installable on Android/iOS

State is client-side only (zustand + localStorage) — no database required.
