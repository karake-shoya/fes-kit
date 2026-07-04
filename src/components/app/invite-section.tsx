"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Link2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createInvitation } from "@/actions/invitation";
import { cn } from "@/lib/utils";

const ROLE_OPTIONS = [
  { value: "editor", label: "編集者", desc: "追加・編集ができる" },
  { value: "viewer", label: "閲覧者", desc: "見るだけ" },
] as const;

type Role = (typeof ROLE_OPTIONS)[number]["value"];

/**
 * 招待リンクの発行UI（オーナー専用）。
 * ロールを選んでリンクを作成し、コピー／共有（LINEなど）できる。
 * リンクは72時間有効・1回使い切り。
 */
export function InviteSection({ projectId }: { projectId: string }) {
  const [role, setRole]     = useState<Role>("editor");
  const [url, setUrl]       = useState<string | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      try {
        const { token } = await createInvitation(projectId, role);
        setUrl(`${window.location.origin}/invite/${token}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      }
    });
  }

  async function handleCopy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("コピーできませんでした。リンクを長押しして選択してください");
    }
  }

  async function handleShare() {
    if (!url) return;
    try {
      await navigator.share({ title: "FesKit プロジェクトへの招待", url });
    } catch {
      // 共有シートを閉じただけでも例外になるため、エラー表示はしない
    }
  }

  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="flex flex-col gap-3">
      {/* ロール選択（セグメント風） */}
      <div className="grid grid-cols-2 gap-2">
        {ROLE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setRole(opt.value)}
            aria-pressed={role === opt.value}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-left transition-colors",
              role === opt.value
                ? "border-primary bg-primary/10"
                : "border-border bg-card hover:bg-muted"
            )}
          >
            <span className="block text-sm font-semibold text-foreground">{opt.label}</span>
            <span className="block text-xs text-muted-foreground">{opt.desc}</span>
          </button>
        ))}
      </div>

      <Button onClick={handleCreate} disabled={isPending} variant="secondary">
        <Link2 className="w-4 h-4" />
        {isPending ? "作成中…" : "招待リンクを作成"}
      </Button>

      {url && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/50 px-3 py-3">
          <p className="text-xs text-muted-foreground break-all leading-relaxed">{url}</p>
          <div className="flex gap-2">
            <Button onClick={handleCopy} size="sm" className="flex-1">
              {copied ? (
                <>
                  <Check className="w-4 h-4" /> コピーしました
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> コピー
                </>
              )}
            </Button>
            {canShare && (
              <Button onClick={handleShare} size="sm" variant="outline" className="flex-1">
                <Share2 className="w-4 h-4" /> 共有
              </Button>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <p className="text-xs text-muted-foreground/70">
        リンクは72時間有効・1回だけ使えます。LINEなどで相手に送ってください。
      </p>
    </div>
  );
}
