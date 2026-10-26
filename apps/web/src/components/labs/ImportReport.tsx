'use client';

// P6-c — "Import from report" on /labs.
//
// Flow: paste the report text (open the PDF, Ctrl+A / Ctrl+C, paste; phone
// share-sheet copies work too) or pick a CSV/TSV file -> parse (deterministic
// engine parser, no OCR, no AI) -> REVIEW screen with every field editable
// and unmatched lines offered for manual mapping (never silent) -> Save
// creates one LabPanel via /api/lab-panels.
import { useRef, useState } from 'react';
import { LAB_TESTS, LAB_TEST_MAP, type LabTestDef } from '@mi/engine';
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
}

export default function ImportReport({ onSaved }: { onSaved: () => void }) {
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewRow[] | null>(null);
  const [manual, setManual] = useState<{ line: string; name: string; value: string; testKey: string }[]>([]);
  const [date, setDate] = useState('');
  const [labName, setLabName] = useState('');
  const [panelName, setPanelName] = useState('');
  const [parsedMeta, setParsedMeta] = useState<ParseResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /** Populate the review screen from a parse result (shared by the paste
   * and the PDF-upload paths). */
  function applyParsed(parsed: ParseResult) {
    if (parsed.matches.length === 0 && parsed.unmatched.length === 0) {
      throw new Error('No test rows recognized. Check that this is the results section of the report and try again.');
    }
    setParsedMeta(parsed);
    setReview(
      parsed.matches.map((m) => ({
        testKey: m.testKey,
        asPrinted: m.asPrinted,
        value: String(m.value),
        unit: m.unit,
        refLow: m.refLow != null ? String(m.refLow) : '',
        refHigh: m.refHigh != null ? String(m.refHigh) : '',
        confidence: m.confidence,
      })),
    );
    setManual(
      parsed.unmatched
        .filter((u) => u.value != null)
        .map((u) => ({
          line: u.line,
          name: u.name,
          value: String(u.value),
          testKey: u.suggestions[0] ?? '',
        })),
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
    setReview((rows) => (rows ?? []).map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function save() {
    if (!review) return;
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const results = [
        ...review
          .filter((r) => r.testKey && r.value.trim() !== '' && Number.isFinite(Number(r.value)))
          .map((r) => ({
            testKey: r.testKey,
            value: Number(r.value),
            ...(r.refLow.trim() !== '' ? { refLow: Number(r.refLow) } : {}),
            ...(r.refHigh.trim() !== '' ? { refHigh: Number(r.refHigh) } : {}),
          })),
        ...manual
          .filter((m) => m.testKey && m.value.trim() !== '' && Number.isFinite(Number(m.value)))
          .map((m) => ({ testKey: m.testKey, value: Number(m.value) })),
      ];
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
            <div className="grid gap-3 sm:grid-cols-3">
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
            </div>

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
                        <td className="px-3 py-2"><input inputMode="decimal" value={r.refLow} onChange={(e) => updateRow(i, { refLow: e.target.value })} className={cellInput} /></td>
                        <td className="px-3 py-2"><input inputMode="decimal" value={r.refHigh} onChange={(e) => updateRow(i, { refHigh: e.target.value })} className={cellInput} /></td>
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
                  Not recognized ({manual.length}) - map them yourself or leave them out (never silently dropped):
                </p>
                <ul className="mt-2 space-y-2">
                  {manual.map((m, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-neutral-300 p-2 text-sm dark:border-neutral-700">
                      <span className="min-w-0 flex-1 truncate" title={m.line}>
                        <span className="font-medium">{m.name}</span>
                        <span className="ml-2 text-xs text-neutral-400 tabular-nums">{m.value}</span>
                      </span>
                      <select
                        value={m.testKey}
                        onChange={(e) => setManual((rows) => rows.map((x, idx) => (idx === i ? { ...x, testKey: e.target.value } : x)))}
                        className="rounded border border-neutral-300 bg-transparent px-2 py-1 text-xs dark:border-neutral-700"
                        aria-label={`map ${m.name}`}
                      >
                        <option value="">- leave out -</option>
                        {LAB_TESTS.filter((t) => !t.documentOnly && !usedKeys.has(t.key)).map((t) => (
                          <option key={t.key} value={t.key}>{t.label}</option>
                        ))}
                      </select>
                    </li>
                  ))}
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
