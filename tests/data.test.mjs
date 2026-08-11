import test from "node:test";
import assert from "node:assert/strict";
import { yearOf, formatDateFr } from "../js/data.js";

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
