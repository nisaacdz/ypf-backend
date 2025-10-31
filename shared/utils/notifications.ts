import { InferSelectModel } from "drizzle-orm";
import { AnnouncementBroadCasts } from "@/db/schema/activities";
// involves adding notification entries for the associated constituents of this NotificationBroadcast
// create a notification for the users and reference the broadcastId as annoucementBroadcast.id
//
export function propagateannouncement(
  announcementBroadcast: InferSelectModel<typeof AnnouncementBroadCasts>,
) {
  if (announcementBroadcast.chapterId) {
    // notify all this chapter members
  } else if (announcementBroadcast.committeeId) {
    // notify all this committee members
  } else {
    // notify everyone
  }
}

export function broadcastannouncements() {}
