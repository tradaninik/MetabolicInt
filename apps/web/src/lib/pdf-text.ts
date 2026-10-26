// P7-A — server-only PDF text extraction, zero dependencies beyond node:zlib.
//
// Why: users upload real lab PDFs (Thyrocare / Metropolis / Dr Lal - most are
// digitally generated and carry a full text layer). Decoding the raw file as
// UTF-8 produced mojibake; this module extracts the text layer properly so
// "Import from report" accepts the PDF itself. It is deliberately NOT in
// packages/engine (the engine is bundled to the browser and must stay pure).
//
// What it does, best-effort and fully deterministic:
//   1. parse the indirect-object table (PDF 1.4-style plain objects),
//   2. walk pages -> /Resources /Font -> /ToUnicode CMaps -> font decoders,
//   3. interpret each page's content stream (BT/Tf/Tm/Td/TD/T*/*/'/"/Tj/TJ,
//      q/Q/cm), decode strings through the font's CMap (1-byte subset fonts)
//      or WinAnsi/cp1252 when no CMap exists,
//   4. rebuild visual lines by grouping runs on the same baseline (so table
//      columns reflow into "NAME ... VALUE ... UNIT" rows the engine parser
//      already understands),
//   5. fall back to scanning every stream (xref-stream PDFs) with a global
//      CMap pool when the object graph yields nothing.
//
// Scans/photos have no text layer - the caller gets a plain-language error.

import { inflateRawSync, inflateSync } from 'node:zlib';

export type PdfTextResult = { text: string; pages: number } | { error: string };

const MAX_PDF_BYTES = 8 * 1024 * 1024; // 8 MB
const NOT_A_PDF =
  'That file does not look like a PDF (the PDF header is missing). Save the report as a PDF and try again.';
const NO_TEXT_LAYER =
  'This PDF has no readable text layer (it may be a scan or photo). Open it, copy the text, and paste it instead - or store the file in the Documents vault.';

// ---------- WinAnsi / cp1252 (fonts without a ToUnicode CMap) ----------

const CP1252_HIGH: Record<number, string> = {
  0x80: '\u20AC', 0x82: '\u201A', 0x83: '\u0192', 0x84: '\u201E', 0x85: '\u2026',
  0x86: '\u2020', 0x87: '\u2021', 0x88: '\u02C6', 0x89: '\u2030', 0x8A: '\u0160',
  0x8B: '\u2039', 0x8C: '\u0152', 0x8E: '\u017D', 0x91: '\u2018', 0x92: '\u2019',
  0x93: '\u201C', 0x94: '\u201D', 0x95: '\u2022', 0x96: '\u2013', 0x97: '\u2014',
  0x98: '\u02DC', 0x99: '\u2122', 0x9A: '\u0161', 0x9B: '\u203A', 0x9C: '\u0153',
  0x9E: '\u017E', 0x9F: '\u0178',
};

function decodeCp1252(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) {
    if (b >= 0x20 && b <= 0x7e) out += String.fromCharCode(b);
    else if (b === 0x0a || b === 0x0d || b === 0x09) out += ' ';
    else if (b >= 0xa0) out += String.fromCharCode(b);
    else if (CP1252_HIGH[b]) out += CP1252_HIGH[b];
  }
  return out;
}

// ---------- ToUnicode CMap parsing (1-byte simple subsets + 2-byte CID) ----------

interface CMapDecoder {
  codeLen: 1 | 2;
  map: Map<number, string>;
}

function utf16FromHex(hex: string): string {
  const clean = hex.replace(/[^0-9A-Fa-f]/g, '');
  if (clean.length % 2 !== 0) return '';
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) bytes.push(parseInt(clean.slice(i, i + 2), 16));
  let out = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
  return out;
}

