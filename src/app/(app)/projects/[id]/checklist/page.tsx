import { Plus } from "lucide-react";
import { requireProjectPage } from "@/lib/auth";
import { getChecklistItems } from "@/db/queries/checklist";
import { ChecklistDialog } from "@/components/app/checklist-dialog";
import { ChecklistBoard } from "@/components/app/checklist-board";
import { AppHeader } from "@/components/app/app-header";
import { Button } from "@/components/ui/button";

export default async function ChecklistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [{ canEdit }, items] = await Promise.all([
    requireProjectPage(id),
    getChecklistItems(id),
  ]);

  return (
    <>
      <AppHeader
        title="持ち物・準備チェックリスト"
        backHref={`/projects/${id}`}
        action={
          canEdit && (
            <ChecklistDialog projectId={id}>
              <Button size="sm">
                <Plus className="w-4 h-4" /> 追加
              </Button>
            </ChecklistDialog>
          )
        }
      />

      <main className="px-4 py-6 flex flex-col gap-4 max-w-lg mx-auto">
        <ChecklistBoard projectId={id} canEdit={canEdit} items={items} />
      </main>
    </>
  );
}
