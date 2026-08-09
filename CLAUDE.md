# FesKit（出店の採算管理アプリ）

## プロジェクト概要

1回の出店を1プロジェクトとして管理するWebアプリケーション。
イベント・マルシェ・お祭り・文化祭など、食べ物を売る出店ならどれでも扱う。
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

## Claude Codeのpreviewツールに関する制約

- Clerk認証が必要なページ（サインイン後の画面）は `preview_*` ツールで確認しない。Clerkのホスト型サインインが `*.clerk.accounts.dev` にリダイレクトし、previewツールはlocalhost以外へのリダイレクトをブロックするため確認できない。
- previewツールの利用は公開ページ（`/`, `/sign-in`, `/sign-up` など認証不要なルート）のみに限定する。
- 認証後の画面の動作確認は、ユーザー自身が通常のブラウザで `http://localhost:3000` を開いて行う（Claude側では実施しない・依頼もしない）。
- 開発環境で認証をバイパスする対応は行わない（`src/proxy.ts` や各所の `auth()`/`currentUser()` 呼び出しに影響する設計変更のため、必要な場合は事前にPlanモードで承認を得る）。

---

## poporu（秘書ポポルの記憶）へのポインタ

🔴 **2026-08-09 から、このリポの作業は poporu ではなく「このリポ」で `claude` を起動する。** 並列セッションが poporu の作業ツリーを共有すると `git add` が他セッションの途中編集を巻き込み、書いたものが黙って消えるため（2026-08-08 に2回発生）。設計は `~/poporu/plans/秘書AIアーキテクチャの再設計.md`。

- **poporu 側にこのリポ専用のメモリは無い。** 進捗・設計・調査の正は**このリポの `.claude/docs/`**。
- Monthly Ship（月1で稼ぐ仕組みごと出す取り組み）としての位置づけ・採算の方針は `~/poporu/memory/private/monthly-ship.md`。
- 領域名は `feskit` を使う。
- 🔴 **作業を終えたら `~/poporu/journal/YYYY-MM-DD/HHMM-<領域>-<slug>.md` を1ファイル書く。** 1エントリ1ファイル（同時追記で記録が消えるのを防ぐ形）・**事実だけ書き解釈は書かない**・`git add -A` と `git add .` は使わない・**NEXT.md は触らない**（夜の締めルーチンが journal から拾う）。正はグローバル `~/.claude/CLAUDE.md` の「薄いポポル」節。
- **poporu の記憶を全読みはしない。** 上のポインタ先だけ読む（読み込み量を増やさないため）。
- 一次資料・調査ログ・成果物の実体は**このリポの `.claude/docs/`** に置く。poporu へ実体を持ち込まない（境界ルール）。
- スマホから触るときは claude.ai / Claude アプリで **`poporu` とこのリポの2つを選ぶ**（クラウドは `~/.claude/` を読まないため、poporu を載せないと記憶も義務も効かない）。
