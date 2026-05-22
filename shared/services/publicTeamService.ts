import { eq, asc, desc, sql } from "drizzle-orm";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { ApiError } from "@/shared/types";
import * as mediaUtils from "@/shared/utils/files";

export type PublicTeamMember = {
  id: string;
  name: string;
  role: string;
  bio?: string;
  photoUrl?: string;
  position: number;
  isActive: boolean;
  constituentId?: string;
  createdAt: Date;
  updatedAt: Date;
};

type WriteInput = {
  name: string;
  role: string;
  bio?: string;
  position?: number;
  isActive?: boolean;
  constituentId?: string | null;
  photoMediumId?: string | null;
};

function urlFor(externalId: string | null | undefined): string | undefined {
  if (!externalId) return undefined;
  return mediaUtils.generatePublicMediaUrl(externalId, { resolution: 720 });
}

/**
 * Lookup the underlying Media row for a photoId so we can build the signed
 * public URL. Returns null when the photo has been deleted or never set.
 */
async function fetchMediumExternalId(
  photoId: string | null | undefined,
): Promise<string | null> {
  if (!photoId) return null;
  const [row] = await dbClient.db
    .select({ externalId: schema.Media.externalId })
    .from(schema.Media)
    .where(eq(schema.Media.id, photoId))
    .limit(1);
  return row?.externalId ?? null;
}

