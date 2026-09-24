import 'server-only';
import { createTransport, type Transporter } from 'nodemailer';
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
 * Email transport.
 *
 * Two drivers, chosen by EMAIL_DRIVER. `console` writes the message to the
 * server log, which is what a local machine and the automated tests want: no
 * mail server to run, and the reset link is readable in the terminal. `smtp`
 * sends it, through Mailpit locally or a transactional provider in production.
 *
 * A send that fails is logged and reported, never thrown. Mail is a courtesy
 * on top of the in-application notification that has already been written to
 * the database; losing the courtesy must not roll back the record, and no
 * decision the system takes depends on delivery.
 */
export async function sendEmail(message: EmailMessage): Promise<{ sent: boolean }> {
  if (env.EMAIL_DRIVER === 'smtp') {
    return sendViaSmtp(message);
  }
  return sendViaConsole(message);
}

async function sendViaConsole(message: EmailMessage): Promise<{ sent: boolean }> {
  const action = message.actionUrl
    ? `\n  Action: ${message.actionLabel} -> ${message.actionUrl}`
    : '';
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

// One transport for the life of the process. Creating one per message opens a
// new connection every time, which a provider will rate-limit long before a
// busy evening of notifications is finished.
let transport: Transporter | null = null;

function smtpTransport(): Transporter | null {
  if (transport) return transport;
  if (!env.SMTP_HOST) {
    // eslint-disable-next-line no-console
    console.warn('[email] EMAIL_DRIVER is smtp but SMTP_HOST is not set; logging instead.');
    return null;
  }
  transport = createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    // Mailpit and Mailhog accept anonymous mail; a provider will not.
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? '' } : undefined,
  });
  return transport;
}

async function sendViaSmtp(message: EmailMessage): Promise<{ sent: boolean }> {
  const mailer = smtpTransport();
  if (!mailer) return sendViaConsole(message);

  try {
    await mailer.sendMail({
      from: env.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: renderEmailText(message),
      html: renderEmailHtml(message),
    });
    return { sent: true };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[email] could not be sent', { to: message.to, subject: message.subject }, error);
    return { sent: false };
  }
}

export function renderEmailText(message: EmailMessage): string {
  return [
    message.heading,
    '',
    message.body,
    message.actionUrl ? `\n${message.actionLabel}: ${message.actionUrl}` : '',
  ]
    .join('\n')
    .trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * A plain, single-column message.
 *
 * Inline styles and a table, because that is what mail clients render
 * predictably; no images, so nothing breaks when remote content is blocked.
 */
export function renderEmailHtml(message: EmailMessage): string {
  const action = message.actionUrl
    ? `<tr><td style="padding:24px 0 8px"><a href="${escapeHtml(message.actionUrl)}"
         style="background:#0f5132;color:#ffffff;text-decoration:none;padding:12px 20px;
                border-radius:8px;display:inline-block;font-weight:600">
         ${escapeHtml(message.actionLabel ?? 'Open Bursary-Bridge')}</a></td></tr>`
    : '';

  return `<!doctype html><html><body style="margin:0;background:#f6f7f6;
    font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1f1d">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding:32px 16px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="max-width:560px;background:#ffffff;border-radius:12px;padding:32px">
          <tr><td style="font-size:18px;font-weight:700;padding-bottom:12px">
            ${escapeHtml(message.heading)}</td></tr>
          <tr><td style="font-size:15px;line-height:1.6">${escapeHtml(message.body)}</td></tr>
          ${action}
          <tr><td style="padding-top:28px;font-size:12px;color:#6b706d">
            Bursary-Bridge</td></tr>
        </table>
      </td></tr>
    </table></body></html>`;
}
