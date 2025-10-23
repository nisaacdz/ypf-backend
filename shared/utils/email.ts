import nodemailer from "nodemailer";
import variables from "@/configs/env";
import emailer from "@/configs/emailer";
import logger from "@/configs/logger";

const colors = {
  primaryText: "#31393C",
  primaryAction: "#2176FF",
  secondaryAccent: "#33A1FD",
  highlightYellow: "#FDCA40",
  highlightOrange: "#F79824",
  background: "#FFFFFF",
  containerBackground: "#F8F9FA",
  footerText: "#6c757d",
};

/**
 * Generates a base HTML structure for emails with consistent branding and styling.
 * This ensures all outgoing emails have a professional and uniform look.
 */
const generateBaseHtml = (subject: string, contentHtml: string): string => {
  const year = variables.app.year;
  const logoUrl = variables.app.logoUrl;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
        .button:hover { opacity: 0.8; }
      </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: ${colors.containerBackground};">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: ${colors.background}; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
              
              <!-- Header with Logo -->
              <tr>
                <td align="center" style="padding: 20px 0; border-bottom: 1px solid #eaeaea;">
                  <img src="${logoUrl}" alt="YPF Africa Logo" width="150" style="display: block;">
                </td>
              </tr>

              <!-- Main Content -->
              <tr>
                <td style="padding: 40px 30px; color: ${colors.primaryText}; font-size: 16px; line-height: 1.6;">
                  <h1 style="color: ${colors.primaryText}; font-size: 24px; margin-top: 0;">${subject}</h1>
                  ${contentHtml}
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td align="center" style="padding: 20px 30px; background-color: ${colors.containerBackground}; border-top: 1px solid #eaeaea; color: ${colors.footerText}; font-size: 12px;">
                  <p style="margin: 0;">&copy; ${year} YPF Africa. All rights reserved.</p>
                  <p style="margin: 5px 0 0 0;">This is an automated message, please do not reply directly to this email.</p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

/**
 * Core function to send an email.
 * Specific email functions should prepare content and call this.
 */
export const sendEmail = async (
  to: string,
  subject: string,
  htmlBody: string,
  textContent?: string,
): Promise<void> => {
  const mailOptions: nodemailer.SendMailOptions = {
    from: `"YPF Africa" <${variables.services.email.sender}>`,
    to: to,
    subject: subject,
    html: htmlBody,
  };
  if (textContent) {
    mailOptions.text = textContent;
  }

  try {
    const info = await emailer.transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${to}. Message ID: ${info.messageId}`);
  } catch (error) {
    logger.error(error, `Error sending email to ${to}:`);
    throw new Error(
      `Failed to send email: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

// === SAMPLE IMPLEMENTATIONS ===

/**
 * Sends a welcome email to a new user.
 * @param to - The recipient's email address.
 * @param name - The user's name to personalize the email.
 */
export async function sendWelcomeEmail(
  to: string,
  name: string,
): Promise<void> {
  const subject = "Welcome to YPF Africa!";

  const content = `
    <p>Hi ${name},</p>
    <p>We are thrilled to have you join the YPF Africa community! Our mission is to connect and empower young professionals across the continent, and you are now a part of that journey.</p>
    <p>Here are a few things you can do to get started:</p>
    <ul>
      <li>Complete your profile to connect with others.</li>
      <li>Explore upcoming events and projects.</li>
      <li>Join a chapter or committee to get involved.</li>
    </ul>
    <p>If you have any questions, feel free to reach out. We're excited to see the impact you'll make!</p>
    <br>
    <a href="https://your-app-url.com/login" class="button" style="background-color: ${colors.primaryAction}; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">Go to Your Dashboard</a>
    <br>
    <p>Best regards,<br>The YPF Africa Team</p>
  `;

  // 1. Generate the full, styled HTML
  const htmlBody = generateBaseHtml(subject, content);

  // 2. Create a plain text version for email clients that don't render HTML
  const textContent = `Hi ${name},\n\nWelcome to YPF Africa! We are thrilled to have you join our community.\n\nVisit your dashboard to get started: https://your-app-url.com/login\n\nBest regards,\nThe YPF Africa Team`;

  // 3. Send the email using the core function
  await sendEmail(to, subject, htmlBody, textContent);
}

/**
 * Sends an OTP (One-Time Password) email to a user.
 * @param to - The recipient's email address.
 * @param otp - The 6-digit OTP code.
 */
export async function send_otp_email(to: string, otp: string): Promise<void> {
  const subject = "Password Reset Code";

  const content = `
    <p>You have requested to reset your password.</p>
    <p>Your verification code is:</p>
    <div style="background-color: ${colors.containerBackground}; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
      <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: ${colors.primaryAction};">${otp}</span>
    </div>
    <p><strong>This code will expire in 6 minutes.</strong></p>
    <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
    <p>Best regards,<br>The YPF Africa Team</p>
  `;

  const htmlBody = generateBaseHtml(subject, content);

  const textContent = `You have requested to reset your password.\n\nYour verification code is: ${otp}\n\nThis code will expire in 6 minutes.\n\nIf you did not request a password reset, please ignore this email.\n\nBest regards,\nThe YPF Africa Team`;

  await sendEmail(to, subject, htmlBody, textContent);
}
