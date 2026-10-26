# Conectar ADN Generator a laya-server (War)

ADN ya tiene el cliente Jev y los gates G1–G6 en sombra (`src/clients/jev_client.py`, `docs/JEV-SOMBRA.md`). El servidor responde el mismo contrato, así que **no hay que tocar código**, solo el `.env` de ADN en el mini.

## .env de ADN (mini)
```
GV_JEV_ENABLED=true
GV_JEV_MODE=shadow
GV_JEV_URL=http://<ip-tailscale-del-nodo>:8787/v1/systemone
GV_JEV_API_KEY=<LAYA_TOKEN de C:\gwar\laya-server\.env en War>
GV_JEV_TIMEOUT_S=12
```
- **Quitar `AI_GATEWAY_API_KEY` del `.env` de ADN.** `jev_api_key` lo lee primero y, si existe, manda la key del gateway a War (401). La key de Jev vive ahora en War como `CASCADE_KEY`.
- `GV_JEV_TIMEOUT_S=12`: Laya responde en <1 s, pero lo dudoso sube a Jev en la nube (hasta `CASCADE_TIMEOUT_MS`). En sombra no bloquea nada.

## Qué gate cae dónde
Laya lee máximo ~512 tokens de estado. El servidor manda directo a Jev todo estado de más de `MAX_LOCAL_CHARS` (1500).
| Gate | Estado típico | Quién decide |
|---|---|---|
| G1 narración↔visual (ventanas de 15 beats) | largo | Jev (cascada). Para que decida Laya: `GV_JEV_G1_WINDOW=3` |
| G2 hook | apertura corta | Laya, Jev si duda |
| G3 identidad de canal | identidad + guion, largo | Jev |
| G4 gate REVIEW | derivado de G2/G3 | — |
| G5 hooks de shorts (ventanas) | medio/largo | mixto |
| G6 comentarios | corto | Laya |

## Pendiente del lado ADN (sesión del mini)
1. Guardar en la observación de sombra el `model` de la respuesta (`laya-local` o `jev-latest`) para que `scripts/jev_shadow_report.py` compare Laya vs Jev por gate.
2. El costo: Laya no trae `providerMetadata.gateway.cost`, así que `billed_usd` queda vacío (correcto: es $0). No estimar costo por tokens para `model=laya-local`.
