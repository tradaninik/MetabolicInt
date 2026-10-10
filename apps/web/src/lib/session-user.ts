// Session -> userId, one place. next-auth v4 per apps/web/package.json;
// auth.ts puts the user id on session.user.id via the jwt/session callbacks.
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

export async function getSessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  return typeof id === 'string' && id !== '' ? id : null;
}