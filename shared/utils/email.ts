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
export async function sendDonationAcknowledgementEmail(params: {
  email: string;
  name: string;
  donation: {
    id: string;
    amount: string;
    currency: string;
  };
}): Promise<void> {
  const subject = "Thank You for Your Donation!";

  const content = `
    <p>Dear ${params.name},</p>
    <p>Thank you for your generous donation to YPF Africa!</p>
    <div style="background-color: ${colors.muted}; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: ${colors.mutedForeground};">Donation Details:</p>
      <p style="margin: 10px 0 5px 0; font-size: 18px; font-weight: bold; color: ${colors.foreground};">Amount: ${params.donation.currency} ${params.donation.amount}</p>
      <p style="margin: 0; font-size: 12px; color: ${colors.mutedForeground};">Reference ID: ${params.donation.id}</p>
    </div>
    <br>
    <p>With gratitude,<br>The YPF Africa Team</p>
  `;

  const htmlBody = generateBaseHtml(subject, content);

  const textContent = [
    `Dear ${params.name},`,
    "",
    "Thank you for your generous donation to YPF Africa!",
    "",
    "Donation Details:",
    `Amount: ${params.donation.currency} ${params.donation.amount}`,
    `Reference ID: ${params.donation.id}`,
    "",
    "With gratitude,",
    "The YPF Africa Team",
  ].join("\n");

  await sendEmail(params.email, subject, htmlBody, textContent);
}

/**
 * Sends a transaction failure email to a user.
 * @param params - Email parameters including recipient info and transaction details
 */
export async function sendTransactionFailureEmail(params: {
  email: string;
  name: string;
  transaction: {
    id: string;
    amount: string;
    currency: string;
    type: string; // e.g., "donation", "dues payment", "order"
  };
}): Promise<void> {
  const subject = "Payment Transaction Failed";

  const content = `
    <p>Dear ${params.name},</p>
    <p>We regret to inform you that your recent ${params.transaction.type} payment could not be processed.</p>
    <div style="background-color: ${colors.muted}; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: ${colors.mutedForeground};">Transaction Details:</p>
      <p style="margin: 10px 0 5px 0; font-size: 18px; font-weight: bold; color: ${colors.foreground};">Amount: ${params.transaction.currency} ${params.transaction.amount}</p>
      <p style="margin: 0; font-size: 12px; color: ${colors.mutedForeground};">Reference ID: ${params.transaction.id}</p>
    </div>
    <p>This may have happened due to insufficient funds, card limitations, or network issues. Please try again or contact your bank for more information.</p>
    <p>If you continue to experience issues, please contact our support team.</p>
    <br>
    <p>Best regards,<br>The YPF Africa Team</p>
  `;

  const htmlBody = generateBaseHtml(subject, content);

  const textContent = [
    `Dear ${params.name},`,
    "",
    `We regret to inform you that your recent ${params.transaction.type} payment could not be processed.`,
    "",
    "Transaction Details:",
    `Amount: ${params.transaction.currency} ${params.transaction.amount}`,
    `Reference ID: ${params.transaction.id}`,
    "",
    "This may have happened due to insufficient funds, card limitations, or network issues.",
    "Please try again or contact your bank for more information.",
    "",
    "Best regards,",
    "The YPF Africa Team",
  ].join("\n");

  await sendEmail(params.email, subject, htmlBody, textContent);
}

/**
 * Sends a transaction refund email to a user.
 * @param params - Email parameters including recipient info and transaction details
 */
