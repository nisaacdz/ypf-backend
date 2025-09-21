import nodemailer from "nodemailer";
import variables from "@/configs/env";

class Emailer {
  transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: variables.smtpHost,
      port: 465,
      secure: true,
      auth: {
        user: variables.smtpUser,
        pass: variables.smtpPass,
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

const emailer = new Emailer();

export default emailer;
