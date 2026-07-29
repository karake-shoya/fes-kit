"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createScenario, updateScenario, deleteScenario } from "@/actions/scenario";
import { EntityFormDialog } from "@/components/app/entity-form-dialog";
import { useEntityDialog } from "@/lib/use-entity-dialog";
import {
  evaluateScenario,
  calcPurchaseRate,
  type BreakevenRecipe,
  type ScenarioLineInput,
} from "@/lib/breakeven";
import { formatYen } from "@/lib/format";

// 1商品ぶんの入力（数値は入力途中を許すため文字列で保持する）
type Draft = { price: string; quantity: string };

type Props = {
  projectId: string;
  /** 今の商品と原価（原価は材料マスタの最新値） */
  recipes: BreakevenRecipe[];
  fixedCost: number;
  expectedVisitors: number | null;
  /** 指定があれば編集モード、なければ追加モード */
  scenario?: { id: string; name: string; items: ScenarioLineInput[] };
  children: React.ReactNode;
};

// 編集なら保存済みの値、追加なら今の販売価格・作る予定数を初期値にする
// （「今の計画をひとまず1案として保存する」が最初の一手になるため）
function initialDrafts(
  recipes: BreakevenRecipe[],
  items?: ScenarioLineInput[]
): Record<string, Draft> {
  const saved = new Map(items?.map((i) => [i.recipeId, i]));

  return Object.fromEntries(
    recipes.map((r) => {
      const item = saved.get(r.recipeId);
      return [
        r.recipeId,
        {
          price:    String(Math.round(item?.sellingPrice ?? r.sellingPrice)),
          quantity: String(item?.quantity ?? r.servings),
        },
      ];
    })
  );
}

