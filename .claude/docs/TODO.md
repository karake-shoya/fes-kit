# 次セッションでやること

> **実機確認25項目は 2026-08-13 に全件 E2E へ移した。**
> `npm run test:e2e` = 61 passed（2ブラウザ併走）。
> 仕分けは [docs/2026-08-08_実機確認25項目の仕分け.md](../../docs/2026-08-08_実機確認25項目の仕分け.md)、
> 実行の仕組みは README の「E2E」節。

## 残っていること

- **E2E を CI に接続する**（計画の Step 5）。今は手元実行のみ。
  鍵は GitHub Secrets（`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` / `E2E_CLERK_USER_EMAIL`）。
  Turso の鍵は `file:` DB を使うので要らない。`npx playwright install --with-deps` が要る。
  失敗時は `playwright-report` を artifact に上げる。

- **実機（iPhone/PWA）で一度だけ目視する項目**。E2E はブラウザエンジンであって実機ではないため、
  **見た目は初回だけ実機で見て、以後の回帰は E2E が守る**という分担にしている。
  1. **オフライン時の挙動**（①3）。`context.setOffline` は実機の PWA オフラインとは経路が違う。
     E2E が守るのは「失敗を知らせて巻き戻す」ロジックまで。
  2. **比較表のスマホ幅での見え方**（⑤3〜⑤5）。左列固定・横スクロール・王冠の位置。
     WebKit で通ってはいるが、実機の Safari とは描画が完全には一致しない。
  3. **スワイプ削除の指の感触**（②2・③4）。合成タッチでロジックは通るが、
     SLOP(8px) の遊びが実機で自然かは触ってみないと分からない。

- **AI採算診断の実API往復**。E2E は `e2e/ai-stub.mjs` を相手にしていて、本物の Claude API は叩かない。
  プロンプトを変えたときは実APIで1回試す（2026-07-29 の使い捨てスクリプトと同じやり方）。
  ⚠ **原価割れによる `dropped` の分岐は実APIでは7回とも発火せず未通過**（モデルが指示を守るため）。
  スタブなら任意に作れるので、必要ならテストを足せる。

- **採算シミュレーションの未決事項**。設計の「未決・保留」節（1人が複数個買う前提の扱い／
  パターンの引き継ぎ）。どれも実データが出てから決める性質のもの。
  設計は [docs/採算シミュレーション設計.md](../../docs/採算シミュレーション設計.md)。

- **GitHub Issue で判断待ち**
  - #32 `ai-price.ts と ai-simulation.ts の重複（MODEL・round10・APIキーガード）を共通化する`
  - #33 `未使用の .dark トークンを消すか、ダークモードを実装するか決める`

---

## E2E がいま守っているもの（25項目の対応）

| 区分 | 項目 | spec |
|---|---|---|
| ① リファクタ | 1 タブバー保持 | `read-only.spec.ts` |
| | 2 楽観的更新 | `optimistic.spec.ts` |
| | 3 オフラインの巻き戻し | `optimistic.spec.ts` |
| | 4 ダイアログ6種 | `dialogs.spec.ts` |
| ② 採算シミュレーション | 1 ホームのカード | `read-only.spec.ts` |
| | 2 かかるお金の追加・編集／スワイプ削除 | `expenses.spec.ts` / `swipe.spec.ts` |
| | 3 固定費未登録の案内 | `read-only.spec.ts` |
| | 4 トントンと内訳の一致 | `simulation.spec.ts` |
| | 5 購入率・赤警告・境界100% | `simulation.spec.ts` |
| ③ 採算パターン | 1〜3 追加・保存前の再計算・カードの3値 | `simulation.spec.ts` |
| | 4 タップ編集・スワイプ削除 | `swipe.spec.ts` |
| | 5 これにする | `simulation.spec.ts` |
| | 6 上限5件 | `simulation.spec.ts` |
| ④ AI診断・手残り | 1・2 相談と検算結果の優先 | `ai.spec.ts` |
| | 3 パターンへ保存 | `ai.spec.ts` |
| | 4 手残りの一致 | `expenses.spec.ts` |
| | 5 未登録時の案内 | `read-only.spec.ts` |
| ⑤ パターン比較表 | 1 1件なら閉じている | `read-only.spec.ts` |
| | 2 マーカーの二重表示なし | `optimistic.spec.ts` |
| | 3〜5 左列固定・横スクロール・王冠 | **未着手**（実機目視で確認済み・E2E化は任意） |

---

## 完了済み

- **E2E 化 Step 1〜4**（2026-08-13）:
  - Step 1: サインイン済み state・E2E専用DB（`file:./e2e.db`）・専用ポート3456。PR #34
  - Step 2: 読み取りだけの5項目とシードヘルパー。PR #35
  - Step 3: 書き込みを伴う10項目と `busy_timeout`。PR #36
  - Step 4: スワイプ・楽観的更新・オフライン・WebKitマーカー・AIスタブ。
  - 🔴 **本番DBを守る形**: `.env.local` の `TURSO_DATABASE_URL` は本番を指すので、
    dev サーバーにだけ `file:` DB を渡し、既存サーバーは再利用しない。詳細は README。

- **実機確認⑥⑦（ひとつ前に戻す／レビュー修正分）＝Shoya が実機で確認・正常動作**（2026-07-29）:
  - ⑥「これにする → ひとつ前に戻す」の1往復が実データで通った。
  - ⑦ パターン保存後に「追加」を開き直したときの初期値が今のレシピの値に戻ることを確認。

- **採算シミュレーション ステップ1〜7**（2026-07-29）。設計のステップはすべて完了。
  スキーマ（`project_expenses` / `projects.expected_visitors` / `simulation_scenarios` /
  `simulation_items`）、`src/lib/breakeven.ts`（+19テスト）、`evaluateScenario()`（+8テスト）、
  かかるお金CRUD、採算シミュレーション画面、パターン、AI診断、実績の手残り。

- **リファクタリング Phase 0〜3**（2026-07-29）:
  - Phase 0: Vitest 導入（44件）。Phase 1: 認可・再検証・スワイプ・ダイアログ・ページ骨格の共通化。
  - Phase 2: `loading.tsx` でタブバー保持、ホームの Suspense 分割。
  - Phase 3: `error.tsx`、失敗通知トースト、楽観的更新。

- **持ち物・準備チェックリスト**（2026-07-05）
- **当日の売上・実績記録**（2026-07-05）

---

## 計測メモ（2026-07-29 時点）

クライアントJS合計 約1.18MB（未圧縮・32チャンク）。内訳の大きい順に
React DOM 約198KB、**Clerk 約155KB**、その他100KB級が3つ。
Clerk はルートレイアウトの `ClerkProvider` が読み込むため、
`AppHeader` の `UserButton` を別画面へ移しても削減にはならない（導線を削る意味がないので見送り）。
