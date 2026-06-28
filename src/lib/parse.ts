// 数値文字列を厳密にパースする
// parseFloat は "1,000" → 1 のように途中まで読んで誤った値を通すため、
// カンマ除去後に Number() で全体を検証する（原価計算がズレるのを防ぐ）
export function parsePositiveNumber(raw: string | null, label: string): number {
  const cleaned = (raw ?? "").trim().replace(/,/g, "");
  const value   = Number(cleaned);
  if (cleaned === "" || Number.isNaN(value) || value <= 0) {
    throw new Error(`${label}は0より大きい数値で入力してください`);
  }
  return value;
}

// 1以上の整数をパースする（空欄なら fallback を返す）
// 予定数など「省略可・既定値あり」の整数フィールド向け
export function parsePositiveInt(
  raw: string | null,
  label: string,
  fallback: number
): number {
  const cleaned = (raw ?? "").trim().replace(/,/g, "");
  if (cleaned === "") return fallback;
  const value = Number(cleaned);
  if (Number.isNaN(value) || value < 1) {
    throw new Error(`${label}は1以上で入力してください`);
  }
  return Math.floor(value);
}
