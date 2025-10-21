import { eq, count } from "drizzle-orm";
import schema from "@/db/schema";
import pgPool from "@/configs/db";
import z from "zod";
import { GetEventMediaQuerySchema } from "../validators/activities";
import * as mediaUtils from "@/shared/utils/media";

export async function fetchEventMedia(
  eventId: string,
  query: z.infer<typeof GetEventMediaQuerySchema>,
) {
  const { page, pageSize } = query;

  const [itemsItems, total] = await Promise.all([
    pgPool.db
      .select({
        id: schema.EventMedia.id,
        caption: schema.EventMedia.caption,
        isFeatured: schema.EventMedia.isFeatured,
        medium: {
          id: schema.Medium.id,
          externalId: schema.Medium.externalId,
          type: schema.Medium.type,
          width: schema.Medium.width,
          height: schema.Medium.height,
          sizeInBytes: schema.Medium.sizeInBytes,
          uploadedAt: schema.Medium.uploadedAt,
        },
      })
      .from(schema.EventMedia)
      .innerJoin(
        schema.Medium,
        eq(schema.EventMedia.mediumId, schema.Medium.id),
      )
      .where(eq(schema.EventMedia.eventId, eventId))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    pgPool.db
      .select({ count: count() })
      .from(schema.EventMedia)
      .where(eq(schema.EventMedia.eventId, eventId))
      .then((res) => res[0].count),
  ]);

  const items = itemsItems.map((m) => ({
    ...m,
    caption: m.caption || undefined,
    medium: {
      id: m.medium.id,
      type: m.medium.type,
      sizeInBytes: m.medium.sizeInBytes,
      uploadedAt: m.medium.uploadedAt,
      url: mediaUtils.generateSignedMediaUrl(m.medium.externalId, {
        resolution: 480,
        expireSeconds: 60 * 60 * 24,
      }),
      dimensions: {
        width: m.medium.width,
        height: m.medium.height,
      },
    },
  }));

  return { items, total };
}
