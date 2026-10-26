[Read in English](README.md)

![laya-server: servidor de decisiones local con el contrato de Jev y cascada a la nube](docs/assets/banner.svg)

## Explicado para un niño de 8 años

Cris tiene una fábrica de videos, ADN Generator, que hace videos. Antes de confiar en un video, alguien tiene que responder preguntas rápidas sobre él, como "¿el inicio engancha?" o "¿los comentarios son buenos?". laya-server es un juez pequeño que responde esas preguntas cortas de sí o no y de escoger una opción, gratis, en el propio computador de Cris, que se llama WAR. Cuando una pregunta es muy larga, o el juez no está seguro, le pregunta a un juez más grande que vive en la nube y se llama Jev. Por ahora funciona en **modo sombra**: sus respuestas quedan anotadas para compararlas después, pero nunca frena un video.

<p align="center">
  <img src="docs/assets/explained.gif" width="720" alt="Historia ilustrada: la fábrica de videos pregunta si el inicio engancha, un juez pequeño y gratis en el computador WAR responde, un guion largo sube a Jev en la nube y, en modo sombra, las respuestas se anotan mientras el video sigue" />
</p>

### Un ejemplo real

- **Imagina** que la fábrica tiene un video nuevo con una frase de arranque corta. Le pregunta al gate G2: "¿este gancho funciona?"
- **Qué pasa:** la pregunta es corta (menos de 1.500 caracteres), así que Laya responde en WAR, en mucho menos de un segundo y sin costo. Si Laya está segura en menos de un 80 %, la pregunta sube a Jev.
- **Otra pregunta,** la del gate G3 "¿el guion encaja con el canal?", lleva la identidad del canal y el guion completo. Eso es demasiado largo para Laya, que lee unas 350 palabras, así que se va directo a Jev.
- **Qué ganamos:** las preguntas fáciles cuestan $0 y los datos se quedan en casa, las difíciles igual reciben una buena respuesta y, en modo sombra, nada se rompe mientras Cris averigua si Laya es lo bastante buena. Nadie ha medido todavía la calidad de Laya en español: esa medición va antes de confiar en ella.

Qué pregunta va a dónde (sale de [docs/ADN.md](docs/ADN.md)):

| Gate | La pregunta, en palabras simples | Quién responde |
|---|---|---|
| G1 | ¿Lo que se dice cuadra con lo que se ve? (ventanas largas de 15 beats) | Jev |
| G2 | ¿El inicio engancha? | Laya, y Jev si Laya duda |
| G3 | ¿El video encaja con el canal? | Jev |
| G4 | Gate de revisión final, armado con G2 y G3 | — |
| G5 | ¿Funcionan los ganchos de los Shorts? | mixto |
| G6 | ¿Los comentarios son buenos? | Laya |

### Palabras difíciles

| Palabra | Qué significa |
|---|---|
| **Laya** | El "cerebro" pequeño y gratis que corre en el computador de Cris, sin internet. |
| **Jev** | Un juez más grande en la nube. Sabe más, pero cada pregunta cuesta plata. |
| **Cascada** | Pasarle una pregunta difícil a alguien que sabe más. |
| **Umbral 0.8** | Qué tan seguro tiene que estar el juez pequeño (8 de 10) para responder solo. |
| **Modo sombra** | Modo de práctica: las respuestas se anotan, pero no cambian nada. |
| **Gate** | Una pregunta de control por la que pasa cada video. |
| **Tailscale** | Un túnel privado para que solo las máquinas de Cris puedan hablar con el servidor. |

## Qué es

Servidor de decisiones local, gratis y compatible con Jev. Corre [Laya](https://huggingface.co/convaiinnovations/laya) (modelo abierto de System One, Apache-2.0, ~2 GB de RAM, solo CPU) detrás del mismo contrato `POST /v1/systemone` de TypeSafe Jev, con una **cascada** opcional: las respuestas seguras se quedan en local, las dudosas o largas suben a Jev en la nube y, si la nube falla, la respuesta vuelve marcada con `escalate: true` para que la revise una persona.

## Cómo funciona

![Cómo decide laya-server: los estados largos van a Jev, Laya responde en local, la baja confianza sube a Jev, y los errores de la nube o la falta de cascada vuelven con escalate: true](docs/assets/how-it-works.svg)


La regla de enrutamiento es `route()` en [`src/policy.mjs`](src/policy.mjs); el servidor de [`src/server.mjs`](src/server.mjs) la llama antes y después de preguntarle a Laya. Sin `CASCADE_URL` ni `CASCADE_KEY`, lo que iría a Jev se queda en Laya con `escalate: true`.

## Por qué
- Gratis e ilimitado en local, ~0,1–0,6 s por llamada en CPU, y los datos nunca salen de la máquina.
- Laya lee como máximo 512 tokens de estado (~350 palabras) y funciona mejor con menos de 20 opciones: sirve para mensajes cortos (WhatsApp, tickets, títulos), no para documentos largos. Los estados más largos pasan directo a la cascada.
- Los autores del modelo no publican su calidad en español: mídela con tu propio set etiquetado antes de confiar en los umbrales.

## Correrlo
```sh
npm install
node --env-file=.env src/server.mjs   # Node ≥ 20.6
```
| Variable | Por defecto | |
|---|---|---|
| `PORT` / `HOST` | `8787` / `0.0.0.0` | |
| `LAYA_TOKEN` | vacío | token Bearer que deben mandar los clientes, si se define |
| `CASCADE_URL` / `CASCADE_KEY` | vacío | endpoint y key de Jev; vacío = solo local |
| `CASCADE_THRESHOLD` | `0.8` | confianza mínima para quedarse con la respuesta local |
| `MAX_LOCAL_CHARS` | `1500` | los estados más largos se saltan a Laya |
| `CASCADE_TIMEOUT_MS` | `8000` | tiempo máximo de la llamada a Jev |

Respuesta: `{ model, decider: "laya"|"jev", reason, escalate, answers, usage, ms }`. `GET /health` devuelve contadores.

## Pruebas

```sh
npm test
```

Siete casos de `node:test` cubren la política de enrutamiento: la confianza de las respuestas sí/no y de opción, que las respuestas seguras se queden en local, que la baja confianza vaya a Jev o a una persona, que los estados largos se salten a Laya y que se normalicen las respuestas booleanas de la nube. No cargan el modelo.

## Windows (un comando, PowerShell como administrador)
```powershell
irm https://raw.githubusercontent.com/criguex/laya-server/main/windows/Install-Laya.ps1 -OutFile $env:TEMP\i.ps1; & $env:TEMP\i.ps1 -CascadeKey "<key opcional de Jev/AI Gateway>"
```
Instala Node LTS si no está, el servidor en `C:\gwar\laya-server`, una tarea al iniciar sesión con reinicio automático y una regla de firewall que solo acepta el rango de Tailscale (100.64.0.0/10).

## Autor

Cristian Guerra · QA · Medellín · [github.com/criguex](https://github.com/criguex)

MIT. Pesos de Laya de Convai Innovations bajo Apache 2.0.
