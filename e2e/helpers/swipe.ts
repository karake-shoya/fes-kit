import type { Locator } from "@playwright/test";

// スワイプ削除（swipe-action-card.tsx）を動かすためのタッチ合成。
//
// Playwright に swipe の API は無い。page.touchscreen が持つのは tap だけで、
// 指を動かす操作は自前で touchstart → touchmove → touchend を投げるしかない。
//
// カード側は React.TouchEvent 実装で、次の2つを満たさないと反応しない:
//   1. 最初の移動が SLOP(8px) を超えるまで方向が確定しない（水平/垂直の判定）
//   2. 水平と判定された後の移動量だけがオフセットに効く
// そのため1回の大きな移動ではなく、刻んで動かす。

/** 削除ボタンが押せる状態になる引き量。ACTION_WIDTH(80px) の半分を超える必要がある。 */
const OPEN_DISTANCE = 100;

/**
 * カードの「前面」要素を取り出す。
 *
 * swipe-action-card は li の直下に
 *   1本目 = 背面の削除ボタン（absolute）
 *   2本目 = 前面カード（onTouchStart などが付く）
 * の順で div を置く。タッチイベントは前面へ投げないと届かない
 * （dispatchEvent は指定した要素から上へ伝わるだけで、子へは降りない）。
 */
function frontOf(card: Locator): Locator {
  return card.locator(":scope > div").nth(1);
}

/**
 * カードを左へスワイプして削除ボタンを開く。
 *
 * @param card スワイプ対象（swipe-action-card が描く li）
 * @param distance 左へ引く量(px)
 */
export async function swipeLeft(card: Locator, distance = OPEN_DISTANCE): Promise<void> {
  const box = await card.boundingBox();
  if (!box) throw new Error("スワイプ対象の位置が取れない（画面に出ていない可能性）");

  // 掴む位置はカードの右寄り。左へ引く余地を残す。
  const startX = box.x + box.width - 20;
  const y = box.y + box.height / 2;
  const front = frontOf(card);

  const steps = 10;
  await dispatchTouch(front, "touchstart", startX, y);
  for (let i = 1; i <= steps; i++) {
    await dispatchTouch(front, "touchmove", startX - (distance * i) / steps, y);
  }
  await dispatchTouch(front, "touchend", startX - distance, y);
}

/**
 * React の合成イベントに届く形でタッチイベントを投げる。
 *
 * ⚠ new TouchEvent() / new Touch() は使わない。WebKit では
 * 「Illegal constructor」で落ちる（Safari はこの2つを公開していない）。
 * React は native イベントの touches / changedTouches を読むだけなので、
 * ただの Event にその3つを生やせば両エンジンで同じように動く。
 */
async function dispatchTouch(
  target: Locator,
  type: "touchstart" | "touchmove" | "touchend",
  clientX: number,
  clientY: number,
): Promise<void> {
  await target.evaluate(
    (el, { type, clientX, clientY }) => {
      const touch = { identifier: 1, target: el, clientX, clientY, pageX: clientX, pageY: clientY };
      // touchend では touches が空になり、離した指は changedTouches に入る。
      const active = type === "touchend" ? [] : [touch];

      const event = new Event(type, { bubbles: true, cancelable: true });
      for (const [key, value] of Object.entries({
        touches: active,
        targetTouches: active,
        changedTouches: [touch],
      })) {
        Object.defineProperty(event, key, { value, enumerable: true });
      }
      el.dispatchEvent(event);
    },
    { type, clientX, clientY },
  );
}
