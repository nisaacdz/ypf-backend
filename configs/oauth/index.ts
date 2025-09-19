import { Issuer, Client, custom } from "openid-client";
import envConfig from "../env";

class OAuthConfig {
  private googleClient?: Client;

  async initialize() {
    custom.setHttpOptionsDefaults({
      timeout: 10000,
    });

    try {
      const googleIssuer = await Issuer.discover("https://accounts.google.com");

      this.googleClient = new googleIssuer.Client({
        client_id: envConfig.googleAuthClientId,
        client_secret: envConfig.googleAuthClientSecret,
        redirect_uris: envConfig.allowedOrigins.map(
          (origin) => `${origin}/auth/google/callback`
        ),
        response_types: ["code"],
      });
      console.log("Google OAuth client initialized successfully.");
    } catch (error) {
      console.error("Failed to initialize Google OAuth client:", error);
    }
  }

  get google() {
    if (!this.googleClient) throw new Error("Google Client not initialized");
    return this.googleClient;
  }
}

const oauthConfig = new OAuthConfig();

export default oauthConfig;
