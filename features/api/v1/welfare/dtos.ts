import { Medium } from "@/shared/dtos";
import { YPFConstituent } from "../constituents/dtos";

export type YPFWelfareCase = {
  id: string;
  title: string;
  featuredMediumUrl?: string;
  beneficiaryCount: number;
  amount: number; // amount spent thus far on this welfarecase
  isSupported: boolean; // basically means that at least one expenditure record exists for this
  date: Date;
  chapterName?: string;
};

export type YPFWelfareCaseDetail = {
  id: string;
  title: string;
  description?: string;
  date?: Date;
  featuredMedia?: {
    caption?: string;
    medium: Medium;
  }[];
  chapter?: {
    id: string;
    name: string;
  };
  expenditure?: {
    // missing if not supported
    id: string;
    amount: number; // sum of all expenditure.amount where welfareCaseId = this.id
  };
  beneficiaries: {
    id: string;
    profilePhotoUrl?: string;
    fullName: string;
    createdAt: Date;
  }[];
};
