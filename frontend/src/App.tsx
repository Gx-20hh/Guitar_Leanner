import { useState } from "react";
import { getConnectorDiagnostic, type ConnectorDiagnostic } from "@bridge/diagnostic";
import { runPing, type PingClientResult } from "@bridge/client";
import { ScoreBoard } from "./score/ScoreBoard";
import { importGpToIsr } from "./parser/importer";
import { expandScore } from "./score/ScorePlaybackAdapter";
import { PracticeBoard } from "./PracticeBoard";
import { usePracticeStore } from "./store/scoreStore";
import { TrainingPanel, type TrainingStats } from "./TrainingPanel";

/** 练习 mock 成绩（原生评分接入后替换）。 */
const mockStats: TrainingStats = { hits: 0, misses: 0, extras: 0, early: 0, late: 0, total: 0 };

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

function PracticePanel() {
  const [pulse, setPulse] = useState(false);
  const [saveName, setSaveName] = useState("");
  const isr = usePracticeStore((s) => s.isr);
  const expansion = usePracticeStore((s) => s.expansion);
  const importer = usePracticeStore((s) => s.importer);
  const setLoading = usePracticeStore((s) => s.setLoading);
  const setImported = usePracticeStore((s) => s.setImported);
  const setImportError = usePracticeStore((s) => s.setImportError);
  const library = usePracticeStore((s) => s.library);
  const addToLibrary = usePracticeStore((s) => s.addToLibrary);
  const loadFromLibrary = usePracticeStore((s) => s.loadFromLibrary);

  function onFile(file: File) {
    setLoading(file.name);
    file
      .arrayBuffer()
      .then((buffer) => importGpToIsr(new Uint8Array(buffer)))
      .then((score) => setImported(file.name, score, expandScore(score)))
      .catch((caught: Error) =>
        setImportError(file.name, caught instanceof Error ? caught.message : String(caught)),
      );
  }

  return (
    <section className="board" data-testid="practicePanel">
      <h2>基础练习（指板）</h2>
      <div className="drop">
        <label htmlFor="practiceFile">载入练习谱（GP/GP5/GP4/GP3）</label>
        <input
          id="practiceFile"
          type="file"
          accept=".gp,.gp5,.gp4,.gp3"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) onFile(file);
          }}
        />
        {importer.kind === "error" ? (
          <p className="err">{importer.message}</p>
        ) : (
          <p>导入谱面 → ISR → 播放展开 → 指板高亮</p>
        )}
      </div>
      <div className="pulseRow">
        <button type="button" onClick={() => setPulse((prev) => !prev)}>
          节拍脉冲（视觉指示，不发声）
        </button>
      </div>
      {isr && expansion ? (
        <PracticeBoard isr={isr} expansion={expansion} pulse={pulse} />
      ) : importer.kind === "loading" ? (
        <div className="tab">载入中…</div>
      ) : (
        <div className="tab">（未载入谱面）</div>
      )}
      <div className="saveRow">
        <input
          value={saveName}
          placeholder="曲名"
          onChange={(event) => setSaveName(event.currentTarget.value)}
        />
        <button type="button" onClick={() => {
          const name = saveName.trim() || "未命名";
          addToLibrary(name);
          setSaveName("");
        }}>
          保存到曲库
        </button>
      </div>
      <section className="library" data-testid="librarySidebar">
        <h3>曲库（点击载入）</h3>
        {library.length === 0 ? (
          <p>（空）</p>
        ) : (
          <ul>
            {library.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => loadFromLibrary(item.id)}>
                  {item.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

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
  const practiceIsr = usePracticeStore((s) => s.isr);
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

      <div className="spacer" />

      <PracticePanel />

      {practiceIsr ? (
        <>
          <div className="spacer" />
          <TrainingPanel stats={mockStats} />
        </>
      ) : null}

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
