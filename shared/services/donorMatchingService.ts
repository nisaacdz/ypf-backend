import { eq, and } from "drizzle-orm";
import pgPool from "@/configs/db";
import schema from "@/db/schema";
import logger from "@/configs/logger";

interface DonorInfo {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  salutation?: string;
}

interface MatchedConstituent {
  constituentId: string;
  matched: boolean;
  matchMethod?: "email" | "phone" | "new";
}

/**
 * Normalizes email addresses for comparison
 */
function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Normalizes phone numbers for comparison
 * Removes spaces, dashes, parentheses, plus signs, and handles common variations
 */
function normalizePhone(phone: string): string {
  // Remove all non-digit characters
  const normalized = phone.replace(/\D/g, "");

  // If it starts with country code 233 (Ghana) and has extra digits, keep full number
  // Otherwise, keep the normalized version
  // This handles cases like +233 XX XXX XXXX, 0XX XXX XXXX, etc.
  // For Ghana: +233 24 123 4567 => 233241234567, 024 123 4567 => 241234567 (remove leading 0)
  if (normalized.startsWith("233") && normalized.length > 10) {
    // Keep full international format
    return normalized;
  } else if (normalized.startsWith("0") && normalized.length > 9) {
    // Remove leading 0 for local numbers (common in Ghana: 024 => 24)
    return normalized.substring(1);
  }

  return normalized;
}

/**
 * Finds or creates a constituent based on the provided information
 *
 * @param donorInfo - The donor's information
 * @param anonymous - Whether this is an anonymous donation (if true, returns null)
 * @returns The constituent ID, or null for anonymous donations
 */
export async function findOrCreateConstituent(
  donorInfo: DonorInfo,
  anonymous: boolean = false,
): Promise<MatchedConstituent | null> {
  // Short-circuit for anonymous donations
  if (anonymous) {
    return null;
  }

  const { firstName, lastName, email, phone, salutation } = donorInfo;

  try {
    // Tier 1: Email matching (95% confidence)
    if (email) {
      const normalizedEmail = normalizeEmail(email);

      const existingContact =
        await pgPool.db.query.ContactInformations.findFirst({
          where: and(
            eq(schema.ContactInformations.contactType, "EMAIL"),
            eq(schema.ContactInformations.value, normalizedEmail),
          ),
          with: {
            constituent: true,
          },
        });

      if (existingContact?.constituent) {
        logger.info(`Matched constituent by email: ${normalizedEmail}`);
        return {
          constituentId: existingContact.constituent.id,
          matched: true,
          matchMethod: "email",
        };
      }
    }

    // Tier 2: Phone matching (85% confidence)
    if (phone) {
      const normalizedPhone = normalizePhone(phone);

      const existingContact =
        await pgPool.db.query.ContactInformations.findFirst({
          where: and(
            eq(schema.ContactInformations.contactType, "PHONE"),
            eq(schema.ContactInformations.value, normalizedPhone),
          ),
          with: {
            constituent: true,
          },
        });

      if (existingContact?.constituent) {
        logger.info(`Matched constituent by phone: ${normalizedPhone}`);
        return {
          constituentId: existingContact.constituent.id,
          matched: true,
          matchMethod: "phone",
        };
      }
    }

    // No match found - create new constituent
    logger.info(`Creating new constituent: ${firstName} ${lastName}`);

    const [newConstituent] = await pgPool.db
      .insert(schema.Constituents)
      .values({
        firstName,
        lastName,
        salutation: salutation || null,
      })
      .returning();

    // Create contact information
    if (email) {
      await pgPool.db.insert(schema.ContactInformations).values({
        constituentId: newConstituent.id,
        contactType: "EMAIL",
        value: normalizeEmail(email),
        isPrimary: true,
      });
    }

    if (phone) {
      await pgPool.db.insert(schema.ContactInformations).values({
        constituentId: newConstituent.id,
        contactType: "PHONE",
        value: normalizePhone(phone),
        isPrimary: !email, // Primary if no email provided
      });
    }

    logger.info(`Created new constituent: ${newConstituent.id}`);
    return {
      constituentId: newConstituent.id,
      matched: false,
      matchMethod: "new",
    };
  } catch (error) {
    logger.error({ error }, "Error in findOrCreateConstituent");
    throw error;
  }
}
