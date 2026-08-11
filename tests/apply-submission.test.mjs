import test from "node:test";
import assert from "node:assert/strict";
import { applySubmission } from "../tools/apply-submission.mjs";
import { validateData } from "../tools/validate.mjs";

function person(id, firstNames, lastName, extra = {}) {
  return {
    id,
    firstNames,
    lastName,
    birthName: null,
    sex: null,
    birth: null,
    death: null,
    photo: null,
    bio: null,
    ...extra,
  };
}

function baseData() {
  return {
    persons: [
      person("jean-durand", "Jean", "Durand", { sex: "M", birth: { date: "1960", place: "Lyon" } }),
      person("anne-petit", "Anne", "Petit", { sex: "F" }),
      person("luc-durand", "Luc", "Durand", { sex: "M", birth: { date: "1988", place: "Lyon" } }),
      person("eva-durand", "Eva", "Durand", { sex: "F" }),
    ],
    unions: [
      { id: "u-jean-anne", partners: ["jean-durand", "anne-petit"], date: "1985", children: ["luc-durand"] },
    ],
  };
}

function makeSub(type, payload, extra = {}) {
  return { version: 1, type, payload, note: null, submitterName: null, ...extra };
}

test("ajout-personne : id slug, personne ajoutee, entree non mutee, resultat valide", () => {
  const data = baseData();
  const result = applySubmission(data, makeSub("ajout-personne", { firstNames: "Zoé", lastName: "Bérard" }));
  const added = result.data.persons.find((p) => p.id === "zoe-berard");
  assert.ok(added, "la personne ajoutee doit avoir l'id slug zoe-berard");
  assert.equal(added.firstNames, "Zoé");
  assert.equal(added.birthName, null);
  assert.equal(result.data.persons.length, 5);
  assert.match(result.summary, /Zoé Bérard/);
  assert.deepEqual(data, baseData(), "applySubmission ne doit pas muter son entree");
  assert.deepEqual(validateData(result.data, { checkPhotos: false }), []);
});

test("ajout-personne : collision d'id -> suffixes -2 puis -3", () => {
  const first = applySubmission(baseData(), makeSub("ajout-personne", { firstNames: "Jean", lastName: "Durand" }));
  assert.ok(first.data.persons.some((p) => p.id === "jean-durand-2"));
  const second = applySubmission(first.data, makeSub("ajout-personne", { firstNames: "Jean", lastName: "Durand" }));
  assert.ok(second.data.persons.some((p) => p.id === "jean-durand-3"));
});

test("ajout-personne : parents.unionId rattache l'enfant a cette union", () => {
  const result = applySubmission(baseData(), makeSub("ajout-personne", {
    firstNames: "Paul",
    lastName: "Durand",
    parents: { unionId: "u-jean-anne" },
  }));
  const union = result.data.unions.find((u) => u.id === "u-jean-anne");
  assert.deepEqual(union.children, ["luc-durand", "paul-durand"]);
  assert.equal(result.data.unions.length, 1);
});

test("ajout-personne : parents.parentIds retrouve l'union existante malgre l'ordre inverse", () => {
  const result = applySubmission(baseData(), makeSub("ajout-personne", {
    firstNames: "Paul",
    lastName: "Durand",
    parents: { parentIds: ["anne-petit", "jean-durand"] },
  }));
  assert.equal(result.data.unions.length, 1, "aucune union ne doit etre creee");
  assert.ok(result.data.unions[0].children.includes("paul-durand"));
});

test("ajout-personne : parents.parentIds cree l'union quand aucune ne correspond", () => {
  const result = applySubmission(baseData(), makeSub("ajout-personne", {
    firstNames: "Paul",
    lastName: "Petit",
    parents: { parentIds: ["anne-petit"] },
  }));
  const union = result.data.unions.find((u) => u.id === "u-anne-petit");
  assert.ok(union, "union monoparentale u-anne-petit attendue");
  assert.deepEqual(union.partners, ["anne-petit"]);
  assert.deepEqual(union.children, ["paul-petit"]);
  assert.equal(result.data.unions.length, 2);
  assert.deepEqual(validateData(result.data, { checkPhotos: false }), []);
});

test("ajout-personne : photoPromised declenche le rappel photo dans le resume", () => {
  const result = applySubmission(baseData(), makeSub("ajout-personne", {
    firstNames: "Zoé",
    lastName: "Bérard",
    photoPromised: true,
  }));
  assert.match(result.summary, /assets\/photos\/zoe-berard\.jpg/);
});

test("correction-personne : ecrase uniquement les champs fournis", () => {
  const result = applySubmission(baseData(), makeSub("correction-personne", {
    id: "jean-durand",
    bio: "Nouveau texte",
    birth: { date: "1961", place: "Paris" },
  }));
  const p = result.data.persons.find((x) => x.id === "jean-durand");
  assert.equal(p.bio, "Nouveau texte");
  assert.deepEqual(p.birth, { date: "1961", place: "Paris" });
  assert.equal(p.sex, "M", "les champs non fournis restent intacts");
  assert.equal(p.firstNames, "Jean");
  assert.match(result.summary, /birth, bio/);
  assert.deepEqual(validateData(result.data, { checkPhotos: false }), []);
});

test("correction-personne : id inconnu leve une erreur francaise", () => {
  assert.throws(
    () => applySubmission(baseData(), makeSub("correction-personne", { id: "nexiste-pas", bio: "x" })),
    /inconnue/
  );
});

test("union : partenaires existants (ordre inverse) -> date mise a jour, enfants fusionnes dedupliques", () => {
  const result = applySubmission(baseData(), makeSub("union", {
    partners: ["anne-petit", "jean-durand"],
    date: "1986",
    children: ["eva-durand", "luc-durand"],
  }));
  assert.equal(result.data.unions.length, 1);
  const union = result.data.unions[0];
  assert.equal(union.date, "1986");
  assert.deepEqual(union.children, ["luc-durand", "eva-durand"]);
  assert.deepEqual(validateData(result.data, { checkPhotos: false }), []);
});

test("union : nouveau couple -> creation avec id u-<id1>-<id2>", () => {
  const result = applySubmission(baseData(), makeSub("union", {
    partners: ["luc-durand", "eva-durand"],
    date: null,
    children: [],
  }));
  assert.equal(result.data.unions.length, 2);
  const union = result.data.unions.find((u) => u.id === "u-luc-durand-eva-durand");
  assert.ok(union);
  assert.deepEqual(union.partners, ["luc-durand", "eva-durand"]);
  assert.deepEqual(validateData(result.data, { checkPhotos: false }), []);
});

test("remarque : donnees strictement identiques, note et auteur dans le resume", () => {
  const note = "Le portrait de Jean date de 1975.";
  const result = applySubmission(baseData(), makeSub("remarque", null, { note, submitterName: "Tante Michèle" }));
  assert.deepEqual(result.data, baseData());
  assert.ok(result.summary.includes(note));
  assert.ok(result.summary.includes("Tante Michèle"));
});

test("type de soumission inconnu -> erreur", () => {
  assert.throws(() => applySubmission(baseData(), makeSub("suppression", {})), /inconnu/);
});
