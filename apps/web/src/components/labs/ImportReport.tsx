'use client';

// P6-c — "Import from report" on /labs.
//
// Flow: paste the report text (open the PDF, Ctrl+A / Ctrl+C, paste; phone
// share-sheet copies work too) or pick a CSV/TSV file -> parse (deterministic
// engine parser, no OCR, no AI) -> REVIEW screen with every field editable
// and unmatched lines offered for manual mapping (never silent) -> Save
// creates one LabPanel via /api/lab-panels.
//
// P7.1 fixes baked in:
//   * auto-suggested mappings never collide with an already-matched test (the
//     old "HEMOGLOBIN row suggests hba1c, save 400s twice, panel never closes"
//     bug), and the mapping select only offers keys not already in use;
//   * unmatched rows can become CUSTOM tests (name + unit + value) that stay
//     tracked on /labs afterwards;
//   * optional patient age/sex at import pre-fills sex-aware display-only
//     default ranges for rows the report printed no range for.
import { useEffect, useRef, useState } from 'react';
import { LAB_TESTS, LAB_TEST_MAP, pickDefaultRange, type LabTestDef } from '@mi/engine';
import { istNow } from '@/lib/clinical-db';

export interface ParseMatch {
  testKey: string;
  label: string;
  asPrinted: string;
  value: number;
  unit: string;
  refLow?: number;
  refHigh?: number;
  confidence: number;
  line: string;
}

export interface ParseUnmatched {
  line: string;
  name: string;
  value: number | null;
  unit: string;
  suggestions: string[];
}

export interface ParseResult {
  matches: ParseMatch[];
  unmatched: ParseUnmatched[];
  performedAt?: string;
  labName?: string;
  patientAge?: number;
  patientSex?: 'male' | 'female';
  format: 'text' | 'csv' | 'pdf';
  /** present when a PDF was uploaded server-side (what was actually read) */
  text?: string;
}

interface ReviewRow {
  testKey: string;
  asPrinted: string;
  value: string;
  unit: string;
  refLow: string;
  refHigh: string;
  confidence: number;
  /** the report printed a range for this row - defaults never overwrite it */
  hasPrintedRange: boolean;
  /** the user typed in a ref cell - sex changes never overwrite it */
  refEdited: boolean;
}

interface ManualRow {
  line: string;
  name: string;
  value: string;
  unit: string;
  testKey: string; // '' = leave out; 'custom:<id>' = a created custom test
  /** inline "create custom test" form */
  creating: boolean;
  customName: string;
  customUnit: string;
  creatingError: string | null;
  creatingBusy: boolean;
}

interface CustomTestOption {
  key: string;
  name: string;
  unit: string;
}

