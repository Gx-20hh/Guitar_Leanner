import { describe, expect, it } from "vitest";
import { getConnectorDiagnostic } from "./diagnostic";

describe("getConnectorDiagnostic", () => {
  it("如实报告当前为未连接状态", () => {
    const diag = getConnectorDiagnostic();
    expect(diag.state).toBe("disconnected");
    expect(diag.transportReady).toBe(false);
  });

  it("状态说明不声称任何连接或设备检测", () => {
    const diag = getConnectorDiagnostic();
    expect(diag.message).toContain("未连接");
    expect(diag.message).not.toContain("GE200");
  });
});
