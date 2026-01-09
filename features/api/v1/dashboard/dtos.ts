import { YPFProject } from "../projects/dtos";
import { YPFEvent } from "../events/dtos";
import { ShopProduct } from "../shop/dtos";

// ============ Stats Endpoint ============

export type DashboardCounts = {
  members: number;
  volunteers: number;
  donations: number;
  events: number;
  projects: number;
  welfareProjects: number;
};

export type MonthlyFinancials = {
  totalDonations: string;
  donationsCount: number;
  totalDuesPayments: string;
  duesPaymentsCount: number;
  totalOrderPayments: string;
  orderPaymentsCount: number;
};

export type MonthlyActivity = {
  newMembersCount: number;
  newVolunteersCount: number;
  eventsCount: number;
  projectsCount: number;
  announcementsCount: number;
};

export type MonthlyReport = {
  reportMonth: Date;
  generatedAt: Date;
  financials: MonthlyFinancials;
  activity: MonthlyActivity;
};

export type DashboardStats = {
  counts: DashboardCounts;
  latestReport?: MonthlyReport;
};

// ============ Activity Endpoint ============

export type RecentProjects = {
  community: YPFProject[];
  welfare: YPFProject[];
};

export type DashboardActivity = {
  projects: RecentProjects;
  events: YPFEvent[];
  shopProducts: ShopProduct[];
};
