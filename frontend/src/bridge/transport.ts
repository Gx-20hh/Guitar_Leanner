/**
 * 传输/播放客户端：查询播放位置与发送播放命令（前端 → 原生）。
 * 沿用 client.ts 的 NativeTransport 注入模式：默认真实实现经 guitarBridge；测试注入替身。
 * 原生缺失时明确返回 unavailable，不自动 mock。有限超时、迟到回复不计入已结束请求。
 */

import { realNativeTransport, isNativeBridgeAvailable, generateRequestId } from "./client";
import { PROTOCOL_VERSION, type PingRequest } from "./types";

/** 前端可观测的"原生桥接是否可用"。 */
export function isTransportAvailable(): boolean {
  return isNativeBridgeAvailable();
}

/** 传输注入接口（宽松 invoke，便于承载 query/playback 两种请求）。 */
export interface TransportNative {
  isNativeAvailable(): boolean;
  invoke(request: unknown): Promise<unknown>;
}

/** 默认真实实现：经 guitarBridge（复用 client 的 realNativeTransport）。 */
export const realNative: TransportNative = {
  isNativeAvailable: isTransportAvailable,
  invoke: async (request: unknown) =>
    await realNativeTransport.invoke(request as PingRequest),
};

export type TransportCommand = "play" | "pause" | "stop";

export interface TransportRequest {
  protocolVersion: typeof PROTOCOL_VERSION;
  requestId: string;
  type: "queryPosition" | "playback";
  payload: { command?: TransportCommand; speed?: number };
}

export type QueryResult =
  | { ok: true; playing: boolean; positionTick: string; positionSeconds: number }
  | { ok: false; reason: "unavailable" | "timeout" | "invalidReply"; message?: string };

export type CommandResult =
  | { ok: true; requestId: string }
  | { ok: false; reason: "unavailable" | "timeout" | "invalidReply"; message?: string };

export interface TransportOptions {
  transport?: TransportNative;
  timeoutMs?: number;
}

const TIMEOUT_SENTINEL = Symbol("timeout");

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMEOUT_SENTINEL> {
  return new Promise<T | typeof TIMEOUT_SENTINEL>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (value: T | typeof TIMEOUT_SENTINEL) => {
      if (!settled) {
        settled = true;
        if (timer) clearTimeout(timer);
        resolve(value);
      }
    };
    timer = setTimeout(() => finish(TIMEOUT_SENTINEL), ms);
    promise.then(
      (value) => finish(value),
      (error) => {
        settled = true;
        if (timer) clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function buildRequest(type: TransportRequest["type"], payload: TransportRequest["payload"]): TransportRequest {
  return { protocolVersion: PROTOCOL_VERSION, requestId: generateRequestId(), type, payload };
}

/** 查询原生播放位置（tick/秒/是否播放）。原生缺失返回 unavailable。 */
export function queryTransportPosition(options: TransportOptions = {}): Promise<QueryResult> {
  const transport = options.transport ?? realNative;
  if (!transport.isNativeAvailable()) {
    return Promise.resolve({ ok: false, reason: "unavailable" });
  }
  const request = buildRequest("queryPosition", {});
  const timeoutMs = options.timeoutMs ?? 3000;

  return withTimeout(transport.invoke(request), timeoutMs).then((raw) => {
    if (raw === TIMEOUT_SENTINEL) return { ok: false, reason: "timeout" };
    const reply = raw as Record<string, unknown>;
    if (reply?.ok === true && typeof reply?.playing === "boolean") {
      return {
        ok: true,
        playing: reply.playing,
        positionTick: String(reply.positionTick ?? "0"),
        positionSeconds: typeof reply.positionSeconds === "number" ? reply.positionSeconds : 0,
      };
    }
    return { ok: false, reason: "invalidReply", message: reply?.message ? String(reply.message) : undefined };
  });
}

/** 发送播放命令（play/pause/stop），可选 speed。原生缺失返回 unavailable。 */
export function sendPlaybackCommand(
  command: TransportCommand,
  options: TransportOptions & { speed?: number } = {},
): Promise<CommandResult> {
  const transport = options.transport ?? realNative;
  if (!transport.isNativeAvailable()) {
    return Promise.resolve({ ok: false, reason: "unavailable" });
  }
  const payload: { command: TransportCommand; speed?: number } = { command };
  if (typeof options.speed === "number") payload.speed = options.speed;
  const request = buildRequest("playback", payload);
  const timeoutMs = options.timeoutMs ?? 3000;

  return withTimeout(transport.invoke(request), timeoutMs).then((raw) => {
    if (raw === TIMEOUT_SENTINEL) return { ok: false, reason: "timeout" };
    const reply = raw as Record<string, unknown>;
    if (reply?.ok === true) return { ok: true, requestId: request.requestId };
    return { ok: false, reason: "invalidReply", message: reply?.message ? String(reply.message) : undefined };
  });
}
