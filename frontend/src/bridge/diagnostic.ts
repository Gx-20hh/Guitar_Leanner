/**
 * 本地连接诊断状态（M0 骨架）。
 *
 * 重要边界：
 * - 这里的状态仅反映\"原生桥接函数是否已注入\"（getNativeFunction / guitarBridge），
 *   不代表已连接到 MOOER GE200 或任何音频设备（参考设备尚未实机验收）。
 * - 检测基于契约：仅当 window.__JUCE__ 注入的原生函数列表包含 guitarBridge 时才算可用，
 *   不会把 mock 当成功。原生缺失时如实返回 disconnected。
 */

import { isNativeBridgeAvailable } from "./client";

export type ConnectionState = "disconnected" | "connecting" | "connected";

export interface ConnectorDiagnostic {
  state: ConnectionState;
  /** 原生桥接函数是否已注入并向页面提供 request/reply 通道。 */
  transportReady: boolean;
  /** 用户可读的状态说明，采用界面语气，不承诺未发生的事。 */
  message: string;
  /** 本会话页面启动的时间戳，仅供诊断展示。 */
  bootedAt: number;
}

/**
 * 当前如实状态：仅当原生 guitarBridge 可用时才是已连接（connected）。
 * 原生缺失时明确未连接（disconnected），不自动用 mock 顶替。
 */
export function getConnectorDiagnostic(): ConnectorDiagnostic {
  const transportReady = isNativeBridgeAvailable();
  const base = {
    transportReady,
    bootedAt: Date.now(),
  } as const;

  if (!transportReady) {
    return {
      ...base,
      state: "disconnected",
      message: "原生桥接函数尚未注入，此页面处于开发诊断阶段，未连接任何设备。",
    };
  }

  return {
    ...base,
    state: "connected",
    message: "原生桥接函数已注入（guitarBridge）；仍不代表已连接音频设备，需以真实 ping 验证。",
  };
}
