import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// 极简测试工具：复用 @testing-library/react 的 render/cleanup。
// 保持依赖最小，仅用于组件冒烟测试。
export * from "@testing-library/react";

afterEach(() => {
  cleanup();
});
