import test from "node:test";
import assert from "node:assert/strict";
import { buildGraph, yearOf, formatDateFr } from "../js/data.js";

test("yearOf returns the year for all three precisions", () => {
  assert.equal(yearOf("1942"), 1942);
  assert.equal(yearOf("1942-05"), 1942);
  assert.equal(yearOf("1942-05-17"), 1942);
});

test("yearOf returns null for null or malformed input", () => {
  assert.equal(yearOf(null), null);
  assert.equal(yearOf(""), null);
  assert.equal(yearOf("abc"), null);
});

test("formatDateFr renders a full date in French", () => {
  assert.equal(formatDateFr("1942-05-17"), "17 mai 1942");
  assert.equal(formatDateFr("1942-08-01"), "1 août 1942");
});

test("formatDateFr renders month precision", () => {
  assert.equal(formatDateFr("1942-02"), "février 1942");
});

test("formatDateFr renders year precision and empty string for null", () => {
  assert.equal(formatDateFr("1942"), "1942");
  assert.equal(formatDateFr(null), "");
});

function person(id, overrides = {}) {
  return {
    id,
    firstNames: id,
    lastName: "Test",
    birthName: null,
    sex: null,
    birth: null,
    death: null,
    photo: null,
    bio: null,
    ...overrides,
  };
}

const ids = (list) => list.map((p) => p.id);

const THREE_GEN = {
  persons: [
    person("abel"), person("berthe"), person("claire"),
    person("denis"), person("eric"), person("fanny"),
  ],
  unions: [
    { id: "u-ab", partners: ["abel", "berthe"], date: "1950", children: ["claire", "denis"] },
    { id: "u-ce", partners: ["claire", "eric"], date: "1975", children: ["fanny"] },
  ],
};

test("buildGraph indexes persons and unions by id", () => {
  const graph = buildGraph(THREE_GEN);
  assert.equal(graph.persons.size, 6);
  assert.equal(graph.unions.size, 2);
  assert.equal(graph.persons.get("claire").id, "claire");
  assert.deepEqual(graph.warnings, []);
});

test("buildGraph fills parentUnionOf and unionsOf", () => {
  const graph = buildGraph(THREE_GEN);
  assert.equal(graph.parentUnionOf.get("fanny"), "u-ce");
  assert.equal(graph.parentUnionOf.get("abel"), undefined);
  assert.deepEqual(graph.unionsOf.get("claire"), ["u-ce"]);
  assert.deepEqual(graph.unionsOf.get("abel"), ["u-ab"]);
});

test("parentsOf returns the partners of the parent union", () => {
  const graph = buildGraph(THREE_GEN);
  assert.deepEqual(ids(graph.parentsOf("fanny")), ["claire", "eric"]);
  assert.deepEqual(graph.parentsOf("abel"), []);
});

test("childrenOf aggregates children across the person's unions", () => {
  const graph = buildGraph(THREE_GEN);
  assert.deepEqual(ids(graph.childrenOf("abel")), ["claire", "denis"]);
  assert.deepEqual(graph.childrenOf("fanny"), []);
});

test("partnersOf returns co-partners, self excluded", () => {
  const graph = buildGraph(THREE_GEN);
  assert.deepEqual(ids(graph.partnersOf("claire")), ["eric"]);
  assert.deepEqual(graph.partnersOf("denis"), []);
});

test("siblingsOf returns co-children, self excluded", () => {
  const graph = buildGraph(THREE_GEN);
  assert.deepEqual(ids(graph.siblingsOf("claire")), ["denis"]);
  assert.deepEqual(graph.siblingsOf("abel"), []);
});
