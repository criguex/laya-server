[Leer en español](README.es.md)

![laya-server: local decision server with the Jev contract and a cascade to the cloud](docs/assets/banner.svg)

Local, free, Jev-compatible decision server. It runs [Laya](https://huggingface.co/convaiinnovations/laya) (open System One model, Apache-2.0, ~2 GB RAM, CPU only) behind the same `POST /v1/systemone` contract as TypeSafe Jev, with an optional **cascade**: confident answers stay local, uncertain or long inputs go to Jev in the cloud, and if the cloud fails the answer comes back flagged `escalate: true` for a human.

## How it works

![How laya-server routes a decision: long states go to Jev, Laya answers locally, low confidence cascades to Jev, cloud errors and missing cascade come back with escalate: true](docs/assets/how-it-works.svg)


The routing rule is `route()` in [`src/policy.mjs`](src/policy.mjs); the server in [`src/server.mjs`](src/server.mjs) calls it before and after asking Laya. Without `CASCADE_URL` and `CASCADE_KEY`, whatever would go to Jev stays in Laya with `escalate: true`.

## Why
- Free and unlimited locally, ~0.1–0.6 s per call on CPU, data never leaves the machine.
- Laya reads at most 512 tokens of state (~350 words) and prefers < 20 options: good for short messages (WhatsApp, tickets, titles), not long documents. Longer states go straight to the cascade.
- Quality in Spanish is not published by the model authors: measure it on your own labelled set before trusting thresholds.

## Run
```sh
npm install
node --env-file=.env src/server.mjs   # Node ≥ 20.6
```
| Env | Default | |
|---|---|---|
| `PORT` / `HOST` | `8787` / `0.0.0.0` | |
| `LAYA_TOKEN` | empty | Bearer token required by clients if set |
| `CASCADE_URL` / `CASCADE_KEY` | empty | Jev endpoint + key; empty = local only |
| `CASCADE_THRESHOLD` | `0.8` | minimum confidence to keep a local answer |
| `MAX_LOCAL_CHARS` | `1500` | longer states skip Laya |
| `CASCADE_TIMEOUT_MS` | `8000` | timeout of the call to Jev |

Response: `{ model, decider: "laya"|"jev", reason, escalate, answers, usage, ms }`. `GET /health` returns counters.

## Test

```sh
npm test
```

Seven `node:test` cases cover the routing policy: confidence of yes/no and choice answers, confident answers staying local, low confidence going to Jev or to a human, long states skipping Laya, and normalizing the cloud's boolean answers. They do not load the model.

## Windows (one command, PowerShell as admin)
```powershell
irm https://raw.githubusercontent.com/criguex/laya-server/main/windows/Install-Laya.ps1 -OutFile $env:TEMP\i.ps1; & $env:TEMP\i.ps1 -CascadeKey "<optional Jev/AI Gateway key>"
```
Installs Node LTS if missing, the server in `C:\gwar\laya-server`, a logon task with auto-restart, and a firewall rule that only accepts the Tailscale range (100.64.0.0/10).

## Author

Cristian Guerra · QA · Medellín · [github.com/criguex](https://github.com/criguex)

MIT. Laya weights by Convai Innovations under Apache 2.0.
