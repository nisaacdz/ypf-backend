import z from "zod";
import {
  ProjectStatus as ProjectStatusEnum,
  EventStatus as EventStatusEnum,
} from "@/db/schema/enums";
import { PaginationQuery } from ".";

export const GetProjectsQuerySchema = z.object({
  filterStatus: z.enum(ProjectStatusEnum.enumValues).optional(),
  ...PaginationQuery.shape,
});

export const CreateEventSchema = z.object({
  name: z.string().min(3).max(100),
  objective: z.string().optional(),
  location: z.string(),
  scheduledStart: z.coerce.date(),
  scheduledEnd: z.coerce.date(),
  status: z.enum(EventStatusEnum.enumValues),
  projectId: z.uuid(),
});
