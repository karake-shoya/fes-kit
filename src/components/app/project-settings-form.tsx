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
        <Label htmlFor="description">メモ</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={project.description ?? ""}
          rows={3}
          disabled={!canEdit}
        />
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
