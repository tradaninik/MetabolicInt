// P6-c — deterministic lab-report text/CSV parser. ZERO dependencies, no OCR:
// the primary flow is "open the PDF, Ctrl+A / Ctrl+C, paste here" (most Indian
// lab PDFs ship selectable text), or a CSV/TSV export. Phone share-sheet copies
// work the same way.
//
// Tolerance strategy, per line: tokenize on whitespace, find the VALUE as the
// first standalone number followed by a unit token (or by a reference-range
// pattern, or the last standalone number), take the text before it as the test
// NAME, and any trailing numbers as the lab-printed reference range. Names map
// to catalog keys through the alias table (exact -> confidence 1, containment
// -> 0.7). Everything with a plausible value that does NOT map is returned as
// an unmatched line for MANUAL mapping in the review screen - never a silent
// drop, never a guess.

import {
  LAB_TEST_MAP,
  labKeyForAlias,
  labKeysContaining,
  type LabTestDef,
} from './labs';

export interface LabParseMatch {
  testKey: string;
  label: string; // catalog label
  asPrinted: string; // name as the lab printed it
  value: number;
  unit: string; // as printed ('' when none)
  refLow?: number;
  refHigh?: number;
  confidence: number; // 1 = exact alias, 0.7 = containment
  line: string;
}

export interface LabUnmatchedLine {
  line: string;
  name: string;
  value: number | null;
  unit: string;
  suggestions: string[]; // catalog keys ranked by alias tightness
}

export interface LabParseResult {
  matches: LabParseMatch[];
  unmatched: LabUnmatchedLine[];
  performedAt?: string; // YYYY-MM-DD when a report date was found
  labName?: string; // recognized Indian lab chain, if any
  format: 'text' | 'csv';
}

const UNIT_RE = /^(?:mg\/dl|mg\/d l|mg%|mg\/l|ug\/dl|µg\/dl|ng\/ml|ng\/d l|pg\/ml|u\/l|iu\/l|uiu\/ml|µiu\/ml|μiu\/ml|µu\/ml|uu\/ml|miu\/l|mmol\/l|g\/dl|gm\/dl|%|percent|mmol\/mol|m\/mol|mg\/g|ug\/g|nmol\/l|pmol\/l|ml\/min|ml\/min\/1.73m2|iu\/ml|u\/ml|ng\/dl)$/i;

const LAB_CHAINS = ['thyrocare', 'metropolis', 'dr lal', 'lal pathlabs', 'lal path labs', 'srl', 'apollo', 'nutrica', 'vlcc', 'healthians', 'redcliffe', 'cadila', 'neuberg'];

const HEADER_HINTS = [
  'test name', 'test parameter', 'parameter', 'investigation', 'observation',
  'result', 'value', 'unit', 'reference range', 'ref range', 'biological ref',
  'reference interval', 'specimen', 'sample', 'patient', 'age', 'gender',
  'referred by', 'ref. by', 'ref by', 'collected', 'received', 'reported',
  'released', 'registered', 'accession', 'barcode',
  'method', 'technolog', ' printed', 'page ', 'www.', 'terms and conditions',
  // Reference-range legend + assay-boilerplate lines (never test rows):
  'male :', 'female :', 'adult :', 'adults :', 'normal :', 'deficiency',
  'insufficiency', 'sufficiency', 'toxicity', 'intra assay', 'inter assay',
  'specifications', '%cv', 'precision', 'sensitivity:', 'standardization',
  'correlate with clinical', 'yrs :', 'years :', 'menopause', 'months :',
];

/** Date coercion: dd/mm/yyyy, dd-mm-yyyy, dd.mm.yy, yyyy-mm-dd -> YYYY-MM-DD. */
function coerceDate(raw: string): string | undefined {
  const s = raw.trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (m) return iso(m[1], m[2], m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(s);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return iso(year, m[2], m[1]); // Indian convention: dd/mm/yyyy
  }
  return undefined;
}

function iso(y: string, mo: string, d: string): string | undefined {
  const yy = Number(y);
  const mm = Number(mo);
  const dd = Number(d);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yy < 1990 || yy > 2100) return undefined;
  return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** "17 Jan 2021", "17-Jan-2021"-style dates - Indian labs print these in
 * "Sample Collected on (SCT) : 17 Jan 2021 07:16" lines. */
