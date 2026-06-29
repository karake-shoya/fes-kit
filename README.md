This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 機能メモ：レシピと利益率（スマホUI）

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

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
