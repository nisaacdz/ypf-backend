import nodemailer from "nodemailer";
import variables from "@/configs/env";
import emailer from "@/configs/emailer";

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
 */
const generateBaseHtml = (subject: string, contentHtml: string): string => {
  const year = variables.year;

  return "";
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
    from: `"${"YPF Africa"}" <${variables.emailer}>`,
    to: to,
    subject: subject,
    html: htmlBody,
  };
  if (textContent) {
    mailOptions.text = textContent;
  }

  try {
    const info = await emailer.transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}. Message ID: ${info.messageId}`);
  } catch (error) {
    console.error(`Error sending email to ${to}:`, error);
    throw new Error(
      `Failed to send email: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};
