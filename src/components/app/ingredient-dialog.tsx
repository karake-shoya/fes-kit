"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createIngredient,
  updateIngredient,
  deleteIngredient,
} from "@/actions/ingredient";
import { EntityFormDialog } from "@/components/app/entity-form-dialog";
import { useEntityDialog } from "@/lib/use-entity-dialog";
import type { Ingredient } from "@/db/schema";

// 単位入力の候補（datalist）
const UNIT_OPTIONS = ["g", "kg", "ml", "L", "個", "袋", "本", "枚", "玉", "パック", "箱"];

type Props = {
  projectId: string;
  // 指定があれば編集モード、なければ追加モード
  ingredient?: Ingredient;
  // トリガーに使う要素（カードや追加ボタンなど）
  children: React.ReactNode;
};

export function IngredientDialog({ projectId, ingredient, children }: Props) {
  const isEdit = Boolean(ingredient);
  const dialog = useEntityDialog();

  return (
    <EntityFormDialog
      dialog={dialog}
      isEdit={isEdit}
      title={isEdit ? "材料を編集" : "材料を追加"}
      trigger={children}
      onSubmit={async (formData) => {
        if (ingredient) {
          await updateIngredient(ingredient.id, projectId, formData);
          return;
        }
        await createIngredient(projectId, formData);
        return { resetForm: true };
      }}
      onDelete={
        ingredient && {
          label: "この材料を削除",
          confirmWith: "inline",
          message: <>この材料を削除しますか？<br />この材料を使っているレシピの構成からも取り除かれます。</>,
          run: () => deleteIngredient(ingredient.id, projectId),
        }
      }
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">材料名 <span className="text-red-500">*</span></Label>
        <Input
          id="name"
          name="name"
          placeholder="例：キャベツ"
          defaultValue={ingredient?.name ?? ""}
          required
          // 追加モードのみ自動フォーカス（編集モードはキーボードを出さない）
          autoFocus={!isEdit}
        />
      </div>

      <div className="flex gap-3">
        <div className="flex flex-col gap-1.5 flex-1">
          <Label htmlFor="price">単価（円） <span className="text-red-500">*</span></Label>
          <Input
            id="price"
            name="price"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            placeholder="198"
            defaultValue={ingredient?.price ?? ""}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          <Label htmlFor="quantity">購入数量 <span className="text-red-500">*</span></Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            placeholder="1000"
            defaultValue={ingredient?.quantity ?? ""}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="unit">単位 <span className="text-red-500">*</span></Label>
        <Input
          id="unit"
          name="unit"
          list="unit-options"
          placeholder="g / 袋 / 個 など"
          defaultValue={ingredient?.unit ?? ""}
          required
        />
        <datalist id="unit-options">
          {UNIT_OPTIONS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        <p className="text-xs text-muted-foreground/70">
          「1000g入りを198円で買った」なら 単価=198 / 数量=1000 / 単位=g
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="supplier">仕入れ先</Label>
        <Input
          id="supplier"
          name="supplier"
          placeholder="例：業務スーパー"
          defaultValue={ingredient?.supplier ?? ""}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="memo">メモ</Label>
        <Textarea
          id="memo"
          name="memo"
          placeholder="特売日や代替品など"
          rows={2}
          defaultValue={ingredient?.memo ?? ""}
        />
      </div>
    </EntityFormDialog>
  );
}