function parseCMap(text: string): CMapDecoder | null {
  if (!/beginbf(char|range)/.test(text)) return null;
  const map = new Map<number, string>();
  let codeLen = 0;
  const cs = /begincodespacerange\s*<([0-9A-Fa-f]+)>/.exec(text);
  if (cs) codeLen = Math.min(2, Math.max(1, Math.floor(cs[1].length / 2)));

  const hexPair = /<([0-9A-Fa-f]{1,8})>\s*<([0-9A-Fa-f]+)>/g; // <src> <dst>
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of block[1].matchAll(hexPair)) {
      if (!codeLen) codeLen = Math.min(2, Math.max(1, m[1].length / 2));
      const code = parseInt(m[1], 16);
      if (Number.isFinite(code) && code <= 0xffff) map.set(code, utf16FromHex(m[2]));
    }
  }
  const rangeRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<[0-9A-Fa-f]+>|\[[^\]]*\])/g;
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of block[1].matchAll(rangeRe)) {
      if (!codeLen) codeLen = Math.min(2, Math.max(1, m[1].length / 2));
      const lo = parseInt(m[1], 16);
      const hi = parseInt(m[2], 16);
      if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo || hi - lo > 0xffff) continue;
      if (m[3].startsWith('[')) {
        const dsts = [...m[3].matchAll(/<([0-9A-Fa-f]+)>/g)];
        for (let i = 0; i <= hi - lo && i < dsts.length; i++) map.set(lo + i, utf16FromHex(dsts[i][1]));
      } else {
        const startHex = m[3].slice(1, -1);
        for (let i = 0; i <= hi - lo; i++) {
          if (startHex.length <= 4) {
            map.set(lo + i, utf16FromHex((parseInt(startHex || '0', 16) + i).toString(16).padStart(4, '0')));
          } else {
            // UTF-16 sequence start: increment the last unit
            const head = startHex.slice(0, -4);
            const tail = parseInt(startHex.slice(-4), 16);
            map.set(lo + i, utf16FromHex(head + (tail + i).toString(16).padStart(4, '0')));
          }
        }
      }
    }
  }
  if (map.size === 0 || !codeLen) return null;
  return { codeLen: codeLen === 2 ? 2 : 1, map };
}

function decodeWithCMap(bytes: Uint8Array, cmap: CMapDecoder): string {
  let out = '';
  if (cmap.codeLen === 2) {
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      out += cmap.map.get((bytes[i] << 8) | bytes[i + 1]) ?? '\uFFFD';
    }
  } else {
    for (let i = 0; i < bytes.length; i++) out += cmap.map.get(bytes[i]) ?? '\uFFFD';
  }
  return out;
}

type FontDecoder = (bytes: Uint8Array, fontName: string) => string;

const cp1252Decoder: FontDecoder = decodeCp1252;

// ---------- Content-stream interpreter ----------

interface TextRun {
  x: number;
  y: number;
  size: number;
  text: string;
  order: number;
}

type Matrix = [number, number, number, number, number, number]; // a b c d e f

function mul(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ];
}

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

type Token =
  | { t: 'num'; v: number }
  | { t: 'str'; b: Uint8Array }
  | { t: 'name'; s: string }
  | { t: 'arr'; items: Token[] }
  | { t: 'mark' };

