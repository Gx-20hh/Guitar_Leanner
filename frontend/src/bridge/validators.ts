/**
 * 契约校验与口径工具（前端侧）。
 *
 * 统一按契约裁定 docs/validation/t7-contract-review.md 与 contracts/：
 * - requestId：ASCII，长度 1–64。
 * - payload.message：按 Unicode 码点，长度 1–256（可含中文）。
 * - ok 成功 / error 失败 严格互斥；ok:true 固定回 payload.message="pong from native"。
 * - 回复的 protocolVersion === 1；requestId 必须回填本请求 id 或 null。
 */

import {
  PONG_MESSAGE,
  PROTOCOL_VERSION,
  type ReplyLike,
  type ValidatedReply,
} from "./types";

/** 按 Unicode 码点数计长（[].length 统计到完整码点，含代理对）。 */
export function codePointLength(value: string): number {
  return Array.from(value).length;
}

/** 仅允许 ASCII（码点 ≤ 0x7F）的非空字符。 */
export function isPureAscii(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    if (value.codePointAt(i)! > 0x7f) return false;
  }
  return true;
}

/**
 * 校验 requestId 是否合法：ASCII、长度 1–64、非空。
 * 对应契约 E_MALFORMED_REQUEST 的 requestId 口径（原生与前端一致）。
 */
export function isValidRequestId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length < 1 || value.length > 64) return false;
  return isPureAscii(value);
}

/** 校验 ping.payload.message：非空字符串且 Unicode 码点 1–256。 */
export function isValidPingMessage(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const n = codePointLength(value);
  return n >= 1 && n <= 256;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 前端对原生回复的校验。sentRequestId 为本请求生成的 requestId。
 * 返回 ValidatedReply：ok / error / invalid 三分支，互斥。
 */
export function validateReply(raw: unknown, sentRequestId: string): ValidatedReply {
  if (!isPlainObject(raw)) {
    return { kind: "invalid", reason: "notObject" };
  }
  const r = raw as ReplyLike;

  // 顶层结构：requestId 必须先可安全校验（契约验证顺序）。
  const hasLegalId = isValidRequestId(r.requestId);
  const idMatches = hasLegalId && r.requestId === sentRequestId;

  // 版本
  if (r.protocolVersion !== PROTOCOL_VERSION) {
    return { kind: "invalid", reason: "versionMismatch", detail: String(r.protocolVersion) };
  }

  // ok 分支
  if (r.ok === true) {
    // 成功不得含 error（互斥）
    if ("error" in r) {
      return { kind: "invalid", reason: "mutExOkError" };
    }
    // 成功必须回填相同 requestId；null/错ID 不能当成功
    if (!idMatches) {
      return { kind: "invalid", reason: "okIdUnmatched", detail: String(r.requestId) };
    }
    // payload 必须为对象且 message 固定为 pong from native
    const payload = r.payload;
    if (!isPlainObject(payload) || payload.message !== PONG_MESSAGE) {
      return { kind: "invalid", reason: "okBadPayload" };
    }
    return {
      kind: "ok",
      reply: { protocolVersion: 1, requestId: sentRequestId, ok: true, payload: { message: PONG_MESSAGE } },
    };
  }

  if (r.ok === false) {
    // 失败不得含 payload（互斥）
    if ("payload" in r) {
      return { kind: "invalid", reason: "mutExErrorPayload" };
    }
    // error 必须存在且含 code 与 message
    const err = r.error;
    if (!isPlainObject(err) || typeof err.code !== "string" || typeof err.message !== "string") {
      return { kind: "invalid", reason: "errorMalformed" };
    }
    // 失败回复的 requestId 允许等于发送 id 或 null；其余视为不可关联
    if (hasLegalId && !idMatches) {
      return { kind: "invalid", reason: "errorIdUnmatched", detail: String(r.requestId) };
    }
    return {
      kind: "error",
      reply: { protocolVersion: 1, requestId: hasLegalId ? String(r.requestId) : null, ok: false, error: { code: err.code, message: err.message } },
    };
  }

  // ok 不是布尔 → 非法
  return { kind: "invalid", reason: "okNotBoolean" };
}
