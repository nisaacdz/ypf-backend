import { ApiResponse } from "@/shared/types";
import {
  GetPostsQuerySchema,
  GetAdminPostsQuerySchema,
  CreatePostSchema,
  UpdatePostSchema,
} from "./schemas";
import z from "zod";
import { Paginated } from "@/shared/dtos";
import { YPFPost, YPFPostDetail } from "./dtos";
import * as postsService from "@/shared/services/postsService";
import * as mediaService from "@/shared/services/mediaService";
import * as documentsService from "@/shared/services/documentsService";
import * as mediaUtils from "@/shared/utils/files";

export async function getPosts(
  query: z.infer<typeof GetPostsQuerySchema>,
): Promise<ApiResponse<Paginated<YPFPost>>> {
  const data = await postsService.fetchPosts(query, { publishedOnly: true });

  return {
    success: true,
    message: "Posts fetched successfully",
    data,
  };
}

export async function getAdminPosts(
  query: z.infer<typeof GetAdminPostsQuerySchema>,
): Promise<ApiResponse<Paginated<YPFPost>>> {
  const data = await postsService.fetchPosts(query, { publishedOnly: false });

  return {
    success: true,
    message: "Posts fetched successfully",
    data,
  };
}

export async function getFeaturedPost(
  section: YPFPost["section"],
): Promise<ApiResponse<YPFPost | null>> {
  const data = await postsService.fetchFeaturedPost(section);

  return {
    success: true,
    message: "Featured post fetched successfully",
    data,
  };
}

export async function getPost(
  slug: string,
  options: { includeDrafts: boolean } = { includeDrafts: false },
): Promise<ApiResponse<YPFPostDetail>> {
  const data = await postsService.fetchPostBySlug(slug, {
    publishedOnly: !options.includeDrafts,
  });

  return {
    success: true,
    message: "Post fetched successfully",
    data,
  };
}

/**
 * Resolves a published post's PDF to a short-lived signed URL. The route
 * redirects to it so the Azure container stays private while the report is
 * still a plain, shareable link.
 */
export async function getPostDocumentUrl(slug: string): Promise<string> {
  const externalId = await postsService.fetchPostDocumentExternalId(slug);
  return mediaUtils.generateSignedDocumentDownloadUrl(externalId, {
    expireSeconds: 300,
  });
}

export async function createPost(
  newPost: z.infer<typeof CreatePostSchema>,
): Promise<ApiResponse<string>> {
  const postId = await postsService.createPost(newPost);

  return {
    success: true,
    message: "Post created successfully",
    data: postId,
  };
}

export async function updatePost(
  postId: string,
  updates: z.infer<typeof UpdatePostSchema>,
): Promise<ApiResponse<null>> {
  await postsService.updatePost(postId, updates);

  return {
    success: true,
    message: "Post updated successfully",
    data: null,
  };
}

export async function deletePost(
  postId: string,
): Promise<ApiResponse<null>> {
  await postsService.deletePost(postId);

  return {
    success: true,
    message: "Post deleted successfully",
    data: null,
  };
}

export async function uploadPostCover({
  constituentId,
  postId,
  file,
}: {
  constituentId: string;
  postId: string;
  file: Express.Multer.File;
}): Promise<ApiResponse<string>> {
  await postsService.assertPostExists(postId);

  const uploadMeta = await mediaUtils.storeMediumFile(file);

  try {
    const medium = await mediaService.uploadMedium({
      ...uploadMeta,
      uploadedBy: constituentId,
    });
    await postsService.setPostCover(postId, medium.id);

    return {
      success: true,
      message: "Cover image uploaded successfully",
      data: medium.id,
    };
  } catch (error) {
    // Don't leave an orphaned blob behind when the DB write fails.
    await mediaUtils.deleteMediumFile(uploadMeta.externalId);
    throw error;
  }
}

export async function uploadPostDocument({
  constituentId,
  postId,
  file,
}: {
  constituentId: string;
  postId: string;
  file: Express.Multer.File;
}): Promise<ApiResponse<string>> {
  await postsService.assertPostExists(postId);

  const uploadMeta = await mediaUtils.storeDocumentFile(file);

  try {
    const document = await documentsService.uploadDocument({
      ...uploadMeta,
      uploadedBy: constituentId,
    });
    await postsService.setPostDocument(postId, document.id);

    return {
      success: true,
      message: "Report uploaded successfully",
      data: document.id,
    };
  } catch (error) {
    await mediaUtils.deleteDocumentFile(uploadMeta.externalId);
    throw error;
  }
}
