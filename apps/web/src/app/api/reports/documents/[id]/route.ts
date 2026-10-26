// P6-f — GET/DELETE /api/reports/documents/[id].
//
// GET serves the bytes two ways: attachment (default; the standard filename
// via Content-Disposition) or inline (?inline=1 for in-app preview of images
// and PDFs). Access mirrors the existing /doctor + /family authorization
// patterns: the OWNER, a LINKED DOCTOR (DoctorPatientLink), or a LINKED
// CAREGIVER (CareRelationship). Nobody else - foreign ids are plain 404s.
// DELETE is owner-only.
import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/session-user';
import { prisma } from '@/lib/prisma';

async function canRead(userId: string, docUserId: string): Promise<boolean> {
  if (userId === docUserId) return true;
  const [doctorLink, careLink] = await Promise.all([
    prisma.doctorPatientLink.findFirst({
      where: { doctorId: userId, patientId: docUserId },
      select: { id: true },
    }),
    prisma.careRelationship.findFirst({
      where: { caregiverId: userId, wardId: docUserId },
      select: { id: true },
    }),
  ]);
  return doctorLink != null || careLink != null;
}

function extForMime(mime: string): string {
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  return 'bin';
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const doc = await prisma.reportDocument.findUnique({
    where: { id },
    select: { userId: true, displayName: true, mimeType: true, dataBase64: true },
  });
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  const allowed = await canRead(userId, doc.userId);
  if (!allowed) return NextResponse.json({ error: 'Document not found' }, { status: 404 }); // invisible, not 403

  const bytes = Buffer.from(doc.dataBase64, 'base64');
  const inline = new URL(req.url).searchParams.get('inline') === '1';
  const ext = extForMime(doc.mimeType);
  // Filename gets a redundant extension guard so browsers never lose the type.
  const name = /\.[a-z0-9]+$/i.test(doc.displayName) ? doc.displayName : `${doc.displayName}.${ext}`;

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': doc.mimeType,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${name}"`,
      'Content-Length': String(bytes.length),
      'Cache-Control': 'private, no-store',
    },
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.reportDocument.findFirst({
    where: { id, userId }, // owner-only delete
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  await prisma.reportDocument.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
