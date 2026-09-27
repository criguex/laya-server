export function confidenceOf(answer) {
  if (!answer) return 0;
  if (answer.type === "noul") {
    const p = typeof answer.noul === "number" ? answer.noul : answer.probability;
    return Math.max(p, 1 - p);
  }
  if (typeof answer.confidence === "number") return answer.confidence;
  const probs = Object.values(answer.probabilities ?? {});
  return probs.length ? Math.max(...probs) : 0;
}

export function minConfidence(answers) {
  const values = Object.values(answers ?? {}).map(confidenceOf);
  return values.length ? Math.min(...values) : 0;
}

export function stateLength(state) {
  return typeof state === "string" ? state.length : JSON.stringify(state ?? "").length;
}

export function route({ state, localAnswers, threshold, maxLocalChars, cascadeAvailable }) {
  if (stateLength(state) > maxLocalChars) {
    return cascadeAvailable ? { decider: "jev", reason: "long_state" } : { decider: "laya", reason: "long_state_truncated", escalate: true };
  }
  if (!localAnswers) return { decider: "laya", reason: "pending" };
  const min = minConfidence(localAnswers);
  if (min >= threshold) return { decider: "laya", reason: "confident", min };
  return cascadeAvailable ? { decider: "jev", reason: "low_confidence", min } : { decider: "laya", reason: "low_confidence", min, escalate: true };
}

export function normalizeUpstream(answers) {
  const out = {};
  for (const [k, a] of Object.entries(answers ?? {})) {
    if (a.type === "noul" || a.type === "boolean") {
      let p = a.noul ?? a.probability;
      if (typeof p === "boolean") p = p ? 1 : 0;
      out[k] = { type: "noul", noul: Number(p) };
    } else {
      out[k] = a;
    }
  }
  return out;
}
