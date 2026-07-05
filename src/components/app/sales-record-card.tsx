"use client";

import { useState } from "react";
import { Minus, Plus, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { setSalesRecord } from "@/actions/sales-record";
import { useKeyedDebounce } from "@/lib/use-keyed-debounce";
import { useDraftNumberInput } from "@/lib/use-draft-number-input";
import { formatYen, profitStyle } from "@/lib/format";
import type { SalesResultItem } from "@/db/queries/sales-records";

type Props = {
  item: SalesResultItem;
  projectId: string;
  canEdit: boolean;
};

// 実績記録ページの1レシピ分カード。
// 「作った数」「売れた数」を−／＋ボタンと数値入力でその場で編集し、
// 実績利益・廃棄数をクライアント側で即時再計算する（500msデバウンスで自動保存）。
export function SalesRecordCard({ item, projectId, canEdit }: Props) {
  const [made, setMade] = useState(item.madeCount);
  const [sold, setSold] = useState(item.soldCount);
  // router.refresh()等でpropsが差し替わったときに追従させる
  // （useEffect経由だとcascading renderになるためReact推奨のこの形にする）
  const [prevProps, setPrevProps] = useState({ made: item.madeCount, sold: item.soldCount });
  if (item.madeCount !== prevProps.made || item.soldCount !== prevProps.sold) {
    setPrevProps({ made: item.madeCount, sold: item.soldCount });
    setMade(item.madeCount);
    setSold(item.soldCount);
  }
  const [scheduleSave] = useKeyedDebounce(500);
  // 保存失敗の通知用。当日の主要データなので黙って失わせず、注意を出して再操作を促す
  const [saveFailed, setSaveFailed] = useState(false);

  const hasCost        = item.cost.totalCost > 0;
  const expectedProfit = item.cost.profit * item.recipe.servings;
  const actualProfit   = item.cost.profit * sold;
  const wasteCount     = Math.max(0, made - sold);
  const overSold       = sold > made; // 売れた数が作った数を超えている（入力ミスの可能性）
  const style          = profitStyle(item.cost.profitRate, hasCost);

  // 両方の値をまとめてupsertする（片方ずつだと古い値で上書きし合うため）
  function save(nextMade: number, nextSold: number) {
    scheduleSave(item.recipe.id, () => {
      setSalesRecord(item.recipe.id, projectId, {
        madeCount: nextMade,
        soldCount: nextSold,
      })
        .then(() => setSaveFailed(false))
        .catch(() => setSaveFailed(true)); // ローカル表示は維持しつつ注意を出す
    });
  }

  function updateMade(v: number) {
    const next = Math.max(0, Math.floor(v));
    setMade(next);
    save(next, sold);
  }
  function updateSold(v: number) {
    const next = Math.max(0, Math.floor(v));
    setSold(next);
    save(made, next);
  }

  const madeField = useDraftNumberInput(made, updateMade, {
    isValid: (raw) => raw >= 0,
    integer: true,
  });
  const soldField = useDraftNumberInput(sold, updateSold, {
    isValid: (raw) => raw >= 0,
    integer: true,
  });

  return (
    <div className="bg-card rounded-2xl border border-border px-4 py-4 shadow-sm flex flex-col gap-3">
      {/* レシピ名と見込み */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-semibold text-foreground truncate">{item.recipe.name}</span>
          <span className="text-xs text-muted-foreground">
            {formatYen(item.recipe.sellingPrice)} × 予定{item.recipe.servings}個
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <span className="text-xs text-muted-foreground">見込み利益</span>
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {hasCost ? formatYen(expectedProfit) : "材料未登録"}
          </span>
        </div>
      </div>

      {/* 作った数・売れた数の入力 */}
      <div className="grid grid-cols-2 gap-2">
        <CounterField
          label="作った数"
          value={made}
          field={madeField}
          onStep={(delta) => updateMade(made + delta)}
          canEdit={canEdit}
        />
        <CounterField
          label="売れた数"
          value={sold}
          field={soldField}
          onStep={(delta) => updateSold(sold + delta)}
          canEdit={canEdit}
        />
      </div>

      {/* 保存に失敗したときの注意（電波が悪い会場などを想定） */}
      {saveFailed && (
        <p className="flex items-center gap-1.5 text-xs text-red-600">
          <TriangleAlert className="w-3.5 h-3.5 shrink-0" />
          保存できませんでした。電波の良い場所でもう一度数字を変えてみてください
        </p>
      )}

      {/* 売れた数 > 作った数 のソフトな注意（入力自体はブロックしない） */}
      {overSold && (
        <p className="flex items-center gap-1.5 text-xs text-amber-600">
          <TriangleAlert className="w-3.5 h-3.5 shrink-0" />
          売れた数が作った数より多くなっています
        </p>
      )}

      {/* 実績利益と廃棄数 */}
      <div className="border-t border-border pt-3 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          実績利益
          <span
            className={`ml-1.5 font-bold text-base tabular-nums ${
              sold > 0 ? style.text : "text-muted-foreground/50"
            }`}
          >
            {hasCost ? formatYen(actualProfit) : "—"}
          </span>
        </span>
        <span className="text-muted-foreground">
          廃棄
          <span
            className={`ml-1 font-semibold tabular-nums ${
              wasteCount > 0 ? "text-orange-600" : "text-muted-foreground/70"
            }`}
          >
            {wasteCount}個
          </span>
        </span>
      </div>
    </div>
  );
}

// −／＋ボタン付きの数値入力フィールド（作った数・売れた数で共用）
function CounterField({
  label,
  value,
  field,
  onStep,
  canEdit,
}: {
  label: string;
  value: number;
  field: ReturnType<typeof useDraftNumberInput>;
  onStep: (delta: number) => void;
  canEdit: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-muted/50 px-3 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {canEdit ? (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label={`${label}を1減らす`}
            onClick={() => onStep(-1)}
            disabled={value <= 0}
            className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-card text-foreground transition-colors active:bg-muted disabled:opacity-40"
          >
            <Minus className="w-4 h-4" />
          </button>
          <Input
            type="number"
            inputMode="numeric"
            value={field.inputValue}
            min="0"
            step="1"
            onFocus={field.onFocus}
            onChange={field.onChange}
            onBlur={field.onBlur}
            onKeyDown={field.onKeyDown}
            className="h-8 min-w-0 flex-1 bg-card text-center font-semibold text-foreground"
          />
          <button
            type="button"
            aria-label={`${label}を1増やす`}
            onClick={() => onStep(1)}
            className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-card text-foreground transition-colors active:bg-muted"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <span className="font-semibold text-foreground tabular-nums">{value}個</span>
      )}
    </div>
  );
}
