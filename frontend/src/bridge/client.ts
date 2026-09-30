/**
 * 桥接客户端：单向 ping 调用（前端 → 原生）。
 *
 * 边界（对齐契约裁定 docs/validation/t7-contract-review.md）：
 * - 原生缺失时明确报告 nativeUnavailable，绝不自动用 mock 顶替成功。
 * - 采用有限超时并在超时后释放待处理状态；迟到回复不计入已结束请求。
 * - 仅在响应到达后按契约校验回复的分支/版本/ID/互斥。
 *
 * 真实传输注入点：NativeTransport。默认真实实现 realNativeTransport，经 WebView2
 * 集成（@juce-framework/webview 9.0.3 匹配版，已 vendored）调用 window.__JUCE__
 * 提供的 guitarBridge。单元测试注入替身 transport，仅测试用，实际 GUI 不 mock。
 */

import { getNativeFunction } from "@juce-framework/webview";
import {
  NATIVE_FN_NAME,
  PROTOCOL_VERSION,
  type PingRequest,
} from "./types";
import { isValidPingMessage, validateReply } from "./validators";

const DEFAULT_TIMEOUT_MS = 3000;
const DEFAULT_MESSAGE = "hello from ui";

/** 原生传输抽象（默认真实实现；测试注入替身以隔离真实宿主）。 */
export interface NativeTransport {
  isNativeAvailable(): boolean;
  invoke(request: PingRequest): Promise<unknown>;
}

interface JuceGlobalsLike {
  __JUCE__?: {
    initialisationData?: { __juce__functions?: string[] };
  };
}

/**
 * 通过本请求唯一原生函数名（guitarBridge）是否被真实集成注册来判断原生是否可用。
 * 该列表仅在真实 WebView2 集成下注入；mock 情形列表为空，因此不会把 mock 当成功。
 */
function detectNativeAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const juce = (window as unknown as JuceGlobalsLike).__JUCE__;
  const funcs = juce?.initialisationData?.__juce__functions;
  return Array.isArray(funcs) && funcs.includes(NATIVE_FN_NAME);
}

/** 前端可观测的"原生桥接是否可用"（仅表示 guitarBridge 是否已注入，不含任何设备）。 */
export function isNativeBridgeAvailable(): boolean {
  return detectNativeAvailable();
}

export const realNativeTransport: NativeTransport = {
  isNativeAvailable: detectNativeAvailable,
  invoke: async (request) => {
    const fn = getNativeFunction(NATIVE_FN_NAME);
    return await fn(request);
  },
};

let sequence = 0;
/** 生成 ASCII、长度 1–64、非空、唯一 requestId。 */
export function generateRequestId(): string {
  sequence += 1;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `gl-${ts}-${sequence}-${rand}`;
}

function buildPingRequest(message?: string): PingRequest {
  const candidate = message ?? DEFAULT_MESSAGE;
  const msg = isValidPingMessage(candidate) ? candidate : DEFAULT_MESSAGE;
  return {
    protocolVersion: PROTOCOL_VERSION,
    requestId: generateRequestId(),
    type: "ping",
    payload: { message: msg },
  };
}

const TIMEOUT_SENTINEL = Symbol("timeout");

/**
 * 带有限超时会话：任一分支（超时 / 成功 / 失败）settle 时才清理定时器，
 * 避免同步 clearTimeout 取消定时器导致超时永不触发。
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMEOUT_SENTINEL> {
  return new Promise<T | typeof TIMEOUT_SENTINEL>((resolve, reject) => {
    let settled = false;
    const clear = () => {
      clearTimeout(timer);
    };
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(TIMEOUT_SENTINEL);
      }
    }, ms);
    promise.then(
      (v) => {
        if (!settled) {
          settled = true;
          clear();
          resolve(v);
        }
      },
      (e) => {
        if (!settled) {
          settled = true;
          clear();
          reject(e);
        }
      },
    );
  });
}

export type PingClientResult =
  | { status: "ok"; requestId: string; message: string; rttMs: number }
  | { status: "error"; requestId: string | null; code: string; message: string; rttMs: number }
  | { status: "invalidReply"; requestId: string; reason: string; detail?: string; rttMs: number }
  | { status: "timeout"; requestId: string; timeoutMs: number }
  | { status: "nativeUnavailable" };

export interface PingOptions {
  message?: string;
  timeoutMs?: number;
  transport?: NativeTransport;
}

/** 执行一次带校验、有限超时的 ping。 */
export async function runPing(options: PingOptions = {}): Promise<PingClientResult> {
  const transport = options.transport ?? realNativeTransport;
  if (!transport.isNativeAvailable()) {
    return { status: "nativeUnavailable" };
  }

  const request = buildPingRequest(options.message);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const started = performance.now();

  const raw = await withTimeout(transport.invoke(request), timeoutMs);

  if (raw === TIMEOUT_SENTINEL) {
    return { status: "timeout", requestId: request.requestId, timeoutMs };
  }

  const rttMs = performance.now() - started;
  const validated = validateReply(raw, request.requestId);

  switch (validated.kind) {
    case "ok":
      return { status: "ok", requestId: validated.reply.requestId, message: validated.reply.payload.message, rttMs };
    case "error":
      return {
        status: "error",
        requestId: validated.reply.requestId,
        code: validated.reply.error.code,
        message: validated.reply.error.message,
        rttMs,
      };
    case "invalid":
      return { status: "invalidReply", requestId: request.requestId, reason: validated.reason, detail: validated.detail, rttMs };
  }
}
