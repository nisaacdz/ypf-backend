/**
 * Causes a donor can give to when they don't pick a specific project.
 * Stored in finance.donations.purpose; labels are what donors and staff see.
 */
export const DONATION_PURPOSES = [
  "EDUCATION",
  "HEALTH",
  "CHILD_WELFARE",
  "COMMUNITY",
  "EMERGENCY_RELIEF",
] as const;

export type DonationPurpose = (typeof DONATION_PURPOSES)[number];

export const DONATION_PURPOSE_LABELS: Record<DonationPurpose, string> = {
  EDUCATION: "Education",
  HEALTH: "Health",
  CHILD_WELFARE: "Child welfare",
  COMMUNITY: "Community development",
  EMERGENCY_RELIEF: "Emergency relief",
};

/** Human label for what a donation supports: project title, cause, or general fund. */
export function donationForLabel(input: {
  projectTitle?: string | null;
  purpose?: string | null;
}): string {
  if (input.projectTitle) return input.projectTitle;
  if (input.purpose && input.purpose in DONATION_PURPOSE_LABELS) {
    return DONATION_PURPOSE_LABELS[input.purpose as DonationPurpose];
  }
  return "Where it's needed most";
}
