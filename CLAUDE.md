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
| Node.js | v24 LTS | `.nvmrc` と `engines` で固定。CI・Vercel も 24。**22 以下では `npm ci` が落ちる**（lock が npm 11 生成のため） |

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

🔴 **このリポの作業は poporu ではなく「このリポ」で `claude` を起動する**（並列セッションが poporu の作業ツリーを共有すると `git add` が他セッションの編集を巻き込むため）。設計は `~/poporu/plans/秘書AIアーキテクチャの再設計.md`。

- **poporu 側に専用メモリは無い。** 正は**このリポ**にあり、2箇所に分かれる。**次セッションでやること＝`.claude/docs/TODO.md`**、**設計・調査の記録＝リポ直下の `docs/`**。Monthly Ship としての位置づけ・採算の方針は `~/poporu/memory/private/monthly-ship.md`。
- **journal の領域名**: `feskit`
- 🔴 **作業を終えたら poporu の当日 journal へ1ファイル書く。書式と規則の正はグローバル `~/.claude/CLAUDE.md` の「薄いポポル」節。** ここには写さない（写すと腐る）。⚠ **スマホ（クラウド）では `~/.claude/` が読まれないので、`poporu` も一緒に選ぶ**（そのときの正は `poporu/CLAUDE.md` の横断メカニズム8）。