const DATE_MON = /(\d{1,2})\s*[-/ ]\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*[-,/ ]\s*(\d{2,4})/i;

/** Any date format after a date-word -> ISO, or undefined. */
function dateFromText(rest: string): string | undefined {
  const mon = DATE_MON.exec(rest);
  if (mon) {
    const mo = MONTHS[mon[2].slice(0, 3).toLowerCase()];
    const yy = mon[3].length === 2 ? `20${mon[3]}` : mon[3];
    if (mo) return iso(yy, String(mo), mon[1]);
  }
  const num = /(\d{1,4})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(rest);
  if (num) return coerceDate(num[0]); // full dd/mm/yyyy-style token
  return undefined;
}

/** Extract a report date + lab chain from prose lines (best effort).
 * Collection dates win over released/reported dates (that is when the blood
 * was actually drawn); dates are only read from date-word lines so prose
 * citations like "Clin Chem Lab Med 2000;38:1003-11" can never fake one. */
function scanMeta(lines: string[]): { performedAt?: string; labName?: string } {
  let collectedAt: string | undefined;
  let otherDate: string | undefined;
  let labName: string | undefined;
  const dateWords = /(?:sample\s+)?(collected|reported|received|registered|released|done|date)\s*[:\-]?\s*(?:on\s*)?/i;
  for (const line of lines) {
    const low = line.toLowerCase();
    if (!labName) {
      for (const chain of LAB_CHAINS) {
        if (low.includes(chain)) {
          labName = chain
            .split(' ')
            .map((w) => w[0].toUpperCase() + w.slice(1))
            .join(' ');
          break;
        }
      }
    }
    const dw = dateWords.exec(line);
    if (dw) {
      const rest = line.slice((dw.index ?? 0) + dw[0].length);
      const d = dateFromText(rest);
      if (d) {
        if (dw[1].toLowerCase() === 'collected') collectedAt = collectedAt ?? d;
        else otherDate = otherDate ?? d;
      }
    }
  }
  return { performedAt: collectedAt ?? otherDate, labName };
}

/** Split a line into whitespace tokens, keeping range patterns glued. */
function tokenize(line: string): string[] {
  return line.split(/\s+/).filter(Boolean);
}

function isNumericToken(tok: string): boolean {
  return /^\d+(?:[.,]\d+)?$/.test(tok);
}

/** 4-digit tokens in 1900-2100 are far more likely years than values. */
function looksLikeYear(tok: string): boolean {
  return /^(19|20)\d{2}$/.test(tok);
}

function num(tok: string): number {
  // Indian formats use '.' decimals; ',' appears as thousands sep - strip it.
  return Number(tok.replace(/,/g, ''));
}

/** "70-100", "70 - 100", "<150", "> 40", "130 - 200 mg/dL" -> {refLow?, refHigh?} */
function parseRange(text: string): { refLow?: number; refHigh?: number } {
  const t = text.trim();
  let m = /^<\s*(\d+(?:\.\d+)?)$/.exec(t);
  if (m) return { refHigh: Number(m[1]) };
  m = /^>\s*(\d+(?:\.\d+)?)$/.exec(t);
  if (m) return { refLow: Number(m[1]) };
  m = /^(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)$/i.exec(t);
  if (m) {
    const lo = Number(m[1]);
    const hi = Number(m[2]);
    return lo <= hi ? { refLow: lo, refHigh: hi } : { refLow: hi, refHigh: lo };
  }
  return {};
}

/** Unit match ignoring case/space/µ-vs-u differences ("gm/dl" == "g/dl"). */
function unitLooksLike(a: string, b: string): boolean {
  const norm = (u: string) =>
    u
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/µ|μ/g, 'u')
      .replace(/gm\//g, 'g/');
  return norm(a) === norm(b) && norm(a).length > 0;
}

/** Name variants for exact matching, most-specific first:
 * full -> parentheticals stripped -> before a comma -> leading row numbering
 * stripped. Real labs print "HbA1c (Glycosylated Haemoglobin)" and
 * "1  HbA1c"; the stripped forms hit the exact alias table. */
