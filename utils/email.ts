/**
 * Email service utility for sending verification codes
 * 
 * Supports multiple email services:
 * - SMTP (Outlook, Gmail, etc.) - Direct email sending
 * - Resend (https://resend.com)
 * - SendGrid (https://sendgrid.com)
 * 
 * For development, emails are logged to console.
 */

import nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email with verification code
 */
export async function sendVerificationEmail(
  email: string,
  code: string,
  username?: string
): Promise<boolean> {
  const emailOptions: EmailOptions = {
    to: email,
    subject: 'Buildscape - Password Reset Verification Code',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Buildscape Tracker</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
            <h2 style="color: #1f2937; margin-top: 0;">Password Reset Verification</h2>
            ${username ? `<p>Hello ${username},</p>` : '<p>Hello,</p>'}
            <p>You requested to reset your password. Use the verification code below to verify your account:</p>
            <div style="background: white; border: 2px dashed #10b981; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #059669; font-family: 'Courier New', monospace;">
                ${code}
              </div>
            </div>
            <p style="color: #6b7280; font-size: 14px;">This code will expire in 15 minutes.</p>
            <p style="color: #6b7280; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">This is an automated message from Buildscape Tracker. Please do not reply to this email.</p>
          </div>
        </body>
      </html>
    `,
    text: `
Buildscape Tracker - Password Reset Verification

${username ? `Hello ${username},` : 'Hello,'}

You requested to reset your password. Use the verification code below to verify your account:

${code}

This code will expire in 15 minutes.

If you didn't request this code, please ignore this email.

---
This is an automated message from Buildscape Tracker.
    `.trim()
  };

  try {
    // TODO: Replace with actual email service
    // For now, we'll use environment variables to determine the email service
    
    const emailService = process.env.EMAIL_SERVICE || 'console';
    
    // SMTP/Outlook support (check first as it's most common)
    if (emailService === 'smtp' || emailService === 'outlook') {
      if (process.env.SMTP_HOST || process.env.SMTP_USER) {
        return await sendViaSMTP(emailOptions);
      }
    }
    
    // Production email service implementations
    if (emailService === 'resend' && process.env.RESEND_API_KEY) {
      return await sendViaResend(emailOptions);
    }
    
    if (emailService === 'sendgrid' && process.env.SENDGRID_API_KEY) {
      return await sendViaSendGrid(emailOptions);
    }
    
    // Development/Console mode (default)
    if (emailService === 'console' || process.env.NODE_ENV === 'development') {
      console.log('='.repeat(60));
      console.log('📧 EMAIL (Development Mode)');
      console.log('='.repeat(60));
      console.log('To:', emailOptions.to);
      console.log('Subject:', emailOptions.subject);
      console.log('Code:', code);
      console.log('='.repeat(60));
      return true;
    }
    
    // Fallback: log to console
    console.log('Email service not configured. Logging to console:');
    console.log('To:', emailOptions.to);
    console.log('Subject:', emailOptions.subject);
    console.log('Code:', code);
    return true;
    
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

/**
 * Send email via SMTP (Outlook, Gmail, etc.)
 * 
 * Environment variables needed:
 * - SMTP_HOST (e.g., smtp-mail.outlook.com or smtp.office365.com)
 * - SMTP_PORT (default: 587 for TLS, 465 for SSL)
 * - SMTP_USER (your email address)
 * - SMTP_PASS (your email password or app password)
 * - SMTP_FROM (optional, defaults to SMTP_USER)
 * - SMTP_SECURE (optional, true for SSL/465, false for TLS/587)
 */
async function sendViaSMTP(options: EmailOptions): Promise<boolean> {
  try {
    const smtpHost = process.env.SMTP_HOST || 'smtp-mail.outlook.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || smtpUser;
    const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;

    if (!smtpUser || !smtpPass) {
      console.error('SMTP credentials not configured. Need SMTP_USER and SMTP_PASS.');
      return false;
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        // Do not fail on invalid certificates
        rejectUnauthorized: false,
      },
    });

    // Verify connection
    await transporter.verify();

    // Send email
    const info = await transporter.sendMail({
      from: smtpFrom,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    console.log('Email sent successfully:', info.messageId);
    return true;
  } catch (error: any) {
    console.error('SMTP error:', error.message || error);
    return false;
  }
}

/**
 * Send email via Resend (https://resend.com)
 */
async function sendViaResend(options: EmailOptions): Promise<boolean> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'noreply@buildscape.com',
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Resend API error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Resend error:', error);
    return false;
  }
}

/**
 * Send email via SendGrid
 */
async function sendViaSendGrid(options: EmailOptions): Promise<boolean> {
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: options.to }],
        }],
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || 'noreply@buildscape.com',
        },
        subject: options.subject,
        content: [
          {
            type: 'text/plain',
            value: options.text || '',
          },
          {
            type: 'text/html',
            value: options.html,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('SendGrid API error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('SendGrid error:', error);
    return false;
  }
}

