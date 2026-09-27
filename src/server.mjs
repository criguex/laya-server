import http from "node:http";
import { Laya } from "@receptron/laya";
import { route, normalizeUpstream, minConfidence } from "./policy.mjs";

const cfg = {
  host: process.env.HOST ?? "0.0.0.0",
  port: Number(process.env.PORT ?? 8787),
  token: process.env.LAYA_TOKEN ?? "",
  threshold: Number(process.env.CASCADE_THRESHOLD ?? 0.8),
  maxLocalChars: Number(process.env.MAX_LOCAL_CHARS ?? 1500),
  upstreamUrl: process.env.CASCADE_URL ?? "",
  upstreamKey: process.env.CASCADE_KEY ?? "",
  upstreamTimeoutMs: Number(process.env.CASCADE_TIMEOUT_MS ?? 8000),
};
const cascadeAvailable = Boolean(cfg.upstreamUrl && cfg.upstreamKey);

const laya = await Laya.load({ onProgress: ({ file, received, total }) => total && process.stdout.write(`\rdownloading ${file} ${Math.round((received / total) * 100)}%`) });
const stats = { started: new Date().toISOString(), requests: 0, laya: 0, jev: 0, escalated: 0, upstreamErrors: 0 };
console.log(`\nlaya-server listening on ${cfg.host}:${cfg.port} cascade=${cascadeAvailable ? "on" : "off"} threshold=${cfg.threshold}`);

async function askUpstream(body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.upstreamTimeoutMs);
  try {
    const res = await fetch(cfg.upstreamUrl, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.upstreamKey}` },
      body: JSON.stringify({ model: "jev-latest", state: body.state, questions: body.questions }),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`upstream ${res.status}: ${text.slice(0, 300)}`);
    const json = JSON.parse(text);
    return { answers: normalizeUpstream(json.answers), usage: json.usage };
  } finally {
    clearTimeout(timer);
  }
}

async function decide(body) {
  const pre = route({ state: body.state, localAnswers: null, threshold: cfg.threshold, maxLocalChars: cfg.maxLocalChars, cascadeAvailable });
  let local = null;
  if (pre.decider !== "jev") {
    const t = Date.now();
    local = await laya.systemOne(body.state, body.questions);
    local.ms = Date.now() - t;
  }
  const r = local ? route({ state: body.state, localAnswers: local.answers, threshold: cfg.threshold, maxLocalChars: cfg.maxLocalChars, cascadeAvailable }) : pre;
  if (r.decider === "jev") {
    try {
      const t = Date.now();
      const up = await askUpstream(body);
      stats.jev++;
      return { model: "jev-latest", decider: "jev", reason: r.reason, escalate: false, answers: up.answers, usage: up.usage, ms: Date.now() - t, local: local ? { answers: local.answers, min_confidence: minConfidence(local.answers) } : undefined };
    } catch (e) {
      stats.upstreamErrors++;
      console.error(`[cascade] ${e.message}`);
      if (!local) {
        const t = Date.now();
        local = await laya.systemOne(body.state, body.questions);
        local.ms = Date.now() - t;
      }
      stats.laya++; stats.escalated++;
      return { model: "laya-local", decider: "laya", reason: `${r.reason}+upstream_error`, escalate: true, answers: local.answers, usage: local.usage, ms: local.ms, upstream_error: e.message };
    }
  }
  stats.laya++;
  if (r.escalate) stats.escalated++;
  return { model: "laya-local", decider: "laya", reason: r.reason, escalate: Boolean(r.escalate), answers: local.answers, usage: local.usage, ms: local.ms };
}

function send(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
}

http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true, cascade: cascadeAvailable, threshold: cfg.threshold, stats });
  if (req.method !== "POST" || !req.url.startsWith("/v1/systemone")) return send(res, 404, { error: "not found" });
  if (cfg.token && req.headers.authorization !== `Bearer ${cfg.token}`) return send(res, 401, { error: "unauthorized" });
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try {
    const body = JSON.parse(raw);
    if (!body.questions || typeof body.questions !== "object") return send(res, 400, { error: "questions required" });
    stats.requests++;
    send(res, 200, await decide(body));
  } catch (e) {
    console.error(e);
    send(res, 500, { error: e.message });
  }
}).listen(cfg.port, cfg.host);
