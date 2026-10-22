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
