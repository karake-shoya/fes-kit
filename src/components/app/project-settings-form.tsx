"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateProject } from "@/actions/project";
import type { Project } from "@/db/schema";

type Props = {
  project: Project;
  canEdit: boolean;
};

export function ProjectSettingsForm({ project, canEdit }: Props) {
  const [error, setError]            = useState<string | null>(null);
  const [success, setSuccess]        = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await updateProject(project.id, formData);
        setSuccess(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">プロジェクト名 <span className="text-red-500">*</span></Label>
        <Input
          id="name"
          name="name"
          defaultValue={project.name}
          required
          disabled={!canEdit}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="eventDate">イベント日</Label>
        <Input
          id="eventDate"
          name="eventDate"
          type="date"
          defaultValue={project.eventDate ?? ""}
          disabled={!canEdit}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expectedVisitors">想定来場者数</Label>
        <Input
          id="expectedVisitors"
          name="expectedVisitors"
          type="number"
          inputMode="numeric"
          step="1"
          min="0"
          placeholder="例：500"
          defaultValue={project.expectedVisitors ?? ""}
          disabled={!canEdit}
        />
        <p className="text-xs text-muted-foreground">
          入れておくと、採算シミュレーションで「来場者の何人に1人が買う計算か」を確認できます。
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="targetProfit">目標の手残り</Label>
        <Input
          id="targetProfit"
          name="targetProfit"
          type="number"
          inputMode="numeric"
          step="1"
          min="0"
          placeholder="例：30000"
          defaultValue={project.targetProfit ?? ""}
          disabled={!canEdit}
        />
        <p className="text-xs text-muted-foreground">
          入れておくと、採算シミュレーションで「その額を残すには何個売るか」を逆算します。
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">説明・メモ</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={project.description ?? ""}
          placeholder="例：地域の秋祭り。家族連れが多め。定番のたこ焼き店。"
          rows={3}
          disabled={!canEdit}
        />
        <p className="text-xs text-muted-foreground">
          イベントの雰囲気や客層を書いておくと、AIの価格提案に反映されます。
        </p>
      </div>
      {error   && <p className="text-sm text-red-500">{error}</p>}
      {success && <p className="text-sm text-green-600">保存しました</p>}
      {canEdit && (
        <Button
          type="submit"
          disabled={isPending}
        >
          {isPending ? "保存中…" : "変更を保存"}
        </Button>
      )}
    </form>
  );
}
