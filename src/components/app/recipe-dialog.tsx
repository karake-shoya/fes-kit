"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createRecipe, updateRecipe, deleteRecipe } from "@/actions/recipe";
import { EntityFormDialog } from "@/components/app/entity-form-dialog";
import { useEntityDialog } from "@/lib/use-entity-dialog";
import type { Recipe } from "@/db/schema";

type Props = {
  projectId: string;
  // 指定があれば編集モード、なければ追加モード
  recipe?: Recipe;
  // 追加後に詳細ページへ遷移するか（一覧の「＋追加」では true）
  redirectOnCreate?: boolean;
  children: React.ReactNode;
};

export function RecipeDialog({ projectId, recipe, redirectOnCreate, children }: Props) {
  const isEdit = Boolean(recipe);
  const dialog = useEntityDialog();

  return (
    <EntityFormDialog
      dialog={dialog}
      isEdit={isEdit}
      title={isEdit ? "商品を編集" : "商品を追加"}
      trigger={children}
      onSubmit={async (formData) => {
        if (recipe) {
          await updateRecipe(recipe.id, projectId, formData);
          return;
        }
        const result = await createRecipe(projectId, formData);
        return {
          resetForm: true,
          redirectTo: redirectOnCreate
            ? `/projects/${projectId}/recipes/${result.recipeId}`
            : undefined,
        };
      }}
      onDelete={
        recipe && {
          label: "この商品を削除",
          confirmWith: "inline" as const,
          message: <>この商品を削除しますか？<br />登録した材料の組み合わせも一緒に削除されます。</>,
          run: () => deleteRecipe(recipe.id, projectId),
          // 詳細ページから削除した場合は一覧へ戻す
          redirectTo: `/projects/${projectId}/recipes`,
        }
      }
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">商品名 <span className="text-red-500">*</span></Label>
        <Input
          id="name"
          name="name"
          placeholder="例：焼きそば"
          defaultValue={recipe?.name ?? ""}
          required
          // 追加モードのみ自動フォーカス（編集モードはキーボードを出さない）
          autoFocus={!isEdit}
        />
      </div>

      <div className="flex gap-3">
        <div className="flex flex-col gap-1.5 flex-1">
          <Label htmlFor="sellingPrice">販売価格（円） <span className="text-red-500">*</span></Label>
          <Input
            id="sellingPrice"
            name="sellingPrice"
            type="number"
            inputMode="decimal"
            step="1"
            min="1"
            placeholder="300"
            defaultValue={recipe?.sellingPrice ?? ""}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          <Label htmlFor="servings">作る予定数</Label>
          <Input
            id="servings"
            name="servings"
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            placeholder="100"
            defaultValue={recipe?.servings ?? 1}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground/70 -mt-2">
        販売価格は「1個（1皿）あたり」の値段を入れてください。<br />
        作る予定数は「買い出しリスト」の必要量の計算に使われます。
      </p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="memo">メモ</Label>
        <Textarea
          id="memo"
          name="memo"
          placeholder="盛り付けやトッピングのメモなど"
          rows={2}
          defaultValue={recipe?.memo ?? ""}
        />
      </div>
    </EntityFormDialog>
  );
}
