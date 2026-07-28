"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { ChecklistDialog } from "@/components/app/checklist-dialog";
import { SwipeActionCard } from "@/components/app/swipe-action-card";
import { deleteChecklistItem, toggleChecklistItem } from "@/actions/checklist";
import type { ChecklistItem } from "@/db/schema";

type Props = {
  item: ChecklistItem;
  projectId: string;
  // editor 以上ならチェック切り替え・編集ダイアログ・スワイプ削除が使える
  canEdit: boolean;
};

// 持ち物1件分のカード。カテゴリ別グループから再利用する。
export function ChecklistItemCard({ item, projectId, canEdit }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleToggle(e: React.MouseEvent) {
    // 親カードの編集ダイアログが開かないよう伝播を止める
    e.stopPropagation();
    e.preventDefault();
    if (!canEdit || isPending) return;
    startTransition(async () => {
      try {
        await toggleChecklistItem(item.id, projectId);
        router.refresh();
      } catch {
        // 失敗時は何もしない（次タップで再試行可能）
      }
    });
  }

  const checkbox = (
    <button
      type="button"
      onClick={handleToggle}
      disabled={!canEdit || isPending}
      aria-label={item.checked ? "未チェックに戻す" : "チェックする"}
      aria-pressed={item.checked}
      className={`grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors ${
        item.checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/30 bg-transparent"
      } ${canEdit ? "active:scale-95 transition-transform" : ""} ${isPending ? "opacity-50" : ""}`}
    >
      {item.checked && <Check className="w-4 h-4" />}
    </button>
  );

  // タイトル＋メモの本文（編集トリガーになる部分）
  const body = (
    <div className="flex flex-col min-w-0">
      <span
        className={`text-sm font-medium truncate ${
          item.checked ? "text-muted-foreground line-through" : "text-foreground"
        }`}
      >
        {item.label}
      </span>
      {item.memo && <span className="text-xs text-muted-foreground/70 truncate">{item.memo}</span>}
    </div>
  );

  return (
    <SwipeActionCard
      enabled={canEdit}
      deleteAriaLabel="この持ち物を削除"
      confirmMessage={<>「{item.label}」を削除します。<br />この操作は取り消せません。</>}
      onDelete={() => deleteChecklistItem(item.id, projectId)}
    >
      <div className="flex flex-1 min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-border bg-card px-3 py-3 shadow-sm">
        {checkbox}
        {canEdit ? (
          <ChecklistDialog projectId={projectId} item={item}>
            <button type="button" className="text-left min-w-0 flex-1 active:scale-[0.99] transition-transform">
              {body}
            </button>
          </ChecklistDialog>
        ) : (
          body
        )}
      </div>
    </SwipeActionCard>
  );
}
