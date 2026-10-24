import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  MEDICAL_DISCLAIMER_SHORT,
  MEDICAL_DISCLAIMER_LONG,
  MEDICAL_DISCLAIMER_REPORT,
  MEDICAL_DISCLAIMER_MANIFEST,
} from '../disclaimer';

const src = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

const ALL = {
  short: MEDICAL_DISCLAIMER_SHORT,
  long: MEDICAL_DISCLAIMER_LONG,
  report: MEDICAL_DISCLAIMER_REPORT,
  manifest: MEDICAL_DISCLAIMER_MANIFEST,
};

describe('medical disclaimer content', () => {
  it('every variant states it is not a doctor/medical advice', () => {
    for (const [name, s] of Object.entries(ALL)) {
      expect(s, `${name} must deny being medical advice`).toMatch(
        /not (a doctor|a medical|medical advice|a medical document)/i,
      );
    }
  });

  it('every variant tells the user to consult a clinician or doctor', () => {
    for (const [name, s] of Object.entries(ALL)) {
      expect(s, `${name} must point to a clinician`).toMatch(
        /consult your (clinician|doctor)|share it with your clinician|contact your doctor/i,
      );
    }
  });

  it('short and long are grounded in blood sugar / lifestyle scope', () => {
    expect(MEDICAL_DISCLAIMER_SHORT).toMatch(/blood sugar/i);
    expect(MEDICAL_DISCLAIMER_SHORT).toMatch(/lifestyle/i);
    expect(MEDICAL_DISCLAIMER_LONG).toMatch(/blood sugar/i);
    expect(MEDICAL_DISCLAIMER_LONG).toMatch(/lifestyle/i);
  });

  it('long form carries the insulin/sulfonylurea hypoglycemia caution', () => {
    expect(MEDICAL_DISCLAIMER_LONG).toMatch(/insulin/i);
    expect(MEDICAL_DISCLAIMER_LONG).toMatch(/sulfonylureas/i);
    expect(MEDICAL_DISCLAIMER_LONG).toMatch(/low blood sugar/i);
  });

  it('long form covers emergencies and wrong-looking readings', () => {
    expect(MEDICAL_DISCLAIMER_LONG).toMatch(/emergency/i);
    expect(MEDICAL_DISCLAIMER_LONG).toMatch(/readings look wrong|feel unwell/i);
  });

  it('report variant frames itself as a share-with-clinician summary', () => {
    expect(MEDICAL_DISCLAIMER_REPORT).toMatch(/self-logged/i);
    expect(MEDICAL_DISCLAIMER_REPORT).toMatch(/clinician/i);
  });

  it('no variant makes treatment, cure, reversal, or guarantee claims', () => {
    // Danger-language scan: bare "treat/treats" is forbidden (allowed only
    // inside compound words like "treatment", which \b boundaries exclude).
    for (const [name, s] of Object.entries(ALL)) {
      expect(s, `${name} must not promise cures`).not.toMatch(
        /\b(cure|cures|cured|reversal|reverses|reversed|guarantee|guarantees|heal|heals|healed)\b/i,
      );
      expect(s, `${name} must not claim to treat`).not.toMatch(/\btreats?\b/i);
    }
  });
});

describe('medical disclaimer wiring', () => {
  it('AppShell renders the MedicalDisclaimer footer on all authed pages', () => {
    const shell = src('../../components/AppShell.tsx');
    expect(shell).toContain("import MedicalDisclaimer from './MedicalDisclaimer'");
    expect(shell).toContain('<MedicalDisclaimer />');
  });

  it('MedicalDisclaimer component renders short line plus expandable long form', () => {
    const comp = src('../../components/MedicalDisclaimer.tsx');
    expect(comp).toContain('MEDICAL_DISCLAIMER_SHORT');
    expect(comp).toContain('MEDICAL_DISCLAIMER_LONG');
    expect(comp).toContain('<details');
    expect(comp).toContain('aria-label="Medical disclaimer"');
  });

  it('login page shows the short disclaimer (public surface)', () => {
    const page = src('../../app/login/page.tsx');
    expect(page).toContain('MEDICAL_DISCLAIMER_SHORT');
  });

  it('printed report footer uses the canonical report disclaimer', () => {
    const page = src('../../app/reports/page.tsx');
    expect(page).toContain('MEDICAL_DISCLAIMER_REPORT');
  });

  it('PWA manifest description carries the not-medical-advice framing', () => {
    const raw = src('../../../public/manifest.webmanifest');
    const manifest = JSON.parse(raw);
    expect(manifest.description).toMatch(/not medical advice/i);
    expect(manifest.description).toMatch(/consult your clinician/i);
  });
});
