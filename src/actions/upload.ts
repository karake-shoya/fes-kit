"use server";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireAuth } from "@/lib/auth";
import { assertProjectAccess } from "@/db/queries/auth";
import { getR2Client, R2_BUCKET, R2_PUBLIC_URL, buildPrototypeKey } from "@/lib/r2";

// 試作写真アップロード用の署名付きPUT URLを発行する。
// クライアントはここで得たuploadUrlへ直接PUTし、publicUrlをDBに保存する。
export async function createPrototypeUploadUrl(projectId: string) {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId, "editor");

  const key = buildPrototypeKey(projectId);

  // クライアントは縮小済みJPEGを送るためContentTypeを固定する
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET(),
    Key: key,
    ContentType: "image/jpeg",
  });

  const uploadUrl = await getSignedUrl(getR2Client(), command, { expiresIn: 60 });
  const publicUrl = `${R2_PUBLIC_URL()}/${key}`;

  return { uploadUrl, publicUrl };
}
