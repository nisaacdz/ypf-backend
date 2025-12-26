// import z from "zod";
// import { WelfareCaseTypeEnum } from "@/db/schema/activities";
// import { PaginationQuery } from "@/shared/validators";

// export const GetWelfareCasesQuerySchema = z.object({
//   filterType: z
//     .enum(WelfareCaseTypeEnum.enumValues, {
//       message: "Invalid welfare case type.",
//     })
//     .optional(),
//   ...PaginationQuery.shape,
// });

// export const CreateWelfareCaseSchema = z.object({
//   title: z
//     .string({ message: "Title is required." })
//     .min(1, { message: "Title is required." }),
//   description: z.string().optional(),
//   date: z.coerce.date().optional(),
//   type: z.enum(WelfareCaseTypeEnum.enumValues, {
//     message: "Invalid welfare case type.",
//   }),
//   beneficiaryIds: z
//     .array(z.uuid({ message: "Invalid beneficiary ID format." }))
//     .optional(),
// });

// export const UpdateWelfareCaseSchema = z
//   .object({
//     title: z.string().min(1, { message: "Title cannot be empty." }).optional(),
//     description: z.string().optional(),
//     date: z.coerce.date().optional(),
//     type: z
//       .enum(WelfareCaseTypeEnum.enumValues, {
//         message: "Invalid welfare case type.",
//       })
//       .optional(),
//   })
//   .refine((data) => Object.keys(data).length > 0, {
//     message: "At least one field must be provided for update.",
//   });
