import { apiOk } from '@/lib/auth/api';
import { getCurrentUser, destroySession } from '@/lib/auth/session';
import { audit } from '@/services/audit';

export async function POST() {
  const user = await getCurrentUser();
  await destroySession();
  if (user) {
    await audit({ userId: user.id, action: 'auth.logout', entityType: 'User', entityId: user.id });
  }
  return apiOk({ ok: true, redirectTo: '/login' });
}
