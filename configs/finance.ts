import variables from "./env";

/**
 * Flutterwave Payment Gateway Configuration
 *
 * This module exports the necessary Flutterwave configurations
 * for processing financial transactions.
 */

export const flutterwaveConfig = {
  /**
   * Public key for client-side Flutterwave integrations
   */
  publicKey: variables.services.flutterwave.publicKey,

  /**
   * Secret key for server-side API calls to Flutterwave
   */
  secretKey: variables.services.flutterwave.secretKey,

  /**
   * Encryption key for encrypting payment data
   */
  encryptionKey: variables.services.flutterwave.encryptionKey,

  /**
   * Webhook secret hash for verifying webhook signatures
   */
  webhookSecret: variables.services.flutterwave.webhookSecret,

  /**
   * Base URL for Flutterwave API
   */
  baseUrl: "https://api.flutterwave.com/v3",
} as const;

export default flutterwaveConfig;
