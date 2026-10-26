// P6-c — POST /api/lab-panels/parse: deterministic parse of pasted report
// text or a CSV/TSV export. The parser is a pure engine module; this route is
// auth + size cap only. NO OCR and no AI: photo/PDF-scan auto-fill is
// deliberately excluded (zero-dependency rule) - the response tells the
// client to say so plainly.
import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/session-user';
import { parseLabReportText } from '@mi/engine';

const MAX_TEXT_CHARS = 200_000;

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text : '';
  if (!text.trim()) {
    return NextResponse.json({ error: 'Paste the text of your report (or choose a CSV file) first.' }, { status: 400 });
  }
  if (text.length > MAX_TEXT_CHARS) {
    return NextResponse.json({ error: 'That text is too long (over 200,000 characters). Paste one report at a time.' }, { status: 400 });
  }

  const parsed = parseLabReportText(text);
  return NextResponse.json(parsed);
}
