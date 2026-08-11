import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGraph } from "../js/data.js";
import { assignGenerations } from "../js/generations.js";

const person = (id) => ({
  id,
  firstNames: id,
  lastName: "Test",
  birthName: null,
  sex: null,
  birth: null,
  death: null,
  photo: null,
  bio: null
});

const union = (id, partners, children) => ({ id, partners, date: null, children });

test("chaine lineaire sur trois generations : 0 / 1 / 2", () => {
  const data = {
    persons: [person("a"), person("b"), person("c")],
    unions: [
      union("u1", ["a"], ["b"]),
      union("u2", ["b"], ["c"])
    ]
  };
  const gen = assignGenerations(buildGraph(data));
  assert.equal(gen.get("a"), 0);
  assert.equal(gen.get("b"), 1);
  assert.equal(gen.get("c"), 2);
});

test("conjoint sans ancetres tire au niveau de son partenaire", () => {
  const data = {
    persons: [person("papa"), person("maman"), person("fils"), person("belle-fille")],
    unions: [
      union("u1", ["papa", "maman"], ["fils"]),
      union("u2", ["fils", "belle-fille"], [])
    ]
  };
  const gen = assignGenerations(buildGraph(data));
  assert.equal(gen.get("papa"), 0);
  assert.equal(gen.get("maman"), 0);
  assert.equal(gen.get("fils"), 1);
  assert.equal(gen.get("belle-fille"), 1);
});

test("remariage : la personne remariee garde une seule generation", () => {
  const data = {
    persons: [
      person("aieul"), person("aieule"),
      person("marc"), person("premiere"), person("seconde"),
      person("enfant1"), person("enfant2")
    ],
    unions: [
      union("u0", ["aieul", "aieule"], ["marc"]),
      union("u1", ["marc", "premiere"], ["enfant1"]),
      union("u2", ["marc", "seconde"], ["enfant2"])
    ]
  };
  const gen = assignGenerations(buildGraph(data));
  assert.equal(gen.get("marc"), 1);
  assert.equal(gen.get("premiere"), 1);
  assert.equal(gen.get("seconde"), 1);
  assert.equal(gen.get("enfant1"), 2);
  assert.equal(gen.get("enfant2"), 2);
});

test("mariage inter-generations : le point fixe propage la remontee", () => {
  // p est racine mais epouse q, dont les parents a et b sont racines un
  // niveau plus haut. p doit monter a 1 ; par ricochet sa conjointe z
  // monte a 1 et leur enfant k a 2. Une seule passe ne suffit pas :
  // u3 est traitee apres u2, donc la remontee de p exige une 2e passe.
  const data = {
    persons: [
      person("a"), person("b"), person("q"),
      person("p"), person("z"), person("k")
    ],
    unions: [
      union("u1", ["a", "b"], ["q"]),
      union("u2", ["p", "z"], ["k"]),
      union("u3", ["p", "q"], [])
    ]
  };
  const gen = assignGenerations(buildGraph(data));
  assert.equal(gen.get("a"), 0);
  assert.equal(gen.get("b"), 0);
  assert.equal(gen.get("q"), 1);
  assert.equal(gen.get("p"), 1);
  assert.equal(gen.get("z"), 1);
  assert.equal(gen.get("k"), 2);
});

test("cycle dans les donnees : erreur en francais, pas de boucle infinie", () => {
  // a est enfant de l'union de b, b est enfant de l'union de a.
  // Chaque personne reste enfant d'au plus une union, mais les niveaux
  // montent a chaque passe : la garde (passes bornees par le nombre de
  // personnes) doit lever une erreur.
  const data = {
    persons: [person("a"), person("b")],
    unions: [
      union("ua", ["a"], ["b"]),
      union("ub", ["b"], ["a"])
    ]
  };
  assert.throws(() => assignGenerations(buildGraph(data)), /générations/);
});
