# FesKit（模擬店出店管理アプリ）

1回のイベントで出す模擬店を1プロジェクトとして管理するスマホ専用Webアプリです。
材料の原価から販売価格・利益率の試算、スケジュール管理、試作記録までを1つにまとめます。

- **UI方針**: スマホのみ対応・落ち着いた配色・見てわかりやすさ重視（PC表示は考慮しない）

---

## 技術スタック

| レイヤー | 技術 | 備考 |
|---|---|---|
| フレームワーク | Next.js (App Router) | v16系 / Turbopack |
| 言語 | TypeScript | strict mode |
| UI | shadcn/ui + Radix UI + Tailwind CSS v4 | アイコンは lucide-react、フォントは Figtree（欧文）+ Zen Maru Gothic（和文） |
| 認証 | Clerk (`@clerk/nextjs` v7) | Webhookでユーザーを同期 |
| DB | Turso (libSQL / SQLite互換) | Embedded Replica対応 |
| ORM | Drizzle ORM | |
| ストレージ | Cloudflare R2 (S3互換) | 試作写真のアップロード |
| デプロイ | Vercel | |
| ランタイム | Node.js v22 LTS（v20以上必須） | |

### Next.js 16の注意点

- ミドルウェアは `middleware.ts` ではなく `src/proxy.ts` に配置
- `cookies()` / `headers()` などのリクエストAPIは async 対応必須
- async params: `params: Promise<{ id: string }>` → `const { id } = await params`

---

## 主な機能

| 機能 | 状態 | 概要 |
|---|---|---|
| 認証 | ✅ | Clerk によるサインイン／サインアップ、Webhook（svix検証）で `users` を同期 |
| プロジェクトCRUD・権限管理 | ✅ | 1イベント=1プロジェクト。`owner` / `editor` / `viewer` のロール |
| プロジェクトホーム | ✅ | イベント日カウントダウン・準備進捗バー・赤字商品の警告・直近タスク表示・メンバー表示（タップで設定へ）。各画面への主導線はタブバーに集約し、ホームにはタブバー外機能（買い出しリスト・実績記録）の入口カードのみ配置 |
| 材料マスタ管理 | ✅ | 仕入れ単価・単位・購入数量・仕入れ先を登録（プロジェクト単位） |
| レシピ管理・原価率計算 | ✅ | 材料の使用量から原価率・利益・利益率をライブ計算。原価率を主役に表示（後述） |
| AIおすすめ販売価格 | ✅ | Claude（Anthropic API）が原価・材料構成から適正価格と理由を提案（後述） |
| 買い出しリスト | ✅ | レシピの「作る予定数」×材料の使用量から、材料ごとに必要な購入ロット数・費用を自動算出（後述） |
| 持ち物・準備チェックリスト | ✅ | 当日現地に持っていく道具・材料・書類をカテゴリ別にチェック管理。買い出しリストからの一括インポートに対応（後述） |
| 売上・実績記録 | ✅ | イベント当日の「作った数」「売れた数」をレシピごとに記録し、見込み利益と実績利益・廃棄数を比較（後述） |
| スケジュール管理 | ✅ | カレンダー／一覧表示、日付タップで当日の予定をボトムシート表示、月フィルタ、スワイプ削除、ステータス管理 |
| 試作品記録 | ✅ | 試作日・結果（good / needs_improvement / failed）・メモ・写真（R2） |
| 共有機能（招待リンク） | ✅ | オーナーがロール付きURLを発行（72時間有効・1回使い切り）。コピー／OS共有シート対応 |
| 更新履歴 | ✅ | ダッシュボードに機能追加のお知らせを一覧表示（`src/lib/changelog.ts` に手動で追記） |

### 画面構成（ルーティング）

```
/                                       ランディング
/sign-in, /sign-up                      Clerk 認証画面
/dashboard                              参加プロジェクト一覧（自分のプロジェクト／共有プロジェクトに分けて表示。共有プロジェクトには作成者名を表示）＋更新履歴
/projects/[id]                          プロジェクトホーム
/projects/[id]/ingredients              材料マスタ
/projects/[id]/recipes                  レシピ一覧
/projects/[id]/recipes/[recipeId]       レシピ詳細（利益率調整）
/projects/[id]/shopping-list            買い出しリスト
/projects/[id]/checklist                持ち物・準備チェックリスト
/projects/[id]/results                  売上・実績記録（見込みと実績の比較）
/projects/[id]/schedule                 スケジュール
/projects/[id]/prototypes               試作記録
/projects/[id]/settings                 プロジェクト設定（招待リンクの発行を含む）
/invite/[token]                         招待リンクの受諾（要ログイン）
/api/webhooks/clerk                     Clerk Webhook 受信
```