function nameVariants(name: string): string[] {
  const noParens = name.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
  const beforeComma = noParens.split(',')[0].trim();
  const noNumbering = noParens.replace(/^\d+\s*[.)::]?\s*/, '').trim();
  const out: string[] = [];
  for (const v of [name, noParens, beforeComma, noNumbering]) {
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

function mapName(name: string, unit: string): { key: string; def: LabTestDef; confidence: number } | null {
  for (const variant of nameVariants(name)) {
    const exact = labKeyForAlias(variant);
    if (exact) {
      const def = LAB_TEST_MAP[exact];
      const unitOk = !unit || !def.unit || unitLooksLike(unit, def.unit);
      return { key: exact, def, confidence: unitOk ? 1 : 0.9 };
    }
  }
  // Ratio/index lines ("APO B / APO A1 RATIO 0.9") only ever auto-map via an
  // exact alias above; containment must not turn them into a component test.
  if (/\bratio\b|\bindex\b/i.test(name)) return null;
  const candidates = labKeysContaining(name);
  if (candidates.length > 0) {
    const def = LAB_TEST_MAP[candidates[0]];
    const unitOk = !unit || !def.unit || unitLooksLike(unit, def.unit);
    // Containment + unit disagreement is NOT a trustworthy auto-match: a CBC
    // "HEMOGLOBIN ... g/dL" row must not silently become hba1c (unit %).
    // It still reaches the review screen as a manual row with a suggestion.
    if (unitOk) return { key: candidates[0], def, confidence: 0.7 };
    return null;
  }
  return null;
}

/** Parse ONE prose line into {name, value, unit, range} or null. */
function parseLine(line: string): { name: string; value: number; unit: string; range: { refLow?: number; refHigh?: number } } | null {
  // Strip trailing page numbers and repeated separators.
  let s = line.replace(/\s+/g, ' ').trim();
  if (!s || s.length < 4) return null;
  s = s.replace(/[|;]+/g, ' ').trim();

  const tokens = tokenize(s);
  if (tokens.length < 2) return null;

  // The value: first numeric token followed by a unit token, else a numeric
  // token followed by a range-looking tail, else the LAST numeric token.
  let valueIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (!isNumericToken(tokens[i])) continue;
    const next = tokens[i + 1] ?? '';
    const afterNext = tokens.slice(i + 1).join(' ');
    if (UNIT_RE.test(next)) {
      valueIdx = i;
      break;
    }
    if (parseRange(afterNext).refLow != null || parseRange(afterNext).refHigh != null) {
      valueIdx = i;
      break;
    }
  }
  if (valueIdx < 0) {
    // last standalone numeric token (value with no unit and no range)
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (isNumericToken(tokens[i]) && i > 0 && !looksLikeYear(tokens[i])) {
        valueIdx = i;
        break;
      }
    }
  }
  if (valueIdx < 1) return null; // a value with no name is not a test row

  const value = num(tokens[valueIdx]);
  if (!Number.isFinite(value) || value <= 0) return null;

  const name = tokens.slice(0, valueIdx).join(' ').replace(/\s*[:,]\s*$/, '').trim();
  if (!name || !/[a-z]/i.test(name)) return null; // needs letters to be a test name

  let unit = '';
  let cursor = valueIdx + 1;
  if (UNIT_RE.test(tokens[cursor] ?? '')) {
    unit = tokens[cursor];
    cursor++;
  }
  const rangeText = tokens.slice(cursor).join(' ');
  const range = parseRange(rangeText);
  if (range.refLow == null && range.refHigh == null) {
    // Range may be glued like "70-100" as one token possibly after a flag.
    const glued = /(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/.exec(rangeText);
    if (glued) {
      const lo = Number(glued[1]);
      const hi = Number(glued[2]);
      range.refLow = Math.min(lo, hi);
      range.refHigh = Math.max(lo, hi);
    } else {
      const lt = /<\s*(\d+(?:\.\d+)?)/.exec(rangeText);
      if (lt) range.refHigh = Number(lt[1]);
    }
  }
  return { name, value, unit, range };
}

