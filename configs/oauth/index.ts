import * as client from "openid-client";
import envConfig from "../env";

class OAuthConfig {
  private googleClient?: client.Configuration;

  async initialize() {
    try {
      const issuer = new URL("https://accounts.google.com");

      this.googleClient = await client.discovery(
        issuer,
        envConfig.googleAuthClientId,
        {
          client_secret: envConfig.googleAuthClientSecret,
          redirect_uris: envConfig.allowedOrigins.map(
            (origin) => `${origin}/auth/google/callback`,
          ),
        },
        undefined,
        { timeout: 10 },
      );

      console.log("Google OAuth client initialized successfully.");
    } catch (error) {
      console.error("Failed to initialize Google OAuth client:", error);
      throw error;
    }
  }

  get google() {
    if (!this.googleClient) {
      throw new Error("Google Client not initialized");
    }
    return this.googleClient;
  }
}

const oauthConfig = new OAuthConfig();

export default oauthConfig;
