# FesKit（模擬店出店管理アプリ）

## プロジェクト概要

1回のイベントで出す模擬店を1プロジェクトとして管理するWebアプリケーション。
スマホ専用UI。ペルソナは料理好きの30代女性（技術に詳しくない）。

## ターゲット（ペルソナ）

- 30代女性、料理が趣味。将来は小料理屋を開きたい
- 少し気持ちの悪いキャラクターを好む
- 落ち着いた色合いを好む（ピンクなどの明るい色は避ける）
- UIは見てわかりやすいものを好む
- 原価計算などの数字は苦手
- **スマホのみで使用（PC表示は考慮しない）**

---

## 技術スタック

| レイヤー | 技術 | バージョン・備考 |
|---|---|---|
| フロント | Next.js (App Router) | v16系（最新stable） |
| 言語 | TypeScript | strict mode |
| UI | shadcn/ui + Tailwind CSS | react-big-calendarは使わない |
| 認証 | Clerk | @clerk/nextjs v7 |
| DB | Turso (libSQL) | SQLite互換 |
| ORM | Drizzle ORM | |
| Storage | Cloudflare R2 | 試作写真のみ（MVP後でも可） |
| デプロイ | Vercel | |
| Node.js | v22 LTS | v20以上必須 |

### Next.js 16の注意点

- `middleware.ts` → `proxy.ts` にリネーム（`src/proxy.ts` に配置）
- Turbopackがデフォルトバンドラー
- `cookies()` `headers()` などのrequest APIはasync対応必須
- async params: `params: Promise<{ id: string }>` → `const { id } = await params`

---

## 実装の優先順位（MVP）

1. ✅ 認証（Clerk + proxy.ts + Webhook同期）
2. ✅ プロジェクトCRUD + 権限管理
3. ✅ 材料マスタ管理
4. ✅ レシピ管理 + 利益率計算
5. ✅ スケジュール管理（カレンダーUI）
6. ⬜ 試作品記録
7. ⬜ 共有機能（招待リンク）
8. ✅ Cloudflare R2（試作写真）

---

## 設計ドキュメント

| ファイル | 内容 |
|---|---|
| [env.md](.claude/docs/env.md) | 環境変数（.env.local テンプレート） |
| [invite.md](.claude/docs/invite.md) | 共有機能（招待リンク方式・フロー・実装例） |
| [setup.md](.claude/docs/setup.md) | セットアップ手順・よく使うコマンド |
