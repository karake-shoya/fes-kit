import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// dark クラスを付与する仕組み（next-themes 等）が無い間、globals.css に
// .dark トークンだけが残っていると「ダークは動く」という誤解を生む（#33）。
describe("globals.css のダークモードトークン", () => {
  const css = readFileSync(resolve(import.meta.dirname, "globals.css"), "utf-8");

  it("next-themes 等のテーマ切替が未導入の間は .dark ブロックを持たない", () => {
    expect(css).not.toMatch(/\.dark\s*\{/);
  });
});