// 入力途中（空欄・不正値）は0として扱い、計算だけは常に走らせる
function toNumber(raw: string): number {
  const value = Number(raw.trim().replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function ScenarioDialog({
  projectId,
  recipes,
  fixedCost,
  expectedVisitors,
  scenario,
  children,
}: Props) {
  const isEdit = Boolean(scenario);

  // 触られるまでは state を持たず、そのつど今の値から初期値を作る。
  // マウント時に固めてしまうと、「これにする」で商品の価格が変わって
  // 再レンダーされても（Reactが同じコンポーネントとして state を保つため）
  // 初期値が反映前の古い価格のまま残ってしまう
  const [edits, setEdits] = useState<Record<string, Draft> | null>(null);
  const drafts = edits ?? initialDrafts(recipes, scenario?.items);

  // 途中でやめて閉じたら入力を捨てる（書きかけの値が次に開いたとき残らないように）。
  // 保存が成功したときはこの onClose は呼ばれない（useEntityDialog の仕様。
  // 保存済みの値まで巻き戻さないための挙動）ので、追加モードの後始末は
  // onSubmit 側で明示的に行う
  const dialog = useEntityDialog({ onClose: () => setEdits(null) });

  function setDraft(recipeId: string, patch: Partial<Draft>) {
    setEdits((prev) => {
      const base = prev ?? initialDrafts(recipes, scenario?.items);
      return { ...base, [recipeId]: { ...base[recipeId], ...patch } };
    });
  }

  // 入力しながら手残りが動くようにする（数字が苦手でも当たりが付くように）
  const preview = evaluateScenario(
    recipes,
    recipes.map((r) => ({
      recipeId:     r.recipeId,
      sellingPrice: toNumber(drafts[r.recipeId]?.price ?? ""),
      quantity:     toNumber(drafts[r.recipeId]?.quantity ?? ""),
    })),
    fixedCost
  );
  const purchaseRate = calcPurchaseRate(preview.totalQuantity, expectedVisitors);

  return (
    <EntityFormDialog
      dialog={dialog}
      isEdit={isEdit}
      title={isEdit ? "パターンを編集" : "パターンを追加"}
      trigger={children}
      onSubmit={async (formData) => {
        if (scenario) {
          await updateScenario(scenario.id, projectId, formData);
          return;
        }
        await createScenario(projectId, formData);
        // 追加モードは同じダイアログを次の1件にも使い回す。
        // 入力を捨てておかないと、次に開いたとき「今のレシピの値」ではなく
        // いま保存した案の値が初期値として出てしまう
        setEdits(null);
        return { resetForm: true };
      }}
      onDelete={
        scenario && {
          label: "このパターンを削除",
          confirmWith: "modal" as const,
          message: <>「{scenario.name}」を削除します。<br />この操作は取り消せません。</>,
          run: () => deleteScenario(scenario.id, projectId),
        }
      }
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">パターン名 <span className="text-red-500">*</span></Label>
        <Input
          id="name"
          name="name"
          placeholder="例：強気プラン"
          defaultValue={scenario?.name ?? ""}
          required
          autoFocus={!isEdit}
        />
      </div>

      {/* 商品ごとの「いくらで・何個売るか」 */}
      <div className="flex flex-col gap-2">
        <Label>商品ごとの値段と売る個数</Label>

        {recipes.map((r) => {
          const draft  = drafts[r.recipeId] ?? { price: "", quantity: "" };
          const margin = toNumber(draft.price) - r.unitCost;

          return (
            <div
              key={r.recipeId}
              className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 flex flex-col gap-2"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-foreground truncate">{r.name}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground/70 tabular-nums">
                  {r.hasCost ? (
                    <>
                      原価 {formatYen(r.unitCost)}・1個{" "}
                      <span className={margin >= 0 ? "text-green-600" : "text-red-600"}>
                        {formatYen(margin)}
                      </span>
                    </>
                  ) : (
                    "材料未登録のため計算に入りません"
                  )}
                </span>
              </div>

              <div className="flex gap-2">
                <div className="flex flex-1 items-center gap-1.5">
                  <span className="text-xs text-muted-foreground shrink-0">値段</span>
                  <Input
                    name={`price-${r.recipeId}`}
                    type="number"
                    inputMode="numeric"
                    step="10"
                    min="1"
                    required
                    value={draft.price}
                    onChange={(e) => setDraft(r.recipeId, { price: e.target.value })}
                    aria-label={`${r.name}の値段`}
                    className="h-9"
                  />
                </div>
                <div className="flex flex-1 items-center gap-1.5">
                  <span className="text-xs text-muted-foreground shrink-0">個数</span>
                  <Input
                    name={`qty-${r.recipeId}`}
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="0"
                    required
                    value={draft.quantity}
                    onChange={(e) => setDraft(r.recipeId, { quantity: e.target.value })}
                    aria-label={`${r.name}の売る個数`}
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 入力に合わせて動く手残り。保存前に結果が見えるのがこの画面の要なので、
          商品が多くて縦に伸びても常に見えるよう下端に貼り付ける。
          外側を不透明（bg-popover）にしないと、下を流れる入力欄が透けて読めなくなる */}
      {/* ダイアログの左右パディング(p-6)を打ち消して端まで伸ばし、上辺の線と影を付ける。
          カードと同じ見た目のまま貼り付けると、下を通る入力欄が隠れたときに
          「カードが消えた」と読めてしまうため、固定バーだと分かる形にする */}
      <div className="sticky bottom-0 -mx-6 border-t border-border bg-popover px-6 py-3 shadow-[0_-8px_16px_-10px_rgba(0,0,0,0.15)]">
        <div className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-3 flex flex-col gap-1">
          <div className="flex items-end justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              全部{preview.totalQuantity}個 売れたら手残り
            </span>
            <span
              className={`text-2xl font-bold tabular-nums ${
                preview.profit >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatYen(preview.profit)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground/70">
            売上 {formatYen(preview.revenue)} − 材料費 {formatYen(preview.ingredientCost)} −
            かかるお金 {formatYen(fixedCost)}
            {purchaseRate !== null && (
              <>
                <br />
                来場者{expectedVisitors}人のうち{Math.round(purchaseRate * 100)}%が買う計算
                {purchaseRate > 1 && (
                  <span className="text-red-600">（全員が1個以上買う前提です）</span>
                )}
              </>
            )}
          </p>
        </div>
      </div>
    </EntityFormDialog>
  );
}
