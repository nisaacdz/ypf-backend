import nodemailer from "nodemailer";
import variables from "@/configs/env";

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
    if (variables.app.isProduction) {
      await this.transporter.verify();
    }
  }
}

const emailer = new Emailer();

export default emailer;
