const MARKDOWN_LINK = /\[[^\]]*\]\(([^)]+)\)/g;

/**
 * Markdown本文からリンク先パスを抽出する。
 * 外部URL（http/https）は対象外、`#見出し` のアンカーは切り捨てる。
 */
export function extractRelativeLinks(markdown: string): string[] {
  const links: string[] = [];
  for (const match of markdown.matchAll(MARKDOWN_LINK)) {
    const target = match[1].split("#")[0].trim();
    if (target === "" || /^https?:\/\//.test(target)) continue;
    links.push(target);
  }
  return links;
}
