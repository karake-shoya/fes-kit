import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// 純粋ロジック（DB・React非依存）だけを対象にしたテスト設定。
// jsdom などの環境は増やさず、node 上で計算ロジックの正しさだけを守る。
export default defineConfig({
  resolve: {
    alias: {
      // tsconfig の paths と同じ "@/..." を解決する
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
