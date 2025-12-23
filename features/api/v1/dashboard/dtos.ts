import { Paginated } from "@/shared/dtos";
import { YPFProject } from "../projects/dtos";
import { YPFWelfareCase } from "../welfare/dtos";
import { YPFEvent } from "../events/dtos";
import { ShopProduct } from "../shop/dtos";

export type Activity = {
  projects: Paginated<YPFProject>;
  welfareProjects: Paginated<YPFWelfareCase>;
  workshopEvents: Paginated<YPFEvent>;
  shopProducts: Paginated<ShopProduct>;
};

export type Stats = {
  membersCount: number;
  donationsCount: number;
  eventsCount: number;
  projectsCount: number;
};
