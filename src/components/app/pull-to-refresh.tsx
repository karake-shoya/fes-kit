"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2 } from "lucide-react";

// この距離(px)を超えて指を離すと更新する
const THRESHOLD = 70;
// 引っ張りの見た目上の上限(px)
const MAX_PULL = 110;
// ラバーバンド抵抗（指の移動量に対する追従率）
const RESISTANCE = 0.5;

/**
 * スマホ向けのカスタム「引っ張って更新」ラッパー。
 * PWAスタンドアロンではブラウザ標準の下引き更新が効かないため、
 * 画面最上部での下方向の引っ張りを自前で検知し、router.refresh() で
 * Server Component のデータを再取得する。
 * globals.css の overscroll-behavior により、ネイティブのバウンス
 * （無駄スクロール）は抑制した上で、この演出だけを見せる。
 */
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pull, setPull] = useState(0); // 現在の引っ張り量(px)
  const [dragging, setDragging] = useState(false); // 指で引っ張り追従中か（演出の切替用）
  const [isPending, startTransition] = useTransition();

  // タッチ開始位置と、引っ張り判定中かどうか（同一ジェスチャ内で同期的に参照するため ref で保持）
  const startY = useRef<number | null>(null);
  const startX = useRef(0);
  const active = useRef(false);

  // 引っ張り判定を終了して状態を初期化する
  const stop = useCallback(() => {
    active.current = false;
    startY.current = null;
    setDragging(false);
    setPull(0);
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      // 最上部でなければ通常スクロールを優先し、更新中も無視する
      if (window.scrollY > 0 || isPending) return;
      startY.current = e.touches[0].clientY;
      startX.current = e.touches[0].clientX;
      active.current = true;
      setDragging(true);
    },
    [isPending]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!active.current || startY.current === null) return;

      const dy = e.touches[0].clientY - startY.current;
      const dx = e.touches[0].clientX - startX.current;

      // 横方向の動きが勝る（横スクロール・スワイプ）、上方向、または最上部を
      // 外れた場合は引っ張り判定を中断する
      if (Math.abs(dx) > Math.abs(dy) || dy <= 0 || window.scrollY > 0) {
        stop();
        return;
      }
      // ラバーバンド抵抗をかけて追従させる
      setPull(Math.min(dy * RESISTANCE, MAX_PULL));
    },
    [stop]
  );

  const onTouchEnd = useCallback(() => {
    if (!active.current) {
      setDragging(false);
      return;
    }
    // 閾値を超えていれば更新する。更新中の表示は isPending から導出し、
    // トランジション終了でインジケーターが自動的に畳まれる
    const shouldRefresh = pull >= THRESHOLD;
    stop();
    if (shouldRefresh) {
      startTransition(() => {
        router.refresh();
      });
    }
  }, [pull, router, stop]);

  // 更新中は閾値位置でインジケーターを保持し、それ以外は引っ張り量に追従させる
  const indicatorHeight = isPending ? THRESHOLD : pull;

  return (
    <>
      {/* 引っ張り量に追従する上部インジケーター */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-end justify-center overflow-hidden"
        style={{
          height: indicatorHeight,
          // 追従中は即時、指を離した後は滑らかに畳む
          transition: dragging ? "none" : "height 0.2s ease",
        }}
      >
        <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-md ring-1 ring-border">
          {isPending ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <Image
              src="/mascot.png"
              alt=""
              width={24}
              height={24}
              className="h-6 w-6 object-contain"
              style={{
                // 引っ張るほどマスコットを回し、閾値でちょうど半回転
                transform: `rotate(${Math.min(pull / THRESHOLD, 1) * 180}deg)`,
                opacity: Math.min(pull / 24, 1),
              }}
            />
          )}
        </div>
      </div>

      {/*
        タッチ検知用のラッパー。ここには transform を掛けないこと。
        transform を持たせると内側の position:fixed 要素（下部タブバー）の
        位置基準がこの要素に変わり、通常時にタブバーが画面外へずれてしまう。
        引っ張りの視覚表現は上のインジケーターだけで担い、本文は動かさない。
      */}
      <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        {children}
      </div>
    </>
  );
}
