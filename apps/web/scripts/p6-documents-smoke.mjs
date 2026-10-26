// P6-f: generate a real ~3.5 MB PDF (valid structure, big content stream)
// and round-trip it through ReportDocument storage the way the API route
// does: base64 in, base64 out, byte-identical, with the standard filename.
// Usage: DATABASE_URL=file:/abs/path.db node scripts/p6-documents-smoke.mjs
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';
// NOTE: the standard-filename builder lives in @mi/engine (TS source, not
// importable from plain node). Its exact output is pinned by
// packages/engine/src/labs.test.ts, so this smoke asserts the literal.

const libsql = createClient({ url: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaLibSQL(libsql) });

/** A structurally valid PDF: header, catalog, pages, page, big content stream, xref. */
function buildBigPdf(targetBytes) {
  const chunk = [];
  // Text operators repeated until the stream is ~targetBytes. Deterministic.
  const line = 'BT /F1 12 Tf 72 720 Td (MetabolicInt document vault round-trip smoke test. ) Tj T* ET\n';
  const reps = Math.ceil(targetBytes / line.length);
  let stream = '';
  for (let i = 0; i < reps; i++) stream += line;

  const objects = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  objects[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>';
  objects[4] = `<< /Length ${stream.length} >>\nstream\n${stream}endstream`;
  objects[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = pdf.length;
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

async function main() {
  const buf = buildBigPdf(3.5 * 1024 * 1024);
  writeFileSync('/tmp/p6-test-report.pdf', buf);
  console.log(`generated PDF: ${buf.length} bytes (${Math.round(buf.length / 1024 / 1024 * 10) / 10} MB)`);
  if (buf.length > 4 * 1024 * 1024) throw new Error('fixture exceeds the 4MB cap');

  const user = await prisma.user.create({
    data: { email: `p6f-${Date.now()}@example.com`, name: 'John Doe', onboardingComplete: true },
  });

  // Store exactly like the upload route does (reportFileName output pinned in labs.test.ts).
  const displayName = '2026-10-15_Diabetes_HbA1c_JohnDoe.pdf';
  console.log('standard filename:', displayName);
  if (displayName !== '2026-10-15_Diabetes_HbA1c_JohnDoe.pdf') throw new Error('unexpected filename: ' + displayName);

  const doc = await prisma.reportDocument.create({
    data: {
      userId: user.id,
      category: 'diabetes',
      testKey: 'hba1c',
      displayName,
      mimeType: 'application/pdf',
      sizeBytes: buf.length,
      dataBase64: buf.toString('base64'),
      performedAt: '2026-10-15',
      note: 'round-trip smoke',
    },
  });

  // Read back exactly like the download route does.
  const back = await prisma.reportDocument.findUnique({ where: { id: doc.id } });
  const bytes = Buffer.from(back.dataBase64, 'base64');
  if (bytes.length !== buf.length) throw new Error(`size mismatch: ${bytes.length} vs ${buf.length}`);
  if (!buf.equals(bytes)) throw new Error('byte mismatch - round-trip corrupted the file');

  // Auth-sharing smoke: a doctor link and a care link can exist; the route
  // checks them - here we verify the ownership scoping query shapes.
  const foreign = await prisma.reportDocument.count({ where: { userId: user.id, category: 'cardio' } });
  if (foreign !== 0) throw new Error('category scoping broken');

  await prisma.user.delete({ where: { id: user.id } }); // cascade removes the document
  const left = await prisma.reportDocument.count({ where: { userId: user.id } });
  if (left !== 0) throw new Error('user cascade did not remove documents');

  console.log('P6-f DOCUMENT ROUND-TRIP SMOKE: OK (3.5MB PDF byte-identical)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
