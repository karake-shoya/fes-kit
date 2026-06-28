import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShoppingCart, Plus, ChevronRight } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { getIngredients } from "@/db/queries/ingredients";
import { getMyRole } from "@/db/queries/projects";
import { IngredientDialog } from "@/components/app/ingredient-dialog";
import { Button } from "@/components/ui/button";

export default async function IngredientsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireAuth();

  // role判定と材料取得は独立なので並列実行する
  const [myRole, list] = await Promise.all([
    getMyRole(id, userId),
    getIngredients(id),
  ]);
  if (!myRole) notFound();

  const canEdit = myRole === "owner" || myRole === "editor";

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200 px-4 py-4 flex items-center gap-3">
        <Link href={`/projects/${id}`} className="text-zinc-400 hover:text-zinc-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-bold text-zinc-800">材料マスタ</h1>
        {canEdit && (
          <div className="ml-auto">
            <IngredientDialog projectId={id}>
              <Button size="sm" className="bg-amber-700 hover:bg-amber-800 text-white">
                <Plus className="w-4 h-4" /> 追加
              </Button>
            </IngredientDialog>
          </div>
        )}
      </header>

      <main className="px-4 py-6 flex flex-col gap-3 max-w-lg mx-auto">
        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <ShoppingCart className="w-12 h-12 text-zinc-300" />
            <p className="text-zinc-500 text-sm leading-relaxed">
              まだ材料がありません。<br />
              {canEdit
                ? "「追加」ボタンから食材を登録しましょう！"
                : "編集者が材料を登録するとここに表示されます。"}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {list.map((ing) => {
              const card = (
                <div className="bg-white rounded-2xl border border-zinc-200 px-4 py-4 shadow-sm active:scale-[0.98] transition-transform">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-semibold text-zinc-800 truncate">{ing.name}</span>
                      <span className="text-sm text-zinc-500">
                        {ing.quantity}{ing.unit} で ¥{ing.price.toLocaleString()}
                      </span>
                      {ing.supplier && (
                        <span className="text-xs text-zinc-400">仕入れ: {ing.supplier}</span>
                      )}
                    </div>
                    {canEdit && <ChevronRight className="shrink-0 w-5 h-5 text-zinc-300" />}
                  </div>
                </div>
              );

              return (
                <li key={ing.id}>
                  {canEdit ? (
                    <IngredientDialog projectId={id} ingredient={ing}>
                      <button type="button" className="w-full text-left">
                        {card}
                      </button>
                    </IngredientDialog>
                  ) : (
                    card
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
