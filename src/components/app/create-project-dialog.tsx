"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createProject } from "@/actions/project";
import { EntityFormDialog } from "@/components/app/entity-form-dialog";
import { useEntityDialog } from "@/lib/use-entity-dialog";

export function CreateProjectDialog() {
  const dialog = useEntityDialog();

  return (
    <EntityFormDialog
      dialog={dialog}
      isEdit={false}
      title="新規プロジェクト"
      submitLabel="作成する"
      pendingLabel="作成中…"
      trigger={
        <Button className="w-full">
          <Plus className="w-4 h-4" /> 新しいプロジェクトを作る
        </Button>
      }
      onSubmit={async (formData) => {
        const result = await createProject(formData);
        // 作成したプロジェクトのホームへそのまま移動する
        return { resetForm: true, redirectTo: `/projects/${result.projectId}` };
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">プロジェクト名 <span className="text-red-500">*</span></Label>
        <Input
          id="name"
          name="name"
          placeholder="例：文化祭2025 焼きそば屋台"
          required
          autoFocus
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="eventDate">イベント日</Label>
        <Input
          id="eventDate"
          name="eventDate"
          type="date"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">説明・メモ</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="例：地域の秋祭り。家族連れが多め。定番のたこ焼き店。"
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          イベントの雰囲気や客層を書いておくと、AIの価格提案に反映されます。
        </p>
      </div>
    </EntityFormDialog>
  );
}