function looksLikeHeaderOrMeta(line: string): boolean {
  const low = line.toLowerCase();
  // Address/pincode tails like "Hyderabad -500 044" (Indian 6-digit pincodes
  // printed as two 3-digit groups after a dash) are never test rows.
  if (/-\s?\d{3}\s+\d{3}\s*$/.test(line)) return true;
  if (!/\d/.test(line) && !/[:]/.test(line)) {
    // Pure prose without digits - only skip if it matches known header words.
    return HEADER_HINTS.some((h) => low.includes(h.trim())) || low.length < 3;
  }
  return HEADER_HINTS.some((h) => low.includes(h.trim()));
}

// ---------- CSV / TSV ----------

function detectDelimiter(lines: string[]): ',' | '\t' | null {
  const commas = lines.filter((l) => (l.match(/,/g) ?? []).length >= 2).length;
  const tabs = lines.filter((l) => (l.match(/\t/g) ?? []).length >= 2).length;
  if (tabs > commas) return '\t';
  if (commas > 0) return ',';
  return null;
}

function splitRow(line: string, delim: ',' | '\t'): string[] {
  // Minimal CSV cell split (quotes stripped; no full RFC parser needed for
  // lab exports, which never embed separators inside quotes).
  return line.split(delim).map((c) => c.replace(/^"|"$/g, '').trim());
}

function parseCsv(text: string): LabParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const delim = detectDelimiter(lines) ?? ',';
  const rows = lines.map((l) => splitRow(l, delim)).filter((r) => r.some((c) => c));

  // Header scan over the first few rows (lab exports prepend a company line):
  // a header row carries >= 2 known header words as cell substrings.
  let headerIdx = -1;
  for (let i = 0; i < Math.min(3, rows.length); i++) {
    const hits = rows[i].filter((c) => {
      const low = c.toLowerCase().replace(/[^a-z ]/g, '').trim();
      return HEADER_HINTS.some((h) => h.trim() && low.includes(h.trim()));
    }).length;
    if (hits >= 2) {
      headerIdx = i;
      break;
    }
  }
  const headerLow = headerIdx >= 0 ? rows[headerIdx].map((c) => c.toLowerCase()) : [];
  const body = headerIdx >= 0 ? rows.slice(headerIdx + 1) : rows;

  // Column resolution: explicit header labels when present; else infer from
  // body shapes - the name column is the first mostly-text column, the value
  // column the first mostly-numeric one after it.
  let nameCol = headerIdx >= 0 ? headerLow.findIndex((c) => /test|parameter|investigation|analyte|^name/.test(c)) : -1;
  let valueCol = headerIdx >= 0 ? headerLow.findIndex((c) => /result|value|observed|measured/.test(c)) : -1;
  let unitCol = headerIdx >= 0 ? headerLow.findIndex((c) => /^unit/i.test(c) && !/reference|ref/.test(c)) : -1;
  let rangeCol = headerIdx >= 0 ? headerLow.findIndex((c) => /reference|ref|range|interval|normal/.test(c)) : -1;

  if (nameCol < 0 || valueCol < 0) {
    const colCount = Math.max(...body.map((r) => r.length), 1);
    const numericRatio = (col: number) => {
      let n = 0;
      let tot = 0;
      for (const r of body) {
        if (col >= r.length) continue;
        tot++;
        if (isNumericToken(r[col])) n++;
      }
      return tot === 0 ? 0 : n / tot;
    };
    if (nameCol < 0) {
      for (let c = 0; c < colCount; c++) {
        if (numericRatio(c) < 0.5 && body.some((r) => /[a-z]/i.test(r[c] ?? ''))) {
          nameCol = c;
          break;
        }
      }
    }
    if (valueCol < 0) {
      for (let c = (nameCol >= 0 ? nameCol : 0) + 1; c < colCount; c++) {
        if (numericRatio(c) >= 0.5) {
          valueCol = c;
          break;
        }
      }
    }
  }
  if (nameCol < 0) nameCol = 0;

  const matches: LabParseMatch[] = [];
  const unmatched: LabUnmatchedLine[] = [];
  const seenKeys = new Set<string>();
  for (const cells of body) {
    if (cells.length < 2) continue;
    const name = cells[nameCol] ?? '';
    if (!name) continue;

    // Value cell: the configured column, else the first cell that is numeric.
    let value = NaN;
    let vIdx = -1;
    if (valueCol >= 0 && valueCol < cells.length) {
      const v = num(cells[valueCol].replace(/[^0-9.,]/g, ''));
      if (Number.isFinite(v) && v > 0) {
        value = v;
        vIdx = valueCol;
      }
    }
    if (vIdx < 0) {
      for (let i = (nameCol >= 0 ? nameCol : 0) + 1; i < cells.length; i++) {
        const clean = cells[i].replace(/[^0-9.,]/g, '');
        if (clean && isNumericToken(clean) && num(clean) > 0) {
          value = num(clean);
          vIdx = i;
          break;
        }
      }
    }
    if (vIdx < 0 || !Number.isFinite(value)) continue;

    let unit = '';
    for (let i = 1; i < cells.length; i++) {
      if (i === vIdx || i === nameCol) continue;
      if (UNIT_RE.test(cells[i])) {
        unit = cells[i];
        break;
      }
    }
    let range: { refLow?: number; refHigh?: number } = {};
    if (rangeCol >= 0 && rangeCol < cells.length && rangeCol !== vIdx) {
      range = parseRange(cells[rangeCol]);
    }
    if (range.refLow == null && range.refHigh == null) {
      for (let i = 1; i < cells.length; i++) {
        if (i === vIdx || i === nameCol || i === unitCol) continue;
        const r = parseRange(cells[i]);
        if (r.refLow != null || r.refHigh != null) {
          range = r;
          break;
        }
      }
    }

    const line = cells.join(delim === '\t' ? ' | ' : ', ');
    const mapped = mapName(name, unit);
    if (mapped) {
      if (seenKeys.has(mapped.key)) continue; // first occurrence wins
      seenKeys.add(mapped.key);
      matches.push({
        testKey: mapped.key,
        label: mapped.def.label,
        asPrinted: name,
        value,
        unit,
        ...(range.refLow != null ? { refLow: range.refLow } : {}),
        ...(range.refHigh != null ? { refHigh: range.refHigh } : {}),
        confidence: mapped.confidence,
        line,
      });
    } else {
      unmatched.push({ line, name, value, unit, suggestions: labKeysContaining(name).slice(0, 4) });
    }
  }

  const meta = scanMeta(lines.filter((l) => !l.includes(delim)));
  return { matches, unmatched, ...meta, format: 'csv' };
}

