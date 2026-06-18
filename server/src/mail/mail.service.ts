import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/** Minimal recipient shape needed to address + route an email. */
export interface MailRecipient {
  email: string;
  name: string;
  role?: 'USER' | 'ADMIN' | string;
}

interface NotificationLike {
  type: string;
  title: string;
  body: string;
  eventId?: string | null;
}

const COLORS = {
  pageBg: '#FBF8F2',
  card: '#FFFFFF',
  ink: '#2B2620',
  inkSoft: '#6B6359',
  inkFaint: '#9A9088',
  clay: '#C15F3C',
  border: '#ECE6DD',
};

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Transactional email. Mirrors the in-app notifications to email (Resend), with a
 * dev-simulation fallback: when no real API key is set (placeholder contains "xxx"),
 * emails are logged to the server console instead of sent — same pattern as Paddle
 * and Turnstile, so local dev never needs real credentials.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend?: Resend;
  private readonly from: string;
  private readonly appUrl: string;
  /** True when a real provider key is configured (otherwise we log instead of send). */
  readonly enabled: boolean;

  constructor(config: ConfigService) {
    const key = config.get<string>('mail.apiKey');
    this.from = config.get<string>('mail.from') ?? 'hudlgo <onboarding@resend.dev>';
    this.appUrl = config.get<string>('frontendUrl') ?? 'http://localhost:5173';
    this.enabled = !!key && !key.includes('xxx');
    if (this.enabled) this.resend = new Resend(key);
  }

  async send(msg: MailMessage): Promise<void> {
    if (!this.enabled || !this.resend) {
      this.logger.log(`[mail:dev] would send → to=${msg.to} · subject="${msg.subject}"`);
      return;
    }
    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text ?? stripHtml(msg.html),
      });
      if (error) this.logger.error(`Resend rejected email to ${msg.to}: ${error.message}`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${msg.to}: ${(err as Error).message}`);
    }
  }

  /** Email mirror of an in-app notification. Never throws. */
  async sendNotification(user: MailRecipient, n: NotificationLike): Promise<void> {
    const cta = n.eventId
      ? { text: 'View activity', url: `${this.appUrl}/event/${n.eventId}` }
      : user.role === 'ADMIN'
        ? { text: 'Open admin panel', url: `${this.appUrl}/admin` }
        : { text: 'Open hudlgo', url: `${this.appUrl}/discover` };

    await this.send({
      to: user.email,
      subject: n.title,
      html: this.layout({ heading: n.title, bodyHtml: `<p style="${P}">${escape(n.body)}</p>`, cta, preheader: n.body }),
    });
  }

  /** One-time welcome email sent at signup. */
  async sendWelcome(user: MailRecipient): Promise<void> {
    const first = user.name?.split(' ')[0] || 'there';
    const body = `
      <p style="${P}">Welcome aboard — hudlgo is where people across Morocco gather for padel, surf, football, hikes, coffee and more.</p>
      <p style="${P}">Here's how to get going:</p>
      <ul style="${P}margin-top:0;padding-left:20px">
        <li style="margin-bottom:6px">Discover activities happening near you</li>
        <li style="margin-bottom:6px">Join one with a tap — or host your own</li>
        <li>Meet your people and make the most of your city</li>
      </ul>`;
    await this.send({
      to: user.email,
      subject: 'Welcome to hudlgo 👋',
      html: this.layout({
        heading: `Welcome, ${escape(first)} 👋`,
        bodyHtml: body,
        cta: { text: 'Explore activities', url: `${this.appUrl}/discover` },
        preheader: 'Find your people for padel, surf, football, hikes and more across Morocco.',
      }),
    });
  }

  // --- Branded HTML layout -------------------------------------------------
  private layout(opts: { heading: string; bodyHtml: string; cta?: { text: string; url: string }; preheader?: string }): string {
    const { heading, bodyHtml, cta, preheader } = opts;
    const button = cta
      ? `<a href="${cta.url}" style="display:inline-block;background:${COLORS.clay};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:999px">${escape(cta.text)}</a>`
      : '';
    return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:${COLORS.pageBg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${COLORS.ink}">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(preheader ?? '')}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.pageBg}">
      <tr><td align="center" style="padding:32px 16px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
          <tr><td style="padding:0 4px 18px 4px">
            <span style="font-size:22px;font-weight:700;letter-spacing:-0.5px;color:${COLORS.ink}">hudlgo</span>
          </td></tr>
          <tr><td style="background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:18px;padding:28px">
            <h1 style="margin:0 0 14px 0;font-size:20px;line-height:1.3;color:${COLORS.ink}">${escape(heading)}</h1>
            ${bodyHtml}
            ${button ? `<div style="margin-top:22px">${button}</div>` : ''}
          </td></tr>
          <tr><td style="padding:18px 4px 0 4px;text-align:center">
            <p style="margin:0 0 4px 0;font-size:12px;color:${COLORS.inkFaint}">
              You're receiving this because you have a hudlgo account.
              Manage email preferences in <a href="${this.appUrl}/settings" style="color:${COLORS.inkSoft}">Settings</a>.
            </p>
            <p style="margin:0;font-size:12px;color:${COLORS.inkFaint}">
              Developed by <a href="https://keyinov.com" style="color:${COLORS.inkSoft};font-weight:600">keyinov</a>
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
  }
}

const P = `margin:0 0 12px 0;font-size:15px;line-height:1.6;color:${COLORS.inkSoft};`;

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
