"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Ghost, Loader2, TriangleAlert, Info, ArrowRight } from "lucide-react";
import { suggestSimulation, type SimulationAdvice } from "@/actions/ai-simulation";
import { saveAiScenario } from "@/actions/scenario";
import { showToast } from "@/components/app/toast";
import { formatYen } from "@/lib/format";

type Props = {
  projectId: string;
  /** パターンの上限に達していたら保存できない（相談自体はできる） */
  canSave: boolean;
};

/**
 * AIに採算を相談するパネル。
 *
 * 出す順番に意図がある：**コードで計算した検算結果を一番上・一番大きく**出し、
 * AIの言葉はその下に置く。数字の出どころはコードだけ、という約束を画面でも守るため。
 */
export function AiSimulationPanel({ projectId, canSave }: Props) {
  const [advice, setAdvice] = useState<SimulationAdvice | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [isAsking, startAsking] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const router = useRouter();

  function ask() {
    setError(null);
    startAsking(async () => {
      try {
        setAdvice(await suggestSimulation(projectId));
      } catch (err) {
        setAdvice(null);
        setError(
          err instanceof Error
            ? err.message
            : "うまく相談できませんでした。少し時間をおいて試してください。"
        );
      }
    });
  }

  function save() {
    if (!advice) return;
    setError(null);
    startSaving(async () => {
      try {
        await saveAiScenario(
          projectId,
          "AIの提案",
          advice.items.map(({ recipeId, sellingPrice, quantity }) => ({
            recipeId,
            sellingPrice,
            quantity,
          }))
        );
        setAdvice(null);
        showToast("AIの提案をパターンに保存しました", "success");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "保存できませんでした");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={ask}
        disabled={isAsking}
        className="flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
      >
        {isAsking ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            考え中…
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            {advice ? "もう一度相談する" : "AIに値段と個数を相談する"}
          </>
        )}
      </button>

      {error && <p className="text-xs text-red-600 text-center">{error}</p>}

      {advice && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-3 py-3">
          {/* 検算結果（コードで計算した数字）。AIの文章より必ず上・大きく出す */}
          <div className="flex flex-col gap-1 rounded-xl bg-primary/5 px-3 py-2.5">
            <div className="flex items-end justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                この案で全部{advice.totalQuantity}個 売れたら手残り
              </span>
              <span
                className={`text-2xl font-bold tabular-nums ${
                  advice.profit >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {formatYen(advice.profit)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground/70 tabular-nums">
              売上 {formatYen(advice.revenue)}・かかるお金 {formatYen(advice.fixedCost)}
              {advice.purchaseRate !== null && (
                <>・購入率 {Math.round(advice.purchaseRate * 100)}%</>
              )}
            </p>
          </div>

          {/* 提案をそのまま採用する前に伝えること */}
          {advice.warnings.map((warning) => (
            <p
              key={warning}
              className="flex items-start gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700"
            >
              <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-px text-red-500" />
              <span>{warning}</span>
            </p>
          ))}

          {/* 検算で落とした商品（黙って消すと数字の理由が分からなくなる） */}
          {advice.dropped.length > 0 && (
            <p className="flex items-start gap-1.5 rounded-xl bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
              <span>
                {advice.dropped.map((d) => `${d.name}：${d.reason}`).join(" / ")}
              </span>
            </p>
          )}

          {/* AIの言葉。判断の理由であって、数字の根拠ではない */}
          <div className="flex items-start gap-2">
            <Ghost className="w-6 h-6 shrink-0 text-muted-foreground" />
            <p className="text-sm text-foreground leading-relaxed">{advice.reason}</p>
          </div>

          {/* 商品ごとの提案（今の値段からどう変わるか） */}
          <ul className="flex flex-col gap-1.5">
            {advice.items.map((item) => (
              <li
                key={item.recipeId}
                className="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-2 text-xs"
              >
                <span className="min-w-0 truncate font-medium text-foreground">{item.name}</span>
                <span className="ml-auto flex shrink-0 items-center gap-1 tabular-nums text-muted-foreground">
                  {formatYen(item.currentPrice)}
                  <ArrowRight className="w-3 h-3" />
                  <span className="font-semibold text-foreground">
                    {formatYen(item.sellingPrice)}
                  </span>
                  <span className="ml-1.5">{item.quantity}個</span>
                </span>
              </li>
            ))}
          </ul>

          {canSave ? (
            <button
              type="button"
              onClick={save}
              disabled={isSaving}
              className="rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-opacity active:opacity-80 disabled:opacity-60"
            >
              {isSaving ? "保存中…" : "この案をパターンに保存する"}
            </button>
          ) : (
            <p className="text-xs text-muted-foreground/70 text-center">
              パターンが上限に達しています。保存するには使わないものを削除してください。
            </p>
          )}
        </div>
      )}
    </div>
  );
}
