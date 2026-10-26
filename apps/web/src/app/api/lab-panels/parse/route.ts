// P6-c + P7-A — POST /api/lab-panels/parse: deterministic parse of pasted
// report text, a CSV/TSV export, or (P7) an uploaded lab PDF. The parser is a
// pure engine module; this route is auth + size caps + PDF text extraction
// (server-only, zero dependencies beyond node:zlib). NO OCR and no AI: a
// scanned/photo PDF is detected (no text layer) and answered plainly.
import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/session-user';
import { parseLabReportText } from '@mi/engine';
import { extractPdfText } from '@/lib/pdf-text';

const MAX_TEXT_CHARS = 200_000;
const MAX_PDF_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const contentType = req.headers.get('content-type') ?? '';

  // --- P7: multipart/form-data with a PDF file field. ---
  if (contentType.includes('multipart/form-data')) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Could not read that upload. Please try again.' }, { status: 400 });
    }
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file was received. Choose a PDF and try again.' }, { status: 400 });
    }
    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: 'That PDF is over 8 MB. Please upload a smaller export of the same report.' }, { status: 413 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const extracted = extractPdfText(buf);
    if ('error' in extracted) return NextResponse.json({ error: extracted.error }, { status: 422 });
    const parsed = parseLabReportText(extracted.text);
    // The extracted text travels back too, so the review screen can show
    // exactly what was read (and the user can re-parse an edited copy).
    return NextResponse.json({ ...parsed, format: 'pdf', text: extracted.text.slice(0, MAX_TEXT_CHARS) });
  }

  // --- Existing JSON path: pasted text / CSV content. ---
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text : '';
  if (!text.trim()) {
    return NextResponse.json({ error: 'Paste the text of your report (or choose a CSV or PDF file) first.' }, { status: 400 });
  }
  if (text.length > MAX_TEXT_CHARS) {
    return NextResponse.json({ error: 'That text is too long (over 200,000 characters). Paste one report at a time.' }, { status: 400 });
  }

  const parsed = parseLabReportText(text);
  return NextResponse.json(parsed);
}
