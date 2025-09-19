import { eq, getTableColumns } from "drizzle-orm";
import { db } from "@/configs/db";
import schema from "../../db/schema";
import { AppError } from "../../shared/types";
import { User, Users } from "@/db/schema/app";

const allColumns = getTableColumns(Users);

const columns = Object.fromEntries(
  Object.keys(allColumns)
    .filter((col) => col !== "password")
    .map((col) => [col, true]),
) as { [K in Exclude<keyof typeof allColumns, "password">]: true };

export async function getUserById(userId: string): Promise<User> {
  const user = await db.query.Users.findFirst({
    columns,
    where: eq(schema.Users.id, userId),
  });
  if (!user) {
    throw new AppError("User not found", 404);
  }
  return user;
}
