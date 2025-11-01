export type DonationResponse = {
  id: string;
  amount: string;
  currency: string;
  donor?: {
    name?: string;
    email?: string;
  };
};
