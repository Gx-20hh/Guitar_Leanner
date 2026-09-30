/**
 * 本地 ping 协议类型（仅供前端客户端消费）。
 *
 * 边界：权威协议定义位于 contracts/ping-protocol.md。本文件是前端侧的类型镜像，
 * 不作为跨层公共 DTO（公共 DTO 由 contracts/ 统一提供）。字段语义以契约裁定
 * docs/validation/t7-contract-review.md 为准。
 */

/** 当前协议版本（契约固定为 1）。 */
export const PROTOCOL_VERSION = 1 as const;

/** 白名单：唯一已批准的命令（契约当前仅 ping）。 */
export const ALLOWED_COMMANDS = ["ping"] as const;

/** 原生唯一函数入口名（契约 bridge-naming）。 */
export const NATIVE_FN_NAME = "guitarBridge" as const;

/** 成功回复的固定消息（契约 ping-protocol §1.2）。 */
export const PONG_MESSAGE = "pong from native" as const;

export interface PingPayload {
  /** 按 Unicode 码点，长度 1–256，可为中文等非 ASCII。 */
  message: string;
}

export interface PingRequest {
  protocolVersion: typeof PROTOCOL_VERSION;
  requestId: string;
  type: "ping";
  payload: PingPayload;
}

export type ErrorCode =
  | "E_MALFORMED_REQUEST"
  | "E_VERSION_UNSUPPORTED"
  | "E_UNKNOWN_COMMAND"
  | "E_BAD_PAYLOAD";

export interface ReplyOk {
  protocolVersion: 1;
  requestId: string;
  ok: true;
  payload: { message: typeof PONG_MESSAGE };
}

export interface ReplyError {
  protocolVersion: 1;
  requestId: string | null;
  ok: false;
  error: { code: ErrorCode | (string & {}); message: string };
}

export type ReplyLike = Record<string, unknown>;

/**
 * 校验结果（前端对回复的分拣）。一次回复只能归入一类。 */
export type ValidatedReply =
  | { kind: "ok"; reply: ReplyOk }
  | { kind: "error"; reply: ReplyError }
  | { kind: "invalid"; reason: string; detail?: string };
