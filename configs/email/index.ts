import nodemailer from "nodemailer";
import envConfig from "../env";

class EmailConfig {
  transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: envConfig.smtpHost,
      port: envConfig.smtpPort,
      secure: true,
      auth: {
        user: envConfig.smtpUser,
        pass: envConfig.smtpPass,
      },
    });
  }

  public async initialize() {
    const result = await this.transporter.verify();
    if (result) {
      console.log("Email transporter is ready to send emails");
    } else {
      console.error("Error setting up email transporter");
    }

    return result;
  }
}

const emailConfig = new EmailConfig();

export default emailConfig;
