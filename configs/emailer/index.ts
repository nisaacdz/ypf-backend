import nodemailer from "nodemailer";
import variables from "@/configs/env";
import logger from "@/configs/logger";

class Emailer {
  transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: variables.services.email.host,
      port: 465,
      secure: true,
      auth: {
        user: variables.services.email.user,
        pass: variables.services.email.pass,
      },
    });
  }

  public async initialize() {
    const result = await this.transporter.verify();
    if (result) {
      logger.info("Email transporter is ready to send emails");
    } else {
      logger.error("Error setting up email transporter");
    }

    return result;
  }
}

const emailer = new Emailer();

export default emailer;
