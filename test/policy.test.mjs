import test from "node:test";
import assert from "node:assert/strict";
import { confidenceOf, route, normalizeUpstream } from "../src/policy.mjs";

test("noul confidence is distance from 0.5 both ways", () => {
  assert.equal(confidenceOf({ type: "noul", noul: 0.1 }), 0.9);
  assert.equal(confidenceOf({ type: "noul", noul: 0.95 }), 0.95);
});

test("choice uses confidence or max probability", () => {
  assert.equal(confidenceOf({ type: "choice", confidence: 0.4 }), 0.4);
  assert.equal(confidenceOf({ type: "choice", probabilities: { a: 0.2, b: 0.7 } }), 0.7);
});

test("confident local answers stay local", () => {
  const r = route({ state: "hola", localAnswers: { x: { type: "noul", noul: 0.05 } }, threshold: 0.8, maxLocalChars: 1500, cascadeAvailable: true });
  assert.equal(r.decider, "laya");
});

test("low confidence cascades to jev when available", () => {
  const r = route({ state: "hola", localAnswers: { x: { type: "choice", confidence: 0.33 } }, threshold: 0.8, maxLocalChars: 1500, cascadeAvailable: true });
  assert.equal(r.decider, "jev");
});

test("low confidence without cascade escalates to human", () => {
  const r = route({ state: "hola", localAnswers: { x: { type: "choice", confidence: 0.33 } }, threshold: 0.8, maxLocalChars: 1500, cascadeAvailable: false });
  assert.equal(r.escalate, true);
});

test("long state goes straight to jev", () => {
  const r = route({ state: "x".repeat(2000), localAnswers: null, threshold: 0.8, maxLocalChars: 1500, cascadeAvailable: true });
  assert.deepEqual([r.decider, r.reason], ["jev", "long_state"]);
});

test("gateway boolean/probability normalized to noul", () => {
  assert.deepEqual(normalizeUpstream({ u: { type: "boolean", probability: 0.94 } }), { u: { type: "noul", noul: 0.94 } });
});
