import type { Session } from 'next-auth';
import { getServerSession } from 'next-auth';
import { isAdminEmail } from '~/lib/auth/admin-emails';
import { authOptions } from '~/lib/auth/auth-options';
import { touchUserActivity } from '~/lib/users/touch-user-activity';

export async function getAuthSession() {
  return getServerSession(authOptions);
}

/** Matches account page and JWT `session.user.isAdmin` semantics. */
export function isSessionAdmin(session: Session | null | undefined): boolean {
  if (!session?.user) return false;
  const email = session.user.email ?? '';
  return Boolean(session.user.isAdmin) || isAdminEmail(email);
}

export async function requireAdminSession() {
  const session = await requireAuthSession();
  if (!session || !isSessionAdmin(session)) return null;
  return session;
}

export async function requireAuthSession() {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return null;
  void touchUserActivity(userId);
  return session;
}