プロジェクト配下の画面には**下部タブバー**（ホーム／材料／レシピ／予定／試作）を常設し、
スマホの親指で届く位置から1タップで画面を切り替えられます（PWAのsafe-area対応）。
タブバーに乗らないサブ機能（買い出しリスト・持ち物チェックリスト・売上・実績記録）へは、ホームのカードから遷移します。

PWA対応（`src/app/manifest.ts`）。ホーム画面に追加するとスタンドアロン・縦向きで起動します。

### スクロールと引っ張って更新（Pull to Refresh）

- 画面の高さ基準を `100dvh` に統一し、`overscroll-behavior-y: none` でネイティブのゴムバウンド（無駄なスクロール）を抑制しています。高さ・背景は `src/app/(app)/layout.tsx` の共通ラッパーが一括で担保します。
- PWAスタンドアロンではブラウザ標準の下引き更新が効かないため、`src/components/app/pull-to-refresh.tsx` で**画面最上部から下方向に引っ張ると更新**するカスタム挙動を全画面共通で実装しています。閾値を超えて指を離すと `router.refresh()` でServer Componentのデータを再取得します。

---

## レシピと原価率（スマホUI）

レシピ詳細ページでは、ダイアログを開かずにその場で**原価率**を調整できます。
飲食の共通言語である原価率を画面の主役にし、利益・利益率は補足として併記します。

- **原価率を主役に大きく表示**し、目安を色とラベルで判断できます
  （〜35%「理想的」＝緑／〜60%「ふつう」＝アンバー／〜100%「原価が高め」＝オレンジ／100%超「赤字」＝赤）。
- **販売価格・材料の使用量はスライダー＋−／＋ボタン、または数値入力欄で操作**します。
  ドラッグ中は原価率・利益がクライアント側で即時に再計算され、
  指を離した時点（ドラッグ確定）／入力確定でサーバーへ自動保存します（500msデバウンス）。
  スライダーの上限は固定で、それを超える値は数値入力欄で直接指定できます。
- 価格スライダーには**目標原価率30%のおすすめ位置**をマーカー表示し、
  「おすすめ：原価率30%なら ¥○○○」をタップすると一発でその価格に設定できます（AI不要・即時）。
- **原価内訳バー**で、どの材料が原価を押し上げているか（原価の中心）を一目で確認できます。
- 各材料カードには**「量で調整」「材料費で調整」のモード切替**があります。
  「材料費で調整」では金額を動かすと、必要な使用量が逆算されて保存されます。
- **「作る予定数」も販売価格と同じくその場でインライン編集**でき、設定ダイアログを開く必要はありません。
  この数値は買い出しリストの必要量計算にそのまま使われます。
- 材料の追加は候補リストから選ぶだけで初期使用量で登録され、その場で
  スライダー調整できます。「×」で材料を外せます（誤タップ防止の確認あり）。

実装の中心: `src/components/app/recipe-profit-panel.tsx`（ライブ集計）、
`src/components/app/recipe-ingredient-editor.tsx`（インライン編集）、
原価計算ロジックは `src/lib/recipe-cost.ts`（クライアント・サーバー共用）。

### AIおすすめ販売価格（Claude）

「AIに価格を相談する」ボタンから、商品名・原価・材料構成をもとに Claude が
**おすすめ販売価格・妥当な価格帯・想定原価率・やさしい一言理由**を提案します。
「この価格にする」で販売価格へ即反映できます。

- モデルは `claude-haiku-4-5`（Claude API 直・安価/高速。`@ai-sdk/anthropic` 経由）。
- サーバーアクション: `src/actions/ai-price.ts`（`generateObject` ＋ Zod で構造化出力）。
- `ANTHROPIC_API_KEY` 未設定時はボタンを表示せず、原価率30%の逆算表示のみで動作します
  （AIなしでもアプリは完結）。

### 買い出しリスト

レシピ登録時に入力する**「作る予定数」**（`recipes.servings`）を使って、
イベント当日までに買うべき材料を自動でまとめます。

- 材料ごとに「使用量 × 作る予定数」を全レシピ分積算し、必要合計量を算出。
- 必要合計量を材料の購入ロット量（材料マスタの数量）で割って切り上げ、
  **買うべきロット数**と**追加費用**を表示します。
- 在庫管理は行わないため、常に「ゼロから買い出す前提」の合計です。
  実装: `src/db/queries/shopping-list.ts`、画面: `src/app/(app)/projects/[id]/shopping-list/page.tsx`。

### 持ち物・準備チェックリスト

当日現地に持っていく道具・材料・書類を、プロジェクト単位でチェック管理します。

- カテゴリは**道具／材料／書類**の3種（固定）。カテゴリ別にグループ表示し、
  各グループ内は未チェック→チェック済みの順に並びます。
