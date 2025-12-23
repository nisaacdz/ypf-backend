import { Medium } from "@/shared/dtos";
import { YPFConstituent } from "../constituents/dtos";

export type WelfareCase = {
  id: string;
  title: string;
  featuredMediumUrl?: string;
  beneficiaryCount: number;
  amount: number; // amount spent thus far on this welfarecase
  isSupported: boolean; // basically means that at least one expenditure record exists for this
  date: Date;
};

export type WelfareCaseDetail = {
  id: string;
  title: string;
  description?: string;
  date?: Date;
  featuredMedia?: {
    caption?: string;
    medium: Medium;
  }[];
  expenditure?: {
    // missing if not supported
    id: string;
    amount: number; // sum of all expenditure.amount where welfareCaseId = this.id
  };
  beneficiaries: YPFConstituent[]; // realistically shouldn't be plenty -- let's fetch all
};
