// P7-A — unit tests for the server-only PDF text extractor (pdf-text.ts).
//
// A tiny synthetic PDF is built in-test with zlib.deflateSync (one FlateDecode
// content stream per page) covering Tj / TJ / ' / hex strings / PDF string
// escapes / line-positioning ops, plus a subset font page decoded through its
// ToUnicode CMap (1-byte) and a 2-byte CID-style map. The real user report
// (Thyrocare Aarogyam C) is a smoke test when the file is present - the whole
// point of this workstream: uploaded PDFs must extract cleanly instead of
// turning into mojibake.
import { beforeAll, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { extractPdfText } from '../pdf-text';
import { parseLabReportText } from '@mi/engine';

// ---------- synthetic PDF builder (xref not needed: objects are scanned) ----------

function buildPdf(objects: Map<number, string | Buffer>): Buffer {
  const parts: string[] = ['%PDF-1.4\n'];
  for (const [num, body] of [...objects.entries()].sort((a, b) => a[0] - b[0])) {
    parts.push(`${num} 0 obj\n`);
    if (typeof body === 'string') parts.push(`${body}\n`);
    else parts.push(body.toString('latin1'));
    parts.push('\nendobj\n');
  }
  parts.push('trailer\n<< /Size 100 /Root 1 0 R >>\nstartxref\n9\n%%EOF\n');
  return Buffer.from(parts.join(''), 'latin1');
}

/** Wrap content bytes in a FlateDecode stream object body. */
function flateStream(content: string, extra = ''): Buffer {
  const data = deflateSync(Buffer.from(content, 'latin1'));
  return Buffer.from(`<< /Length ${data.length} /Filter /FlateDecode ${extra} >>\nstream\n`, 'latin1')
    .toString('latin1') === ''
    ? Buffer.alloc(0)
    : Buffer.concat([
        Buffer.from(`<< /Length ${data.length} /Filter /FlateDecode ${extra} >>\nstream\n`, 'latin1'),
        data,
        Buffer.from('\nendstream', 'latin1'),
      ]);
}

const FONT_PLAIN = '<< /Type /Font /Subtype /TrueType /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';

// ToUnicode CMap: 1-byte subset codes (!"#$%& → THYRO C) + space.
const CMAP_1BYTE = `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
1 begincodespacerange
<20> <26>
endcodespacerange
7 beginbfchar
<20> <0020>
<21> <0054>
<22> <0048>
<23> <0059>
<24> <0052>
<25> <004f>
<26> <0043>
endbfchar
endcmap`;

// ToUnicode CMap: 2-byte (CID-style) codes.
const CMAP_2BYTE = `/CIDInit /ProcSet findresource begin
12 dict begin
begincodespacerange
<0000> <ffff>
endcodespacerange
2 beginbfchar
<4849> <0048 0049>
<4441> <0044 0041>
endbfchar
endcmap`;

const PAGE1_CONTENT = `BT
/F1 10 Tf
1 0 0 1 50 750 Tm
(HbA1c 6.8 % 4.3 - 5.7) Tj
0 -14 Td
(Fasting Blood Sugar \\(FBS\\) 112 mg/dL 70-100) Tj
0 -14 Td
(Escapes: \\( \\) \\\\ \\101 \\42 done) Tj
0 -14 Td
<48 65 78> Tj
0 -14 Td
[(Ker) 24 (ning) -12 ( test)] TJ
0 -14 Td
(postprandial line) '
ET
BT
/F1 9 Tf
1 0 0 1 50 650 Tm
(NAME) Tj
ET
BT
/F1 9 Tf
1 0 0 1 300 650 Tm
(Lakshmi) Tj
ET`;

const PAGE2_CONTENT = `BT
/F2 10 Tf
1 0 0 1 50 700 Tm
( !"#\$%&) Tj
0 -14 Td
/F3 10 Tf
<4849 4441> Tj
ET`;

function syntheticPdf(): Buffer {
  return buildPdf(
    new Map<number, string | Buffer>([
      [1, '<< /Type /Catalog /Pages 2 0 R >>'],
      [2, '<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>'],
      [
        3,
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
      ],
      [4, flateStream(PAGE1_CONTENT)],
      [5, FONT_PLAIN],
      [
        6,
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 7 0 R /Resources << /Font << /F2 8 0 R /F3 8 0 R >> >> >>',
      ],
      [7, flateStream(PAGE2_CONTENT)],
      [8, '<< /Type /Font /Subtype /TrueType /BaseFont /Subset+Test /ToUnicode 9 0 R >>'],
      [9, flateStream(CMAP_1BYTE)],
      [10, flateStream(CMAP_2BYTE)],
    ]),
  );
}

// Page 2 needs TWO different ToUnicode maps (F2 = 1-byte, F3 = 2-byte), so give
// F3 its own font object pointing at the 2-byte CMap.
function syntheticPdfTwoFonts(): Buffer {
  return buildPdf(
    new Map<number, string | Buffer>([
      [1, '<< /Type /Catalog /Pages 2 0 R >>'],
      [2, '<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>'],
      [
        3,
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
      ],
      [4, flateStream(PAGE1_CONTENT)],
      [5, FONT_PLAIN],
      [
        6,
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 7 0 R /Resources << /Font << /F2 8 0 R /F3 11 0 R >> >> >>',
      ],
      [7, flateStream(PAGE2_CONTENT)],
      [8, '<< /Type /Font /Subtype /TrueType /BaseFont /Subset+Test /ToUnicode 9 0 R >>'],
      [9, flateStream(CMAP_1BYTE)],
      [10, flateStream(CMAP_2BYTE)],
      [11, '<< /Type /Font /Subtype /Type0 /BaseFont /Subset+CID /ToUnicode 10 0 R >>'],
    ]),
  );
}

describe('extractPdfText — synthetic PDFs (FlateDecode streams)', () => {
  it('extracts text ops, escapes, hex strings, kerning arrays and line breaks', () => {
    const r = extractPdfText(syntheticPdfTwoFonts());
    expect('error' in r).toBe(false);
    if ('error' in r) return;
    expect(r.pages).toBe(2);
    expect(r.text).toContain('HbA1c 6.8 % 4.3 - 5.7');
    expect(r.text).toContain('Fasting Blood Sugar (FBS) 112 mg/dL 70-100');
    // PDF escapes: \( \) \\ plus octal \101 = 'A' and \42 = '"'.
    expect(r.text).toContain('Escapes: ( ) \\ A " done');
    // Hex string <48 65 78> -> "Hex".
    expect(r.text).toContain('Hex');
    // TJ array: kerning numbers ignored, string parts concatenated.
    expect(r.text).toContain('Kerning test');
    // The ' operator starts a new line then shows the string.
    expect(r.text).toContain('postprandial line');
  });

  it('re-joins table columns that share a baseline into one line', () => {
    const r = extractPdfText(syntheticPdfTwoFonts());
    if ('error' in r) throw new Error(r.error);
    // NAME at x=50 and Lakshmi at x=300, same y -> one visual line.
    expect(r.text).toContain('NAME Lakshmi');
    // And the two pages are separated (HbA1c is page 1, THYROC page 2).
    expect(r.text).toContain('THYROC');
  });

  it('decodes 1-byte subset fonts through their ToUnicode CMap', () => {
    const r = extractPdfText(syntheticPdfTwoFonts());
    if ('error' in r) throw new Error(r.error);
    // Codes !"#\$%& (0x21-0x26 in order) map to THYROC via the CMap, NOT cp1252.
    expect(r.text).toContain('THYROC');
    expect(r.text).not.toContain('!"#\$%&');
  });

  it('decodes 2-byte CID-style codes through a 2-byte ToUnicode CMap', () => {
    const r = extractPdfText(syntheticPdfTwoFonts());
    if ('error' in r) throw new Error(r.error);
    expect(r.text).toContain('HIDA');
  });

  it('rejects garbage bytes with a plain-language error', () => {
    const r = extractPdfText(Buffer.from('hello world this is just text, not a pdf'));
    expect('error' in r).toBe(true);
    if ('error' in r) expect(r.error).toContain('does not look like a PDF');
  });

  it('rejects a PDF with no streams at all (no text layer)', () => {
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n', 'latin1');
    const r = extractPdfText(pdf);
    expect('error' in r).toBe(true);
    if ('error' in r) expect(r.error).toContain('no readable text layer');
  });

  it('rejects a PDF whose only stream is binary (an image), not text', () => {
    const imgData = deflateSync(Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
    const pdf = Buffer.concat([
      Buffer.from('%PDF-1.4\n1 0 obj\n<< /Length ' + imgData.length + ' /Filter /FlateDecode >>\nstream\n', 'latin1'),
      imgData,
      Buffer.from('\nendstream\nendobj\n', 'latin1'),
    ]);
    const r = extractPdfText(pdf);
    expect('error' in r).toBe(true);
    if ('error' in r) expect(r.error).toContain('no readable text layer');
  });

  it('rejects an over-sized PDF politely', () => {
    const r = extractPdfText(Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(9 * 1024 * 1024)]));
    expect('error' in r).toBe(true);
    if ('error' in r) expect(r.error).toContain('8 MB');
  });
});

