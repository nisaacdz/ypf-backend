import nodemailer from "nodemailer";
import variables from "@/configs/env";
import emailer from "@/configs/emailer";
import logger from "@/configs/logger";

const colors = {
  primary: "#301F6E",
  accent: "#FF8C02",
  foreground: "#09090B",
  background: "#FFFFFF",
  muted: "#F4F4F5",
  mutedForeground: "#71717A",
};

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
    <body style="margin: 0; padding: 0; background-color: ${colors.muted};">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: ${colors.background}; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
              
              <!-- Header with Logo, Title and Subtitle -->
              <tr>
                <td align="center" style="padding: 30px 20px; border-bottom: 2px solid ${colors.primary}; background-color: ${colors.background};">
                  <img src="${logoUrl}" alt="YPF Africa Logo" width="80" style="display: block; margin: 0 auto 15px auto; max-width: 80px; height: auto;">
                  <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: bold; color: ${colors.primary}; font-family: Arial, sans-serif;">YPF Africa</h1>
                  <p style="margin: 0; font-size: 14px; color: ${colors.mutedForeground}; font-style: italic;">Empowering Youths to Change Ghana and Africa</p>
                </td>
              </tr>

              <!-- Main Content -->
              <tr>
                <td style="padding: 40px 30px; color: ${colors.foreground}; font-size: 16px; line-height: 1.6;">
                  <h1 style="color: ${colors.foreground}; font-size: 24px; margin-top: 0;">${subject}</h1>
                  ${contentHtml}
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td align="center" style="padding: 20px 30px; background-color: ${colors.muted}; border-top: 1px solid ${colors.mutedForeground}; color: ${colors.mutedForeground}; font-size: 12px;">
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

export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  text?: string,
): Promise<void> => {
  if (variables.app.environment === "test") {
    return;
  }
  const mailOptions: nodemailer.SendMailOptions = {
    from: `"YPF Africa" <${variables.services.email.sender}>`,
    to,
    subject,
    html,
    text,
  };
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
    <a href="https://your-app-url.com/login" class="button" style="background-color: ${colors.accent}; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">Go to Your Dashboard</a>
    <br>
    <p>Best regards,<br>The YPF Africa Team</p>
  `;

  const htmlBody = generateBaseHtml(subject, content);

  const textContent = `Hi ${name},\n\nWelcome to YPF Africa! We are thrilled to have you join our community.\n\nVisit your dashboard to get started: https://your-app-url.com/login\n\nBest regards,\nThe YPF Africa Team`;

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
    <div style="background-color: ${colors.muted}; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
      <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: ${colors.primary};">${otp}</span>
    </div>
    <p><strong>This code will expire in 6 minutes.</strong></p>
    <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
    <p>Best regards,<br>The YPF Africa Team</p>
  `;

  const htmlBody = generateBaseHtml(subject, content);

  const textContent = `You have requested to reset your password.\n\nYour verification code is: ${otp}\n\nThis code will expire in 6 minutes.\n\nIf you did not request a password reset, please ignore this email.\n\nBest regards,\nThe YPF Africa Team`;

  await sendEmail(to, subject, htmlBody, textContent);
}

/**
 * Sends a donation acknowledgement email to a donor.
 * @param to - The recipient's email address.
 * @param donorName - The donor's name to personalize the email.
 * @param amount - The donation amount.
 * @param currency - The currency code (e.g., GHS, USD).
 * @param donationId - The unique donation ID for reference.
 */
export async function sendAcknowledgementEmail(
  to: string,
  donorName: string,
  amount: string,
  currency: string,
  donationId: string,
): Promise<void> {
  const subject = "Thank You for Your Donation!";

  const content = `
    <p>Dear ${donorName},</p>
    <p>Thank you for your generous donation to YPF Africa!</p>
    <div style="background-color: ${colors.muted}; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: ${colors.mutedForeground};">Donation Details:</p>
      <p style="margin: 10px 0 5px 0; font-size: 18px; font-weight: bold; color: ${colors.foreground};">Amount: ${currency} ${amount}</p>
      <p style="margin: 0; font-size: 12px; color: ${colors.mutedForeground};">Reference ID: ${donationId}</p>
    </div>
    <br>
    <p>With gratitude,<br>The YPF Africa Team</p>
  `;

  const htmlBody = generateBaseHtml(subject, content);

  const textContent = [
    `Dear ${donorName},`,
    "",
    "Thank you for your generous donation to YPF Africa!",
    "",
    "Donation Details:",
    `Amount: ${currency} ${amount}`,
    `Reference ID: ${donationId}`,
    "",
    "With gratitude,",
    "The YPF Africa Team",
  ].join("\n");

  await sendEmail(to, subject, htmlBody, textContent);
}
