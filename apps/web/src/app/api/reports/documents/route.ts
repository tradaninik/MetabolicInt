// P6-f — /api/reports/documents: the A–E report vault (list + upload).
//
// Storage is base64 in Turso - the only zero-dependency option on Vercel's
// ephemeral filesystem (@vercel/blob is the scale-up path ONLY if the user
// approves the dependency). Caps, stated in plain language: 4 MB per file,
// 200 files, 50 MB total. The standard filename
// YYYY-MM-DD_[Category]_[TestName]_[PatientName].ext is generated server-side
// from the user's own profile name so it is consistent everywhere.
import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/session-user';
import { prisma } from '@/lib/prisma';
import { istNow } from '@/lib/clinical-db';
import { LAB_CATEGORIES, LAB_TEST_MAP, PRESCRIPTION_CATEGORY, reportFileName } from '@mi/engine';

const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB
const MAX_FILES = 200;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const CATEGORY_IDS = new Set<string>([...LAB_CATEGORIES.map((c) => c.id), PRESCRIPTION_CATEGORY.id]);

const LIST_SELECT = {
  id: true,
  category: true,
  testKey: true,
  displayName: true,
  mimeType: true,
  sizeBytes: true,
  panelId: true,
  performedAt: true,
  note: true,
  createdAt: true,
};

function extForMime(mime: string): string {
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  return 'bin';
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const documents = await prisma.reportDocument.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: LIST_SELECT,
  });
  const totalBytes = documents.reduce((s, d) => s + d.sizeBytes, 0);
  return NextResponse.json({
    documents,
    usage: { count: documents.length, totalBytes, maxFiles: MAX_FILES, maxFileBytes: MAX_FILE_BYTES, maxTotalBytes: MAX_TOTAL_BYTES },
    categories: LAB_CATEGORIES,
  });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Send the file as form data.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Choose a PDF, JPG or PNG file first.' }, { status: 400 });
  }

  // Server-side re-check of the client's size guard - never trust the browser.
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `That file is ${Math.round(file.size / 1024 / 1024)} MB. The limit is 4 MB per file - most lab PDFs are far smaller.` },
      { status: 400 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'That file is empty.' }, { status: 400 });
  }
  const mimeType = file.type || 'application/octet-stream';
  if (!ALLOWED_MIME.has(mimeType)) {
    return NextResponse.json({ error: 'Only PDF, JPG and PNG files are supported.' }, { status: 400 });
  }

  const category = String(form.get('category') ?? '');
  if (!CATEGORY_IDS.has(category)) {
    return NextResponse.json({ error: 'Pick a folder (A–E, or Prescriptions) for this document.' }, { status: 400 });
  }
  const testKeyRaw = form.get('testKey');
  const testKey = typeof testKeyRaw === 'string' && testKeyRaw && LAB_TEST_MAP[testKeyRaw] ? testKeyRaw : null;
  const performedAtRaw = String(form.get('performedAt') ?? '');
  const performedAt = /^\d{4}-\d{2}-\d{2}$/.test(performedAtRaw) ? performedAtRaw : null;
  const note = String(form.get('note') ?? '').slice(0, 200) || null;
  const panelIdRaw = String(form.get('panelId') ?? '');

  // Count + total caps (checked together, one query each, plain-language errors).
  const [count, agg] = await Promise.all([
    prisma.reportDocument.count({ where: { userId } }),
    prisma.reportDocument.aggregate({ where: { userId }, _sum: { sizeBytes: true } }),
  ]);
  if (count >= MAX_FILES) {
    return NextResponse.json({ error: `You've reached the ${MAX_FILES}-file limit. Delete some documents first.` }, { status: 409 });
  }
  const totalNow = agg._sum.sizeBytes ?? 0;
  if (totalNow + file.size > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      { error: `Your vault holds ${Math.round(totalNow / 1024 / 1024)} MB of the 50 MB limit and this file needs ${Math.round(file.size / 1024 / 1024)} MB more. Delete some documents first.` },
      { status: 409 },
    );
  }

  // panelId, when given, must be one of the user's own panels.
  let panelId: string | null = null;
  if (panelIdRaw) {
    const panel = await prisma.labPanel.findFirst({ where: { id: panelIdRaw, userId }, select: { id: true } });
    if (!panel) return NextResponse.json({ error: 'Report not found for the link.' }, { status: 400 });
    panelId = panel.id;
  }

  // The standard filename: date + category token + test label + patient name.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  const patientName = user?.name?.trim() || (user?.email ? user.email.split('@')[0] : '') || 'Patient';
  const displayName = reportFileName({
    date: performedAt ?? istNow().slice(0, 10),
    category,
    testKey,
    patientName,
    ext: extForMime(mimeType),
  });

  const buf = Buffer.from(await file.arrayBuffer());
  const document = await prisma.reportDocument.create({
    data: {
      userId,
      category,
      testKey,
      displayName,
      mimeType,
      sizeBytes: file.size,
      dataBase64: buf.toString('base64'),
      panelId,
      performedAt,
      note,
    },
    select: LIST_SELECT,
  });

  return NextResponse.json({ document });
}
