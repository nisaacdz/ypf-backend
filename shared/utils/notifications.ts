import { InferSelectModel } from "drizzle-orm";
import { AnnouncementBroadCasts } from "@/db/schema/activities";
import logger from "@/configs/logger";

export function propagateAnnouncementBroadcast(
  announcementBroadcast: InferSelectModel<typeof AnnouncementBroadCasts>,
) {
  logger.info(
    `propagating annoucement broadcast ${announcementBroadcast.id} to subjects`,
  );
  // TODO
}

export function broadcastannouncements() {}