// ---------- Entry point ----------

export function parseLabReportText(text: string): LabParseResult {
  if (!text || !text.trim()) {
    return { matches: [], unmatched: [], format: 'text' };
  }
  const capped = text.slice(0, 200_000);

  // CSV/TSV when most non-empty lines carry consistent separators.
  const lines = capped.split(/\r?\n/).filter((l) => l.trim());
  const delim = detectDelimiter(lines);
  const delimLines = lines.filter((l) => delim && l.includes(delim)).length;
  if (delim && delimLines >= Math.max(2, Math.floor(lines.length * 0.6))) {
    return parseCsv(capped);
  }

  const matches: LabParseMatch[] = [];
  const unmatched: LabUnmatchedLine[] = [];
  const seenKeys = new Set<string>();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || looksLikeHeaderOrMeta(line)) continue;
    const parsed = parseLine(line);
    if (!parsed) continue;

    const mapped = mapName(parsed.name, parsed.unit);
    if (mapped) {
      if (seenKeys.has(mapped.key)) continue; // first occurrence wins
      seenKeys.add(mapped.key);
      matches.push({
        testKey: mapped.key,
        label: mapped.def.label,
        asPrinted: parsed.name,
        value: parsed.value,
        unit: parsed.unit,
        ...(parsed.range.refLow != null ? { refLow: parsed.range.refLow } : {}),
        ...(parsed.range.refHigh != null ? { refHigh: parsed.range.refHigh } : {}),
        confidence: mapped.confidence,
        line,
      });
    } else {
      unmatched.push({
        line,
        name: parsed.name,
        value: parsed.value,
        unit: parsed.unit,
        suggestions: labKeysContaining(parsed.name).slice(0, 4),
      });
    }
  }

  const meta = scanMeta(lines);
  return { matches, unmatched, ...meta, format: 'text' };
}
