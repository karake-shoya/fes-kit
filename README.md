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
| UI | shadcn/ui + Radix UI + Tailwind CSS v4 | アイコンは Hugeicons / lucide-react |
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
| 材料マスタ管理 | ✅ | 仕入れ単価・単位・購入数量・仕入れ先を登録（プロジェクト単位） |
| レシピ管理・利益率計算 | ✅ | 材料の使用量から原価・利益・利益率をライブ計算（後述） |
| スケジュール管理 | ✅ | カレンダー／一覧表示、月フィルタ、スワイプ削除、ステータス管理 |
| 試作品記録 | ✅ | 試作日・結果（good / needs_improvement / failed）・メモ・写真（R2） |
| 共有機能（招待リンク） | ⬜ | スキーマ（`project_invitations`）は準備済み。実装は今後 |

### 画面構成（ルーティング）

```
/                                       ランディング
/sign-in, /sign-up                      Clerk 認証画面
/dashboard                              参加プロジェクト一覧
/projects/[id]                          プロジェクトホーム
/projects/[id]/ingredients              材料マスタ
/projects/[id]/recipes                  レシピ一覧
/projects/[id]/recipes/[recipeId]       レシピ詳細（利益率調整）
/projects/[id]/schedule                 スケジュール
/projects/[id]/prototypes               試作記録
/projects/[id]/settings                 プロジェクト設定
/api/webhooks/clerk                     Clerk Webhook 受信
```

PWA対応（`src/app/manifest.ts`）。ホーム画面に追加するとスタンドアロン・縦向きで起動します。

---

## レシピと利益率（スマホUI）

レシピ詳細ページでは、ダイアログを開かずにその場で利益率を調整できます。

- **販売価格・材料の使用量はスライダー＋−／＋ボタン、または数値入力欄で操作**します。
  ドラッグ中は利益・利益率がクライアント側で即時に再計算され（緑＝黒字／赤＝赤字）、
  指を離した時点（ドラッグ確定）／入力確定でサーバーへ自動保存します（500msデバウンス）。
  スライダーの上限は固定（量＝単位ごと、材料費＝購入単価ベース）で、それを超える値は
  数値入力欄で直接指定できます。
- 各材料カードには**「量で調整」「材料費で調整」のモード切替**があります。
  「材料費で調整」では金額を動かすと、必要な使用量が逆算されて保存されます。
- 材料の追加は候補リストから選ぶだけで初期使用量で登録され、その場で
  スライダー調整できます。「×」で材料を外せます（誤タップ防止の確認あり）。

実装の中心: `src/components/app/recipe-profit-panel.tsx`（ライブ集計）、
`src/components/app/recipe-ingredient-editor.tsx`（インライン編集）、
原価計算ロジックは `src/lib/recipe-cost.ts`（クライアント・サーバー共用）。

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