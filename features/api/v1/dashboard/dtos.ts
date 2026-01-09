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
  totalDonations: string;
  donationsCount: number;
  totalDuesPayments: string;
  duesPaymentsCount: number;
  totalOrderPayments: string;
  orderPaymentsCount: number;
  newMembersCount: number;
  newVolunteersCount: number;
  eventsCount: number;
  projectsCount: number;
  announcementsCount: number;
  generatedAt: Date;
};

export type Stats = {
  membersCount: number;
  donationsCount: number;
  eventsCount: number;
  projectsCount: number;
  welfareProjectsCount: number;
  monthlyReport?: MonthlyReport;
};
