import "server-only";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

// R2 は S3 互換 API。AWS SDK の S3Client をそのまま利用する。
// 環境変数が未設定のままアプリ全体が落ちないよう、実際に使う関数側で検証する。

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`環境変数 ${key} が設定されていません`);
  return value;
}

let cachedClient: S3Client | null = null;

// S3Client は使い回せるので一度だけ生成する
export function getR2Client(): S3Client {
  if (cachedClient) return cachedClient;

  const accountId = requireEnv("R2_ACCOUNT_ID");
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
  return cachedClient;
}

export const R2_BUCKET = () => requireEnv("R2_BUCKET_NAME");

// 公開URLのベース（末尾スラッシュは取り除く）
export const R2_PUBLIC_URL = () =>
  requireEnv("NEXT_PUBLIC_R2_PUBLIC_URL").replace(/\/+$/, "");

// 試作写真のオブジェクトキー。projectId配下に一意なファイル名で格納する。
export function buildPrototypeKey(projectId: string): string {
  return `prototypes/${projectId}/${crypto.randomUUID()}.jpg`;
}

// 公開URL → オブジェクトキーを逆算する（削除時に使用）。
// 自分の公開バケット以外のURL（手入力など）は null を返し、削除対象にしない。
export function keyFromPublicUrl(url: string): string | null {
  const base = R2_PUBLIC_URL();
  if (!url.startsWith(base + "/")) return null;
  return url.slice(base.length + 1);
}

// 公開URLで指定したオブジェクトを best-effort で削除する。
// 失敗してもユーザー操作（更新・削除）は止めない。
export async function deletePrototypeImage(url: string | null | undefined): Promise<void> {
  if (!url) return;
  try {
    const key = keyFromPublicUrl(url);
    if (!key) return;
    await getR2Client().send(
      new DeleteObjectCommand({ Bucket: R2_BUCKET(), Key: key }),
    );
  } catch (err) {
    console.error("R2オブジェクトの削除に失敗しました（処理は継続）:", err);
  }
}
