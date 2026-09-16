import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '../config/env.js';

export interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html: string;
  replyTo?: string;
  fromName?: string;
  inReplyTo?: string;
  references?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string | false;
  error?: string;
}

export class EmailService {
  private static transporter: Transporter | null = null;

  /**
   * Initializes and returns the Nodemailer transporter based on environment config.
   */
  public static getTransporter(): Transporter | null {
    if (this.transporter) {
      return this.transporter;
    }

    const provider = env.EMAIL_PROVIDER;

    if (provider === 'gmail') {
      if (!env.EMAIL_USER || !env.EMAIL_PASS) {
        console.warn('⚠️ [EmailService] EMAIL_USER or EMAIL_PASS missing for Gmail provider.');
        return null;
      }

      this.transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true, // Direct SSL on port 465 avoids cloud container firewall ETIMEDOUT
        auth: {
          user: env.EMAIL_USER.trim(),
          pass: env.EMAIL_PASS.replace(/\s+/g, ''),
        },
      });
      return this.transporter;
    }

    if (provider === 'smtp') {
      if (!env.SMTP_HOST) {
        console.warn('⚠️ [EmailService] SMTP_HOST is missing for SMTP provider.');
        return null;
      }

      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: env.EMAIL_USER && env.EMAIL_PASS ? {
          user: env.EMAIL_USER,
          pass: env.EMAIL_PASS,
        } : undefined,
      });
      return this.transporter;
    }

    return null;
  }

  /**
   * Verifies the SMTP / Gmail connection.
   */
  public static async verifyConnection(): Promise<{ success: boolean; message: string }> {
    const transporter = this.getTransporter();
    if (!transporter) {
      return {
        success: false,
        message: `Email provider is set to "${env.EMAIL_PROVIDER}". No active SMTP transporter configured.`,
      };
    }

    try {
      await transporter.verify();
      return {
        success: true,
        message: `SMTP connection verified successfully using "${env.EMAIL_PROVIDER}".`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to verify SMTP connection: ${error?.message || error}`,
      };
    }
  }

  /**
   * Sends an email via the configured email provider.
   */
  public static async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const provider = env.EMAIL_PROVIDER;
    const fromAddress = env.EMAIL_USER || env.SUPPORT_EMAIL || 'support@ticketai.local';
    const fromName = options.fromName || 'Ticket AI Support';
    const formattedFrom = `"${fromName}" <${fromAddress}>`;

    // 1. Mock Provider
    if (provider === 'mock') {
      console.log('📨 [MOCK EMAIL]');
      console.log(`   To: ${options.to}`);
      console.log(`   From: ${formattedFrom}`);
      console.log(`   Subject: ${options.subject}`);
      console.log(`   Preview: ${options.text || options.html.substring(0, 100)}...`);
      return {
        success: true,
        messageId: `mock-${Date.now()}`,
      };
    }

    // 2. Gmail or Custom SMTP Provider
    if (provider === 'gmail' || provider === 'smtp') {
      const transporter = this.getTransporter();
      if (!transporter) {
        console.error('❌ [EmailService] Transporter initialization failed.');
        return {
          success: false,
          error: 'Email transporter not configured',
        };
      }

      try {
        const info = await transporter.sendMail({
          from: formattedFrom,
          to: options.to,
          replyTo: options.replyTo || fromAddress,
          inReplyTo: options.inReplyTo,
          references: options.references || options.inReplyTo,
          subject: options.subject,
          text: options.text,
          html: options.html,
        });

        console.log(`✅ [EmailService] Email sent to ${options.to} (ID: ${info.messageId})`);
        return {
          success: true,
          messageId: info.messageId,
        };
      } catch (error: any) {
        console.error(`❌ [EmailService] Failed to send email to ${options.to}:`, error);
        return {
          success: false,
          error: error?.message || 'Failed to send email',
        };
      }
    }

    // 3. Resend HTTP API Provider (Recommended for Railway / cloud deployments - uses port 443)
    if (provider === 'resend') {
      const apiKey = env.RESEND_API_KEY || process.env.RESEND_API_KEY;
      if (!apiKey) {
        console.error('❌ [EmailService] RESEND_API_KEY is not set.');
        return { success: false, error: 'RESEND_API_KEY missing' };
      }

      try {
        const fromEmail = env.SUPPORT_EMAIL || 'onboarding@resend.dev';
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${fromName} <${fromEmail}>`,
            to: [options.to],
            subject: options.subject,
            html: options.html,
            text: options.text,
            reply_to: options.replyTo || fromAddress,
          }),
        });

        const data = await res.json() as any;
        if (!res.ok) {
          console.error(`❌ [EmailService] Resend API error:`, data);
          return { success: false, error: data?.message || 'Resend API failed' };
        }

        console.log(`✅ [EmailService] Email delivered via Resend to ${options.to} (ID: ${data.id})`);
        return { success: true, messageId: data.id };
      } catch (error: any) {
        console.error(`❌ [EmailService] Resend network error:`, error);
        return { success: false, error: error?.message || 'Resend network error' };
      }
    }

    // 4. SendGrid HTTP API Provider
    if (provider === 'sendgrid') {
      const apiKey = env.SENDGRID_API_KEY || process.env.SENDGRID_API_KEY;
      if (!apiKey) {
        console.error('❌ [EmailService] SENDGRID_API_KEY is not set.');
        return { success: false, error: 'SENDGRID_API_KEY missing' };
      }

      try {
        const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: options.to }] }],
            from: { email: fromAddress, name: fromName },
            subject: options.subject,
            content: [
              { type: 'text/html', value: options.html },
              ...(options.text ? [{ type: 'text/plain', value: options.text }] : []),
            ],
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error(`❌ [EmailService] SendGrid API error:`, errText);
          return { success: false, error: errText };
        }

        console.log(`✅ [EmailService] Email delivered via SendGrid to ${options.to}`);
        return { success: true };
      } catch (error: any) {
        console.error(`❌ [EmailService] SendGrid network error:`, error);
        return { success: false, error: error?.message || 'SendGrid network error' };
      }
    }

    return {
      success: false,
      error: `Unsupported email provider: ${provider}`,
    };
  }

  /**
   * Helper to send notification when a ticket is created.
   */
  public static async sendTicketCreatedNotification(params: {
    to: string;
    ticketNumber: number;
    title: string;
    customerName?: string;
  }) {
    const subject = `[#${params.ticketNumber}] Ticket Received: ${params.title}`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #2563eb; color: #ffffff; padding: 20px; text-align: center;">
          <h2 style="margin: 0;">Support Ticket Received</h2>
        </div>
        <div style="padding: 24px;">
          <p>Hi ${params.customerName || 'there'},</p>
          <p>We have received your support request and assigned it ticket number <strong>#${params.ticketNumber}</strong>.</p>
          <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 12px 16px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold;">Ticket Subject:</p>
            <p style="margin: 4px 0 0 0;">${params.title}</p>
          </div>
          <p>Our team (or AI assistant) is currently reviewing your ticket. You will receive an update shortly.</p>
          <p style="margin-top: 24px; color: #64748b; font-size: 13px;">You can reply directly to this email to add more details.</p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: params.to,
      subject,
      html,
      text: `Your ticket #${params.ticketNumber} (${params.title}) has been received. Our team will review it shortly.`,
    });
  }

  /**
   * Helper to send notification when an agent/support replies to a ticket.
   * Sends the email to the customer with In-Reply-To headers so it appears directly in their conversation thread.
   */
  public static async sendTicketReplyNotification(params: {
    to: string;
    ticketNumber: number;
    title: string;
    senderName: string;
    messageContent: string;
    inReplyToMessageId?: string;
  }) {
    const subject = params.title.toLowerCase().startsWith('re:')
      ? params.title
      : `Re: ${params.title}`;

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #0f172a; color: #ffffff; padding: 16px 20px;">
          <h2 style="margin: 0; font-size: 16px;">Support Reply: Ticket #${params.ticketNumber}</h2>
        </div>
        <div style="padding: 20px;">
          <p style="margin-top: 0;"><strong>${params.senderName}</strong>:</p>
          <div style="background-color: #f8fafc; border-left: 3px solid #2563eb; border-radius: 4px; padding: 14px; margin: 14px 0; white-space: pre-wrap; font-size: 14px;">
${params.messageContent}
          </div>
          <p style="margin-top: 20px; color: #64748b; font-size: 13px;">You can reply directly to this email to respond.</p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: params.to,
      subject,
      html,
      text: `${params.senderName}:\n\n${params.messageContent}`,
      inReplyTo: params.inReplyToMessageId,
      references: params.inReplyToMessageId,
      fromName: params.senderName || 'Ticket AI Support',
    });
  }
}
