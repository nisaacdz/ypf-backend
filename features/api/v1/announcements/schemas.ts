import { z } from "zod";
import {
  AudienceRule,
  AtomicRule,
  CompositeRule,
} from "@/shared/types/targeting";

// --- Recursive AudienceRule Schema ---

// 1. Atomic Rules
const AllConstituentsRuleSchema = z.object({
  kind: z.literal("CONSTITUENTS"),
  filters: z
    .object({
      isActive: z.boolean().optional(),
      hasEmail: z.boolean().optional(),
    })
    .optional(),
});

const SpecificUsersRuleSchema = z.object({
  kind: z.literal("SPECIFIC_USERS"),
  constituentIds: z.array(z.uuid()),
});

const MemberRuleSchema = z.object({
  kind: z.literal("MEMBERS"),
  scope: z
    .object({
      chapterId: z.uuid().optional(),
      committeeId: z.uuid().optional(),
    })
    .optional(),
  status: z.enum(["ACTIVE", "PAST", "ALL"]).optional(),
  roles: z.array(z.string()).optional(),
});

const VolunteerRuleSchema = z.object({
  kind: z.literal("VOLUNTEERS"),
  status: z.enum(["ACTIVE", "PAST", "ALL"]).optional(),
});

const AdminRuleSchema = z.object({
  kind: z.literal("ADMINS"),
  roles: z.array(z.enum(["SUPER_ADMIN", "REGULAR_ADMIN"])).optional(),
  status: z.enum(["ACTIVE", "PAST", "ALL"]).optional(),
});

const ProfileRuleSchema = z.object({
  kind: z.literal("PROFILES"),
  profileType: z.enum(["DIRECTOR", "AUDITOR"]),
  status: z.enum(["ACTIVE", "PAST", "ALL"]).optional(),
});

const LeaderRuleSchema = z.object({
  kind: z.literal("LEADERS"),
  status: z.enum(["ACTIVE", "PAST", "ALL"]).optional(),
});

const DonorRuleSchema = z.object({
  kind: z.literal("DONORS"),
  minTotalDonation: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  period: z
    .object({
      start: z.iso.datetime().optional(),
      end: z.iso.datetime().optional(),
    })
    .optional(),
});

const AtomicRuleSchema = z.discriminatedUnion("kind", [
  AllConstituentsRuleSchema,
  SpecificUsersRuleSchema,
  MemberRuleSchema,
  VolunteerRuleSchema,
  AdminRuleSchema,
  ProfileRuleSchema,
  LeaderRuleSchema,
  DonorRuleSchema,
]);

// 2. Composite Rules (Recursive)
const AudienceRuleSchema: z.ZodType<AudienceRule> = z.lazy(() =>
  z.union([
    AtomicRuleSchema,
    z.object({
      op: z.literal("OR"),
      rules: z.array(AudienceRuleSchema),
    }),
    z.object({
      op: z.literal("AND"),
      rules: z.array(AudienceRuleSchema),
    }),
    z.object({
      op: z.literal("NOT"),
      rule: AudienceRuleSchema,
    }),
  ]),
);

// --- Announcement Schemas ---

export const CreateAnnouncementSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  targetCriteria: AudienceRuleSchema,
  status: z.enum(["DRAFT", "PUBLISHED"]).optional().default("DRAFT"),
  sendAt: z.iso.datetime().optional(), // For scheduled sending (future impl)
  // channel: z.enum(["EMAIL", "SMS", "PUSH"]).default("EMAIL"), // Future proofing
});

export type CreateAnnouncementDto = z.infer<typeof CreateAnnouncementSchema>;
