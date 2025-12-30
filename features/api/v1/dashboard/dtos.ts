import { Paginated } from "@/shared/dtos";
import { YPFProject } from "../projects/dtos";
import { YPFEvent } from "../events/dtos";
import { ShopProduct } from "../shop/dtos";

export type Activity = {
  projects: YPFProject[];
  welfareProjects: YPFProject[];
  workshopEvents: YPFEvent[];
  shopProducts: ShopProduct[];
};

export type Stats = {
  membersCount: number;
  donationsCount: number;
  eventsCount: number;
  projectsCount: number;
  welfareProjectsCount: number;
};