// ---------- the real user report (present in this workspace) ----------

const REAL_PDF = '/home/z/my-project/upload/AE92717100070202409_RLS.pdf';

// P7.1: the file read happens inside beforeAll, NOT in the describe body -
// vitest still runs describe callbacks at collection time (even for skipped
// suites), and a top-level readFileSync here made the whole suite FAIL (not
// skip) on any machine without the founder's local upload/ directory.
describe.skipIf(!existsSync(REAL_PDF))('extractPdfText — real Thyrocare report (16 pages, subset fonts)', () => {
  let text = '';
  let pages = 0;

  beforeAll(() => {
    const r = extractPdfText(readFileSync(REAL_PDF));
    text = 'error' in r ? '' : r.text;
    pages = 'error' in r ? 0 : r.pages;
  });

  it('extracts a real text layer (not mojibake, not an error)', () => {
    expect(text.length).toBeGreaterThan(1500);
    expect(pages).toBeGreaterThanOrEqual(14);
  });

  it('contains the expected report phrases', () => {
    const up = text.toUpperCase();
    expect(up).toContain('THYROCARE');
    expect(up).toContain('FASTING BLOOD SUGAR');
    expect(up).toContain('HS-CRP');
    expect(up).toContain('LIPOPROTEIN');
  });

  it('feeds the engine parser: >= 15 distinct tests incl. fbg / ppbs / hs_crp', () => {
    const parsed = parseLabReportText(text);
    const keys = new Set(parsed.matches.map((m) => m.testKey));
    expect(keys.size).toBeGreaterThanOrEqual(15);
    expect(keys.has('fbg')).toBe(true);
    expect(keys.has('ppbs')).toBe(true);
    expect(keys.has('hs_crp')).toBe(true);
    // And the values that started this whole workstream:
    const byKey = new Map(parsed.matches.map((m) => [m.testKey, m]));
    expect(byKey.get('hs_crp')?.value).toBeCloseTo(7.17, 1);
    expect(byKey.get('fbg')?.value).toBeCloseTo(129.4, 1);
    expect(byKey.get('ppbs')?.value).toBeCloseTo(195.3, 1);
  });
});
