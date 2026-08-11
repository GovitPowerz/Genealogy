import test from "node:test";
import assert from "node:assert/strict";
import { normalize, searchPersons } from "../js/search.js";

function graphOf(persons) {
  return { persons: new Map(persons.map((p) => [p.id, p])) };
}

const family = graphOf([
  { id: "gregoire-lefevre", firstNames: "Grégoire", lastName: "Lefèvre", birthName: null },
  { id: "helene-lefevre", firstNames: "Hélène", lastName: "Lefèvre", birthName: "Duchamp" },
  { id: "jose-garcia", firstNames: "José", lastName: "García", birthName: null }
]);

test("normalize strips diacritics and lowercases", () => {
  assert.equal(normalize("Grégoire"), "gregoire");
  assert.equal(normalize("Hélène LEFÈVRE"), "helene lefevre");
  assert.equal(normalize("àâäéèêëîïôöùûüç"), "aaaeeeeiioouuuc");
});

test("matches on firstNames lastName order", () => {
  const r = searchPersons(family, "gregoire lef");
  assert.equal(r.length, 1);
  assert.equal(r[0].id, "gregoire-lefevre");
});

test("matches on lastName firstNames order", () => {
  const r = searchPersons(family, "lefevre greg");
  assert.equal(r.length, 1);
  assert.equal(r[0].id, "gregoire-lefevre");
});

test("accented query matches accented data", () => {
  const r = searchPersons(family, "Léfèvre HÉ");
  assert.equal(r.length, 1);
  assert.equal(r[0].id, "helene-lefevre");
});

test("matches on birthName", () => {
  const r = searchPersons(family, "ducha");
  assert.equal(r.length, 1);
  assert.equal(r[0].id, "helene-lefevre");
});

test("caps results at 8", () => {
  const many = graphOf(Array.from({ length: 12 }, (_, i) => (
    { id: "jean-" + i, firstNames: "Jean", lastName: "Martin", birthName: null }
  )));
  assert.equal(searchPersons(many, "jean").length, 8);
});

test("empty and whitespace queries return []", () => {
  assert.deepEqual(searchPersons(family, ""), []);
  assert.deepEqual(searchPersons(family, "   "), []);
});

test("no match returns []", () => {
  assert.deepEqual(searchPersons(family, "zzz"), []);
});
