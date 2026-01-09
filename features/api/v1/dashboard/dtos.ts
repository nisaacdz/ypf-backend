import { YPFProject } from "../projects/dtos";
import { YPFEvent } from "../events/dtos";
import { ShopProduct } from "../shop/dtos";

export type Activity = {
  projects: YPFProject[];
  welfareProjects: YPFProject[];
  workshopEvents: YPFEvent[];
  shopProducts: ShopProduct[];
};

export type MonthlyReport = {
  reportMonth: Date;
  totalDonations: string | null;
  donationsCount: number | null;
  totalDuesPayments: string | null;
  duesPaymentsCount: number | null;
  totalOrderPayments: string | null;
  orderPaymentsCount: number | null;
  newMembersCount: number | null;
  newVolunteersCount: number | null;
  eventsCount: number | null;
  projectsCount: number | null;
  announcementsCount: number | null;
  generatedAt: Date;
};

export type Stats = {
  membersCount: number;
  donationsCount: number;
  eventsCount: number;
  projectsCount: number;
  welfareProjectsCount: number;
  monthlyReport: MonthlyReport | null;
};
