import "http";
import { AuthenticatedUser } from ".";

declare module "http" {
  interface IncomingMessage {
    User?: AuthenticatedUser;
    Body: any;
    Query: any;
    Params: any;
    File: any;
    Files: any;
  }
}
