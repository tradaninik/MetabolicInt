'use client';

// P6-f — the report documents vault on /labs: the A–E master folder.
//
// Upload PDFs/JPGs/PNGs into category folders (A Diabetes, B Cardio, C
// Liver&Thyroid, D Nutrition, E Screening); every file automatically gets
// the standard filename YYYY-MM-DD_[Category]_[TestName]_[PatientName].ext -
// previewed before upload, generated server-side on save, and sent as the
// download name via Content-Disposition. Linked doctors and caregivers see
// the same folders from their portals. Base64 in the DB is the deliberate
// zero-dep choice; caps are plain-language (4 MB/file, 200 files, 50 MB).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LAB_CATEGORIES, LAB_TESTS, LAB_TEST_MAP, reportFileName, type LabReportCategory } from '@mi/engine';
import { istNow } from '@/lib/clinical-db';

export interface DocumentRow {
  id: string;
  category: string;
  testKey: string | null;
  displayName: string;
  mimeType: string;
  sizeBytes: number;
  panelId: string | null;
  performedAt: string | null;
  note: string | null;
  createdAt: string;
}

interface Usage {
  count: number;
  totalBytes: number;
  maxFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
}

const mb = (bytes: number) => `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;
const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

export default function DocumentsVault() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [openCat, setOpenCat] = useState<string>('diabetes');
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState('diabetes');
  const [testKey, setTestKey] = useState('');
  const [performedAt, setPerformedAt] = useState('');
  const [note, setNote] = useState('');
  const [patientName, setPatientName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/reports/documents');
      if (res.ok) {
        const j = await res.json();
        setDocuments(j.documents ?? []);
        setUsage(j.usage ?? null);
      }
    } catch {
      // offline-tolerant: keep what we have
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    setPerformedAt(istNow().slice(0, 10));
    load();
    // Patient-name token for the filename preview (the server regenerates it
    // from the profile anyway - this is display only).
    fetch('/api/me/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.name || d?.email) setPatientName(d.name || String(d.email).split('@')[0]); })
      .catch(() => {});
  }, [load]);

  const previewName = useMemo(() => {
    if (!file) return null;
    const ext = file.name.split('.').pop() ?? 'bin';
    return reportFileName({
      date: performedAt || 'undated',
      category,
      testKey: testKey || null,
      patientName: patientName || 'Patient',
      ext,
    });
  }, [file, performedAt, category, testKey, patientName]);

  function pickFile(f: File | null) {
    setError(null);
    setMsg(null);
    if (!f) { setFile(null); return; }
    if (f.size > 4 * 1024 * 1024) {
      setError(`That file is ${mb(f.size)}. The limit is 4 MB per file - scan at a lower resolution or split the PDF.`);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setFile(f);
  }

  async function upload() {
    if (!file) return;
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('category', category);
      if (testKey) form.set('testKey', testKey);
      if (performedAt) form.set('performedAt', performedAt);
      if (note.trim()) form.set('note', note.trim());
      const res = await fetch('/api/reports/documents', { method: 'POST', body: form });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? 'Could not upload that file.');
      setMsg(`Saved as ${j.document?.displayName ?? 'document'} - it's in the ${categoryLabel(j.document?.category)} folder.`);
      setFile(null);
      setNote('');
      if (fileRef.current) fileRef.current.value = '';
      setOpenCat(j.document?.category ?? category);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload that file.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(d: DocumentRow) {
    if (!window.confirm(`Delete ${d.displayName}?`)) return;
    await fetch(`/api/reports/documents/${encodeURIComponent(d.id)}`, { method: 'DELETE' });
    load();
  }

  const categoryLabel = (id: string | null | undefined) =>
    LAB_CATEGORIES.find((c) => c.id === id)?.title ?? 'Report';

  const sizeLabel = (bytes: number) => (bytes >= 1024 * 1024 ? mb(bytes) : kb(bytes));

  const byCategory = useMemo(() => {
    const map = new Map<string, DocumentRow[]>();
    for (const c of LAB_CATEGORIES) map.set(c.id, []);
    for (const d of documents) {
      if (!map.has(d.category)) map.set(d.category, []);
      map.get(d.category)!.push(d);
    }
    return map;
  }, [documents]);

  const input = 'w-full rounded-lg border border-neutral-300 bg-transparent px-2 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-neutral-700';

  return (
    <div>
      {/* ---------- Upload ---------- */}
      <div className="mt-6 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="text-lg font-semibold">Upload a report document</h2>
        <p className="mt-1 text-sm text-neutral-500">
          PDF, JPG or PNG, up to 4 MB each. It lands in an A–E folder and gets the standard filename automatically.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-neutral-500">
            File
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-xs"
            />
          </label>
          <label className="text-xs text-neutral-500">
            Document date
            <input type="date" value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} className={input} />
          </label>
          <label className="text-xs text-neutral-500">
            Folder (A–E)
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
              {LAB_CATEGORIES.map((c: LabReportCategory) => (
                <option key={c.id} value={c.id}>{c.letter}. {c.title}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-neutral-500">
            Test / document type (optional)
            <select value={testKey} onChange={(e) => setTestKey(e.target.value)} className={input}>
              <option value="">- general document -</option>
              {LAB_TESTS.filter((t) => t.category === LAB_CATEGORIES.find((c) => c.id === category)?.letter)
                .map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
            </select>
          </label>
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note, e.g. the lab-printed result or the screening finding"
          maxLength={200}
          className={`mt-3 ${input}`}
          aria-label="document note"
        />

        {previewName && (
          <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600 dark:bg-neutral-900/40 dark:text-neutral-400">
            <span className="font-medium">Will be saved as:</span>{' '}
            <span className="font-mono">{previewName}</span>
          </p>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {msg && (
          <p className="mt-3 rounded-lg border border-brand-300 bg-brand-50 p-3 text-sm text-brand-800 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-200">
            {msg}
          </p>
        )}

        <button
          onClick={upload}
          disabled={saving || !file}
          className="mt-4 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? 'Uploading...' : 'Save to vault'}
        </button>

        {usage && (
          <p className="mt-3 text-[11px] text-neutral-400">
            Vault usage: {usage.count} of {usage.maxFiles} files, {mb(usage.totalBytes)} of {mb(usage.maxTotalBytes)}.
          </p>
        )}
      </div>

      {/* ---------- Folders ---------- */}
      {loaded && documents.length === 0 && (
        <p className="mt-6 text-sm text-neutral-500">
          No documents yet. Upload your first report above - ECGs, echo reports, retinopathy screenings and foot-exam
          records all live here.
        </p>
      )}

      {documents.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold">Master folder</h2>
          <p className="mt-1 text-sm text-neutral-500">
            The A–E structure, ready for your doctor and caregivers - they see these folders from their portals with
            the same download names.
          </p>
          <div className="mt-3 space-y-2">
            {LAB_CATEGORIES.map((c) => {
              const docs = byCategory.get(c.id) ?? [];
              const isOpen = openCat === c.id;
              return (
                <div key={c.id} className="rounded-xl border border-neutral-200 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setOpenCat(isOpen ? '' : c.id)}
                    aria-expanded={isOpen}
                    className="flex min-h-[44px] w-full items-center justify-between gap-2 px-4 py-3 text-left"
                  >
                    <span>
                      <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                        {c.letter}
                      </span>
                      <span className="text-sm font-semibold">{c.title}</span>
                    </span>
                    <span className="text-xs text-neutral-400">
                      {docs.length} document{docs.length === 1 ? '' : 's'}
                    </span>
                  </button>
                  {isOpen && (
                    <ul className="divide-y divide-neutral-100 border-t border-neutral-100 dark:divide-neutral-900 dark:border-neutral-900">
                      {docs.length === 0 && (
                        <li className="px-4 py-3 text-xs text-neutral-400">Nothing in this folder yet.</li>
                      )}
                      {docs.map((d) => (
                        <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-mono text-xs font-medium text-neutral-700 dark:text-neutral-300" title={d.displayName}>
                              {d.displayName}
                            </p>
                            <p className="mt-0.5 text-[11px] text-neutral-400">
                              {sizeLabel(d.sizeBytes)} · {d.mimeType === 'application/pdf' ? 'PDF' : d.mimeType === 'image/jpeg' ? 'JPG' : 'PNG'}
                              {d.testKey ? ` · ${LAB_TEST_MAP[d.testKey]?.label ?? d.testKey}` : ''}
                              {d.note ? ` · ${d.note}` : ''}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <a
                              href={`/api/reports/documents/${encodeURIComponent(d.id)}`}
                              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
                            >
                              Download
                            </a>
                            <a
                              href={`/api/reports/documents/${encodeURIComponent(d.id)}?inline=1`}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
                            >
                              View
                            </a>
                            <button
                              onClick={() => remove(d)}
                              className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
                              aria-label={`Delete ${d.displayName}`}
                            >
                              Delete
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-neutral-400">
        Documents are stored inside your account (base64 in the database - no third-party service). Deleting a
        document never touches your lab numbers.
      </p>
    </div>
  );
}
