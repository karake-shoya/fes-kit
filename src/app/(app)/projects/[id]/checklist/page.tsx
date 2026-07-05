import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { getChecklistItems } from "@/db/queries/checklist";
import { getMyRole } from "@/db/queries/projects";
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
  const userId = await requireAuth();

  const [myRole, items] = await Promise.all([
    getMyRole(id, userId),
    getChecklistItems(id),
  ]);
  if (!myRole) notFound();

  const canEdit = myRole === "owner" || myRole === "editor";

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
