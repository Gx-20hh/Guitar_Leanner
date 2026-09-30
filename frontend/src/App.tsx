import { useState } from "react";
import { getConnectorDiagnostic, type ConnectorDiagnostic } from "@bridge/diagnostic";
import { runPing, type PingClientResult } from "@bridge/client";
import { ScoreBoard } from "./score/ScoreBoard";

const SCRIPTS: Array<{ name: string; purpose: string }> = [
  { name: "npm run dev", purpose: "启动本地 Vite 开发服务器" },
  { name: "npm run typecheck", purpose: "TypeScript 类型检查（无输出）" },
  { name: "npm test", purpose: "运行 Vitest 单元测试" },
  { name: "npm run build", purpose: "类型检查 + 构建前端产物" },
];

interface Readout {
  label: string;
  value: string;
  hint?: string;
}

const READOUTS: Readout[] = [
  { label: "页面形态", value: "本地开发诊断页（M0 骨架）", hint: "连接诊断定位，非正式产品外壳" },
  { label: "乐谱模块", value: "未接入", hint: "alphaTab 导入在 T11/T12，本子项不做" },
  { label: "音频 / 评分", value: "未接入", hint: "归原生端，前端不拥有音频时钟" },
  { label: "参考设备", value: "MOOER GE200（未实机验收）", hint: "未连接、无驱动安装、未测通道" },
];

function StatusBand({ diag }: { diag: ConnectorDiagnostic }) {
  const stateLabel = diag.state === "connected" ? "已连接（原生桥接可用）" : "未连接";
  return (
    <section className="status" aria-live="polite">
      <span className="statusDot" aria-hidden="true" />
      <div className="statusText">
        <span className="statusState">{stateLabel}</span>
        <p>{diag.message}</p>
      </div>
    </section>
  );
}

function resultSummary(result: PingClientResult | null): {
  label: string;
  detail: string;
} {
  if (result === null) {
    return { label: "尚未发送", detail: "点击下方按钮向原生发起一次 ping 请求。" };
  }
  switch (result.status) {
    case "ok":
      return {
        label: "pong from native",
        detail: `请求 ${result.requestId} 往返 ${result.rttMs.toFixed(1)} ms。`,
      };
    case "error":
      return {
        label: `${result.code} / ${result.message}`,
        detail: `失败回复（请求 ${result.requestId ?? "null"}）往返 ${result.rttMs.toFixed(1)} ms。`,
      };
    case "invalidReply":
      return {
        label: `回复校验失败：${result.reason}`,
        detail: result.detail ? `详情：${result.detail}` : result.requestId,
      };
    case "timeout":
      return {
        label: "超时（无原生响应）",
        detail: `请求 ${result.requestId} 在 ${result.timeoutMs} ms 内未返回，已放弃等待。`,
      };
    case "nativeUnavailable":
      return {
        label: "未连接：原生接口不可用",
        detail: "检测不到 guitarBridge 原生函数。此页面不冒充已连接设备。",
      };
  }
}

function PingControl() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PingClientResult | null>(null);
  const [rtt, setRtt] = useState<number | null>(null);

  async function onPing() {
    setBusy(true);
    setResult(null);
    const started = performance.now();
    const res = await runPing();
    const elapsed = performance.now() - started;
    setResult(res);
    setRtt(res.status === "nativeUnavailable" ? null : elapsed);
    setBusy(false);
  }

  const { label, detail } = resultSummary(result);

  return (
    <section className="ping">
      <h2>原生桥接自检</h2>
      <div className="pingRow">
        <button type="button" className="pingBtn" onClick={onPing} disabled={busy}>
          {busy ? "发送中…" : "发送 ping"}
        </button>
        {rtt !== null ? <span className="pingRtt">实际往返 {rtt.toFixed(1)} ms</span> : null}
      </div>
      <dl className="pingResult" aria-live="polite">
        <div className="readout">
          <dt>结果</dt>
          <dd>{label}</dd>
        </div>
        <div className="readout">
          <dt>说明</dt>
          <dd>{detail}</dd>
        </div>
      </dl>
    </section>
  );
}

export function App() {
  const diag = getConnectorDiagnostic();
  const bootedAt = new Date(diag.bootedAt).toLocaleTimeString("zh-CN", {
    hour12: false,
  });

  return (
    <main className="page">
      <header className="masthead">
        <h1>连接诊断</h1>
        <p className="lede">
          Guitar Learner 前端骨架。此页只说明当前开发阶段的接入状态，不冒充已连接设备。
        </p>
      </header>

      <StatusBand diag={diag} />

      <PingControl />

      <dl className="readouts">
        {READOUTS.map((r) => (
          <div className="readout" key={r.label}>
            <dt>{r.label}</dt>
            <dd>
              {r.value}
              {r.hint ? <span className="hint">{r.hint}</span> : null}
            </dd>
          </div>
        ))}
      </dl>

      <div className="spacer" />

      <ScoreBoard />

      <section className="scripts">
        <h2>本地脚本</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">命令</th>
              <th scope="col">用途</th>
            </tr>
          </thead>
          <tbody>
            {SCRIPTS.map((s) => (
              <tr key={s.name}>
                <td>
                  <code>{s.name}</code>
                </td>
                <td>{s.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="foot">
        <span>页面启动于 {bootedAt}</span>
        <span>桥接契约已裁定，客户端按契约实现</span>
      </footer>
    </main>
  );
}
