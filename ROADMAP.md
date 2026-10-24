# Project Log

---

## 2026-10-22 - Phase 3 closeout (KI-1, P3-5, prod redeploy)
- KI-1 CLOSED: son@metabolic.dev 401 root cause = account never existed in prod DB (anti-enumeration message). Auth verified end-to-end (bcryptjs $2a$10 write + verify). No code defect.
- P3-5 smoke (login / session / reports-csv / glucose / meals): 5/6 accounts FULL GREEN on fresh prod build. Transient PS keep-alive drops documented (demo@ recovered; priya@ retry queued). arjun@ removed from smoke list by request (account intact in DB).
- Credentials: all 6 demo accounts now share demo1234 (reset tool, bcryptjs cost 10, verify-after-write).
- Deploy: metabolic-int-mndc36krb -> metabolic-int-web.vercel.app (Ready 1m). PENDING: Vercel Functions region to bom1 (Mumbai) to co-locate with Turso ap-south - applies on next deploy, should cut cold-start/keep-alive transients.
- Phase 4 order (locked): P4a Safety First (U25 hypoglycemia guardrails, P0, clinical review gate) -> P4b Know Your Body (U11+U14) -> P4c Food as Medicine (U16+U17+U19) -> P4d Rhythm and Digestion (U12+U13+U20) -> P4e Movement and Mind (U21+U22+U23) -> P4f Kitchen Pharmacy and Herbs (U18+U15, clinical review gate) -> P4g Medication Stewardship and Doctor Report (U26+U24, CSV injection fix gate).
- Payment / monetization: deferred until after all Phase 4 features; planned as pre-launch workstream.
- Known debt: CSV formula injection in apps/web/src/app/api/reports/route.ts csvCell - neutralize leading =,+,-,@ characters before U24 ships.

---

## 2026-10-23 - P4a shipped: U25 Hypoglycemia Guardrails (P0)
- Always-on educational guardrails. No flag, no migration; verdicts computed on read, never stored.
- Engine: packages/engine/src/glucoseGuard.ts + vitest unit tests (boundaries 70/69/54/53, validation 20-600, 24h pattern).
- POST /api/glucose: rejects <20 or >600 mg/dL (400), returns guard verdict alongside reading; 24h pattern aggravator (>=2 readings <70).
- UI: GlucoseGuardBanner (red <54, amber 54-69) on /glucose latest reading + after each save in GlucoseLogger.
- Drive-by fix: apps/web/src/app/glucose/page.tsx had lass30 typo (ReferenceError crashing the /glucose page) - corrected to last30.
- Smoke: POST 65->level1, 50->level2, 5->400, 105->none; /glucose page returns 200 again.

<!-- P4b:shipped -->
## P4b - Know Your Body (U11 Prakriti + U14 Ritucharya) - shipped 2026-10-23

- Commit c62c582 "feat(P4b): U11 prakriti quiz + U14 ritucharya seasonal guidance" (13 files, +1224/-1)
- Engine: packages/engine prakriti.ts (12-question scoring, integer-only largest-remainder, pinned tie-break vata > pitta > kapha) + ritucharya.ts seasonal guidance; new tests 6 + 8
- Test suite: 11 engine files / 81 tests green; full repo 22 files / 175 tests green
- DB: migration 0004_phase4b_know_your_body applied to prod Turso; Prisma client regenerated
- API: /api/ayurveda/prakriti (GET latest, POST submit) with session auth guard - 401 verified on prod
- UI: /prakriti quiz page, PrakritiQuiz component, SeasonalCard on dashboard
- Deploy: origin/main c62c582 -> Vercel prod; smoke green (/, /login, /prakriti = 200; API guard 401); browser E2E confirmed
- Follow-up: prod 500 on signed-in GET /api/ayurveda/prakriti - root cause: prod Turso lacked 0004 tables (SQLITE_UNKNOWN: no such table main.PrakritiProfile); migration 0004 applied via db:migrate:prod (tracker 0001-0004 green, 22 -> 23 tables incl. PrakritiProfile).
- Signed-in E2E on prod: API {"profile":null}; quiz submit -> dosha percentages; re-GET returns persisted profile; SeasonalCard (Sharad - autumn) visible on /dashboard.
- Nav follow-up: /prakriti added to AppShell NAV (desktop sidebar + mobile nav) in commit 76d4fed.

<!-- P4c:shipped -->
## P4c - Food as Medicine (U16+U17+U19) - shipped 2026-10-24