- 「買い出しリストから追加」ボタンで、買い出しリストの材料をワンタップで持ち物へ
  一括インポートできます（必要量・購入ロット数・費用をメモに自動転記）。
  既にインポート済みの材料は重複登録されません。
- チェックのON/OFF・編集・スワイプ削除はスケジュール機能と同じ操作感で統一しています。
- ホームの「準備の進みぐあい」バーには、スケジュールタスクの完了数と
  持ち物チェックの完了数を合算した1つの指標として表示されます。
  実装: `src/db/queries/checklist.ts`、`src/actions/checklist.ts`、
  画面: `src/app/(app)/projects/[id]/checklist/page.tsx`。

### 売上・実績記録

イベント当日に「作った数」「売れた数」をレシピごとに記録し、
レシピ登録時の**見込み利益**（1個あたり利益 × 作る予定数）と**実績利益**（1個あたり利益 × 売れた数）を並べて比較できます。

- 記録は**1レシピにつき当日1件**の上書き方式（時間帯別の複数記録はしない）。
- 「作った数」「売れた数」は−／＋ボタンと数値入力でその場で編集でき、
  実績利益・**廃棄数**（作った数 − 売れた数）が即時に再計算されます（500msデバウンスで自動保存）。
- 売れた数が作った数を超えた場合はやさしく注意表示します（入力はブロックしない）。
- ホームのヒーローには、イベント当日「売上・実績を記録する」、終了後「売上・実績をふりかえる」の導線が出ます。
  実装: `src/db/queries/sales-records.ts`、`src/actions/sales-record.ts`、
  画面: `src/app/(app)/projects/[id]/results/page.tsx`＋`src/components/app/sales-record-card.tsx`。

---

## ディレクトリ構成

```
src/
├── actions/        Server Actions（project, ingredient, recipe, schedule, prototype, upload）
├── app/
│   ├── (app)/      認証必須のアプリ画面（dashboard, projects/...）
│   ├── (auth)/     サインイン・サインアップ
│   ├── api/webhooks/clerk/   Clerk Webhook ルート
│   ├── manifest.ts / icon.tsx / apple-icon.tsx   PWA・アイコン
├── components/
│   ├── app/        画面固有コンポーネント（ダイアログ・カレンダー・編集UI 等）
│   └── ui/         shadcn/ui プリミティブ
├── db/
│   ├── schema.ts   Drizzle スキーマ定義
│   ├── db.ts       libSQL クライアント（Embedded Replica対応・シングルトン）
│   └── queries/    テーブル別クエリ関数
├── lib/            ユーティリティ（auth, r2, recipe-cost, schedule, format 等）
└── proxy.ts        Clerk ミドルウェア（公開ルート以外を保護）

drizzle/            生成されたマイグレーション
```

---

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

> グローバルで `ignore-scripts=true` を設定済みのため、postinstall が必要なパッケージは個別対応。

### 2. 環境変数（`.env.local`）

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...        # Clerk Webhook の署名シークレット（svix）

# Turso (libSQL)
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
# 任意: Embedded Replica（読み取り高速化）
# Vercel では書き込み可能な /tmp 配下を指定
TURSO_REPLICA_PATH=file:/tmp/feskit-replica.db
TURSO_SYNC_INTERVAL=60                # バックグラウンド同期間隔（秒・既定60）

# Cloudflare R2（試作写真）
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
NEXT_PUBLIC_R2_PUBLIC_URL=https://...  # バケットの公開URLベース

# AI（おすすめ販売価格・任意）
# Claude API（Anthropic）の API キー。https://console.anthropic.com/ で発行。
# 未設定でもアプリは動作し、AIボタンのみ非表示になる。
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. データベースのマイグレーション

```bash
npm run db:generate   # スキーマからマイグレーション生成
npm run db:migrate    # Turso に適用
npm run db:studio     # Drizzle Studio で確認（任意）
```

### 4. 開発サーバー起動

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開きます（スマホ表示で確認推奨）。

### 5. Clerk Webhook

`users` テーブルは Clerk の Webhook（`user.created` / `user.updated` / `user.deleted`）で同期します。
Clerk ダッシュボードで `/api/webhooks/clerk` をエンドポイントに登録し、署名シークレットを
`CLERK_WEBHOOK_SECRET` に設定してください。ローカルでは Clerk のローカル転送機能などを利用します。

---

## スクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | 本番ビルド |
| `npm run start` | 本番サーバー起動 |
| `npm run lint` | ESLint |
| `npm run db:generate` | マイグレーション生成 |
| `npm run db:migrate` | マイグレーション適用 |
| `npm run db:studio` | Drizzle Studio 起動 |

---