/** Tokenize a content stream (latin1 keeps bytes 1:1). */
function* tokenize(s: string): Generator<Token | string> {
  let i = 0;
  const n = s.length;
  while (i < n) {
    const c = s[i];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '\f' || c === '\0') { i++; continue; }
    if (c === '%') { while (i < n && s[i] !== '\n' && s[i] !== '\r') i++; continue; }
    if (c === '(') {
      // Literal string: nested parens + backslash escapes (\n \r \t \b \f \( \) \\ \ddd).
      const out: number[] = [];
      let depth = 1;
      i++;
      while (i < n && depth > 0) {
        const ch = s[i];
        if (ch === '\\') {
          const e = s[i + 1];
          if (e === 'n') { out.push(10); i += 2; }
          else if (e === 'r') { out.push(13); i += 2; }
          else if (e === 't') { out.push(9); i += 2; }
          else if (e === 'b') { out.push(8); i += 2; }
          else if (e === 'f') { out.push(12); i += 2; }
          else if (e === '(') { out.push(40); i += 2; }
          else if (e === ')') { out.push(41); i += 2; }
          else if (e === '\\') { out.push(92); i += 2; }
          else if (e === '\n') { i += 2; } // line continuation
          else if (e === '\r') { i += (s[i + 2] === '\n' ? 3 : 2); }
          else if (e >= '0' && e <= '7') {
            let oct = '';
            let j = i + 1;
            while (j < n && oct.length < 3 && s[j] >= '0' && s[j] <= '7') { oct += s[j]; j++; }
            out.push(parseInt(oct, 8) & 0xff);
            i = j;
          } else { out.push(e.charCodeAt(0) & 0xff); i += 2; }
        } else if (ch === '(') { depth++; out.push(40); i++; }
        else if (ch === ')') { depth--; if (depth > 0) out.push(41); i++; }
        else { out.push(ch.charCodeAt(0) & 0xff); i++; }
      }
      yield { t: 'str', b: Uint8Array.from(out) };
      continue;
    }
    if (c === '<') {
      if (s[i + 1] === '<') { i += 2; continue; } // dict delimiter - not a string
      let hex = '';
      i++;
      while (i < n && s[i] !== '>') { if (/[0-9A-Fa-f]/.test(s[i])) hex += s[i]; i++; }
      i++; // consume '>'
      if (hex.length % 2 !== 0) hex += '0';
      const out: number[] = [];
      for (let k = 0; k < hex.length; k += 2) out.push(parseInt(hex.slice(k, k + 2), 16));
      yield { t: 'str', b: Uint8Array.from(out) };
      continue;
    }
    if (c === '>' || c === '{' || c === '}') { i++; continue; }
    if (c === '[') { yield { t: 'mark' }; i++; continue; }
    if (c === ']') { yield ']'; i++; continue; }
    if (c === '/') {
      let j = i + 1;
      while (j < n && !/[\s/\[\]<>(){}%]/.test(s[j])) j++;
      yield { t: 'name', s: s.slice(i + 1, j) };
      i = j;
      continue;
    }
    // keyword or number
    let j = i;
    while (j < n && !/[\s/\[\]<>(){}%]/.test(s[j])) j++;
    const word = s.slice(i, j);
    i = j;
    // Numeric operand -> num token. (Critical: a bare number yielded as a
    // keyword would be treated as an operator and WIPE the operand stack,
    // so "/F0 8.25 Tf" would never bind the font and Tm/Td would no-op.)
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) yield { t: 'num', v: parseFloat(word) };
    else yield word;
  }
}

