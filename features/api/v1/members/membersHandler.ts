import { Response } from "express";
import * as membersService from "@/shared/services/membersService";
import { ApiResponse } from "@/shared/types";
import { streamCsv } from "@/shared/utils/csv";
import {
  GetMembersQuerySchema,
  EnrollMemberSchema,
  UnenrollMemberSchema,
  EnrollRoleSchema,
  UnenrollRoleSchema,
  GetRolesQuerySchema,
  GetLeadershipQuerySchema,
} from "./schemas";
import { Paginated } from "@/shared/dtos";
import { MemberRole, YPFMember, YPFMemberDetail } from "./dtos";
import z from "zod";

export async function getMembers(
  query: z.infer<typeof GetMembersQuerySchema>,
): Promise<ApiResponse<Paginated<YPFMember>>> {
  const data = await membersService.getMembers(query);
  return { success: true, data };
}

export async function getMember(
  constituentId: string,
): Promise<ApiResponse<YPFMemberDetail>> {
  const data = await membersService.getMemberByConstituentId(constituentId);
  return { success: true, data };
}

export async function enrollMember(
  body: z.infer<typeof EnrollMemberSchema>,
): Promise<ApiResponse<{ memberId: string }>> {
  const memberId = await membersService.enrollGlobal(
    body.constituentId,
    body.startedAt ? new Date(body.startedAt) : undefined,
  );
  return { success: true, data: { memberId } };
}

export async function unenrollMember(
  body: z.infer<typeof UnenrollMemberSchema>,
): Promise<ApiResponse<null>> {
  await membersService.unenrollGlobal(body.constituentId);
  return { success: true, data: null };
}

export async function getRoles(
  query: z.infer<typeof GetRolesQuerySchema>,
): Promise<ApiResponse<Paginated<MemberRole>>> {
  const data = await membersService.getRoles(query);
  return { success: true, data };
}

export async function getLeadership(
  query: z.infer<typeof GetLeadershipQuerySchema>,
): Promise<ApiResponse<Paginated<YPFMember>>> {
  const data = await membersService.getLeadership(query);
  return { success: true, data };
}

export async function enrollRole(
  titleId: string,
  body: z.infer<typeof EnrollRoleSchema>,
): Promise<ApiResponse<{ assignmentId: string }>> {
  const assignmentId = await membersService.assignRole(
    body.constituentId,
    titleId,
    body.startedAt ? new Date(body.startedAt) : undefined,
  );
  return { success: true, data: { assignmentId } };
}

export async function unenrollRole(
  titleId: string,
  body: z.infer<typeof UnenrollRoleSchema>,
): Promise<ApiResponse<null>> {
  await membersService.unassignRole(body.constituentId, titleId);
  return { success: true, data: null };
}

/**
 * CSV export — re-uses `getMembers` but bumps pageSize way up. Streams via
 * `streamCsv` so a 50k-row dump doesn't materialise in memory.
 *
 * We don't paginate on export: the admin asked for "everything matching
 * the current filter". For lists that genuinely exceed memory, swap the
 * fetch for a generator that pages internally.
 */
export async function exportMembersCsv(
  query: z.infer<typeof GetMembersQuerySchema>,
  res: Response,
): Promise<void> {
  const PAGE_SIZE = 500;
  async function* iterator() {
    let page = 1;
    while (true) {
      const result = await membersService.getMembers({
        ...query,
        page,
        pageSize: PAGE_SIZE,
      });
      for (const m of result.items) {
        yield {
          publicId: m.publicId,
          fullName: m.fullName,
          email: m.email ?? "",
          title: m.title ?? "",
          chapter: m.chapter?.name ?? "",
          committee: m.committee?.name ?? "",
          country: m.country ?? "",
          campus: m.campus ?? "",
          startedAt: m.startedAt ?? "",
          duesPaid: m.dues?.paid ? "yes" : "no",
          duesAmount: m.dues?.amount ?? "",
          duesCurrency: m.dues?.currency ?? "",
        };
      }
      if (result.items.length < PAGE_SIZE) break;
      page += 1;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  await streamCsv(res, {
    filename: `ypf-people-${today}.csv`,
    columns: [
      { key: "publicId", label: "Member ID" },
      { key: "fullName", label: "Full Name" },
      { key: "email", label: "Email" },
      { key: "title", label: "Title" },
      { key: "chapter", label: "Chapter" },
      { key: "committee", label: "Committee" },
      { key: "country", label: "Country" },
      { key: "campus", label: "Campus" },
      { key: "startedAt", label: "Joined" },
      { key: "duesPaid", label: "Dues Paid (Current Month)" },
      { key: "duesAmount", label: "Dues Amount" },
      { key: "duesCurrency", label: "Currency" },
    ],
    rows: iterator(),
  });
}

/**
 * Whole-org KPI snapshot for the People page.
 * Always returns totals over the entire dataset — not the current page or
 * the current search filter — so the cards describe the org, not the view.
 */
export async function getMemberStats(): Promise<
  ApiResponse<membersService.MemberStats>
> {
  const data = await membersService.getMemberStats();
  return { success: true, data };
}
