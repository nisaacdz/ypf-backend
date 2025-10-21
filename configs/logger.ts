import pino from "pino";
import variables from "./env";

const logger = pino({
  level: variables.app.isProduction ? "info" : "debug",

  transport: variables.app.isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      },
});

export default logger;
