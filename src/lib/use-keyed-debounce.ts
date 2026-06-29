"use client";

import { useEffect, useRef } from "react";

// キーごとに最新の呼び出しだけを遅延実行するデバウンスを返す。
// スライダーのドラッグ確定・ステッパー連打で走るサーバー保存をまとめる用途。
// 材料ごと（ingredientId）に独立したタイマーを持たせ、別材料の保存を打ち消さない。
// 返り値: [schedule, cancel]
//   schedule(key, fn) … 遅延実行を予約（同keyの保留分は上書き）
//   cancel(key)       … 保留中の予約を取り消す（材料を外したときに復活保存を防ぐ）
export function useKeyedDebounce(
  delay: number
): [(key: string, fn: () => void) => void, (key: string) => void] {
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // アンマウント時に保留中のタイマーを破棄
  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const cancel = (key: string) => {
    const existing = timers.current.get(key);
    if (existing) {
      clearTimeout(existing);
      timers.current.delete(key);
    }
  };

  const schedule = (key: string, fn: () => void) => {
    cancel(key);
    timers.current.set(
      key,
      setTimeout(() => {
        timers.current.delete(key);
        fn();
      }, delay)
    );
  };

  return [schedule, cancel];
}
