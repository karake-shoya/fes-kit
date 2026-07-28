"use client";

import { useEffect } from "react";
import { CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * アプリ画面で予期しないエラーが起きたときの受け皿。
 * これが無いと真っ白な画面になってしまうため、原因が何であれ
 * 「やりなおす」で復帰できる出口をユーザーに残す。
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 本文には出さず、調査用にコンソールへ残す
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <CloudOff className="w-12 h-12 text-muted-foreground/40" />
      <div className="flex flex-col gap-1.5">
        <p className="font-semibold text-foreground">うまく読み込めませんでした</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          通信が不安定だったのかもしれません。<br />
          少し待ってから、もう一度お試しください。
        </p>
      </div>
      <Button onClick={reset} className="w-full max-w-xs">
        やりなおす
      </Button>
    </div>
  );
}