/** Interpret one content stream; `decode` turns string bytes into text per font. */
function interpretContent(s: string, decode: (bytes: Uint8Array, fontName: string) => string): TextRun[] {
  const runs: TextRun[] = [];
  let textM: Matrix = IDENTITY;
  let lineM: Matrix = IDENTITY;
  let ctm: Matrix = IDENTITY;
  // q/Q save & restore the FULL graphics state, which per PDF 32000 §9.3.1
  // INCLUDES the text state (font, size, leading). Real-world reports rely on
  // this: an image/logo block wrapped in q ... /OtherFont Tf ... Tj ... Q is
  // followed by text that inherits the RESTORED font, not the inner one.
  interface GState { ctm: Matrix; fontName: string; fontSize: number; leading: number }
  const gsStack: GState[] = [];
  let fontName = '';
  let fontSize = 10;
  let leading = 0;
  let order = 0;
  let stack: Token[] = [];

  const show = (bytes: Uint8Array) => {
    const text = decode(bytes, fontName);
    if (!text) return;
    runs.push({
      x: ctm[0] * textM[4] + ctm[2] * textM[5] + ctm[4],
      y: ctm[1] * textM[4] + ctm[3] * textM[5] + ctm[5],
      size: Math.max(1, fontSize * (Math.abs(ctm[3]) || 1) * (Math.abs(textM[3]) || 1)),
      text,
      order: order++,
    });
    // Approximate advance so same-line ordering and gap detection work
    // without parsing /Widths arrays (0.5 em per char is close enough).
    textM = mul([1, 0, 0, 1, text.length * 0.5 * fontSize, 0], textM);
  };

  for (const tok of tokenize(s)) {
    if (tok === ']') {
      const items: Token[] = [];
      while (stack.length) {
        const t = stack.pop()!;
        if (t.t === 'mark') break;
        items.unshift(t);
      }
      stack.push({ t: 'arr', items });
      continue;
    }
    if (typeof tok !== 'string') { stack.push(tok); continue; }

    // tok is an operator keyword - dispatch with the pending operands.
    // NOTE: map to the numeric VALUES - Tm/Td/Tf/cm consume raw numbers.
    const nums = stack.filter((t): t is { t: 'num'; v: number } => t.t === 'num').map((t) => t.v);
    const lastStr = [...stack].reverse().find((t) => t.t === 'str') as { t: 'str'; b: Uint8Array } | undefined;
    switch (tok) {
      case 'BT': textM = IDENTITY; lineM = IDENTITY; break;
      case 'Tf': {
        const nameTok = [...stack].reverse().find((t) => t.t === 'name') as { t: 'name'; s: string } | undefined;
        if (nameTok) fontName = nameTok.s;
        const sz = nums.at(-1);
        if (sz != null && sz > 0) fontSize = sz;
        break;
      }
      case 'Tm': {
        if (nums.length >= 6) {
          textM = [nums.at(-6)!, nums.at(-5)!, nums.at(-4)!, nums.at(-3)!, nums.at(-2)!, nums.at(-1)!];
          lineM = [...textM] as Matrix;
        }
        break;
      }
      case 'Td':
      case 'TD': {
        if (nums.length >= 2) {
          const [tx, ty] = [nums.at(-2)!, nums.at(-1)!];
          if (tok === 'TD') leading = -ty;
          lineM = mul([1, 0, 0, 1, tx, ty], lineM);
          textM = [...lineM] as Matrix;
        }
        break;
      }
      case 'TL': { const v = nums.at(-1); if (v != null) leading = v; break; }
      case 'T*': lineM = mul([1, 0, 0, 1, 0, -leading], lineM); textM = [...lineM] as Matrix; break;
      case 'Tj': if (lastStr) show(lastStr.b); break;
      case "'": lineM = mul([1, 0, 0, 1, 0, -leading], lineM); textM = [...lineM] as Matrix; if (lastStr) show(lastStr.b); break;
      case '"': lineM = mul([1, 0, 0, 1, 0, -leading], lineM); textM = [...lineM] as Matrix; if (lastStr) show(lastStr.b); break;
      case 'TJ': {
        const arr = [...stack].reverse().find((t) => t.t === 'arr') as { t: 'arr'; items: Token[] } | undefined;
        if (arr) {
          for (const item of arr.items) {
            if (item.t === 'str') show(item.b);
            else if (item.t === 'num') textM = mul([1, 0, 0, 1, -(item.v / 1000) * fontSize, 0], textM);
          }
        }
        break;
      }
      case 'cm': {
        if (nums.length >= 6) {
          ctm = mul([nums.at(-6)!, nums.at(-5)!, nums.at(-4)!, nums.at(-3)!, nums.at(-2)!, nums.at(-1)!], ctm);
        }
        break;
      }
      case 'q':
        gsStack.push({ ctm: [...ctm] as Matrix, fontName, fontSize, leading });
        break;
      case 'Q': {
        const gs = gsStack.pop();
        if (gs) {
          ctm = gs.ctm;
          fontName = gs.fontName;
          fontSize = gs.fontSize;
          leading = gs.leading;
        }
        break;
      }
      default: break; // painting / spacing / gs ops: irrelevant to text
    }
    stack = [];
  }
  return runs;
}

/** Group runs into visual lines: bucket by baseline y, order by x within a line. */
function runsToLines(runs: TextRun[]): string {
  if (runs.length === 0) return '';
  const sorted = [...runs].sort((a, b) => b.y - a.y || a.order - b.order);
  const buckets: TextRun[][] = [];
  let cur: TextRun[] = [sorted[0]];
  let curY = sorted[0].y;
  for (let i = 1; i < sorted.length; i++) {
    const r = sorted[i];
    if (Math.abs(r.y - curY) <= 2.5) cur.push(r);
    else { buckets.push(cur); cur = [r]; curY = r.y; }
  }
  buckets.push(cur);

  const lines: string[] = [];
  for (const bucket of buckets) {
    bucket.sort((a, b) => a.x - b.x || a.order - b.order);
    let line = '';
    let prevEnd = -Infinity;
    for (const r of bucket) {
      // Space when the run starts clearly right of the previous run's end
      // (a column gap), or clearly LEFT of it (a different cell / real
      // overlap). Tiny overlaps (~kerning correction after our 0.5 em width
      // estimate) must NOT split words like "Vidyanagar" -> "Vidy anagar".
      const isColumnGap = r.x - prevEnd > 0.2 * r.size;
      const isNewCell = r.x < prevEnd - 0.5 * r.size;
      if (line !== '' && (isColumnGap || isNewCell)) line += ' ';
      line += r.text;
      prevEnd = r.x + r.text.length * 0.5 * r.size;
    }
    const collapsed = line.replace(/\s+/g, ' ').trim();
    if (collapsed) lines.push(collapsed);
  }
  return lines.join('\n');
}

