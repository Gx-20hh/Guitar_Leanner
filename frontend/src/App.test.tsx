import { render, screen } from "./test-utils";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("渲染诊断标题与未连接状态", () => {
    render(<App />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toContain("连接诊断");
    expect(screen.getByText("未连接")).toBeTruthy();
  });
});
