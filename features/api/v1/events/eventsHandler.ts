import { ApiResponse, AppError } from "@/shared/types";
import { CreateEventSchema } from "@/shared/validators/activities";
import { Events } from "@/db/schema/activities";
import z from "zod";
import pgPool from "@/configs/db";

export async function createEvent(
  newEvent: z.infer<typeof CreateEventSchema>
): Promise<ApiResponse<null>> {
  const d = await pgPool.db.insert(Events).values(newEvent).returning();
  if (!d?.length) {
    throw new AppError("A server error occurred", 500);
  }
  return {
    success: true,
    message: "Event created successfully",
    data: null,
  };
}