// ---------- Object graph (PDF 1.4-style plain objects) ----------

interface PdfObject {
  num: number;
  bodyStart: number;
  bodyEnd: number;
}

function parseObjects(latin: string): Map<number, PdfObject> {
  const objs = new Map<number, PdfObject>();
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(latin))) {
    if (m.index < cursor) continue; // match inside a previous object's stream
    const end = latin.indexOf('endobj', m.index);
    if (end < 0) break;
    const num = Number(m[1]);
    if (!objs.has(num)) objs.set(num, { num, bodyStart: m.index + m[0].length, bodyEnd: end });
    cursor = end + 6;
  }
  return objs;
}

/** Extract the stream bytes of an object, or null when it has none. */
function objectStream(buf: Buffer, latin: string, obj: PdfObject): Buffer | null {
  const body = latin.slice(obj.bodyStart, obj.bodyEnd);
  const kw = /\bstream\b/.exec(body);
  if (!kw) return null;
  const kwStart = obj.bodyStart + kw.index;
  let dataStart = kwStart + 6;
  const b = buf[dataStart];
  if (b === 0x0d) dataStart++;
  if (buf[dataStart] === 0x0a) dataStart++;
  const dataEnd = buf.indexOf('endstream', dataStart, 'latin1');
  if (dataEnd < 0) return null;
  return buf.slice(dataStart, dataEnd);
}

function inflateStream(raw: Buffer): Buffer | null {
  const attempts = [raw, raw.length && raw[raw.length - 1] === 0x0a ? raw.slice(0, -1) : raw];
  for (const chunk of attempts) {
    try { return inflateSync(chunk); } catch { /* try next */ }
    try { return inflateRawSync(chunk); } catch { /* try next */ }
  }
  // Uncompressed content/CMap streams are legal - accept recognizable text.
  const head = raw.slice(0, 4096).toString('latin1');
  if (/BT[\s\S]{0,400}(Tj|TJ)/.test(head) || head.includes('/CIDInit') || head.includes('begincmap')) return raw;
  return null;
}

function readBalancedDict(s: string, start: number): string {
  // start points at '<<'
  let depth = 0;
  for (let i = start; i < s.length - 1; i++) {
    if (s[i] === '<' && s[i + 1] === '<') { depth++; i++; }
    else if (s[i] === '>' && s[i + 1] === '>') { depth--; i++; if (depth === 0) return s.slice(start, i + 1); }
  }
  return s.slice(start);
}

function refAfter(latin: string, key: string): number | null {
  const m = new RegExp(key.replace(/[/\\]/g, '\\$&') + '\\s+(\\d+)\\s+0\\s+R').exec(latin);
  return m ? Number(m[1]) : null;
}

// ---------- Page collection ----------

function pageOrder(latin: string, objs: Map<number, PdfObject>): number[] {
  // Prefer the page tree: the /Type/Pages object with the largest /Count.
  let root: { kids: number[]; count: number } | null = null;
  for (const obj of objs.values()) {
    const body = latin.slice(obj.bodyStart, obj.bodyEnd);
    if (!/\/Type\s*\/Pages\b/.test(body)) continue;
    const count = Number(/\/Count\s+(\d+)/.exec(body)?.[1] ?? 0);
    if (!root || count > root.count) {
      const kids = [...body.matchAll(/\/Kids\s*\[([^\]]*)\]/g)]
        .flatMap((k) => [...k[1].matchAll(/(\d+)\s+0\s+R/g)].map((r) => Number(r[1])));
      if (kids.length) root = { kids, count };
    }
  }
  const flatten = (ids: number[], depth = 0): number[] => {
    if (depth > 8) return [];
    const out: number[] = [];
    for (const id of ids) {
      const obj = objs.get(id);
      if (!obj) continue;
      const body = latin.slice(obj.bodyStart, obj.bodyEnd);
      if (/\/Type\s*\/Pages\b/.test(body)) {
        const kids = [...body.matchAll(/\/Kids\s*\[([^\]]*)\]/g)]
          .flatMap((k) => [...k[1].matchAll(/(\d+)\s+0\s+R/g)].map((r) => Number(r[1])));
        out.push(...flatten(kids, depth + 1));
      } else if (/\/Type\s*\/Page\b/.test(body)) out.push(id);
    }
    return out;
  };
  if (root) {
    const order = flatten(root.kids);
    if (order.length) return order;
  }
  return [...objs.values()]
    .filter((o) => /\/Type\s*\/Page\b/.test(latin.slice(o.bodyStart, o.bodyEnd)) && !/\/Type\s*\/Pages\b/.test(latin.slice(o.bodyStart, o.bodyEnd)))
    .map((o) => o.num)
    .sort((a, b) => a - b);
}

