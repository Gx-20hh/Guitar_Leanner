import { describe, expect, it } from "vitest";
import {
  codePointLength,
  isPureAscii,
  isValidPingMessage,
  isValidRequestId,
} from "./validators";
import { generateRequestId } from "./client";

describe("isValidRequestId — requestId 口径（ASCII 1–64）", () => {
  it("合法：ASCII 且长度 1–64", () => {
    expect(isValidRequestId("req_0192fc3a-abc")).toBe(true);
    expect(isValidRequestId("a")).toBe(true);
    expect(isValidRequestId("x".repeat(64))).toBe(true);
  });

  it("空字符串 → 非法", () => {
    expect(isValidRequestId("")).toBe(false);
  });

  it("超长 65 → 非法", () => {
    expect(isValidRequestId("x".repeat(65))).toBe(false);
  });

  it("非 ASCII（中文 / 表情）→ 非法", () => {
    expect(isValidRequestId("请求请求")).toBe(false);
    expect(isValidRequestId("🎸")).toBe(false);
  });

  it("非字符串类型 → 非法", () => {
    expect(isValidRequestId(123)).toBe(false);
    expect(isValidRequestId(null)).toBe(false);
    expect(isValidRequestId(undefined)).toBe(false);
  });
});

describe("码点口径（Unicode 边界）", () => {
  it("codePointLength 按码点数计：表情为一个码点", () => {
    expect(codePointLength("🎸")).toBe(1);
    expect(codePointLength("🎸🎸🎸")).toBe(3);
  });

  it("isPureAscii：表情/中文非 ASCII；纯 ASCII 为真", () => {
    expect(isPureAscii("abc-123")).toBe(true);
    expect(isPureAscii("🎸")).toBe(false);
    expect(isPureAscii("中文")).toBe(false);
  });

  it("isValidPingMessage：1–256 码点（中文可行），空/超 256 非法", () => {
    expect(isValidPingMessage("诊断自检 🎸")).toBe(true);
    expect(isValidPingMessage("")).toBe(false);
    expect(isValidPingMessage("语".repeat(257))).toBe(false);
    expect(isValidPingMessage("语".repeat(256))).toBe(true);
    expect(isValidPingMessage(null)).toBe(false);
  });
});

describe("generateRequestId — 客户端生成", () => {
  it("生成串为 ASCII 且长度 1–64，并保持唯一", () => {
    const a = generateRequestId();
    const b = generateRequestId();
    expect(isValidRequestId(a)).toBe(true);
    expect(a.length).toBeGreaterThanOrEqual(1);
    expect(a.length).toBeLessThanOrEqual(64);
    expect(a).not.toBe(b);
  });
});
