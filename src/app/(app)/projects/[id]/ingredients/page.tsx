import { notFound } from "next/navigation";
import { ShoppingCart, Plus, ChevronRight } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { getIngredients } from "@/db/queries/ingredients";
import { getMyRole } from "@/db/queries/projects";
import { IngredientDialog } from "@/components/app/ingredient-dialog";
import { AppHeader } from "@/components/app/app-header";
import { Button } from "@/components/ui/button";
import { formatYen } from "@/lib/format";

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
    <div className="min-h-screen bg-background">
      <AppHeader
        title="材料マスタ"
        backHref={`/projects/${id}`}
        action={
          canEdit && (
            <IngredientDialog projectId={id}>
              <Button size="sm">
                <Plus className="w-4 h-4" /> 追加
              </Button>
            </IngredientDialog>
          )
        }
      />

      <main className="px-4 py-6 flex flex-col gap-3 max-w-lg mx-auto">
        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <ShoppingCart className="w-12 h-12 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm leading-relaxed">
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
                <div className="bg-card rounded-2xl border border-border px-4 py-4 shadow-sm active:scale-[0.98] transition-transform">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-semibold text-foreground truncate">{ing.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {ing.quantity}{ing.unit} で {formatYen(ing.price)}
                      </span>
                      {ing.supplier && (
                        <span className="text-xs text-muted-foreground/70">仕入れ: {ing.supplier}</span>
                      )}
                    </div>
                    {canEdit && <ChevronRight className="shrink-0 w-5 h-5 text-muted-foreground/40" />}
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