export default function ImportReport({ onSaved }: { onSaved: () => void }) {
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewRow[] | null>(null);
  const [manual, setManual] = useState<ManualRow[]>([]);
  const [date, setDate] = useState('');
  const [labName, setLabName] = useState('');
  const [panelName, setPanelName] = useState('');
  const [parsedMeta, setParsedMeta] = useState<ParseResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'' | 'male' | 'female'>('');
  const [customTests, setCustomTests] = useState<CustomTestOption[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // The user's custom tests are mapping targets for unmatched rows too.
  useEffect(() => {
    fetch('/api/lab-tests')
      .then((r) => (r.ok ? r.json() : { tests: [] }))
      .then((j) => setCustomTests(j.tests ?? []))
      .catch(() => {});
  }, []);

  /** Sex-aware default range strings for a catalog test ('' when none). */
  function defaultRangeStrings(def: LabTestDef | undefined, sexNow: '' | 'male' | 'female') {
    if (!def) return { refLow: '', refHigh: '' };
    const d = pickDefaultRange(def, sexNow || null);
    return {
      refLow: d.refLow != null ? String(d.refLow) : '',
      refHigh: d.refHigh != null ? String(d.refHigh) : '',
    };
  }

  /** Populate the review screen from a parse result (shared by the paste
   * and the PDF-upload paths). P7.1: suggested keys never collide with a
   * matched test or another suggestion, so Save can never produce a
   * duplicate testKey (the "panel doesn't close" bug). */
  function applyParsed(parsed: ParseResult) {
    if (parsed.matches.length === 0 && parsed.unmatched.length === 0) {
      throw new Error('No test rows recognized. Check that this is the results section of the report and try again.');
    }
    setParsedMeta(parsed);
    const sexNow: '' | 'male' | 'female' = parsed.patientSex ?? '';
    setSex(sexNow);
    setAge(parsed.patientAge != null ? String(parsed.patientAge) : '');
    setReview(
      parsed.matches.map((m) => {
        const hasPrintedRange = m.refLow != null || m.refHigh != null;
        const defaults = defaultRangeStrings(LAB_TEST_MAP[m.testKey], sexNow);
        return {
          testKey: m.testKey,
          asPrinted: m.asPrinted,
          value: String(m.value),
          unit: m.unit,
          refLow: m.refLow != null ? String(m.refLow) : defaults.refLow,
          refHigh: m.refHigh != null ? String(m.refHigh) : defaults.refHigh,
          confidence: m.confidence,
          hasPrintedRange,
          refEdited: false,
        };
      }),
    );
    const usedByReview = new Set(parsed.matches.map((m) => m.testKey));
    const claimed = new Set<string>();
    setManual(
      parsed.unmatched
        .filter((u) => u.value != null)
        .map((u) => {
          // First suggestion that is neither matched above nor claimed by
          // another row - the auto-pick can never create a duplicate key.
          const suggestion = u.suggestions.find(
            (s) => !usedByReview.has(s) && !claimed.has(s) && !s.startsWith('custom:'),
          );
          if (suggestion) claimed.add(suggestion);
          return {
            line: u.line,
            name: u.name,
            value: String(u.value),
            unit: u.unit,
            testKey: suggestion ?? '',
            creating: false,
            customName: u.name.replace(/[^A-Za-z0-9 ()/.-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60),
            customUnit: u.unit,
            creatingError: null,
            creatingBusy: false,
          };
        }),
    );
    setDate(parsed.performedAt ?? istNow().slice(0, 10));
    setLabName(parsed.labName ?? '');
  }

  async function parse() {
    setParsing(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch('/api/lab-panels/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? 'Could not read that text.');
      applyParsed(j as ParseResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that text.');
    } finally {
      setParsing(false);
    }
  }

  async function handleFile(file: File) {
    setError(null);
    setMsg(null);
    try {
      // PDFs (detected by magic bytes - phone pickers often omit the MIME
      // type) are extracted server-side; raw bytes here would be mojibake.
      const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
      const isPdf =
        file.type === 'application/pdf' ||
        file.name.toLowerCase().endsWith('.pdf') ||
        (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46);
      if (isPdf) {
        if (file.size > 8 * 1024 * 1024) {
          throw new Error('That PDF is over 8 MB. Please upload a smaller export of the same report.');
        }
        setParsing(true);
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/lab-panels/parse', { method: 'POST', body: fd });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error ?? 'Could not read that PDF.');
        const parsed = j as ParseResult;
        // Show what was actually read, so the user can verify and re-parse.
        setText(parsed.text ?? '');
        applyParsed(parsed);
        return;
      }
      if (file.size > 2_000_000) {
        throw new Error('That file is over 2 MB - CSV exports are tiny. You may have picked a scan or photo; those need OCR, which is not included.');
      }
      const content = await file.text();
      setText(content.slice(0, 200_000));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.');
    } finally {
      setParsing(false);
    }
  }

  function updateRow(i: number, patch: Partial<ReviewRow>) {
    setReview((rows) =>
      (rows ?? []).map((r, idx) =>
        idx === i
          ? {
              ...r,
              ...patch,
              ...(patch.refLow != null || patch.refHigh != null ? { refEdited: true } : {}),
            }
          : r,
      ),
    );
  }

  /** P7.1: changing the patient sex re-picks display-only defaults for rows
   * whose range the report did not print and the user has not typed over. */
  function changeSex(next: '' | 'male' | 'female') {
    setSex(next);
    setReview((rows) =>
      (rows ?? []).map((r) => {
        if (r.hasPrintedRange || r.refEdited) return r;
        const d = defaultRangeStrings(LAB_TEST_MAP[r.testKey], next);
        return { ...r, refLow: d.refLow, refHigh: d.refHigh };
      }),
    );
  }

  /** P7.1: create a custom test for an unmatched row (name + unit). */
  async function createCustomTest(i: number) {
    setManual((rows) =>
      rows.map((x, idx) => (idx === i ? { ...x, creatingBusy: true, creatingError: null } : x)),
    );
    const row = manual[i];
    try {
      const res = await fetch('/api/lab-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: row.customName.trim(), unit: row.customUnit.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? 'Could not create that test.');
      const created = j as { key: string; name: string; unit: string };
      setCustomTests((prev) => [...prev.filter((t) => t.key !== created.key), { key: created.key, name: created.name, unit: created.unit }]);
      setManual((rows) =>
        rows.map((x, idx) =>
          idx === i ? { ...x, testKey: created.key, creating: false, creatingBusy: false, creatingError: null } : x,
        ),
      );
    } catch (e) {
      setManual((rows) =>
        rows.map((x, idx) =>
          idx === i
            ? { ...x, creatingBusy: false, creatingError: e instanceof Error ? e.message : 'Could not create that test.' }
            : x,
        ),
      );
    }
  }

  async function save() {
    if (!review) return;
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const reviewResults = review
        .filter((r) => r.testKey && r.value.trim() !== '' && Number.isFinite(Number(r.value)))
        .map((r) => ({
          testKey: r.testKey,
          value: Number(r.value),
          ...(r.refLow.trim() !== '' ? { refLow: Number(r.refLow) } : {}),
          ...(r.refHigh.trim() !== '' ? { refHigh: Number(r.refHigh) } : {}),
        }));
      const used = new Set(reviewResults.map((r) => r.testKey));
      const manualResults = manual
        .filter(
          (m) =>
            m.testKey &&
            !used.has(m.testKey) && // belt & braces: a collision can no longer be built
            m.value.trim() !== '' &&
            Number.isFinite(Number(m.value)),
        )
        .map((m) => ({
          testKey: m.testKey,
          value: Number(m.value),
          ...(m.testKey.startsWith('custom:') && m.unit ? { unit: m.unit } : {}),
        }));
      const results = [...reviewResults, ...manualResults];
      const res = await fetch('/api/lab-panels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          performedAt: date,
          ...(panelName.trim() ? { name: panelName.trim() } : {}),
          ...(labName.trim() ? { labName: labName.trim() } : {}),
          sourceNote: 'report import',
          results,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? 'Could not save this panel.');
      setMsg(`Saved panel of ${results.length} result${results.length === 1 ? '' : 's'} from your report.`);
      setReview(null);
      setManual([]);
      setText('');
      setParsedMeta(null);
      setAge('');
      setSex('');
      if (fileRef.current) fileRef.current.value = '';
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this panel.');
    } finally {
      setSaving(false);
    }
  }

  const input = 'w-full rounded-lg border border-neutral-300 bg-transparent px-2 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-neutral-700';
  const cellInput = 'w-full rounded border border-neutral-300 bg-transparent px-2 py-1 text-sm dark:border-neutral-700';
  const usedKeys = new Set((review ?? []).map((r) => r.testKey));
  const manualChosen = new Set(manual.map((m) => m.testKey).filter(Boolean));
  const mappable = (t: { key: string }) => !usedKeys.has(t.key) && !manualChosen.has(t.key);
  const customOptionByKey = new Map(customTests.map((t) => [t.key, t]));

  return (
    <div>
      <div className="mt-6 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="text-lg font-semibold">Import from report</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Upload your lab PDF, paste the report text, or choose a CSV/TSV export. Fields pre-fill for your review
          before anything is saved.
        </p>

        {/* The honest limits of a zero-dependency app, stated up front. */}
        <p className="mt-2 rounded-lg bg-neutral-50 p-3 text-[11px] leading-relaxed text-neutral-500 dark:bg-neutral-900/40 dark:text-neutral-400">
          <span className="font-medium">PDFs with a text layer are read automatically</span> (most lab exports:
          Thyrocare, Metropolis, Dr Lal...). Scanned or photographed reports are not - reading values out of images
          needs OCR (a new dependency + API key), which this app deliberately avoids. For a scan, open it, copy the
          text and paste it, or store the file in the Documents vault.
        </p>

        {!review && (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={'Paste here, e.g.\nHbA1c 6.8 % 4.3 - 5.7\nFasting Blood Sugar 112 mg/dL 70 - 100\nS. Cholesterol 212 mg/dL 130 - 200'}
              className="mt-3 w-full rounded-lg border border-neutral-300 bg-transparent p-3 font-mono text-xs outline-none focus:border-brand-500 dark:border-neutral-700"
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={parse}
                disabled={parsing || !text.trim()}
                className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {parsing ? 'Reading...' : 'Read report'}
              </button>
              <label className="text-xs text-neutral-500">
                or upload PDF/CSV/TSV:
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.csv,.tsv,.txt,application/pdf,text/csv,text/plain"
                  className="ml-2 text-xs"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </label>
              {parsing && <span className="text-xs text-neutral-400">Reading...</span>}
            </div>
          </>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {msg && (
          <p className="mt-3 rounded-lg border border-brand-300 bg-brand-50 p-3 text-sm text-brand-800 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-200">
            {msg}
          </p>
        )}

        {/* ---------- Review screen ---------- */}
        {review && (
          <div className="mt-4">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <label className="text-xs text-neutral-500">
                Test date {parsedMeta?.performedAt && <span className="text-neutral-400">(from report)</span>}
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
              </label>
              <label className="text-xs text-neutral-500">
                Lab name {parsedMeta?.labName && <span className="text-neutral-400">(recognized)</span>}
                <input value={labName} onChange={(e) => setLabName(e.target.value)} placeholder="e.g. Thyrocare" className={input} />
              </label>
              <label className="text-xs text-neutral-500">
                Panel name (optional)
                <input value={panelName} onChange={(e) => setPanelName(e.target.value)} placeholder="e.g. Quarterly check" className={input} />
              </label>
              <label className="text-xs text-neutral-500">
                Patient age {parsedMeta?.patientAge != null && <span className="text-neutral-400">(from report)</span>}
                <input
                  inputMode="numeric"
                  value={age}
                  onChange={(e) => setAge(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
                  placeholder="optional"
                  className={input}
                />
              </label>
              <label className="text-xs text-neutral-500">
                Patient sex {parsedMeta?.patientSex && <span className="text-neutral-400">(from report)</span>}
                <select value={sex} onChange={(e) => changeSex(e.target.value as '' | 'male' | 'female')} className={input} aria-label="patient sex">
                  <option value="">not set</option>
                  <option value="male">male</option>
                  <option value="female">female</option>
                </select>
              </label>
            </div>
            <p className="mt-2 text-[11px] text-neutral-400">
              Age and sex only pick display-only default ranges for rows the report printed no range for - the lab&apos;s
              own printed range always wins. They are not stored as profile facts.
            </p>

            <p className="mt-4 text-xs font-medium text-neutral-500">
              Review the pre-filled fields ({review.length} recognized) - everything is editable:
            </p>
            <div className="mt-2 overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-xs text-neutral-500 dark:bg-neutral-900">
                  <tr>
                    <th className="px-3 py-2">As printed</th>
                    <th className="px-3 py-2">Saved as</th>
                    <th className="px-3 py-2 w-24">Value</th>
                    <th className="px-3 py-2 w-24">Unit</th>
                    <th className="px-3 py-2 w-20">Ref low</th>
                    <th className="px-3 py-2 w-20">Ref high</th>
                    <th className="px-3 py-2">Match</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {review.map((r, i) => {
                    const def = LAB_TEST_MAP[r.testKey];
                    return (
                      <tr key={i} className="border-t border-neutral-100 dark:border-neutral-900">
                        <td className="px-3 py-2 text-xs text-neutral-500">{r.asPrinted}</td>
                        <td className="px-3 py-2">
                          <select value={r.testKey} onChange={(e) => updateRow(i, { testKey: e.target.value })} className={cellInput} aria-label="mapped test">
                            {LAB_TESTS.filter((t) => !t.documentOnly).map((t: LabTestDef) => (
                              <option key={t.key} value={t.key}>{t.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2"><input inputMode="decimal" value={r.value} onChange={(e) => updateRow(i, { value: e.target.value })} className={cellInput} /></td>
                        <td className="px-3 py-2 text-xs text-neutral-400">{r.unit || def?.unit || ''}</td>
                        <td className="px-3 py-2">
                          <input inputMode="decimal" value={r.refLow} onChange={(e) => updateRow(i, { refLow: e.target.value })} className={cellInput} aria-label="reference low" />
                          {!r.hasPrintedRange && !r.refEdited && <span className="text-[10px] text-neutral-300">default</span>}
                        </td>
                        <td className="px-3 py-2">
                          <input inputMode="decimal" value={r.refHigh} onChange={(e) => updateRow(i, { refHigh: e.target.value })} className={cellInput} aria-label="reference high" />
                        </td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            r.confidence >= 1
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                          }`}>
                            {r.confidence >= 1 ? 'exact' : 'likely'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => setReview((rows) => (rows ?? []).filter((_, idx) => idx !== i))}
                            className="text-xs text-neutral-400 hover:text-red-500"
                            aria-label="remove row"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {manual.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-neutral-500">
                  Not recognized ({manual.length}) - map them, create a custom test, or leave them out (never silently dropped):
                </p>
                <ul className="mt-2 space-y-2">
                  {manual.map((m, i) => {
                    const isCustom = m.testKey.startsWith('custom:');
                    const customDef = isCustom ? customOptionByKey.get(m.testKey) : undefined;
                    return (
                      <li key={i} className="rounded-lg border border-dashed border-neutral-300 p-2 text-sm dark:border-neutral-700">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="min-w-0 flex-1 truncate" title={m.line}>
                            <span className="font-medium">{m.name}</span>
                            <span className="ml-2 text-xs text-neutral-400 tabular-nums">{m.value} {m.unit}</span>
                          </span>
                          {isCustom ? (
                            <span className="flex items-center gap-2">
                              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                                custom: {customDef?.name ?? 'your test'}
                              </span>
                              <button
                                onClick={() => setManual((rows) => rows.map((x, idx) => (idx === i ? { ...x, testKey: '' } : x)))}
                                className="text-xs text-neutral-400 hover:text-red-500"
                              >
                                leave out
                              </button>
                            </span>
                          ) : (
                            <>
                              <select
                                value={m.testKey}
                                onChange={(e) => setManual((rows) => rows.map((x, idx) => (idx === i ? { ...x, testKey: e.target.value, creating: false, creatingError: null } : x)))}
                                className="rounded border border-neutral-300 bg-transparent px-2 py-1 text-xs dark:border-neutral-700"
                                aria-label={`map ${m.name}`}
                              >
                                <option value="">- leave out -</option>
                                {customTests.filter(mappable).map((t) => (
                                  <option key={t.key} value={t.key}>{t.name} (yours)</option>
                                ))}
                                {LAB_TESTS.filter((t) => !t.documentOnly && mappable(t)).map((t) => (
                                  <option key={t.key} value={t.key}>{t.label}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => setManual((rows) => rows.map((x, idx) => (idx === i ? { ...x, creating: !x.creating, creatingError: null } : x)))}
                                className="rounded-lg border border-brand-300 px-2 py-1 text-[11px] font-medium text-brand-700 hover:bg-brand-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-950/40"
                              >
                                + Create custom test
                              </button>
                            </>
                          )}
                        </div>
                        {m.creating && !isCustom && (
                          <div className="mt-2 flex flex-wrap items-end gap-2 rounded-lg bg-neutral-50 p-2 dark:bg-neutral-900/40">
                            <label className="text-xs text-neutral-500">
                              Test name
                              <input
                                value={m.customName}
                                onChange={(e) => setManual((rows) => rows.map((x, idx) => (idx === i ? { ...x, customName: e.target.value } : x)))}
                                className={`${cellInput} w-44`}
                                maxLength={60}
                                aria-label="custom test name"
                              />
                            </label>
                            <label className="text-xs text-neutral-500">
                              Unit
                              <input
                                value={m.customUnit}
                                onChange={(e) => setManual((rows) => rows.map((x, idx) => (idx === i ? { ...x, customUnit: e.target.value } : x)))}
                                className={`${cellInput} w-24`}
                                maxLength={16}
                                placeholder="e.g. mg/dL"
                                aria-label="custom test unit"
                              />
                            </label>
                            <span className="text-xs text-neutral-400">
                              value {m.value} - saved with the panel and tracked on Labs afterwards
                            </span>
                            <button
                              onClick={() => createCustomTest(i)}
                              disabled={m.creatingBusy || m.customName.trim().length < 2}
                              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                            >
                              {m.creatingBusy ? 'Creating...' : 'Create test'}
                            </button>
                            {m.creatingError && <span className="w-full text-xs text-red-600">{m.creatingError}</span>}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={save}
                disabled={saving || !date}
                className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save panel'}
              </button>
              <button onClick={() => { setReview(null); setManual([]); }} className="text-xs text-neutral-500 hover:underline">
                Back to paste
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
