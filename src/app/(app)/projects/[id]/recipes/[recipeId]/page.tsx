import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getRecipeWithCost } from "@/db/queries/recipes";
import { getIngredients } from "@/db/queries/ingredients";
import { getMyRole } from "@/db/queries/projects";
import { RecipeDialog } from "@/components/app/recipe-dialog";
import { RecipeIngredientEditor } from "@/components/app/recipe-ingredient-editor";
import { formatYen, profitStyle } from "@/lib/format";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string; recipeId: string }>;
}) {
  const { id, recipeId } = await params;
  const userId = await requireAuth();

  const [myRole, data, allIngredients] = await Promise.all([
    getMyRole(id, userId),
    getRecipeWithCost(recipeId, id),
    getIngredients(id),
  ]);

  if (!myRole) notFound();
  if (!data) notFound();

  const { recipe, cost } = data;
  const canEdit = myRole === "owner" || myRole === "editor";
  const hasCost = cost.lines.length > 0;
  const style   = profitStyle(cost.profitRate, hasCost);

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200 px-4 py-4 flex items-center gap-3">
        <Link href={`/projects/${id}/recipes`} className="text-zinc-400 hover:text-zinc-600">
          ←
        </Link>
        <h1 className="font-bold text-zinc-800 truncate">{recipe.name}</h1>
        {canEdit && (
          <div className="ml-auto">
            <RecipeDialog projectId={id} recipe={recipe}>
              <button type="button" className="text-zinc-400 hover:text-zinc-600 text-xl">⚙</button>
            </RecipeDialog>
          </div>
        )}
      </header>

      <main className="px-4 py-6 flex flex-col gap-6 max-w-lg mx-auto">
        {/* 利益サマリー */}
        <section className="bg-white rounded-2xl border border-zinc-200 px-4 py-5 flex flex-col gap-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">販売価格（1個）</span>
            <span className="font-semibold text-zinc-800">{formatYen(recipe.sellingPrice)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">原価（1個）</span>
            <span className="font-semibold text-zinc-800">
              {hasCost ? formatYen(cost.totalCost) : "—"}
            </span>
          </div>
          <div className="border-t border-zinc-100 pt-4 flex items-center justify-between">
            <span className="text-sm text-zinc-500">利益（1個）</span>
            <span className={`font-bold text-xl ${style.text}`}>
              {hasCost ? formatYen(cost.profit) : "—"}
            </span>
          </div>
          <div className="flex items-center justify-center gap-2 bg-zinc-50 rounded-xl py-3">
            {hasCost ? (
              <>
                <span className={`text-3xl font-bold ${style.text}`}>
                  {Math.round(cost.profitRate)}%
                </span>
                <span className={`text-sm ${style.text}`}>{style.emoji} {style.label}</span>
              </>
            ) : (
              <span className="text-sm text-zinc-400">材料を追加すると利益率がわかります</span>
            )}
          </div>
          {recipe.servings > 1 && hasCost && (
            <p className="text-xs text-zinc-400 text-center">
              {recipe.servings}個作ると利益は約 {formatYen(cost.profit * recipe.servings)}
            </p>
          )}
        </section>

        {/* 材料 */}
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold text-zinc-700 px-1">材料（1個分）</h2>
          {canEdit ? (
            <RecipeIngredientEditor
              recipeId={recipe.id}
              projectId={id}
              lines={cost.lines}
              allIngredients={allIngredients}
            />
          ) : cost.lines.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-4">材料が登録されていません</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {cost.lines.map((line) => (
                <li
                  key={line.ingredientId}
                  className="bg-white rounded-xl border border-zinc-200 px-3 py-3 flex items-center justify-between gap-2"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-zinc-800 truncate">{line.ingredientName}</span>
                    <span className="text-xs text-zinc-500">{line.quantityUsed}{line.unit}</span>
                  </div>
                  <span className="text-sm text-zinc-600 shrink-0">{formatYen(line.lineCost)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {recipe.memo && (
          <section className="bg-white rounded-2xl border border-zinc-200 px-4 py-3">
            <p className="text-sm text-zinc-600 whitespace-pre-wrap">{recipe.memo}</p>
          </section>
        )}
      </main>
    </div>
  );
}
