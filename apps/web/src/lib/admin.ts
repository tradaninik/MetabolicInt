import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from './auth';
import { prisma } from './prisma';

/** Server-side guard for /admin/* — redirects non-admins to /dashboard. */
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/login');
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });
  if (user?.role !== 'admin') redirect('/dashboard');
}