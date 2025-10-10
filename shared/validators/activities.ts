import z from "zod";
import { ProjectStatus as ProjectStatusEnum } from "@/db/schema/enums";
import { PaginationQuery } from ".";

export const GetProjectsQuerySchema = z.object({
    filterStatus: z.enum(ProjectStatusEnum.enumValues).optional(),
    ...PaginationQuery.shape
});

export const CreateEventSchema = z.object({
    title: z.string().min(3).max(100),
    description: z.string().min(10).max(1000),
    location: z.string().min(3).max(255),
});