export async function listPublicTeam(opts?: {
  includeInactive?: boolean;
}): Promise<PublicTeamMember[]> {
  const includeInactive = opts?.includeInactive ?? false;

  const rows = await dbClient.db
    .select({
      id: schema.PublicTeamMembers.id,
      name: schema.PublicTeamMembers.name,
      role: schema.PublicTeamMembers.role,
      bio: schema.PublicTeamMembers.bio,
      photoExternalId: schema.Media.externalId,
      // Constituent fallback for the photo if no override has been uploaded.
      constituentPhotoExternalId: sql<string | null>`(
        SELECT m.external_id FROM core.media m
        WHERE m.id = (
          SELECT c.profile_photo_id
          FROM core.constituents c
          WHERE c.id = ${schema.PublicTeamMembers.constituentId}
        )
      )`,
      constituentId: schema.PublicTeamMembers.constituentId,
      position: schema.PublicTeamMembers.position,
      isActive: schema.PublicTeamMembers.isActive,
      createdAt: schema.PublicTeamMembers.createdAt,
      updatedAt: schema.PublicTeamMembers.updatedAt,
    })
    .from(schema.PublicTeamMembers)
    .leftJoin(
      schema.Media,
      eq(schema.PublicTeamMembers.photoId, schema.Media.id),
    )
    .orderBy(
      asc(schema.PublicTeamMembers.position),
      desc(schema.PublicTeamMembers.createdAt),
    );

  return rows
    .filter((r) => includeInactive || r.isActive)
    .map((r) => ({
      id: r.id,
      name: r.name,
      role: r.role,
      bio: r.bio ?? undefined,
      photoUrl: urlFor(r.photoExternalId ?? r.constituentPhotoExternalId),
      position: r.position,
      isActive: r.isActive,
      constituentId: r.constituentId ?? undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
}

export async function createPublicTeamMember(
  input: WriteInput,
): Promise<string> {
  if (!input.name.trim()) throw new ApiError("Name is required", 400);
  if (!input.role.trim()) throw new ApiError("Role is required", 400);

  const [row] = await dbClient.db
    .insert(schema.PublicTeamMembers)
    .values({
      name: input.name.trim(),
      role: input.role.trim(),
      bio: input.bio?.trim() || undefined,
      photoId: input.photoMediumId ?? undefined,
      constituentId: input.constituentId ?? undefined,
      position: input.position ?? 0,
      isActive: input.isActive ?? true,
    })
    .returning({ id: schema.PublicTeamMembers.id });

  return row.id;
}

export async function updatePublicTeamMember(
  id: string,
  input: Partial<WriteInput>,
): Promise<void> {
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.role !== undefined) patch.role = input.role.trim();
  if (input.bio !== undefined) patch.bio = input.bio?.trim() || null;
  if (input.position !== undefined) patch.position = input.position;
  if (input.isActive !== undefined) patch.isActive = input.isActive;
  if (input.constituentId !== undefined) patch.constituentId = input.constituentId;
  if (input.photoMediumId !== undefined) patch.photoId = input.photoMediumId;

  const [updated] = await dbClient.db
    .update(schema.PublicTeamMembers)
    .set(patch)
    .where(eq(schema.PublicTeamMembers.id, id))
    .returning({ id: schema.PublicTeamMembers.id });

  if (!updated) throw new ApiError("Team member not found", 404);
}

export async function deletePublicTeamMember(id: string): Promise<void> {
  // Look up the photo id first so we can clean the underlying media row +
  // remote asset if no other table references it. Photo is set NULL on delete
  // (FK rule), so the Media row would otherwise dangle.
  const [member] = await dbClient.db
    .select({ photoId: schema.PublicTeamMembers.photoId })
    .from(schema.PublicTeamMembers)
    .where(eq(schema.PublicTeamMembers.id, id))
    .limit(1);

  const [deleted] = await dbClient.db
    .delete(schema.PublicTeamMembers)
    .where(eq(schema.PublicTeamMembers.id, id))
    .returning({ id: schema.PublicTeamMembers.id });

  if (!deleted) throw new ApiError("Team member not found", 404);

  // Best-effort cleanup of the orphaned media row + remote asset.
  if (member?.photoId) {
    try {
      const externalId = await fetchMediumExternalId(member.photoId);
      await dbClient.db
        .delete(schema.Media)
        .where(eq(schema.Media.id, member.photoId));
      if (externalId) {
        mediaUtils.deleteMediumFile(externalId).catch(() => {});
      }
    } catch {
      // Non-fatal — orphan media will be cleaned up by future audit.
    }
  }
}

/**
 * Upload a new photo and link it to the team member, replacing any previous
 * photo. The previous Media row is removed (it was 1:1 with this member).
 */
export async function setTeamMemberPhoto(input: {
  teamMemberId: string;
  uploaderConstituentId: string;
  file: Express.Multer.File;
}): Promise<{ photoUrl: string }> {
  const [member] = await dbClient.db
    .select({ photoId: schema.PublicTeamMembers.photoId })
    .from(schema.PublicTeamMembers)
    .where(eq(schema.PublicTeamMembers.id, input.teamMemberId))
    .limit(1);

  if (!member) throw new ApiError("Team member not found", 404);

  // Upload the new file to blob storage + extract dimensions.
  const uploadMeta = await mediaUtils.storeMediumFile(input.file);

  let mediumId: string;
  try {
    const [created] = await dbClient.db
      .insert(schema.Media)
      .values({
        externalId: uploadMeta.externalId,
        type: uploadMeta.type,
        width: uploadMeta.width,
        height: uploadMeta.height,
        size: uploadMeta.size,
        uploadedBy: input.uploaderConstituentId,
      })
      .returning({ id: schema.Media.id });
    mediumId = created.id;
  } catch (err) {
    // Couldn't write to the Media table — roll back the blob upload.
    await mediaUtils.deleteMediumFile(uploadMeta.externalId);
    throw err;
  }

  // Swap pointer + delete prior photo
  await dbClient.db
    .update(schema.PublicTeamMembers)
    .set({ photoId: mediumId, updatedAt: new Date() })
    .where(eq(schema.PublicTeamMembers.id, input.teamMemberId));

  if (member.photoId) {
    const oldExternal = await fetchMediumExternalId(member.photoId);
    await dbClient.db
      .delete(schema.Media)
      .where(eq(schema.Media.id, member.photoId));
    if (oldExternal) mediaUtils.deleteMediumFile(oldExternal).catch(() => {});
  }

  return {
    photoUrl: mediaUtils.generatePublicMediaUrl(uploadMeta.externalId, {
      resolution: 720,
    }),
  };
}

/**
 * Bulk reorder. Accepts a list of `{id, position}` pairs; positions are
 * assigned exactly as provided (no normalisation). UMS sends a clean 0..N
 * list after drag-and-drop.
 */
export async function reorderPublicTeam(
  items: Array<{ id: string; position: number }>,
): Promise<void> {
  if (items.length === 0) return;
  await dbClient.db.transaction(async (tx) => {
    for (const item of items) {
      await tx
        .update(schema.PublicTeamMembers)
        .set({ position: item.position, updatedAt: new Date() })
        .where(eq(schema.PublicTeamMembers.id, item.id));
    }
  });
}
