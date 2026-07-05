"use client";

import { useState } from "react";
import type { ChangeEvent, FocusEvent, KeyboardEvent } from "react";

// 数値インライン編集の共通ロジック（フォーカスで編集バッファ化→blurで確定）。
// 販売価格・作る予定数・実績数など「その場で編集→即保存」という同じパターンを持つ
// 数値フィールドで共用し、境界値チェック・丸め処理だけを呼び出し側で指定する。
export function useDraftNumberInput(
  value: number,
  onCommit: (next: number) => void,
  { isValid, integer = false }: { isValid: (raw: number) => boolean; integer?: boolean }
) {
  const [draft, setDraft] = useState<string | null>(null);
  const inputValue = draft ?? String(Math.round(value));

  function onFocus(e: FocusEvent<HTMLInputElement>) {
    setDraft(inputValue);
    e.currentTarget.select();
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    setDraft(e.target.value);
  }

  // 不正値は無視して元の値を維持
  function onBlur() {
    if (draft === null) return;
    const cleaned = draft.trim().replace(/,/g, "");
    const raw = Number(cleaned);
    setDraft(null);
    if (cleaned === "" || Number.isNaN(raw) || !isValid(raw)) return;
    onCommit(integer ? Math.floor(raw) : raw);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") e.currentTarget.blur();
  }

  return { inputValue, onFocus, onChange, onBlur, onKeyDown };
}
