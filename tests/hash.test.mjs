import test from "node:test";
import assert from "node:assert/strict";
import { parseHash, buildHash } from "../js/main.js";

test("parseHash: empty hash -> both null", () => {
  assert.deepEqual(parseHash(""), { theme: null, person: null });
  assert.deepEqual(parseHash("#"), { theme: null, person: null });
});

test("parseHash: unknown theme id -> null, person kept", () => {
  const r = parseHash("#theme=inconnu&person=marie-dupont");
  assert.equal(r.theme, null);
  assert.equal(r.person, "marie-dupont");
});

test("parseHash: person only", () => {
  assert.deepEqual(parseHash("#person=jean-martin"), { theme: null, person: "jean-martin" });
});

test("buildHash: both parts", () => {
  assert.equal(buildHash({ theme: "ciel", person: "jean-martin" }), "#theme=ciel&person=jean-martin");
});

test("buildHash: omits null parts, empty when both null", () => {
  assert.equal(buildHash({ theme: "ciel", person: null }), "#theme=ciel");
  assert.equal(buildHash({ theme: null, person: "jean-martin" }), "#person=jean-martin");
  assert.equal(buildHash({ theme: null, person: null }), "");
});

test("roundtrip: person survives buildHash -> parseHash", () => {
  const hash = buildHash({ theme: null, person: "louise-bernard" });
  assert.equal(parseHash(hash).person, "louise-bernard");
});
