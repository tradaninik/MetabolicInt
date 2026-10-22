// GET /api/export - P3-1 data export/backup download.
// ?format=json -> full JSON backup (all 21 user tables, secrets redacted);
// ?format=csv&table=<key> -> one table as CSV. Thin wrapper over
// lib/export-response (unit-tested); auth via getSessionUserId (jwt).
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/session-user';
import { buildExport } from '@/lib/export-response';

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Sign in to export your data.' }, { status: 401 });
  const format = req.nextUrl.searchParams.get('format');
  const table = req.nextUrl.searchParams.get('table');
  const out = await buildExport(prisma, userId, format, table);
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status });
  return new NextResponse(out.body, {
    headers: {
      'Content-Type': out.contentType,
      'Content-Disposition': `attachment; filename="${out.filename}"`,
    },
  });
}
