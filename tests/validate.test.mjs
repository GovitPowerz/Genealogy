import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateData } from "../tools/validate.mjs";

function person(over = {}) {
  return {
    id: "jean-dupont",
    firstNames: "Jean",
    lastName: "Dupont",
    birthName: null,
    sex: "M",
    birth: { date: "1950-03-14", place: "Lyon" },
    death: null,
    photo: null,
    bio: null,
    ...over,
  };
}

function validFixture() {
  return {
    persons: [
      person(),
      person({ id: "marie-dupont", firstNames: "Marie", sex: "F" }),
      person({ id: "paul-dupont", firstNames: "Paul", birth: { date: "1980", place: null } }),
    ],
    unions: [
      {
        id: "u-jean-marie",
        partners: ["jean-dupont", "marie-dupont"],
        date: "1975",
        children: ["paul-dupont"],
      },
    ],
  };
}

test("fixture valide: aucune erreur", () => {
  assert.deepEqual(validateData(validFixture(), { checkPhotos: false }), []);
});

test("identifiant de personne en double", () => {
  const data = validFixture();
  data.persons.push(person());
  assert.deepEqual(validateData(data, { checkPhotos: false }), [
    'Identifiant de personne en double: "jean-dupont"',
  ]);
});

test("champ obligatoire manquant", () => {
  const data = validFixture();
  delete data.persons[0].lastName;
  assert.deepEqual(validateData(data, { checkPhotos: false }), [
    'Personne "jean-dupont": champ obligatoire "lastName" manquant',
  ]);
});

test("valeur de sex invalide", () => {
  const data = validFixture();
  data.persons[0].sex = "X";
  assert.deepEqual(validateData(data, { checkPhotos: false }), [
    'Personne "jean-dupont": valeur de "sex" invalide: "X" (attendu "M", "F" ou null)',
  ]);
});

test("format de date invalide", () => {
  const data = validFixture();
  data.persons[0].birth = { date: "14/03/1950", place: "Lyon" };
  assert.deepEqual(validateData(data, { checkPhotos: false }), [
    'Personne "jean-dupont": date de naissance invalide: "14/03/1950" (format attendu AAAA, AAAA-MM ou AAAA-MM-JJ)',
  ]);
});

test("union sans partenaire", () => {
  const data = validFixture();
  data.unions[0].partners = [];
  assert.deepEqual(validateData(data, { checkPhotos: false }), [
    'Union "u-jean-marie": nombre de partenaires invalide: 0 (attendu 1 ou 2)',
  ]);
});

test("union avec trois partenaires", () => {
  const data = validFixture();
  data.unions[0].partners = ["jean-dupont", "marie-dupont", "paul-dupont"];
  assert.deepEqual(validateData(data, { checkPhotos: false }), [
    'Union "u-jean-marie": nombre de partenaires invalide: 3 (attendu 1 ou 2)',
  ]);
});

test("partenaire inconnu", () => {
  const data = validFixture();
  data.unions[0].partners = ["jean-dupont", "fantome"];
  assert.deepEqual(validateData(data, { checkPhotos: false }), [
    'Union "u-jean-marie": partenaire inconnu: "fantome"',
  ]);
});

test("enfant inconnu", () => {
  const data = validFixture();
  data.unions[0].children = ["paul-dupont", "fantome"];
  assert.deepEqual(validateData(data, { checkPhotos: false }), [
    'Union "u-jean-marie": enfant inconnu: "fantome"',
  ]);
});

test("enfant de plusieurs unions", () => {
  const data = validFixture();
  data.unions.push({
    id: "u-jean-bis",
    partners: ["jean-dupont"],
    date: null,
    children: ["paul-dupont"],
  });
  assert.deepEqual(validateData(data, { checkPhotos: false }), [
    'Personne "paul-dupont": enfant de plusieurs unions ("u-jean-marie" et "u-jean-bis")',
  ]);
});

test("photo introuvable avec checkPhotos", () => {
  const data = validFixture();
  data.persons[0].photo = "assets/photos/fantome.jpg";
  assert.deepEqual(validateData(data, { checkPhotos: true }), [
    'Personne "jean-dupont": photo introuvable: "assets/photos/fantome.jpg"',
  ]);
});

test("data/family.json est valide", () => {
  const raw = readFileSync(new URL("../data/family.json", import.meta.url), "utf8");
  assert.deepEqual(validateData(JSON.parse(raw), { checkPhotos: false }), []);
});
