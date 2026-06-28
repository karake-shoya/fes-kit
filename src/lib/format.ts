// 円表示（小数は四捨五入して整数円に）
// 負の値は「-¥150」のように符号を先頭に出す（¥-150 はペルソナに不自然なため）
export function formatYen(value: number): string {
  const rounded = Math.round(value);
  const sign    = rounded < 0 ? "-" : "";
  return `${sign}¥${Math.abs(rounded).toLocaleString()}`;
}

// 利益率の表示スタイル（黒字＝緑 / 赤字＝赤 / 原価ゼロ＝グレー）
// ペルソナ（数字が苦手）が一目で判断できるよう絵文字・短いラベルを添える
export function profitStyle(profitRate: number, hasCost: boolean) {
  if (!hasCost) {
    return { text: "text-zinc-400", emoji: "—", label: "材料未登録" };
  }
  if (profitRate >= 0) {
    return { text: "text-green-600", emoji: "🙂", label: "黒字" };
  }
  return { text: "text-red-600", emoji: "😟", label: "赤字（見直そう）" };
}
