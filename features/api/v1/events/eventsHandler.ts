import { ApiResponse } from "@/shared/types";
import { CreateEventSchema } from "@/shared/validators";
import { Event, Events } from "@/db/schema/activities";
import z from "zod";
import db from "@/configs/db";

export async function createEvent(
  newEvent: z.infer<typeof CreateEventSchema>,
): Promise<ApiResponse<Event>> {
  const [event] = await db.insert(Events).values(newEvent).returning();
  return {
    success: true,
    message: "Event created successfully",
    data: event,
  };
}
