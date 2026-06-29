// ブラウザ側で画像を縮小・JPEG圧縮するユーティリティ。
// スマホ写真は数MBになりやすいため、アップロード前に長辺を抑えて軽量化する。

/**
 * 画像ファイルを長辺 maxEdge px 以内に縮小し、JPEG Blob として返す。
 * 元画像が maxEdge より小さい場合は拡大せず、そのままのサイズで再エンコードする。
 */
export async function resizeImage(
  file: File,
  maxEdge = 1600,
  quality = 0.8,
): Promise<Blob> {
  // EXIF の回転情報を反映する（スマホの縦写真が横向きになるのを防ぐ）
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = bitmap;
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("画像の処理に失敗しました");
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) throw new Error("画像の変換に失敗しました");
    return blob;
  } finally {
    bitmap.close();
  }
}
