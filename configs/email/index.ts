import nodemailer from "nodemailer";
import envConfig from "../env";

const emailConfig = {
  transporter: nodemailer.createTransport({
    host: envConfig.smtpHost,
    port: envConfig.smtpPort,
    secure: true,
    auth: {
      user: envConfig.serviceEmailer,
      pass: envConfig.serviceEmailerPass,
    },
  }),
};

export async function connectEmail() {
  const result = await emailConfig.transporter.verify();
  if (result) {
    console.log("Email transporter is ready to send emails");
  } else {
    console.error("Error setting up email transporter");
  }

  return result;
}

export default emailConfig;
