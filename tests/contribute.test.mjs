import test from "node:test";
import assert from "node:assert/strict";
import { CONTACT_EMAIL, slugify, buildSubmission, submissionToMailto } from "../js/contribute.js";

test("slugify strips diacritics, lowercases, hyphenates", () => {
  assert.equal(slugify("Grégory", "Gelly"), "gregory-gelly");
  assert.equal(slugify("Éléonore Anaïs", "de La Tour"), "eleonore-anais-de-la-tour");
  assert.equal(slugify("Jean-Marie", "Müller"), "jean-marie-muller");
});

test("buildSubmission ajout-personne builds a full person payload", () => {
  const sub = buildSubmission("ajout-personne", {
    firstNames: "Odile", lastName: "Roux", birthName: "",
    sex: "F", birthDate: "1950-03", birthPlace: "Nice",
    deathDate: "", deathPlace: "", bio: "",
    photoPromised: true, parents: { unionId: "u-x" },
    note: "", submitterName: "Marc"
  });
  assert.deepEqual(sub, {
    version: 1,
    type: "ajout-personne",
    payload: {
      firstNames: "Odile", lastName: "Roux", birthName: null, sex: "F",
      birth: { date: "1950-03", place: "Nice" }, death: null,
      photo: null, bio: null, photoPromised: true, parents: { unionId: "u-x" }
    },
    note: "", submitterName: "Marc"
  });
});

test("buildSubmission ajout-personne handles parentIds and absent parents", () => {
  const a = buildSubmission("ajout-personne", { firstNames: "A", lastName: "B", parents: { parentIds: ["x", "y"] } });
  assert.deepEqual(a.payload.parents, { parentIds: ["x", "y"] });
  const b = buildSubmission("ajout-personne", { firstNames: "A", lastName: "B" });
  assert.equal("parents" in b.payload, false);
  assert.equal(b.payload.photoPromised, false);
  assert.equal(b.payload.birth, null);
});

test("buildSubmission correction-personne keeps id, never touches photo", () => {
  const sub = buildSubmission("correction-personne", {
    id: "odile-roux", firstNames: "Odile", lastName: "Roux",
    birthName: "Blanc", sex: "F", birthDate: "1950",
    note: "date corrigée", submitterName: "Marc"
  });
  assert.equal(sub.type, "correction-personne");
  assert.equal(sub.payload.id, "odile-roux");
  assert.equal(sub.payload.birthName, "Blanc");
  assert.deepEqual(sub.payload.birth, { date: "1950", place: null });
  assert.equal("photo" in sub.payload, false);
  assert.equal("photoPromised" in sub.payload, false);
});

test("buildSubmission union defaults date and children", () => {
  const one = buildSubmission("union", { partners: ["a"], note: "", submitterName: "M" });
  assert.deepEqual(one.payload, { partners: ["a"], date: null, children: [] });
  const two = buildSubmission("union", { partners: ["a", "b"], date: "1999", children: ["c"] });
  assert.deepEqual(two.payload, { partners: ["a", "b"], date: "1999", children: ["c"] });
});

test("buildSubmission remarque has null payload and keeps the note", () => {
  const sub = buildSubmission("remarque", { note: "Le nom de X est mal orthographié", submitterName: "Léa" });
  assert.equal(sub.version, 1);
  assert.equal(sub.payload, null);
  assert.equal(sub.note, "Le nom de X est mal orthographié");
  assert.equal(sub.submitterName, "Léa");
});

test("buildSubmission rejects an unknown kind with a French message", () => {
  assert.throws(() => buildSubmission("suppression", {}), /Type de contribution inconnu/);
});

test("submissionToMailto encodes subject and body reversibly", () => {
  const sub = buildSubmission("ajout-personne", { firstNames: "Grégory", lastName: "Gelly", note: "", submitterName: "Grégory" });
  const url = submissionToMailto(sub, CONTACT_EMAIL);
  assert.ok(url.startsWith("mailto:gregory.gelly@gmail.com?subject="));
  const m = url.match(/\?subject=([^&]*)&body=(.*)$/);
  assert.equal(decodeURIComponent(m[1]), "Généalogie - ajout-personne - Grégory Gelly");
  assert.deepEqual(JSON.parse(decodeURIComponent(m[2])), sub);
});

test("submissionToMailto subject falls back to partners then note excerpt", () => {
  const u = submissionToMailto(buildSubmission("union", { partners: ["a", "b"] }), "x@y.z");
  assert.equal(decodeURIComponent(u.match(/subject=([^&]*)/)[1]), "Généalogie - union - a & b");
  const r = submissionToMailto(buildSubmission("remarque", { note: "Petite remarque sur la frise" }), "x@y.z");
  assert.equal(decodeURIComponent(r.match(/subject=([^&]*)/)[1]), "Généalogie - remarque - Petite remarque sur la frise");
});
