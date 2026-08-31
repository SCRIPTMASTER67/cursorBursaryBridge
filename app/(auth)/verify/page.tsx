import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/auth/session';
import { VerifyPanel } from './verify-panel';

export const metadata: Metadata = { title: 'Verify your email' };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const user = await getCurrentUser();

  // Following a verification link while signed out still needs to work.
  if (!user && !token) redirect('/login');

  return (
    <Card className="p-7 text-center sm:p-9">
      <VerifyPanel token={token ?? null} email={user?.email ?? null} verified={Boolean(user?.emailVerifiedAt)} />
    </Card>
  );
}
