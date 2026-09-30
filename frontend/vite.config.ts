import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// 开发/构建共用的最小配置。桥接通过独立模块接入，不在此处定义协议。
export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      "@bridge": fileURLToPath(new URL("./src/bridge", import.meta.url)),
      "@juce-framework/webview": fileURLToPath(
        new URL("./vendor/juce-webview-interop/dist/index.js", import.meta.url),
      ),
    },
  },
  test: {
    // Vitest 配置（与 @vitejs/plugin-react 共用该文件）
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
