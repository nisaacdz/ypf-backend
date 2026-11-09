import { TransactionStatus } from "@/shared/utils";

export type YPFDonation = {
  id: string;
  amount: string;
  currency: string;
  status: TransactionStatus;
  date: Date;
  donor?: {
    name: string;
    email: string;
  };
  /** What the gift supports (null/undefined = where it's needed most). */
  projectId?: string;
  projectTitle?: string;
  purpose?: string;
  /** Ready-to-show label: project title, cause name, or general fund. */
  forLabel: string;
  paymentReference?: string;
};