// ---------- Main entry ----------

export function extractPdfText(buf: Buffer): PdfTextResult {
  if (!buf || buf.length === 0) return { error: NOT_A_PDF };
  if (buf.length > MAX_PDF_BYTES) {
    return { error: 'That PDF is over 8 MB. Please upload a smaller export of the same report.' };
  }
  const headerIdx = buf.indexOf('%PDF', 0, 'latin1');
  if (headerIdx < 0 || headerIdx > 1024) return { error: NOT_A_PDF };

  const latin = buf.toString('latin1');
  const objs = parseObjects(latin);
  const cmapCache = new Map<number, CMapDecoder | null>();

  const cmapForObject = (objNum: number): CMapDecoder | null => {
    if (cmapCache.has(objNum)) return cmapCache.get(objNum) ?? null;
    let out: CMapDecoder | null = null;
    const obj = objs.get(objNum);
    if (obj) {
      const raw = objectStream(buf, latin, obj);
      if (raw) {
        const data = inflateStream(raw);
        if (data) out = parseCMap(data.toString('latin1'));
      }
    }
    cmapCache.set(objNum, out);
    return out;
  };

  let text = '';
  let pages = 0;

  // --- Primary path: page tree with per-page font binding. ---
  const order = pageOrder(latin, objs);
  if (order.length > 0) {
    const pageTexts: string[] = [];
    for (const pageId of order) {
      const obj = objs.get(pageId)!;
      const body = latin.slice(obj.bodyStart, obj.bodyEnd);

      // Font name -> decoder for THIS page.
      const decoders = new Map<string, FontDecoder>();
      const resIdx = body.indexOf('/Resources');
      if (resIdx >= 0) {
        let resDict = '';
        // Inline dict may have any whitespace between the key and '<<'
        // ("/Resources << ..." is just as legal as "/Resources<< ...").
        const resInline = /^\s*<</.test(body.slice(resIdx + 10));
        if (resInline) resDict = readBalancedDict(body, body.indexOf('<<', resIdx));
        else {
          const resRef = refAfter(body, '/Resources');
          const resObj = resRef != null ? objs.get(resRef) : undefined;
          resDict = resObj ? latin.slice(resObj.bodyStart, resObj.bodyEnd) : '';
        }
        const fontIdx = resDict.indexOf('/Font');
        if (fontIdx >= 0) {
          let fontDict = '';
          if (/^\s*<</.test(resDict.slice(fontIdx + 5))) fontDict = readBalancedDict(resDict, resDict.indexOf('<<', fontIdx));
          else {
            const fontRef = refAfter(resDict, '/Font');
            const fontObj = fontRef != null ? objs.get(fontRef) : undefined;
            fontDict = fontObj ? latin.slice(fontObj.bodyStart, fontObj.bodyEnd) : '';
          }
          for (const fm of fontDict.matchAll(/\/(\w+)\s+(\d+)\s+0\s+R/g)) {
            const fontObjNum = Number(fm[2]);
            const fontObj = objs.get(fontObjNum);
            const toUnicode = fontObj
              ? Number(/\/ToUnicode\s+(\d+)\s+0\s+R/.exec(latin.slice(fontObj.bodyStart, fontObj.bodyEnd))?.[1] ?? NaN)
              : NaN;
            const cmap = Number.isFinite(toUnicode) ? cmapForObject(toUnicode) : null;
            decoders.set(fm[1], cmap ? (b: Uint8Array) => decodeWithCMap(b, cmap) : cp1252Decoder);
          }
        }
      }
      const decode: FontDecoder = (bytes, name) => (decoders.get(name) ?? cp1252Decoder)(bytes, name);

      // Contents: one ref or an array of refs.
      const contentIds: number[] = [];
      const arr = /\/Contents\s*\[([^\]]*)\]/.exec(body);
      if (arr) for (const r of arr[1].matchAll(/(\d+)\s+0\s+R/g)) contentIds.push(Number(r[1]));
      else {
        const single = refAfter(body, '/Contents');
        if (single != null) contentIds.push(single);
      }

      const runs: TextRun[] = [];
      for (const cid of contentIds) {
        const cobj = objs.get(cid);
        if (!cobj) continue;
        const raw = objectStream(buf, latin, cobj);
        if (!raw) continue;
        const data = inflateStream(raw);
        if (!data) continue;
        runs.push(...interpretContent(data.toString('latin1'), decode));
      }
      pageTexts.push(runsToLines(runs));
    }
    text = pageTexts.filter(Boolean).join('\n');
    pages = order.length;
  }

  // --- Fallback: scan every stream (xref-stream PDFs, no page objects). ---
  const alnum = (text.match(/[A-Za-z0-9]/g) ?? []).length;
  if (alnum < 80) {
    const pool: CMapDecoder[] = [];
    const contentChunks: Buffer[] = [];
    let pos = 0;
    while (pos < latin.length) {
      const s = latin.indexOf('stream', pos);
      if (s < 0) break;
      let dataStart = s + 6;
      if (buf[dataStart] === 0x0d) dataStart++;
      if (buf[dataStart] === 0x0a) dataStart++;
      const dataEnd = buf.indexOf('endstream', dataStart, 'latin1');
      if (dataEnd < 0) break;
      pos = dataEnd + 9;
      if (dataEnd - dataStart > 4_000_000) continue;
      const raw = buf.slice(dataStart, dataEnd);
      let data: Buffer | null = null;
      try { data = inflateSync(raw); } catch { try { data = inflateRawSync(raw); } catch { data = null; } }
      if (!data) continue;
      const str = data.toString('latin1');
      if (str.includes('beginbfchar') || str.includes('beginbfrange')) {
        const cmap = parseCMap(str);
        if (cmap) pool.push(cmap);
      } else if (data.byteLength < 2_000_000 && /BT/.test(str.slice(0, 4000)) && /\b(Tj|TJ)\b/.test(str.slice(0, 8000))) {
        contentChunks.push(data);
      }
    }

    if (contentChunks.length > 0) {
      const bestDecode: FontDecoder = (bytes) => {
        let best = decodeCp1252(bytes);
        if (pool.length === 0) return best;
        let bestScore = scoreText(best);
        for (const cmap of pool) {
          const t = decodeWithCMap(bytes, cmap);
          const sc = scoreText(t);
          if (sc > bestScore) { bestScore = sc; best = t; }
        }
        return best;
      };
      const parts: string[] = [];
      for (const chunk of contentChunks) parts.push(runsToLines(interpretContent(chunk.toString('latin1'), bestDecode)));
      const fallbackText = parts.filter(Boolean).join('\n');
      if ((fallbackText.match(/[A-Za-z0-9]/g) ?? []).length > alnum) {
        text = fallbackText;
        pages = Math.max(pages, contentChunks.length);
      }
    }
  }

  // --- Quality gate: scans and photos have no usable text layer. The bar is
  // low (80 alphanumeric chars) so short real documents - a 1-page
  // prescription, a single-panel report - still extract, while a scan (0
  // text ops) or an image-only PDF is rejected with a plain-language error. ---
  const finalAlnum = (text.match(/[A-Za-z0-9]/g) ?? []).length;
  if (finalAlnum < 80) return { error: NO_TEXT_LAYER };
  const fffd = (text.match(/\uFFFD/g) ?? []).length;
  if (fffd / Math.max(1, text.length) > 0.1) return { error: NO_TEXT_LAYER };

  return { text, pages: Math.max(1, pages) };
}

function scoreText(s: string): number {
  if (!s) return -1;
  let printable = 0;
  let alnumScore = 0;
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if ((c >= 0x20 && c <= 0x7e) || c >= 0xa0) printable++;
    if (/[A-Za-z0-9 ]/.test(ch)) alnumScore++;
  }
  return printable / s.length + (2 * alnumScore) / s.length;
}
