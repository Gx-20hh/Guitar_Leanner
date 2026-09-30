import { describe, expect, it } from "vitest";
import { runPing, type NativeTransport } from "./client";
import { PONG_MESSAGE, type PingRequest } from "./types";
import { codePointLength } from "./validators";

/** 测试专用替身传输（仅单测；实际 GUI 使用 realNativeTransport，不 mock）。 */
function fakeTransport(opts: {
  available: boolean;
  onInvoke?: (request: PingRequest) => Promise<unknown>;
}): NativeTransport {
  return {
    isNativeAvailable: () => opts.available,
    invoke: async (request) => {
      if (!opts.onInvoke) {
        return new Promise(() => undefined); // 永不 resolve → 超时
      }
      return opts.onInvoke(request);
    },
  };
}

function okReply(request: PingRequest) {
  return { protocolVersion: 1, requestId: request.requestId, ok: true, payload: { message: PONG_MESSAGE } };
}

describe("runPing — 正常", () => {
  it("收到合法 ok 回复时返回 ok，并回显同一 requestId 与固定 pong", async () => {
    const t = fakeTransport({ available: true, onInvoke: (r) => Promise.resolve(okReply(r)) });
    const res = await runPing({ transport: t, timeoutMs: 1000 });
    expect(res.status).toBe("ok");
    if (res.status === "ok") {
      expect(res.message).toBe(PONG_MESSAGE);
      expect(res.requestId).toMatch(/^[ -~]{1,64}$/);
      expect(res.rttMs).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("runPing — 原生缺失", () => {
  it("isNativeAvailable 为 false 时明确返回 nativeUnavailable，且不调用 invoke", async () => {
    let invoked = false;
    const t = fakeTransport({
      available: false,
      onInvoke: (r) => {
        invoked = true;
        return Promise.resolve(okReply(r));
      },
    });
    const res = await runPing({ transport: t, timeoutMs: 500 });
    expect(res.status).toBe("nativeUnavailable");
    expect(invoked).toBe(false);
  });
});

describe("runPing — 有限超时", () => {
  it("原生不返回时在 timeoutMs 后返回 timeout，不把迟到回复当成功", async () => {
    const t = fakeTransport({ available: true }); // 无 onInvoke → 永不 resolve
    const started = performance.now();
    const res = await runPing({ transport: t, timeoutMs: 60 });
    const elapsed = performance.now() - started;
    expect(res.status).toBe("timeout");
    if (res.status === "timeout") expect(res.timeoutMs).toBe(60);
    expect(elapsed).toBeGreaterThanOrEqual(50);
  });
});

describe("runPing — 失败回复", () => {
  it("ok:false + code/message 时返回 error", async () => {
    const t = fakeTransport({
      available: true,
      onInvoke: (r) =>
        Promise.resolve({
          protocolVersion: 1,
          requestId: r.requestId,
          ok: false,
          error: { code: "E_UNKNOWN_COMMAND", message: "command not allowed: frobnicate" },
        }),
    });
    const res = await runPing({ transport: t, timeoutMs: 1000 });
    expect(res.status).toBe("error");
    if (res.status === "error") expect(res.code).toBe("E_UNKNOWN_COMMAND");
  });

  it("null 的 requestId 错误回复：视为合法失败（不可关联），不当作成功", async () => {
    const t = fakeTransport({
      available: true,
      onInvoke: () =>
        Promise.resolve({
          protocolVersion: 1,
          requestId: null,
          ok: false,
          error: { code: "E_MALFORMED_REQUEST", message: "request could not be parsed" },
        }),
    });
    const res = await runPing({ transport: t, timeoutMs: 1000 });
    expect(res.status).toBe("error");
    if (res.status === "error") expect(res.requestId).toBeNull();
  });

  it("错误回复 requestId 与发送不符（非 null）→ 不得当成功，判 invalidReply:errorIdUnmatched", async () => {
    const t = fakeTransport({
      available: true,
      onInvoke: () =>
        Promise.resolve({
          protocolVersion: 1,
          requestId: "req_other-request-id",
          ok: false,
          error: { code: "E_BAD_PAYLOAD", message: "nope" },
        }),
    });
    const res = await runPing({ transport: t, timeoutMs: 1000 });
    expect(res.status).toBe("invalidReply");
    if (res.status === "invalidReply") expect(res.reason).toBe("errorIdUnmatched");
  });
});

describe("runPing — 回复校验：版本 / 互斥 / ID 不符", () => {
  it("版本必须为 1：protocolVersion 3 → invalidReply:versionMismatch", async () => {
    const t = fakeTransport({
      available: true,
      onInvoke: (r) => Promise.resolve({ protocolVersion: 3, requestId: r.requestId, ok: true, payload: { message: PONG_MESSAGE } }),
    });
    const res = await runPing({ transport: t, timeoutMs: 1000 });
    expect(res.status).toBe("invalidReply");
    if (res.status === "invalidReply") expect(res.reason).toBe("versionMismatch");
  });

  it("互斥：ok:true 不得带 error → invalidReply:mutExOkError", async () => {
    const t = fakeTransport({
      available: true,
      onInvoke: (r) =>
        Promise.resolve({ protocolVersion: 1, requestId: r.requestId, ok: true, payload: { message: PONG_MESSAGE }, error: { code: "E_BAD_PAYLOAD", message: "x" } }),
    });
    const res = await runPing({ transport: t, timeoutMs: 1000 });
    expect(res.status).toBe("invalidReply");
    if (res.status === "invalidReply") expect(res.reason).toBe("mutExOkError");
  });

  it("互斥：ok:false 不得带 payload → invalidReply:mutExErrorPayload", async () => {
    const t = fakeTransport({
      available: true,
      onInvoke: (r) =>
        Promise.resolve({ protocolVersion: 1, requestId: r.requestId, ok: false, payload: { message: "x" }, error: { code: "E_BAD_PAYLOAD", message: "x" } }),
    });
    const res = await runPing({ transport: t, timeoutMs: 1000 });
    expect(res.status).toBe("invalidReply");
    if (res.status === "invalidReply") expect(res.reason).toBe("mutExErrorPayload");
  });

  it("ok 回复 requestId 与发送不符/null → 不得当成功：okIdUnmatched", async () => {
    const t = fakeTransport({
      available: true,
      onInvoke: () => Promise.resolve({ protocolVersion: 1, requestId: null, ok: true, payload: { message: PONG_MESSAGE } }),
    });
    const res = await runPing({ transport: t, timeoutMs: 1000 });
    expect(res.status).toBe("invalidReply");
    if (res.status === "invalidReply") expect(res.reason).toBe("okIdUnmatched");
  });
});

describe("runPing — Unicode 码点边界", () => {
  it("中文消息（非 ASCII）长度在 1-256 码点内时原样发送并通过", async () => {
    const emoji = "🎸"; // 单个码点
    const msg = `诊断自检 ${emoji}`;
    const t = fakeTransport({
      available: true,
      onInvoke: (r) => {
        // 在 fake 内直接断言发出的消息与码点长度（避免闭包变量在跨 await 后的窄化问题）
        expect(r.payload.message).toBe(msg);
        expect(codePointLength(r.payload.message)).toBeLessThanOrEqual(256);
        return Promise.resolve({
          protocolVersion: 1,
          requestId: r.requestId,
          ok: false,
          error: { code: "E_UNKNOWN_COMMAND", message: "not ping" },
        });
      },
    });
    const res = await runPing({ transport: t, timeoutMs: 1000, message: msg });
    expect(res.status).toBe("error");
  });

  it("超过 256 码点的消息被本地护栏回退到默认消息（仍发出合法请求）", async () => {
    const t = fakeTransport({
      available: true,
      onInvoke: (r) => {
        expect(r.payload.message).toBe("hello from ui");
        return Promise.resolve({ protocolVersion: 1, requestId: r.requestId, ok: true, payload: { message: PONG_MESSAGE } });
      },
    });
    const res = await runPing({ transport: t, timeoutMs: 1000, message: "语".repeat(300) });
    expect(res.status).toBe("ok");
  });
});
