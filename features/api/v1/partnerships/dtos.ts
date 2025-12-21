import { Medium } from "@/shared/dtos";
import { PartnershipType } from "@/shared/utils";

/**
 * Organization summary for partnership responses
 */
export type YPFOrganization = {
  id: string;
  name: string;
  logoUrl?: string;
  website?: string;
};

/**
 * Project/Event summary for partnership responses
 */
export type YPFPartnershipActivity = {
  id: string;
  name: string;
};

/**
 * Partnership list item DTO
 */
export type YPFPartnership = {
  id: string;
  organization: YPFOrganization;
  partnershipType: PartnershipType;
  startedAt: Date;
  endedAt?: Date;
  value?: string; // monetary value as decimal string
  isActive: boolean;
  project?: YPFPartnershipActivity;
  event?: YPFPartnershipActivity;
};

/**
 * Partnership detail DTO with full information
 */
export type YPFPartnershipDetail = YPFPartnership & {
  metadata?: string; // JSON string for additional structured data
  contractDocument?: {
    id: string;
    type: string;
  };
  organization: YPFOrganization & {
    description?: string;
    isActive: boolean;
  };
};

/**
 * Response for partnership creation/update operations
 */
export type YPFPartnershipMutation = {
  id: string;
  message: string;
};
