"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// 送信ハンドラの戻り値で、送信後の後始末を指示できる
export type SubmitResult = {
  /** 追加モードのようにフォームを空に戻したいとき */
  resetForm?: boolean;
  /** 保存後に別画面へ移動したいとき（未指定なら現在の画面を再取得） */
  redirectTo?: string;
} | void;

export type EntityDialog = ReturnType<typeof useEntityDialog>;

/**
 * 追加・編集ダイアログの共通状態（開閉・保存中・エラー・削除確認）をまとめる。
 *
 * 材料／商品／予定／持ち物／試作記録のダイアログは、フォームの項目が違うだけで
 * ここの流れはすべて同じなので、状態と後始末をこのフックに集約する。
 */
export function useEntityDialog(options?: {
  /** ダイアログを閉じたときに追加で戻したい状態（写真・選択中のレシピなど） */
  onClose?: () => void;
}) {
  const [open, setOpen]                   = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  // 削除は誤タップ防止のため2段階（ボタン → 確認）にする
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition]      = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router  = useRouter();

  // ダイアログを閉じたら確認状態・エラーをリセットする
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setConfirmDelete(false);
      setError(null);
      options?.onClose?.();
    }
  }

  function toMessage(err: unknown) {
    return err instanceof Error ? err.message : "エラーが発生しました";
  }

  /**
   * フォーム送信をラップする。成功なら閉じて再取得、失敗ならエラーを表示する。
   *
   * 成功時は handleOpenChange を通さず setOpen(false) で閉じるため、**onClose は呼ばれない**。
   * onClose の役目は「保存していない入力を捨てる」ことなので、保存できた値まで
   * 巻き戻すと逆に困るため（編集ダイアログなら、再取得がまだ届いていない
   * 古い props へ state を戻してしまう）。
   * 追加モードで次の1件に備えて state を空にしたい場合は、呼び出し側が
   * onSubmit の中で明示的にリセットする（scenario-dialog / prototype-dialog がその形）。
   */
  function submit(
    e: React.FormEvent<HTMLFormElement>,
    run: (formData: FormData) => Promise<SubmitResult>
  ) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        const result = await run(formData);
        if (result?.resetForm) formRef.current?.reset();
        setOpen(false);
        if (result?.redirectTo) router.push(result.redirectTo);
        else router.refresh();
      } catch (err) {
        setError(toMessage(err));
      }
    });
  }

  /** 削除をラップする。失敗時はダイアログを開いたままエラーを表示する */
  function remove(
    run: () => Promise<void>,
    opts?: {
      /**
       * 確認モーダル（ネストしたDialog）から呼ぶときは true。
       * 同一フレームで内外のDialogを閉じるとRadixのスクロールロック解除が
       * 取りこぼされ画面が操作不能になるため、内側→外側の順に時間差で閉じる。
       */
      stagger?: boolean;
      /** 削除後に移動したい画面（一覧へ戻すときなど） */
      redirectTo?: string;
    }
  ) {
    setError(null);
    startTransition(async () => {
      try {
        await run();
        const finish = () => {
          setOpen(false);
          if (opts?.redirectTo) router.push(opts.redirectTo);
          router.refresh();
        };
        if (opts?.stagger) {
          setConfirmDelete(false);
          setTimeout(finish, 150);
        } else {
          finish();
        }
      } catch (err) {
        setError(toMessage(err));
      }
    });
  }

  return {
    open,
    setOpen,
    handleOpenChange,
    error,
    setError,
    confirmDelete,
    setConfirmDelete,
    isPending,
    formRef,
    submit,
    remove,
  };
}
