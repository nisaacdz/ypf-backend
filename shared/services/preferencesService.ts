import { eq } from "drizzle-orm";
import dbClient from "@/configs/db";
import schema from "@/db/schema";

export type UserPreferencesData = {
  twoFactorEnabled: boolean;
  sensitiveChangeAlerts: boolean;
  notifyAnnouncements: boolean;
  notifyEvents: boolean;
  notifyDues: boolean;
};

const DEFAULTS: UserPreferencesData = {
  twoFactorEnabled: false,
  sensitiveChangeAlerts: true,
  notifyAnnouncements: true,
  notifyEvents: true,
  notifyDues: true,
};

export async function getPreferences(
  userId: string,
): Promise<UserPreferencesData> {
  const [row] = await dbClient.db
    .select({
      twoFactorEnabled: schema.UserPreferences.twoFactorEnabled,
      sensitiveChangeAlerts: schema.UserPreferences.sensitiveChangeAlerts,
      notifyAnnouncements: schema.UserPreferences.notifyAnnouncements,
      notifyEvents: schema.UserPreferences.notifyEvents,
      notifyDues: schema.UserPreferences.notifyDues,
    })
    .from(schema.UserPreferences)
    .where(eq(schema.UserPreferences.userId, userId));

  return row ?? DEFAULTS;
}

export async function updatePreferences(
  userId: string,
  updates: Partial<UserPreferencesData>,
): Promise<UserPreferencesData> {
  const [existing] = await dbClient.db
    .select({ id: schema.UserPreferences.id })
    .from(schema.UserPreferences)
    .where(eq(schema.UserPreferences.userId, userId));

  if (existing) {
    await dbClient.db
      .update(schema.UserPreferences)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.UserPreferences.userId, userId));
  } else {
    await dbClient.db.insert(schema.UserPreferences).values({
      userId,
      ...DEFAULTS,
      ...updates,
    });
  }

  return getPreferences(userId);
}
