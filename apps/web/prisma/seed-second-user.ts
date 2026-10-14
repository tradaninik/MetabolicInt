// QA user for smoke check 15. Idempotent. Local dev DB only.
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';

async function main() {
  const email = (process.env.QA_EMAIL2 || 'priya@metabolic.dev').toLowerCase();
  const password = process.env.QA_PASSWORD2 || 'demo1234';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) { console.log('second user already present:', email); return; }
  await prisma.user.create({
    data: { email, name: 'Priya (QA)', passwordHash: await bcrypt.hash(password, 10) },
  });
  console.log('created second user:', email);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());