import { TransactionStatus } from "@/shared/utils";

export type YPFDonation = {
  id: string;
  amount: string;
  currency: string;
  status: TransactionStatus;
  date: Date;
  donor?: {
    name?: string;
    email?: string;
  };
};
