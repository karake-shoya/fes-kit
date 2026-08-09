import { Target } from "lucide-react";
import { type BreakevenResult } from "@/lib/breakeven";
import { formatYen } from "@/lib/format";

/**
 * 「トントン」の先＝目標の手残りに届く個数。
 *
 * 採算の芯は「赤字を防ぐ（損益分岐）」と「利益を読む（この行）」の2つで、
 * 分岐点だけだと後半が製品に無いことになる。
 * 目標が未入力のとき、および今の価格では何個売っても届かないときは出さない
 * （届かない理由は上の赤いカードが既に説明している）。
 */
export function TargetProfitRow({
  target,
  breakeven,
}: {
  /** 目標利益で逆算した結果。目標が未入力なら null */
  target: BreakevenResult | null;
  /** 同じ商品・かかるお金で出した損益分岐点（「あと何個」の起点） */
  breakeven: BreakevenResult;
}) {
  if (!target || target.status !== "ok") return null;

  // 分岐点が出せているときだけ「あと何個」を添える（出せないときの差分は意味を持たない）
  const extra = breakeven.status === "ok" ? target.totalQuantity - breakeven.totalQuantity : null;

  // 大きい数字は左右振り分けにすると、スマホ幅で数字と説明文が両方折り返して衝突する。
  // 損益分岐点のカードと同じ「文章の中に大きい数字を挟む」組み方に揃える
  return (
    <section className="bg-card rounded-2xl border border-border px-4 py-4 flex flex-col gap-2">
      <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
        <Target className="w-3.5 h-3.5" />
        {formatYen(target.targetProfit)} 残すなら
      </p>
      <p className="text-foreground leading-none">
        <span className="text-sm">全部で</span>
        <span className="mx-1 text-4xl font-bold tabular-nums text-primary">
          {target.totalQuantity}
        </span>
        <span className="text-sm">個</span>
        {/* 折り返しても「個）」だけが次行に取り残されないよう、ひとかたまりで動かす */}
        {extra !== null && (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            （トントンから あと{extra}個）
          </span>
        )}
      </p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        売上 {formatYen(target.revenue)} ぶんです。
        今の価格と、作る予定数の比率のままで計算しています。
      </p>
    </section>
  );
}
