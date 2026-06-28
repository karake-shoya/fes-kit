import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turso Embedded Replica はネイティブモジュール（libsql）を使うため、
  // Turbopack/サーバーバンドルに含めず外部依存として扱う。
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
