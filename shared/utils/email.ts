import nodemailer from "nodemailer";
import variables from "@/configs/env";
import emailer from "@/configs/emailer";
import logger from "@/configs/logger";
import { marked } from "marked";

const colors = {
  primary: "#301F6E",
  accent: "#FF8C02",
  foreground: "#09090B",
  background: "#FFFFFF",
  muted: "#F4F4F5",
  mutedForeground: "#71717A",
  border: "#E4E4E7",
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
        body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: ${colors.muted}; color: ${colors.foreground}; }
        a { color: ${colors.accent}; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .button { display: inline-block; background-color: ${colors.accent}; color: #ffffff !important; padding: 12px 24px; border-radius: 6px; font-weight: 600; text-decoration: none; margin-top: 16px; }
        .button:hover { background-color: #e67e00; text-decoration: none; }
        .content h1, .content h2, .content h3 { color: ${colors.primary}; margin-top: 24px; margin-bottom: 16px; }
        .content p { margin-bottom: 16px; line-height: 1.6; }
        .content ul, .content ol { margin-bottom: 16px; padding-left: 24px; }
        .content li { margin-bottom: 8px; }
        .content blockquote { border-left: 4px solid ${colors.border}; margin: 0; padding-left: 16px; color: ${colors.mutedForeground}; }
        .content img { max-width: 100%; height: auto; border-radius: 4px; }
      </style>
    </head>
    <body>
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: ${colors.background}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
              
              <!-- Header -->
              <tr>
                <td align="center" style="padding: 32px; background-color: ${colors.background}; border-bottom: 1px solid ${colors.border};">
                  <img src="${logoUrl}" alt="YPF Africa Logo" width="64" style="display: block; margin-bottom: 12px;">
                  <div style="font-size: 20px; font-weight: 700; color: ${colors.primary}; letter-spacing: -0.025em;">YPF Africa</div>
                </td>
              </tr>

              <!-- Main Content -->
              <tr>
                <td class="content" style="padding: 40px 32px; font-size: 16px;">
                  ${contentHtml}
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td align="center" style="padding: 32px; background-color: ${colors.muted}; border-top: 1px solid ${colors.border};">
                  <p style="margin: 0 0 8px 0; font-size: 12px; color: ${colors.mutedForeground};">&copy; ${year} YPF Africa. All rights reserved.</p>
                  <p style="margin: 0; font-size: 12px; color: ${colors.mutedForeground};">
                    Empowering Youths to Change Ghana and Africa
                  </p>
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
  to: string | string[],
  subject: string,
  html: string,
  text?: string,
  isBcc: boolean = false,
): Promise<void> => {
  if (variables.app.environment === "test") {
    return;
  }

  const mailOptions: nodemailer.SendMailOptions = {
    from: `"YPF Africa" <${variables.services.email.sender}>`,
    subject,
    html,
    text,
  };

  if (isBcc) {
    mailOptions.bcc = to;
    // When using BCC, 'to' field is usually the sender or a noreply address to avoid empty 'To' header issues in some clients
    mailOptions.to = variables.services.email.sender;
  } else {
    mailOptions.to = to;
  }

  try {
    const info = await emailer.transporter.sendMail(mailOptions);
    logger.info(
      `Email sent to ${Array.isArray(to) ? to.length : 1} recipient(s). Message ID: ${info.messageId}`,
    );
  } catch (error) {
    logger.error(error, `Error sending email:`);
    throw new Error(
      `Failed to send email: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

/**
 * Sends an announcement to a list of recipients.
 * Uses BCC for privacy and efficiency.
 * Converts Markdown content to HTML.
 */
export async function sendAnnouncementEmail(
  recipients: string[],
  title: string,
  markdownContent: string,
): Promise<void> {
  if (!recipients.length) return;

  // Convert markdown to HTML
  const htmlContent = marked.parse(markdownContent);

  const htmlBody = generateBaseHtml(
    title,
    `
    <h1 style="margin-top: 0;">${title}</h1>
    ${htmlContent}
    `,
  );

  await sendEmail(recipients, title, htmlBody, undefined, true);
}

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
    <a href="https://dashboard.ypfafrica.live" class="button">Go to Your Dashboard</a>
    <br><br>
    <p>Best regards,<br>The YPF Africa Team</p>
  `;

  const htmlBody = generateBaseHtml(subject, content);

  const textContent = `Hi ${name},\n\nWelcome to YPF Africa! We are thrilled to have you join our community.\n\nVisit your dashboard to get started: https://dashboard.ypfafrica.live\n\nBest regards,\nThe YPF Africa Team`;

  await sendEmail(to, subject, htmlBody, textContent);
}

/**
 * Sends an OTP (One-Time Password) email to a user.
 * @param to - The recipient's email address.
 * @param otp - The 6-digit OTP code.
 */
export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const subject = "Password Reset Code";

  const content = `
    <p>You have requested to reset your password.</p>
    <p>Your verification code is:</p>
    <div style="background-color: ${colors.muted}; padding: 24px; text-align: center; border-radius: 8px; margin: 24px 0;">
      <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: ${colors.primary}; font-family: monospace;">${otp}</span>
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
    <div style="background-color: ${colors.muted}; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid ${colors.border};">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: ${colors.mutedForeground}; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Donation Details</p>
      <p style="margin: 0 0 4px 0; font-size: 24px; font-weight: 700; color: ${colors.foreground};">${params.donation.currency} ${params.donation.amount}</p>
      <p style="margin: 0; font-size: 12px; color: ${colors.mutedForeground}; font-family: monospace;">Ref: ${params.donation.id}</p>
    </div>
    <p>Your support helps us continue our mission of empowering youths across Africa.</p>
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
    <div style="background-color: #FEF2F2; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #FECACA;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #991B1B; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Transaction Details</p>
      <p style="margin: 0 0 4px 0; font-size: 24px; font-weight: 700; color: #7F1D1D;">${params.transaction.currency} ${params.transaction.amount}</p>
      <p style="margin: 0; font-size: 12px; color: #991B1B; font-family: monospace;">Ref: ${params.transaction.id}</p>
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
    <div style="background-color: ${colors.muted}; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid ${colors.border};">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: ${colors.mutedForeground}; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Refund Details</p>
      <p style="margin: 0 0 4px 0; font-size: 24px; font-weight: 700; color: ${colors.foreground};">${params.transaction.currency} ${params.transaction.amount}</p>
      <p style="margin: 0; font-size: 12px; color: ${colors.mutedForeground}; font-family: monospace;">Ref: ${params.transaction.id}</p>
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
    <div style="background-color: ${colors.muted}; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid ${colors.border};">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: ${colors.mutedForeground}; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Payment Details</p>
      <p style="margin: 0 0 4px 0; font-size: 24px; font-weight: 700; color: ${colors.foreground};">${params.payment.currency} ${params.payment.amount}</p>
      <p style="margin: 0 0 4px 0; font-size: 16px; color: ${colors.foreground};">Period: ${params.payment.period}</p>
      <p style="margin: 0; font-size: 12px; color: ${colors.mutedForeground}; font-family: monospace;">Ref: ${params.payment.id}</p>
    </div>
    <p>Our records have been updated. Thank you for your continued support of YPF Africa!</p>
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
    <div style="background-color: ${colors.muted}; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid ${colors.border};">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: ${colors.mutedForeground}; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Order Details</p>
      <p style="margin: 0 0 4px 0; font-size: 24px; font-weight: 700; color: ${colors.foreground};">${params.order.currency} ${params.order.amount}</p>
      <p style="margin: 0; font-size: 12px; color: ${colors.mutedForeground}; font-family: monospace;">Order ID: ${params.order.id}</p>
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

/**
 * Sends an order placement email with payment link.
 * @param params - Email parameters including recipient info, order details, and payment URL
 */
export async function sendOrderPlacementEmail(params: {
  email: string;
  name: string;
  order: {
    id: string;
    amount: string;
    currency: string;
    items: Array<{
      name: string;
      quantity: number;
      price: string;
    }>;
  };
}): Promise<void> {
  const subject = "Complete Your Order Payment";

  const itemsList = params.order.items
    .map(
      (item) =>
        `<li style="margin: 5px 0; color: ${colors.foreground};">${item.quantity}x ${item.name} - <span style="font-weight: 600;">${params.order.currency} ${item.price}</span></li>`,
    )
    .join("");

  const content = `
    <p>Dear ${params.name},</p>
    <p>Thank you for placing an order with YPF Africa! Your order has been created and is awaiting payment.</p>
    <div style="background-color: ${colors.muted}; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid ${colors.border};">
      <p style="margin: 0 0 12px 0; font-size: 14px; color: ${colors.mutedForeground}; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Order Summary</p>
      <ul style="list-style: none; padding: 0; margin: 0 0 16px 0;">
        ${itemsList}
      </ul>
      <div style="border-top: 1px solid ${colors.border}; padding-top: 12px;">
        <p style="margin: 0 0 4px 0; font-size: 14px; color: ${colors.mutedForeground};">Total Amount</p>
        <p style="margin: 0; font-size: 24px; font-weight: 700; color: ${colors.foreground};">${params.order.currency} ${params.order.amount}</p>
      </div>
      <p style="margin: 8px 0 0 0; font-size: 12px; color: ${colors.mutedForeground}; font-family: monospace;">Order ID: ${params.order.id}</p>
    </div>
    <p>Please complete your payment to process your order.</p>
    <br>
    <p>Once payment is confirmed, we will send you a receipt and begin processing your order.</p>
    <br>
    <p>Best regards,<br>The YPF Africa Team</p>
  `;

  const htmlBody = generateBaseHtml(subject, content);

  const itemsText = params.order.items
    .map(
      (item) =>
        `  ${item.quantity}x ${item.name} - ${params.order.currency} ${item.price}`,
    )
    .join("\n");

  const textContent = [
    `Dear ${params.name},`,
    "",
    "Thank you for placing an order with YPF Africa! Your order has been created and is awaiting payment.",
    "",
    "Order Details:",
    itemsText,
    `Total: ${params.order.currency} ${params.order.amount}`,
    `Order ID: ${params.order.id}`,
    "",
    "Please complete your payment to process your order.",
    "",
    "Once payment is confirmed, we will send you a receipt and begin processing your order.",
    "",
    "Best regards,",
    "The YPF Africa Team",
  ].join("\n");

  await sendEmail(params.email, subject, htmlBody, textContent);
}

/**
 * Sends an onboarding invitation email to a constituent who has been onboarded.
 * @param params - Email parameters including recipient info and onboarding link
 */
export async function sendOnboardingInvitationEmail(params: {
  email: string;
  name: string;
  onboardingUrl: string;
}): Promise<void> {
  const subject = "Welcome to YPF Africa - Complete Your Account Setup";

  const content = `
    <p>Dear ${params.name},</p>
    <p>Congratulations! You have been invited to join the YPF Africa platform.</p>
    <p>To complete your account setup and gain access to your dashboard, please click the button below:</p>
    <br>
    <a href="${params.onboardingUrl}" class="button">Complete Account Setup</a>
    <br><br>
    <p>You will be asked to verify your email and set a password to secure your account.</p>
    <p>If you have any questions, please don't hesitate to reach out to our support team.</p>
    <br>
    <p>Best regards,<br>The YPF Africa Team</p>
  `;

  const htmlBody = generateBaseHtml(subject, content);

  const textContent = [
    `Dear ${params.name},`,
    "",
    "Congratulations! You have been invited to join the YPF Africa platform.",
    "",
    "To complete your account setup and gain access to your dashboard, please visit:",
    params.onboardingUrl,
    "",
    "You will be asked to verify your email and set a password to secure your account.",
    "",
    "Best regards,",
    "The YPF Africa Team",
  ].join("\n");

  await sendEmail(params.email, subject, htmlBody, textContent);
}

/**
 * Sends an acknowledgement email to an applicant.
 * @param params - Email parameters including recipient info
 */
export async function sendApplicationAcknowledgementEmail(params: {
  email: string;
  name: string;
}): Promise<void> {
  const subject = "Application Received - YPF Africa";

  const content = `
    <p>Dear ${params.name},</p>
    <p>Thank you for applying to YPF Africa. We have received your application and will review it shortly.</p>
    <br>
    <p>Best regards,<br>The YPF Africa Team</p>
  `;

  const htmlBody = generateBaseHtml(subject, content);

  const textContent = [
    `Dear ${params.name},`,
    "",
    "Thank you for applying to YPF Africa. We have received your application and will review it shortly.",
    "",
    "Best regards,",
    "The YPF Africa Team",
  ].join("\n");

  await sendEmail(params.email, subject, htmlBody, textContent);
}
