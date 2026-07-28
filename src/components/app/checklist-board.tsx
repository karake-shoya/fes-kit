"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, ShoppingBasket } from "lucide-react";
import { ChecklistItemCard } from "@/components/app/checklist-item-card";
import { EmptyState } from "@/components/app/page-shell";
import { importFromShoppingList } from "@/actions/checklist";
import { CATEGORY_STYLE, groupChecklistItemsByCategory, type ChecklistCategory } from "@/lib/checklist";
import type { ChecklistItem } from "@/db/schema";

type Props = {
  projectId: string;
  canEdit: boolean;
  items: ChecklistItem[];
};

export function ChecklistBoard({ projectId, canEdit, items }: Props) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const router = useRouter();

  const groups = groupChecklistItemsByCategory(items);

  function handleImport() {
    setFeedback(null);
    startTransition(async () => {
      try {
        const { imported } = await importFromShoppingList(projectId);
        setFeedback(imported > 0 ? `${imported}件追加しました` : "追加できる材料はありません");
        router.refresh();
      } catch (err) {
        setFeedback(err instanceof Error ? err.message : "エラーが発生しました");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {canEdit && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleImport}
            disabled={isPending}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary active:opacity-80 transition-opacity disabled:opacity-50"
          >
            <ShoppingBasket className="w-4 h-4" />
            {isPending ? "追加中…" : "買い出しリストから追加"}
          </button>
          {feedback && <p className="text-xs text-center text-muted-foreground">{feedback}</p>}
        </div>
      )}

      {groups.length === 0 ? (
        <EmptyState icon={ClipboardList}>
          まだ持ち物がありません。<br />
          {canEdit
            ? "「追加」ボタンや「買い出しリストから追加」で登録しましょう！"
            : "編集者が持ち物を登録するとここに表示されます。"}
        </EmptyState>
      ) : (
        <CategoryGroups groups={groups} projectId={projectId} canEdit={canEdit} />
      )}
    </div>
  );
}

function CategoryGroups({
  groups,
  projectId,
  canEdit,
}: {
  groups: [ChecklistCategory, ChecklistItem[]][];
  projectId: string;
  canEdit: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      {groups.map(([category, categoryItems]) => {
        const doneCount = categoryItems.filter((item) => item.checked).length;
        return (
          <section key={category} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold px-1 text-foreground">
              {CATEGORY_STYLE[category].label}
              <span className="ml-1.5 text-xs text-muted-foreground/70 tabular-nums">
                {doneCount}/{categoryItems.length}
              </span>
            </h2>
            <ul className="flex flex-col gap-2">
              {categoryItems.map((item) => (
                <ChecklistItemCard key={item.id} item={item} projectId={projectId} canEdit={canEdit} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
