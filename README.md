# laya-server

Local, free, Jev-compatible decision server. It runs [Laya](https://huggingface.co/convaiinnovations/laya) (open System One model, Apache-2.0, ~2 GB RAM, CPU only) behind the same `POST /v1/systemone` contract as TypeSafe Jev, with an optional **cascade**: confident answers stay local, uncertain or long inputs go to Jev in the cloud, and if the cloud fails the answer comes back flagged `escalate: true` for a human.

```
client ──► laya-server (LAN/Tailscale)
              ├─ state > MAX_LOCAL_CHARS ─────────► Jev (cloud)
              ├─ Laya local ── min confidence ≥ T ─► answer (decider: laya)
              └─ min confidence < T ──────────────► Jev (cloud)
                                   └─ cloud error ─► local answer + escalate: true
```

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

Response: `{ model, decider: "laya"|"jev", reason, escalate, answers, usage, ms }`. `GET /health` returns counters.

## Windows (one command, PowerShell as admin)
```powershell
irm https://raw.githubusercontent.com/criguex/laya-server/main/windows/Install-Laya.ps1 -OutFile $env:TEMP\i.ps1; & $env:TEMP\i.ps1 -CascadeKey "<optional Jev/AI Gateway key>"
```
Installs Node LTS if missing, the server in `C:\gwar\laya-server`, a logon task with auto-restart, and a firewall rule that only accepts the Tailscale range (100.64.0.0/10).

## Español
Servidor de decisiones local y gratis compatible con Jev. Lo claro se decide en tu PC; lo dudoso o largo sube a Jev; si la nube falla, vuelve marcado para revisión humana. Instalación en Windows con el comando de arriba.

MIT. Laya weights by Convai Innovations under Apache 2.0.
