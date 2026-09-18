import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { sendEmail } from '@/lib/email';

/**
 * Password reset tokens.
 *
 * The same shape as the email-verification tokens: a random value handed to
 * the user, only its SHA-256 hash stored, single use, and short lived. The
 * unique constraint on userId means issuing a new link silently invalidates
 * any previous one, so a leaked older link stops working.
 */
const TTL_MINUTES = 60;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Issue a token and email the link. Returns the token for tests to use. */
export async function issuePasswordReset(user: {
  id: string;
  email: string;
  firstName: string;
}): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60_000);

  await prisma.passwordResetToken.upsert({
    where: { userId: user.id },
    create: { userId: user.id, tokenHash: hashToken(token), expiresAt },
    update: { tokenHash: hashToken(token), expiresAt },
  });

  const url = `${env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: 'Reset your Bursary-Bridge password',
    heading: `Hello ${user.firstName}`,
    body:
      'Use the link below to set a new password. It expires in one hour and can only be used ' +
      'once. If you did not ask for this, you can ignore this message.',
    actionLabel: 'Set a new password',
    actionUrl: url,
  });

  return token;
}

export type ResetTokenLookup =
  | { ok: true; userId: string; tokenId: string }
  | { ok: false; reason: 'invalid' | 'expired' };

/** Look a token up without consuming it. */
export async function findPasswordReset(token: string): Promise<ResetTokenLookup> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true },
  });

  if (!record) return { ok: false, reason: 'invalid' };
  if (record.expiresAt.getTime() < Date.now()) {
    await prisma.passwordResetToken.delete({ where: { id: record.id } });
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, userId: record.userId, tokenId: record.id };
}

export { hashToken as hashResetToken };
