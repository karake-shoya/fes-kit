import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractRelativeLinks } from "@/lib/readme-links";

describe("extractRelativeLinks", () => {
  it("Markdownリンクからリンク先パスを抽出する", () => {
    const markdown = "参照: [TODO](.claude/docs/TODO.md) と [調査](docs/note.md)";
    expect(extractRelativeLinks(markdown)).toEqual([".claude/docs/TODO.md", "docs/note.md"]);
  });

  it("http:// https:// で始まるリンクは対象外にする", () => {
    const markdown = "[外部サイト](https://example.com) [http](http://example.com)";
    expect(extractRelativeLinks(markdown)).toEqual([]);
  });

  it("アンカー（#以降）は無視してファイルパスだけを見る", () => {
    const markdown = "[節へ](docs/note.md#見出し)";
    expect(extractRelativeLinks(markdown)).toEqual(["docs/note.md"]);
  });

  it("リンクが無ければ空配列を返す", () => {
    expect(extractRelativeLinks("リンクのない本文です。")).toEqual([]);
  });
});

describe("README.md の相対リンク", () => {
  const repoRoot = resolve(import.meta.dirname, "../..");
  const readme = readFileSync(resolve(repoRoot, "README.md"), "utf-8");
  const links = extractRelativeLinks(readme);

  it("README.md からリンクを1本以上抽出できる", () => {
    expect(links.length).toBeGreaterThan(0);
  });

  it.each(links)("%s がリポジトリ内に実在する", (link) => {
    expect(existsSync(resolve(repoRoot, link))).toBe(true);
  });
});