export async function sendTransactionRefundEmail(params: {
  email: string;
  name: string;
  transaction: {
    id: string;
    amount: string;
    currency: string;
    type: string; // e.g., "donation", "dues payment", "order"
  };
}): Promise<void> {
  const subject = "Payment Refunded";

  const content = `
    <p>Dear ${params.name},</p>
    <p>Your ${params.transaction.type} payment has been refunded.</p>
    <div style="background-color: ${colors.muted}; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: ${colors.mutedForeground};">Refund Details:</p>
      <p style="margin: 10px 0 5px 0; font-size: 18px; font-weight: bold; color: ${colors.foreground};">Amount: ${params.transaction.currency} ${params.transaction.amount}</p>
      <p style="margin: 0; font-size: 12px; color: ${colors.mutedForeground};">Reference ID: ${params.transaction.id}</p>
    </div>
    <p>The refunded amount should appear in your account within 5-10 business days, depending on your bank or payment provider.</p>
    <p>If you have any questions about this refund, please contact our support team.</p>
    <br>
    <p>Best regards,<br>The YPF Africa Team</p>
  `;

  const htmlBody = generateBaseHtml(subject, content);

  const textContent = [
    `Dear ${params.name},`,
    "",
    `Your ${params.transaction.type} payment has been refunded.`,
    "",
    "Refund Details:",
    `Amount: ${params.transaction.currency} ${params.transaction.amount}`,
    `Reference ID: ${params.transaction.id}`,
    "",
    "The refunded amount should appear in your account within 5-10 business days.",
    "",
    "Best regards,",
    "The YPF Africa Team",
  ].join("\n");

  await sendEmail(params.email, subject, htmlBody, textContent);
}

/**
 * Sends a dues payment acknowledgement email.
 * @param params - Email parameters including recipient info and payment details
 */
export async function sendDuesPaymentAcknowledgementEmail(params: {
  email: string;
  name: string;
  payment: {
    id: string;
    amount: string;
    currency: string;
    period: string;
  };
}): Promise<void> {
  const subject = "Dues Payment Received";

  const content = `
    <p>Dear ${params.name},</p>
    <p>Thank you for your dues payment!</p>
    <div style="background-color: ${colors.muted}; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: ${colors.mutedForeground};">Payment Details:</p>
      <p style="margin: 10px 0 5px 0; font-size: 18px; font-weight: bold; color: ${colors.foreground};">Amount: ${params.payment.currency} ${params.payment.amount}</p>
      <p style="margin: 5px 0; font-size: 14px; color: ${colors.foreground};">Period: ${params.payment.period}</p>
      <p style="margin: 0; font-size: 12px; color: ${colors.mutedForeground};">Reference ID: ${params.payment.id}</p>
    </div>
    <p>Your membership status has been updated. Thank you for your continued support of YPF Africa!</p>
    <br>
    <p>Best regards,<br>The YPF Africa Team</p>
  `;

  const htmlBody = generateBaseHtml(subject, content);

  const textContent = [
    `Dear ${params.name},`,
    "",
    "Thank you for your dues payment!",
    "",
    "Payment Details:",
    `Amount: ${params.payment.currency} ${params.payment.amount}`,
    `Period: ${params.payment.period}`,
    `Reference ID: ${params.payment.id}`,
    "",
    "Your membership status has been updated.",
    "",
    "Best regards,",
    "The YPF Africa Team",
  ].join("\n");

  await sendEmail(params.email, subject, htmlBody, textContent);
}

/**
 * Sends an order confirmation email.
 * @param params - Email parameters including recipient info and order details
 */
export async function sendOrderConfirmationEmail(params: {
  email: string;
  name: string;
  order: {
    id: string;
    amount: string;
    currency: string;
  };
}): Promise<void> {
  const subject = "Order Confirmed";

  const content = `
    <p>Dear ${params.name},</p>
    <p>Thank you for your order! We have received your payment and are processing your order.</p>
    <div style="background-color: ${colors.muted}; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: ${colors.mutedForeground};">Order Details:</p>
      <p style="margin: 10px 0 5px 0; font-size: 18px; font-weight: bold; color: ${colors.foreground};">Total: ${params.order.currency} ${params.order.amount}</p>
      <p style="margin: 0; font-size: 12px; color: ${colors.mutedForeground};">Order ID: ${params.order.id}</p>
    </div>
    <p>We will notify you once your order is ready for pickup or has been shipped.</p>
    <br>
    <p>Best regards,<br>The YPF Africa Team</p>
  `;

  const htmlBody = generateBaseHtml(subject, content);

  const textContent = [
    `Dear ${params.name},`,
    "",
    "Thank you for your order! We have received your payment and are processing your order.",
    "",
    "Order Details:",
    `Total: ${params.order.currency} ${params.order.amount}`,
    `Order ID: ${params.order.id}`,
    "",
    "We will notify you once your order is ready for pickup or has been shipped.",
    "",
    "Best regards,",
    "The YPF Africa Team",
  ].join("\n");

  await sendEmail(params.email, subject, htmlBody, textContent);
}
