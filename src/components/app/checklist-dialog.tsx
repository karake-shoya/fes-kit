"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createChecklistItem, updateChecklistItem, deleteChecklistItem } from "@/actions/checklist";
import { EntityFormDialog } from "@/components/app/entity-form-dialog";
import { useEntityDialog } from "@/lib/use-entity-dialog";
import { CATEGORY_ORDER, CATEGORY_STYLE } from "@/lib/checklist";
import type { ChecklistItem } from "@/db/schema";

type Props = {
  projectId: string;
  // 指定があれば編集モード、なければ追加モード
  item?: ChecklistItem;
  children: React.ReactNode;
};

export function ChecklistDialog({ projectId, item, children }: Props) {
  const isEdit = Boolean(item);
  const dialog = useEntityDialog();

  return (
    <EntityFormDialog
      dialog={dialog}
      isEdit={isEdit}
      title={isEdit ? "持ち物を編集" : "持ち物を追加"}
      trigger={children}
      onSubmit={async (formData) => {
        if (item) {
          await updateChecklistItem(item.id, projectId, formData);
          return;
        }
        await createChecklistItem(projectId, formData);
        return { resetForm: true };
      }}
      onDelete={
        item && {
          label: "この持ち物を削除",
          confirmWith: "modal" as const,
          message: <>「{item.label}」を削除します。<br />この操作は取り消せません。</>,
          run: () => deleteChecklistItem(item.id, projectId),
        }
      }
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="label">名前 <span className="text-red-500">*</span></Label>
        <Input
          id="label"
          name="label"
          placeholder="例：テント、軍手"
          defaultValue={item?.label ?? ""}
          required
          autoFocus={!isEdit}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category">カテゴリ</Label>
        <select
          id="category"
          name="category"
          defaultValue={item?.category ?? "tool"}
          className="h-9 rounded-md border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>{CATEGORY_STYLE[c].label}</option>
          ))}
        </select>
      </div>
    </EntityFormDialog>
  );
}
