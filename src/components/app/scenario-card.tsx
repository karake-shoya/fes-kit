"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, TriangleAlert, Undo2 } from "lucide-react";
import { SwipeActionCard } from "@/components/app/swipe-action-card";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { ScenarioDialog } from "@/components/app/scenario-dialog";
import { showToast } from "@/components/app/toast";
import { deleteScenario, applyScenario } from "@/actions/scenario";
import {
  evaluateScenario,
  calcPurchaseRate,
  type BreakevenRecipe,
  type ScenarioLineInput,
} from "@/lib/breakeven";
import { formatYen } from "@/lib/format";

type Props = {
  projectId: string;
  scenario: { id: string; name: string; items: ScenarioLineInput[] };
  /** 今の商品と原価。パターンは価格と個数しか持たないため、原価は常にここから取る */
  recipes: BreakevenRecipe[];
  fixedCost: number;
  expectedVisitors: number | null;
  // editor 以上なら編集・削除・「これにする」が使える
  canEdit: boolean;
  /**
   * 「これにする」の直前に自動保存された控えか。
   * 控えは中身を人が編集するものではないので、編集・スワイプ削除を出さず、
   * ボタンも「ひとつ前に戻す」に変える。
   */
  isBackup?: boolean;
};

/**
 * 採算パターン1件分のカード。
 * タップで編集・左スワイプで削除・「これにする」で商品へ反映する。
 */
export function ScenarioCard({
  projectId,
  scenario,
  recipes,
  fixedCost,
  expectedVisitors,
  canEdit,
  isBackup = false,
}: Props) {
  const [confirmApply, setConfirmApply] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const result       = evaluateScenario(recipes, scenario.items, fixedCost);
  const purchaseRate = calcPurchaseRate(result.totalQuantity, expectedVisitors);
  const tooMany      = purchaseRate !== null && purchaseRate > 1;
  // 値段が原価を下回っている商品（売るほど損をするので保存後も気づけるようにする）
  const belowCost    = result.lines.filter((l) => l.quantity > 0 && l.marginPerUnit < 0);
  // 「これにする」で作る予定数を据え置く商品（0個＝今回は作らない）
  const zeroQuantity = result.lines.filter((l) => l.quantity === 0);

  function handleApply() {
    startTransition(async () => {
      try {
        await applyScenario(scenario.id, projectId);
        setConfirmApply(false);
        showToast(
          isBackup ? "変更前の値段に戻しました" : `「${scenario.name}」を商品に反映しました`,
          "success"
        );
        router.refresh();
      } catch {
        showToast(isBackup ? "戻せませんでした" : "反映できませんでした");
      }
    });
  }

  const summary = (
    <div className="flex w-full min-w-0 flex-col gap-1.5 text-left">
      <div className="flex items-end justify-between gap-2">
        <span className="text-sm font-medium text-foreground truncate">{scenario.name}</span>
        <span
          className={`shrink-0 text-xl font-bold tabular-nums ${
            result.profit >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          {formatYen(result.profit)}
        </span>
      </div>

      <span className="text-xs text-muted-foreground/70 tabular-nums">
        全部{result.totalQuantity}個・売上 {formatYen(result.revenue)}
        {purchaseRate !== null && <>・購入率 {Math.round(purchaseRate * 100)}%</>}
      </span>

      {(tooMany || belowCost.length > 0 || result.unlisted.length > 0) && (
        <span className="flex items-start gap-1 text-xs text-amber-600 leading-relaxed">
          <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>
            {tooMany && "来場者全員が1個以上買う前提です。"}
            {belowCost.length > 0 &&
              `${belowCost.map((l) => l.name).join("・")}は値段が原価を下回っています。`}
            {result.unlisted.length > 0 &&
              `${result.unlisted.map((u) => u.name).join("・")}はこのパターンに入っていません。`}
          </span>
        </span>
      )}
    </div>
  );

  return (
    <SwipeActionCard
      // 控えは人が消すものではない（次の「これにする」で自動的に入れ替わる）
      enabled={canEdit && !isBackup}
      deleteAriaLabel="このパターンを削除"
      confirmMessage={<>「{scenario.name}」を削除します。<br />この操作は取り消せません。</>}
      onDelete={() => deleteScenario(scenario.id, projectId)}
    >
      <div
        className={`flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-sm ${
          isBackup ? "border-dashed border-border bg-muted/30" : "border-border bg-card"
        }`}
      >
        {canEdit && !isBackup ? (
          <ScenarioDialog
            projectId={projectId}
            recipes={recipes}
            fixedCost={fixedCost}
            expectedVisitors={expectedVisitors}
            scenario={scenario}
          >
            <button
              type="button"
              className="flex min-w-0 px-3 py-3 active:scale-[0.99] transition-transform"
            >
              {summary}
            </button>
          </ScenarioDialog>
        ) : (
          <div className="px-3 py-3">{summary}</div>
        )}

        {canEdit && (
          <button
            type="button"
            onClick={() => setConfirmApply(true)}
            className={`flex items-center justify-center gap-1.5 border-t py-2.5 text-xs font-medium transition-colors ${
              isBackup
                ? "border-border text-muted-foreground active:bg-muted"
                : "border-border text-primary active:bg-primary/5"
            }`}
          >
            {isBackup ? <Undo2 className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
            {isBackup ? "ひとつ前に戻す" : "これにする"}
          </button>
        )}

        <ConfirmDialog
          open={confirmApply}
          onOpenChange={setConfirmApply}
          title={isBackup ? "変更前に戻しますか？" : "商品に反映しますか？"}
          message={
            <>
              {isBackup ? (
                <>
                  商品の値段と作る予定数を、
                  前回「これにする」を押す直前の状態に戻します。
                  <br />
                  いまの状態がこの控えに入れ替わるので、もう一度押せば行き来できます。
                </>
              ) : (
                <>
                  「{scenario.name}」の値段と作る予定数を、
                  いまの商品に上書きします。
                  <br />
                  いまの値段は「変更前（自動保存）」として残るので、あとで戻せます。
                </>
              )}
              {zeroQuantity.length > 0 && (
                <>
                  <br />
                  {zeroQuantity.map((l) => l.name).join("・")}は0個のため、
                  値段だけ反映して作る予定数はそのままにします。
                </>
              )}
            </>
          }
          confirmLabel={isBackup ? "戻す" : "これにする"}
          pendingLabel={isBackup ? "戻しています…" : "反映中…"}
          isPending={isPending}
          onConfirm={handleApply}
        />
      </div>
    </SwipeActionCard>
  );
}