- Delivered as four gated artifact blocks (a/b/c/d): zip with patch + bundle fallback + SHA256-verified PowerShell apply script, y/n gates for apply and push, one commit per block. Zero migration throughout (0005 stays reserved); no package.json changes.
- P4c-a (0d07225): three-lens healing-foods knowledge base (Ayur/Sci/Exp, evidence grades A-D, integer-only ranking with explainable reasons) + /healing-foods explorer + session-guarded GET /api/food-as-medicine. 36 new tests.
- P4c-b (46e50ff): U16 taste overlay on /log (139 foods, rasa+virya, dosha effects derived via saptarasa matrix, honest coverage counting, /my-foods overlay badges) + U17 agni rhythm (IST day windows, agniScore 0-100, AgniRhythmCard, GET /api/ayurveda/agni, late-meal banner, rhythm habit entries). 56 new tests.
- P4c-c (9f43862): U19 viruddha ahara checker - engine pair table with dual-lens rationales (classical + modern note on every row, severities info/caution/avoid), amber-only tray strip + post-save banner on /log, session-guarded POST /api/ayurveda/viruddha, best-effort same-meal-window findings on POST /api/meals. 57 new tests.
- P4c-d (this commit): global medical disclaimer (canonical strings in lib/disclaimer.ts rendered by AppShell footer on all authed pages, login page, printed report footer, PWA manifest description; danger-language scan tests) + phase records + forward plan below. 12 new tests.
- Suite evolution: 24 files/211 (P4c-a) -> 27/267 (P4c-b, user-verified locally) -> 30/324 (P4c-c) -> 31/336 (P4c-d). next build clean at 49 routes; only the pre-existing /log img warning. Prod smoke checklist in WORKLOG.

## Forward plan (updated 2026-10-24; supersedes the Phase 4 ordering note above)

Locked Phase 4 spine (continues after the new tracks below):
- P4d Rhythm and Digestion (U12+U13+U20)
- P4e Movement and Mind (U21+U22+U23)
- P4f Kitchen Pharmacy and Herbs (U18+U15, clinical review gate)
- P4g Medication Stewardship and Doctor Report (U26+U24, CSV injection fix gate)

New tracks (approved direction 2026-10-24; revised same day - user correction: P6 is Stress & Cortisol, kidney care moves into the P8 organ-labs platform):
- P5 Mobile and Reach: (a) mobile-friendly install URL + /install route with client-rendered QR code, native install prompt (beforeinstallprompt), iOS Add-to-Home-Screen guide, share cards; (b) installable offline-capable PWA - offline shell for /log /dashboard /healing-foods, offline meal logging queue (IndexedDB + Background Sync), thumb-reach bottom nav, >=44px touch targets; (c) Agni-timed opt-in notifications (09:45 kapha-window close, 20:30 late-meal nudge; default OFF; iOS requires home-screen install); (d) store-native decision - Capacitor wrap vs Expo; engine + food-db are dependency-pure TS and can be shared single-source into a native shell.
- P6 Stress & Cortisol (HPA rhythm): (a) stress check-ins (1-10 with quick tags: poor sleep, work deadline, conflict, over-caffeine, skipped meal) + caffeine-timing logging; (b) stressRhythm engine module - honest cortisol education (morning cortisol peak and natural evening decline, late caffeine and screens delaying sleep), evidence-graded A-D stress practices (slow breathing, meditation, nature time) with dual-lens Ayurvedic vata-pacifying dinacharya (pranayama, abhyanga, early dinner), integrated with U17 agni windows and existing sleep logging; (c) cortisol + DHEA-S fields on /labs with trend lines and clinician-flag framing - states plainly that adrenal fatigue is not a recognized diagnosis and doctors interpret labs. Framing: supports a healthy stress rhythm; explicitly does not claim to fix cortisol or treat adrenal disorders.
- P7 My Kitchen (my-foods revamp): favorites + quick-add from /log, personal tolerance signals from post-meal feedback + glucose deltas (minimum-N gating, honest correlation framing), personal watch-list with amber hints on /log, custom foods with auto taste + viruddha tagging, 7-day six-taste diversity ring, saved combos surfaced as one-tap meal templates.
- P8 Organ Labs platform (kidney first): unified per-organ expansion of /labs - marker logging + trend lines + evidence-graded education + doctor-visit questions, one organ at a time: (1) kidney - creatinine + eGFR with stage-gated renal education (hydration, BP and blood-sugar control as the biggest kidney protectors, protein moderation, NSAID avoidance, potassium/phosphorus lists only with labs on file, doctor-escalation banners at eGFR < 60 and < 15; kidney leads because diabetic kidney disease is the top cause of CKD); (2) thyroid - TSH/free T4 with fatigue-weight-cold-intolerance education; (3) liver - ALT/AST with MASLD (fatty liver) education; (4) lipids - LDL/HDL/triglycerides with ASCVD framing (BP logging already exists); (5) vitamin D. Framing: education + trends only; explicitly does not promise to lower any marker.
- Backlog (unscheduled): HbA1c target bands + trend summaries, eye/foot complication-screening reminders (annual retinal exam, daily foot check), gut-health/fiber-diversity view (candidate fold into P7 My Kitchen), hormonal health incl. PCOS (future workstream, needs clinical review gate), Hindi/regional i18n, dark-mode/accessibility polish, streaks/habit loop, family caregiver sharing, doctor-visit one-pager PDF, custom domain (user-side purchase + Vercel attach), payment/monetization pre-launch workstream (deferred, unchanged).
- Known debt (unchanged): CSV formula injection neutralization in apps/web/src/app/api/reports/route.ts csvCell before U24 ships.
