import 'server-only';
import { env } from '@/lib/env';

export type EmailMessage = {
  to: string;
  subject: string;
  heading: string;
  body: string;
  actionLabel?: string;
  actionUrl?: string;
};

/**
 * Email transport seam.
 *
 * The prototype logs messages to the server console. Point EMAIL_DRIVER at
 * "smtp" and implement `sendViaSmtp` (Mailpit/Mailhog in development, a
 * transactional provider in production) without touching any call site.
 */
export async function sendEmail(message: EmailMessage): Promise<{ sent: boolean }> {
  if (env.EMAIL_DRIVER === 'smtp') {
    return sendViaSmtp(message);
  }
  return sendViaConsole(message);
}

async function sendViaConsole(message: EmailMessage): Promise<{ sent: boolean }> {
  const action = message.actionUrl ? `\n  Action: ${message.actionLabel} -> ${message.actionUrl}` : '';
  // eslint-disable-next-line no-console
  console.info(
    `\n[email] ---------------------------------------------------\n` +
      `  From:    ${env.EMAIL_FROM}\n` +
      `  To:      ${message.to}\n` +
      `  Subject: ${message.subject}\n` +
      `  ${message.heading}\n` +
      `  ${message.body}${action}\n` +
      `-------------------------------------------------------\n`,
  );
  return { sent: true };
}

async function sendViaSmtp(_message: EmailMessage): Promise<{ sent: boolean }> {
  // eslint-disable-next-line no-console
  console.warn('[email] SMTP driver selected but not implemented; falling back to console.');
  return sendViaConsole(_message);
}

export function renderEmailText(message: EmailMessage): string {
  return [message.heading, '', message.body, message.actionUrl ? `\n${message.actionLabel}: ${message.actionUrl}` : '']
    .join('\n')
    .trim();
}
