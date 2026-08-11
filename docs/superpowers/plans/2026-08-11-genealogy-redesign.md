# Genealogy Site Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the static genealogy site into a French-language, four-rendering family tree (Manuscrit, Ciel étoilé, Hologramme, Frise du temps) with a no-dev contribution flow, on GitHub Pages with zero dependencies.

**Architecture:** A shared kinship-graph core (data, generations, layout) feeds interchangeable theme modules that each draw a complete world into one SVG stage (plus a canvas backdrop for effects). Shared engine code owns pan/zoom, the person panel, search fly-to, and URL-hash state. Contributions are structured JSON built by a static form and emailed to the maintainer, who applies them with a local Node tool guarded by a validator that also runs in CI.

**Tech Stack:** Plain HTML/CSS/JS (ES2022 modules), SVG + canvas, `node --test`, GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-08-11-genealogy-redesign-design.md` (approved). The pinned module contract lives in each task's Interfaces block.

## Global Constraints

- Zero runtime dependencies; no build step; GitHub Pages serves the repo root. `package.json` exists only for `"type": "module"` and the `test`/`validate` scripts.
- All UI text in French; code identifiers in English.
- No em dashes, no smart quotes, no decorative Unicode in code or UI strings; accented French letters are fine. Copy-paste-safe code.
- Code style: ES2022, `const`/`let`, semicolons, 2-space indent, no speculative abstractions.
- Dates are strings `"YYYY"`, `"YYYY-MM"`, or `"YYYY-MM-DD"`; `death: null` means living; `sex` is `"M"`, `"F"`, or `null`; a person is child of at most one union; required person fields `id`, `firstNames`, `lastName`.
- Tests use small inline fixtures, never the contents of `data/family.json` (exception: Task 1's validator sanity pass).
- All work on branch `feature/genealogy-redesign`; never commit to `main`; never push.
- Every commit message ends with a blank line then `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`; prefixes `feat:`/`test:`/`chore:`/`docs:`.

## File Structure

```
index.html            app shell: toolbar, search, canvas#backdrop, svg#stage, aside#panel
contribute.html       family contribution form (French, no login)
data/family.json      persons[] + unions[]
assets/photos/        portraits, <id>.<ext>
css/                  base.css + one file per theme + contribute.css
js/
  data.js             buildGraph, loadFamily, yearOf, formatDateFr
  generations.js      assignGenerations (fixpoint BFS)
  layout.js           SPACING, computeLayout (barycenter ordering)
  panzoom.js          createPanZoom (viewBox drag/wheel/pinch/flyTo)
  panel.js            showPanel/hidePanel (person detail)
  search.js           normalize, searchPersons
  main.js             boot, theme registry wiring, parseHash/buildHash
  themes/index.js     THEMES registry (order: manuscrit, ciel, hologramme, frise)
  themes/<id>.js      one module per theme, default export {id, label, className, render}
  contribute.js       slugify, buildSubmission, submissionToMailto + form wiring
tools/
  validate.mjs        validateData + CLI (French errors, exit 1)
  apply-submission.mjs applySubmission + CLI (--dry-run)
tests/                node --test suites
.github/workflows/validate.yml
.nojekyll  package.json
```

Task order: 1 scaffold/data/validator, 2 graph, 3 generations, 4 layout, 5 app shell, 6 panel+search, 7-10 themes (numeric order; each task pins the exact THEMES registry state it leaves behind), 11 contribute page, 12 apply tool, 13 CI+README, 14 final verification.

---


---

### Task 1: Scaffold, starter data, validator

**Files:**
- Create: `package.json`
- Create: `.nojekyll`
- Create: `data/family.json`
- Create: `tools/validate.mjs`
- Test: `tests/validate.test.mjs`

**Interfaces:**
- Consumes: nothing (first task; the old `index.html`/`script.js`/`styles.css` stay untouched until Task 5).
- Produces:
  - `export function validateData(data, opts = {}) -> string[]` in `tools/validate.mjs`. French error messages, empty array = valid. `opts.checkPhotos` (default `true`) checks `photo` paths on disk relative to the cwd. Task 12 imports it with `import { validateData } from "./validate.mjs";` and Task 13's workflow runs `node tools/validate.mjs`.
  - `data/family.json` shaped `{ persons: Person[], unions: Union[] }` with Person `{ id, firstNames, lastName, birthName, sex, birth: {date, place}|null, death: {date, place}|null, photo, bio }` and Union `{ id, partners: [personId] (1 or 2), date: string|null, children: [personId] }`. Later tasks load it at runtime only; their tests use inline fixtures.
  - `package.json` with `"type": "module"` plus `npm test` (`node --test tests/`) and `npm run validate` scripts used by every later task.

Constraints to keep in mind for the whole task: zero dependencies, no build step, Node built-ins only. ES2022, `const`/`let`, semicolons, 2-space indent. All human-readable messages in French; code identifiers in English. No em dashes, no smart quotes, no decorative Unicode anywhere; accented French letters are fine. Dates match `^\d{4}(-\d{2}){0,2}$`. Required person fields: `id`, `firstNames`, `lastName`; `sex` is `"M"`, `"F"`, or `null`; a person is child of at most one union.

- [ ] **Step 1: Create the feature branch**

```bash
cd /Users/govit/Git/Govit/Genealogy
git switch feature/genealogy-redesign 2>/dev/null || git switch -c feature/genealogy-redesign
```

Never commit to `main`. Every later task keeps working on this branch.

- [ ] **Step 2: Create package.json, .nojekyll, and directories**

```bash
mkdir -p data tools tests
touch .nojekyll
```

`.nojekyll` stays empty; it tells GitHub Pages to serve the repo root as-is without Jekyll processing.

Write `package.json` with exactly this content:

```json
{
  "name": "genealogy",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/",
    "validate": "node tools/validate.mjs"
  }
}
```

No dependencies, ever. `"type": "module"` is what lets both browser `js/` files and Node `tools/` files use ES module syntax.

- [ ] **Step 3: Create data/family.json (starter family)**

Fictional French family: 12 persons, 3 generations. It exercises every edge case the themes and tools need: grandparent couple both deceased with full dates (Henri, Jeanne), their two children with spouses (Pierre, Françoise), one remarriage (Pierre has two unions, each with children), one single-parent union (`u-annie`, one partner), living grandchildren with mixed date precision (Julien and Camille have year-only births), all `photo` null, French bios for 4 persons. Formatting is exactly what `JSON.stringify(data, null, 2)` emits, so Task 12's rewrite produces clean diffs. Key order per person follows the spec example: id, firstNames, lastName, birthName, sex, birth, death, photo, bio.

Write `data/family.json`:

```json
{
  "persons": [
    {
      "id": "henri-moreau",
      "firstNames": "Henri",
      "lastName": "Moreau",
      "birthName": null,
      "sex": "M",
      "birth": {
        "date": "1921-03-14",
        "place": "Angers"
      },
      "death": {
        "date": "1998-11-02",
        "place": "Angers"
      },
      "photo": null,
      "bio": "Menuisier à Angers pendant quarante ans. Il a construit lui-même la maison familiale de la rue des Lices."
    },
    {
      "id": "jeanne-moreau",
      "firstNames": "Jeanne",
      "lastName": "Moreau",
      "birthName": "Aubert",
      "sex": "F",
      "birth": {
        "date": "1925-07-08",
        "place": "Saumur"
      },
      "death": {
        "date": "2010-04-21",
        "place": "Angers"
      },
      "photo": null,
      "bio": "Institutrice à Saumur puis à Angers. Réputée pour ses confitures de coing et sa mémoire infaillible des dates d'anniversaire."
    },
    {
      "id": "pierre-moreau",
      "firstNames": "Pierre",
      "lastName": "Moreau",
      "birthName": null,
      "sex": "M",
      "birth": {
        "date": "1949-05-17",
        "place": "Angers"
      },
      "death": null,
      "photo": null,
      "bio": "Ingénieur des travaux publics. A participé au chantier du pont de l'île de Ré avant de revenir s'installer en Anjou."
    },
    {
      "id": "annie-lefevre",
      "firstNames": "Annie",
      "lastName": "Lefèvre",
      "birthName": null,
      "sex": "F",
      "birth": {
        "date": "1951-10-02",
        "place": "Tours"
      },
      "death": null,
      "photo": null,
      "bio": null
    },
    {
      "id": "sylvie-garnier",
      "firstNames": "Sylvie",
      "lastName": "Garnier",
      "birthName": null,
      "sex": "F",
      "birth": {
        "date": "1956-04-19",
        "place": "Nantes"
      },
      "death": null,
      "photo": null,
      "bio": null
    },
    {
      "id": "francoise-petit",
      "firstNames": "Françoise",
      "lastName": "Petit",
      "birthName": "Moreau",
      "sex": "F",
      "birth": {
        "date": "1953-09-30",
        "place": "Angers"
      },
      "death": null,
      "photo": null,
      "bio": null
    },
    {
      "id": "marc-petit",
      "firstNames": "Marc",
      "lastName": "Petit",
      "birthName": null,
      "sex": "M",
      "birth": {
        "date": "1950-01-25",
        "place": "Cholet"
      },
      "death": null,
      "photo": null,
      "bio": null
    },
    {
      "id": "claire-moreau",
      "firstNames": "Claire",
      "lastName": "Moreau",
      "birthName": null,
      "sex": "F",
      "birth": {
        "date": "1974-02-11",
        "place": "Tours"
      },
      "death": null,
      "photo": null,
      "bio": "Libraire à Tours. C'est elle qui garde les albums photos et les archives de la famille."
    },
    {
      "id": "julien-moreau",
      "firstNames": "Julien",
      "lastName": "Moreau",
      "birthName": null,
      "sex": "M",
      "birth": {
        "date": "1977",
        "place": "Tours"
      },
      "death": null,
      "photo": null,
      "bio": null
    },
    {
      "id": "thomas-moreau",
      "firstNames": "Thomas",
      "lastName": "Moreau",
      "birthName": null,
      "sex": "M",
      "birth": {
        "date": "1990-06",
        "place": "Nantes"
      },
      "death": null,
      "photo": null,
      "bio": null
    },
    {
      "id": "lucie-petit",
      "firstNames": "Lucie",
      "lastName": "Petit",
      "birthName": null,
      "sex": "F",
      "birth": {
        "date": "1979-12-03",
        "place": "Angers"
      },
      "death": null,
      "photo": null,
      "bio": null
    },
    {
      "id": "camille-lefevre",
      "firstNames": "Camille",
      "lastName": "Lefèvre",
      "birthName": null,
      "sex": null,
      "birth": {
        "date": "1984",
        "place": "Tours"
      },
      "death": null,
      "photo": null,
      "bio": null
    }
  ],
  "unions": [
    {
      "id": "u-henri-jeanne",
      "partners": [
        "henri-moreau",
        "jeanne-moreau"
      ],
      "date": "1947-06-21",
      "children": [
        "pierre-moreau",
        "francoise-petit"
      ]
    },
    {
      "id": "u-pierre-annie",
      "partners": [
        "pierre-moreau",
        "annie-lefevre"
      ],
      "date": "1972",
      "children": [
        "claire-moreau",
        "julien-moreau"
      ]
    },
    {
      "id": "u-pierre-sylvie",
      "partners": [
        "pierre-moreau",
        "sylvie-garnier"
      ],
      "date": "1988-09",
      "children": [
        "thomas-moreau"
      ]
    },
    {
      "id": "u-francoise-marc",
      "partners": [
        "francoise-petit",
        "marc-petit"
      ],
      "date": "1975",
      "children": [
        "lucie-petit"
      ]
    },
    {
      "id": "u-annie",
      "partners": [
        "annie-lefevre"
      ],
      "date": null,
      "children": [
        "camille-lefevre"
      ]
    }
  ]
}
```

- [ ] **Step 4: Commit the scaffold**

```bash
git add package.json .nojekyll data/family.json
git commit -m "$(cat <<'EOF'
chore: scaffold project and add starter family data

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Write the failing validator tests**

Each test pins the exact French message so the implementation cannot drift. The fixture is inline; only the last sanity test reads `data/family.json` (allowed for this task only).

Write `tests/validate.test.mjs`:

```js
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
```

Note the single-parent union in the "enfant de plusieurs unions" fixture (`u-jean-bis`, one partner): it doubles as proof that 1-partner unions are accepted.

- [ ] **Step 6: Run the tests, expect failure**

Run: `node --test tests/validate.test.mjs` (from the repo root)

Expected: FAIL. The whole file errors during load with `ERR_MODULE_NOT_FOUND` (`Cannot find module .../tools/validate.mjs`). If it fails for any other reason, fix the test file before moving on.

- [ ] **Step 7: Implement tools/validate.mjs**

Write `tools/validate.mjs`:

```js
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const DATE_RE = /^\d{4}(-\d{2}){0,2}$/;
const DATE_HINT = "(format attendu AAAA, AAAA-MM ou AAAA-MM-JJ)";
const REQUIRED_PERSON_FIELDS = ["id", "firstNames", "lastName"];

export function validateData(data, opts = {}) {
  const { checkPhotos = true } = opts;
  const errors = [];

  if (!data || !Array.isArray(data.persons) || !Array.isArray(data.unions)) {
    return ["Structure invalide: attendu un objet { persons: [...], unions: [...] }"];
  }

  const personIds = new Set();
  data.persons.forEach((p, i) => {
    if (!p || typeof p !== "object") {
      errors.push(`Personne #${i}: entrée invalide`);
      return;
    }
    const hasId = typeof p.id === "string" && p.id !== "";
    const label = hasId ? `"${p.id}"` : `#${i}`;
    for (const field of REQUIRED_PERSON_FIELDS) {
      if (typeof p[field] !== "string" || p[field] === "") {
        errors.push(`Personne ${label}: champ obligatoire "${field}" manquant`);
      }
    }
    if (hasId) {
      if (personIds.has(p.id)) {
        errors.push(`Identifiant de personne en double: "${p.id}"`);
      }
      personIds.add(p.id);
    }
    if (p.sex !== undefined && p.sex !== null && p.sex !== "M" && p.sex !== "F") {
      errors.push(`Personne ${label}: valeur de "sex" invalide: "${p.sex}" (attendu "M", "F" ou null)`);
    }
    if (p.birth && p.birth.date != null && !DATE_RE.test(p.birth.date)) {
      errors.push(`Personne ${label}: date de naissance invalide: "${p.birth.date}" ${DATE_HINT}`);
    }
    if (p.death && p.death.date != null && !DATE_RE.test(p.death.date)) {
      errors.push(`Personne ${label}: date de décès invalide: "${p.death.date}" ${DATE_HINT}`);
    }
    if (checkPhotos && typeof p.photo === "string" && p.photo !== "" && !existsSync(p.photo)) {
      errors.push(`Personne ${label}: photo introuvable: "${p.photo}"`);
    }
  });

  const unionIds = new Set();
  const parentUnionOfChild = new Map();
  data.unions.forEach((u, i) => {
    if (!u || typeof u !== "object") {
      errors.push(`Union #${i}: entrée invalide`);
      return;
    }
    const hasId = typeof u.id === "string" && u.id !== "";
    const label = hasId ? `"${u.id}"` : `#${i}`;
    if (!hasId) {
      errors.push(`Union ${label}: champ obligatoire "id" manquant`);
    } else {
      if (unionIds.has(u.id)) {
        errors.push(`Identifiant d'union en double: "${u.id}"`);
      }
      unionIds.add(u.id);
    }
    const partners = Array.isArray(u.partners) ? u.partners : [];
    if (partners.length < 1 || partners.length > 2) {
      errors.push(`Union ${label}: nombre de partenaires invalide: ${partners.length} (attendu 1 ou 2)`);
    }
    for (const pid of partners) {
      if (!personIds.has(pid)) {
        errors.push(`Union ${label}: partenaire inconnu: "${pid}"`);
      }
    }
    if (u.date != null && !DATE_RE.test(u.date)) {
      errors.push(`Union ${label}: date invalide: "${u.date}" ${DATE_HINT}`);
    }
    const children = Array.isArray(u.children) ? u.children : [];
    for (const cid of children) {
      if (!personIds.has(cid)) {
        errors.push(`Union ${label}: enfant inconnu: "${cid}"`);
      }
      if (parentUnionOfChild.has(cid)) {
        errors.push(`Personne "${cid}": enfant de plusieurs unions (${parentUnionOfChild.get(cid)} et ${label})`);
      } else {
        parentUnionOfChild.set(cid, label);
      }
    }
  });

  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2] ?? "data/family.json";
  let data;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    console.error(`Impossible de lire ${path}: ${err.message}`);
    process.exit(1);
  }
  const errors = validateData(data, { checkPhotos: true });
  if (errors.length > 0) {
    for (const e of errors) console.error(e);
    console.error(`${errors.length} erreur(s).`);
    process.exit(1);
  }
  console.log(`Données valides: ${data.persons.length} personnes, ${data.unions.length} unions.`);
}
```

Design notes, so nobody "improves" this later: the CLI guard compares `import.meta.url` against `pathToFileURL(process.argv[1]).href` so importing the module (Task 12, tests) never triggers the CLI. `checkPhotos` defaults to `true` and resolves photo paths relative to the cwd, which is the repo root both for the CLI and for `npm test`. The multi-union check stores the first union label per child, so the error names both unions in encounter order.

- [ ] **Step 8: Run the tests, expect pass**

Run: `node --test tests/validate.test.mjs`

Expected: PASS. 12 tests, 12 pass, 0 fail.

- [ ] **Step 9: Check the CLI and npm wiring**

```bash
npm test
node tools/validate.mjs
node tools/validate.mjs nope.json; echo "exit=$?"
npm run validate
```

Expected, in order:
- `npm test`: same 12 tests pass.
- `node tools/validate.mjs`: prints `Données valides: 12 personnes, 5 unions.` and exits 0.
- The `nope.json` line: prints `Impossible de lire nope.json: ...` on stderr, then `exit=1`.
- `npm run validate`: same valid output as the direct call.

- [ ] **Step 10: Commit the validator**

```bash
git add tools/validate.mjs tests/validate.test.mjs
git commit -m "$(cat <<'EOF'
feat: add data validator with French error messages

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Kinship graph core (js/data.js)

**Files:**
- Create: `js/data.js` (new module; built up across the steps below)
- Create: `tests/data.test.mjs` (new test file; built up across the steps below)
- Test: `node --test tests/data.test.mjs`

**Interfaces:**

Consumes (from Task 1):
- `package.json` at repo root containing `{"type":"module"}` so every `.js`/`.mjs` file loads as an ES module under node. No JS imports from earlier tasks.

Produces (later tasks import these from `js/data.js` - signatures are frozen, do not deviate):
- `export function buildGraph(data)` -> `{ persons: Map<id, Person>, unions: Map<id, Union>, parentUnionOf: Map<personId, unionId>, unionsOf: Map<personId, unionId[]>, warnings: string[], parentsOf(id) -> Person[], childrenOf(id) -> Person[], partnersOf(id) -> Person[], siblingsOf(id) -> Person[] }` - used by Task 3 `assignGenerations(graph)`, Task 4 `computeLayout(graph, generations)`, Tasks 5/6 (main, panel, search).
- `export async function loadFamily(url = "data/family.json")` -> `Promise<{ data, graph }>`, throws `Error` with a French message on HTTP or parse failure - used by Task 5 `main.js` boot.
- `export function yearOf(dateStr)` -> `int|null` - used by Task 4 layout and Task 7 frise.
- `export function formatDateFr(dateStr)` -> `"17 mai 1942" | "mai 1942" | "1942" | ""` - used by Task 6 panel.

Context you need (restated from the contract):
- Data shape: `{ persons: Person[], unions: Union[] }`. `Person: { id, firstNames, lastName, birthName, sex, birth: {date, place}|null, death: {date, place}|null, photo, bio }`. `Union: { id, partners: [personId] (1 or 2), date: string|null, children: [personId] }`. Dates are `"YYYY" | "YYYY-MM" | "YYYY-MM-DD"`. A person is child of at most one union.
- `siblingsOf` includes half-siblings: children of ANY union involving either parent, deduplicated, self excluded, sorted by birth year. Decision for this task: persons with unknown birth sort last; two unknown births compare equal (comparator returns 0, keeping encounter order) - never map unknown to Infinity, since Infinity - Infinity is NaN and makes the comparator inconsistent.
- Dangling person refs inside unions are dropped from the graph with a French warning pushed to `warnings`; a union whose partners all vanish is dropped entirely (with its own warning). Input `data` is never mutated.
- French months, lowercase: janvier, février, mars, avril, mai, juin, juillet, août, septembre, octobre, novembre, décembre.
- Tests use small INLINE fixtures only - never read `data/family.json`.
- `loadFamily` is a thin `fetch` wrapper and is deliberately excluded from node tests (no `fetch`-able server in unit tests); it is exercised by the Task 5 browser boot check.
- Style: ES2022, `const`/`let`, semicolons, 2-space indent, no classes. All work happens on the feature branch created in Task 1 - never commit to `main`.

- [ ] **Step 1: Write failing tests for yearOf and formatDateFr**

Create `tests/data.test.mjs` with exactly:

```js
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
```

- [ ] **Step 2: Run the tests, confirm they fail for the right reason**

Run: `node --test tests/data.test.mjs`
Expected: FAIL - `ERR_MODULE_NOT_FOUND` for `../js/data.js` (the module does not exist yet). If you see any other error, fix the test file before moving on.

- [ ] **Step 3: Implement yearOf and formatDateFr**

Create `js/data.js` with exactly:

```js
const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export function yearOf(dateStr) {
  if (!dateStr) return null;
  const m = /^(\d{4})/.exec(dateStr);
  return m ? Number(m[1]) : null;
}

export function formatDateFr(dateStr) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  if (!month) return year;
  const monthName = MONTHS_FR[Number(month) - 1];
  if (!day) return `${monthName} ${year}`;
  return `${Number(day)} ${monthName} ${year}`;
}
```

- [ ] **Step 4: Run the tests, confirm green**

Run: `node --test tests/data.test.mjs`
Expected: PASS - 5 tests, 0 failures.

- [ ] **Step 5: Commit the date helpers**

```bash
git add js/data.js tests/data.test.mjs
git commit -m "$(cat <<'EOF'
feat: date helpers yearOf and formatDateFr

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Write failing tests for buildGraph lookups on a 3-generation fixture**

In `tests/data.test.mjs`, replace the import line at the top with:

```js
import { buildGraph, yearOf, formatDateFr } from "../js/data.js";
```

Then append at the end of the file:

```js
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
```

- [ ] **Step 7: Run the tests, confirm the new ones fail for the right reason**

Run: `node --test tests/data.test.mjs`
Expected: FAIL - `SyntaxError: The requested module '../js/data.js' does not provide an export named 'buildGraph'`. The whole file aborts (the 5 earlier tests do not run); that is normal for an ESM import failure.

- [ ] **Step 8: Implement buildGraph (indexes + lookup helpers, plain siblings only)**

Append to `js/data.js`:

```js
export function buildGraph(data) {
  const persons = new Map(data.persons.map((p) => [p.id, p]));
  const unions = new Map(data.unions.map((u) => [u.id, u]));
  const warnings = [];

  const parentUnionOf = new Map();
  const unionsOf = new Map();
  for (const u of unions.values()) {
    for (const pid of u.partners) {
      if (!unionsOf.has(pid)) unionsOf.set(pid, []);
      unionsOf.get(pid).push(u.id);
    }
    for (const cid of u.children) parentUnionOf.set(cid, u.id);
  }

  const parentsOf = (id) => {
    const uid = parentUnionOf.get(id);
    if (uid === undefined) return [];
    return unions.get(uid).partners.map((pid) => persons.get(pid));
  };

  const childrenOf = (id) => {
    const uids = unionsOf.get(id) || [];
    return uids
      .flatMap((uid) => unions.get(uid).children)
      .map((cid) => persons.get(cid));
  };

  const partnersOf = (id) => {
    const uids = unionsOf.get(id) || [];
    return uids
      .flatMap((uid) => unions.get(uid).partners)
      .filter((pid) => pid !== id)
      .map((pid) => persons.get(pid));
  };

  const siblingsOf = (id) => {
    const uid = parentUnionOf.get(id);
    if (uid === undefined) return [];
    return unions.get(uid).children
      .filter((cid) => cid !== id)
      .map((cid) => persons.get(cid));
  };

  return {
    persons, unions, parentUnionOf, unionsOf, warnings,
    parentsOf, childrenOf, partnersOf, siblingsOf,
  };
}
```

- [ ] **Step 9: Run the tests, confirm green**

Run: `node --test tests/data.test.mjs`
Expected: PASS - 11 tests, 0 failures.

- [ ] **Step 10: Commit the graph core**

```bash
git add js/data.js tests/data.test.mjs
git commit -m "$(cat <<'EOF'
feat: kinship graph indexes and lookup helpers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 11: Write failing tests for half-siblings and birth-year sort**

Append to `tests/data.test.mjs`:

```js
const REMARRIAGE = {
  persons: [
    person("paul"), person("jeanne"), person("sophie"),
    person("marc", { birth: { date: "1970-03-02", place: null } }),
    person("lea", { birth: { date: "1973-11", place: null } }),
    person("anne", { birth: { date: "1975", place: null } }),
    person("zoe"),
  ],
  unions: [
    { id: "u-pj", partners: ["paul", "jeanne"], date: null, children: ["marc"] },
    { id: "u-ps", partners: ["paul", "sophie"], date: null, children: ["anne", "lea", "zoe"] },
  ],
};

test("siblingsOf includes half-siblings from any union of either parent", () => {
  const graph = buildGraph(REMARRIAGE);
  assert.deepEqual(ids(graph.siblingsOf("marc")), ["lea", "anne", "zoe"]);
});

test("siblingsOf sorts by birth year, unknown birth last", () => {
  const graph = buildGraph(REMARRIAGE);
  assert.deepEqual(ids(graph.siblingsOf("anne")), ["marc", "lea", "zoe"]);
});

const UNKNOWN_BIRTHS = {
  persons: [
    person("rene"), person("odette"),
    person("gilles"),
    person("marie", { birth: { date: "1960", place: null } }),
    person("henri"),
    person("luc", { birth: { date: "1958", place: null } }),
  ],
  unions: [
    { id: "u-ro", partners: ["rene", "odette"], date: null, children: ["gilles", "marie", "henri", "luc"] },
  ],
};

test("siblingsOf keeps two unknown-birth siblings, known births first", () => {
  const graph = buildGraph(UNKNOWN_BIRTHS);
  const sibs = ids(graph.siblingsOf("luc"));
  assert.equal(sibs[0], "marie");
  assert.deepEqual(sibs.slice(1).sort(), ["gilles", "henri"]);
});
```

Note what these pin down: marc's siblings come from BOTH of paul's unions (u-pj gives nobody else, u-ps gives anne, lea, zoe), and the union's raw child order `["anne", "lea", "zoe"]` must be re-sorted to `["lea", "anne", "zoe"]` by birth year (1973 before 1975, unknown last). The third test pins the two-unknown case: gilles and henri (no birth) must both survive the sort behind marie (1960); their relative order is unconstrained, so the assertion sorts the tail before comparing. This is why the comparator must return 0 for an unknown-vs-unknown pair instead of mapping unknown to Infinity (Infinity - Infinity is NaN, an inconsistent comparator).

- [ ] **Step 12: Run the tests, confirm the three new ones fail**

Run: `node --test tests/data.test.mjs`
Expected: FAIL - exactly 3 failing tests. `siblingsOf("marc")` currently returns `[]` (marc is the only child of u-pj), `siblingsOf("anne")` returns `["lea", "zoe"]` without marc and without the sort, and `siblingsOf("luc")` returns `["gilles", "marie", "henri"]` in raw child order (gilles before marie). The 11 earlier tests still pass.

- [ ] **Step 13: Extend siblingsOf to half-siblings with birth-year sort**

In `js/data.js`, replace the entire `const siblingsOf = ...;` block inside `buildGraph` with:

```js
  const siblingsOf = (id) => {
    const uid = parentUnionOf.get(id);
    if (uid === undefined) return [];
    const seen = new Set();
    for (const parentId of unions.get(uid).partners) {
      for (const puid of unionsOf.get(parentId) || []) {
        for (const cid of unions.get(puid).children) {
          if (cid !== id) seen.add(cid);
        }
      }
    }
    return [...seen]
      .map((cid) => persons.get(cid))
      .sort((a, b) => {
        const ya = yearOf(a.birth ? a.birth.date : null);
        const yb = yearOf(b.birth ? b.birth.date : null);
        if (ya === null && yb === null) return 0;
        if (ya === null) return 1;
        if (yb === null) return -1;
        return ya - yb;
      });
  };
```

- [ ] **Step 14: Run the tests, confirm green**

Run: `node --test tests/data.test.mjs`
Expected: PASS - 14 tests, 0 failures.

- [ ] **Step 15: Commit half-sibling support**

```bash
git add js/data.js tests/data.test.mjs
git commit -m "$(cat <<'EOF'
feat: half-siblings and birth-year sort in siblingsOf

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 16: Write failing tests for dangling-reference warnings**

Append to `tests/data.test.mjs`:

```js
const DANGLING = {
  persons: [person("paul"), person("marc")],
  unions: [
    { id: "u-1", partners: ["paul", "ghost"], date: null, children: ["marc", "fantome"] },
    { id: "u-2", partners: ["esprit"], date: null, children: [] },
  ],
};

test("buildGraph reports dangling refs with French warnings", () => {
  const graph = buildGraph(DANGLING);
  assert.deepEqual(graph.warnings, [
    'Union "u-1" : partenaire inconnu "ghost", référence ignorée.',
    'Union "u-1" : enfant inconnu "fantome", référence ignorée.',
    'Union "u-2" : partenaire inconnu "esprit", référence ignorée.',
    'Union "u-2" ignorée : aucun partenaire connu.',
  ]);
});

test("dangling refs are dropped from the stored union without mutating input", () => {
  const graph = buildGraph(DANGLING);
  assert.deepEqual(graph.unions.get("u-1").partners, ["paul"]);
  assert.deepEqual(graph.unions.get("u-1").children, ["marc"]);
  assert.deepEqual(DANGLING.unions[0].partners, ["paul", "ghost"]);
});

test("a union whose partners all vanish is dropped entirely", () => {
  const graph = buildGraph(DANGLING);
  assert.equal(graph.unions.has("u-2"), false);
  assert.equal(graph.unions.size, 1);
});
```

- [ ] **Step 17: Run the tests, confirm the three new ones fail**

Run: `node --test tests/data.test.mjs`
Expected: FAIL - exactly 3 failing tests: `warnings` is `[]` instead of the 4 messages, `"ghost"` is still in `u-1.partners`, and `u-2` is still in the unions map. The 14 earlier tests still pass.

- [ ] **Step 18: Implement dangling-ref filtering in buildGraph**

In `js/data.js`, inside `buildGraph`, replace these three lines:

```js
  const persons = new Map(data.persons.map((p) => [p.id, p]));
  const unions = new Map(data.unions.map((u) => [u.id, u]));
  const warnings = [];
```

with:

```js
  const persons = new Map(data.persons.map((p) => [p.id, p]));
  const warnings = [];

  const unions = new Map();
  for (const u of data.unions) {
    const partners = u.partners.filter((pid) => {
      if (persons.has(pid)) return true;
      warnings.push(`Union "${u.id}" : partenaire inconnu "${pid}", référence ignorée.`);
      return false;
    });
    const children = u.children.filter((cid) => {
      if (persons.has(cid)) return true;
      warnings.push(`Union "${u.id}" : enfant inconnu "${cid}", référence ignorée.`);
      return false;
    });
    if (partners.length === 0) {
      warnings.push(`Union "${u.id}" ignorée : aucun partenaire connu.`);
      continue;
    }
    unions.set(u.id, { ...u, partners, children });
  }
```

Note the stored union is a shallow copy with filtered arrays; the input `data` object is never touched.

- [ ] **Step 19: Run the tests, confirm green**

Run: `node --test tests/data.test.mjs`
Expected: PASS - 17 tests, 0 failures.

- [ ] **Step 20: Commit dangling-ref handling**

```bash
git add js/data.js tests/data.test.mjs
git commit -m "$(cat <<'EOF'
feat: drop dangling refs with French warnings

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 21: Implement loadFamily (no node test - documented exclusion)**

`loadFamily` is a thin browser `fetch` wrapper; there is no server in `node --test`, so it has NO unit test by design. It is exercised end-to-end by the Task 5 browser boot check (and its failure path by the error banner check there). Append to `js/data.js`:

```js
// loadFamily is browser-only (fetch); covered by the Task 5 browser check, not by node tests.
export async function loadFamily(url = "data/family.json") {
  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error("Impossible de charger les données de la famille (réseau indisponible).");
  }
  if (!response.ok) {
    throw new Error(`Impossible de charger les données de la famille (HTTP ${response.status}).`);
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Le fichier de données de la famille est invalide (JSON illisible).");
  }
  return { data, graph: buildGraph(data) };
}
```

- [ ] **Step 22: Run the full suite to confirm the module still parses and nothing regressed**

Run: `node --test tests/data.test.mjs`
Expected: PASS - 17 tests, 0 failures (importing the module now also parses `loadFamily`, so a syntax error there would surface here).

- [ ] **Step 23: Commit loadFamily**

```bash
git add js/data.js
git commit -m "$(cat <<'EOF'
feat: loadFamily fetch wrapper with French error messages

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Generation assignment (js/generations.js)

**Files:**
- Create: `js/generations.js`
- Test: `tests/generations.test.mjs`
- Modify: none

**Interfaces:**
- Consumes (from Task 2, `js/data.js`): `export function buildGraph(data)` returning `{ persons: Map<id, Person>, unions: Map<id, Union>, parentUnionOf, unionsOf, warnings, parentsOf, childrenOf, partnersOf, siblingsOf }`. This task only reads `graph.persons` and `graph.unions`. `buildGraph` guarantees dangling refs are already dropped, so every id appearing in a union exists in `graph.persons`.
- Produces (relied on by Task 4 `computeLayout(graph, generations)`, Task 5 `main.js`, Task 6 `panel.js` ctx): `export function assignGenerations(graph) -> Map<personId, int>`.

Algorithm contract, restated exactly:
- Every person with no parent union (a root) starts at generation 0.
- All partners of a union share the max level among them (a rootless spouse gets pulled up to their partner's level).
- Every child of a union is at union generation + 1.
- These rules interact (raising a spouse can raise their other union's children), so iterate to fixpoint. Guard: passes bounded by person count; if the bound is exceeded the data contains a cycle and the function throws an `Error` with a French message instead of hanging.

Environment reminders: `package.json` with `{"type":"module"}` already exists from Task 1; run everything from the repo root `/Users/govit/Git/Govit/Genealogy`, on the feature branch created in Task 1. Style: ES2022, `const`/`let`, semicolons, 2-space indent.

- [ ] **Step 1: Write the failing test file**

Create `tests/generations.test.mjs` with exactly this content. Fixtures are inline; never load `data/family.json` here.

```js
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
```

- [ ] **Step 2: Run the test, confirm it fails for the right reason**

Run: `node --test tests/generations.test.mjs`
Expected: FAIL. Non-zero exit; the file fails to load with `ERR_MODULE_NOT_FOUND` mentioning `js/generations.js` (the module does not exist yet). If the error instead mentions `js/data.js`, stop: Task 2 is not in place, and this task depends on it.

- [ ] **Step 3: Implement js/generations.js**

Create `js/generations.js` with exactly this content:

```js
// Generation levels: roots at 0, partners of a union share the max level
// among them, children sit one level below their union. Rules interact
// (raising a spouse can raise her other union's children), so iterate to
// fixpoint. Levels only ever increase, so for acyclic data the number of
// useful passes is bounded by the person count; exceeding the bound means
// the data contains an ancestry cycle.
export function assignGenerations(graph) {
  const gen = new Map();
  for (const id of graph.persons.keys()) gen.set(id, 0);

  const maxPasses = graph.persons.size + 1;
  for (let pass = 0; pass < maxPasses; pass += 1) {
    let changed = false;
    for (const union of graph.unions.values()) {
      let unionGen = 0;
      for (const pid of union.partners) unionGen = Math.max(unionGen, gen.get(pid));
      for (const pid of union.partners) {
        if (gen.get(pid) < unionGen) {
          gen.set(pid, unionGen);
          changed = true;
        }
      }
      const childGen = unionGen + 1;
      for (const cid of union.children) {
        if (gen.get(cid) < childGen) {
          gen.set(cid, childGen);
          changed = true;
        }
      }
    }
    if (!changed) return gen;
  }
  throw new Error("Impossible de calculer les générations : cycle probable dans les données.");
}
```

Notes for the implementer, do not "improve" these away:
- Initialize everyone to 0, then only ever raise. Roots keep 0 unless a marriage pulls them up (that is the intended behavior, see test 2).
- Recompute each union's level from its partners' current levels on every pass; do not cache.
- Do not add `?? 0` fallbacks or `has()` checks on `gen.get(...)`: `buildGraph` (Task 2 contract) guarantees every id in a union exists in `graph.persons`.
- The guard is `persons.size + 1` passes exactly, then a French `Error`. No console.log, no warnings array.

- [ ] **Step 4: Run the tests, confirm all pass, then run the whole suite**

Run: `node --test tests/generations.test.mjs`
Expected: PASS. `tests 5, pass 5, fail 0`, exit code 0.

Run: `npm test`
Expected: PASS. All test files so far (validate, data, generations) green, exit code 0. If anything outside this file fails, you broke nothing here; do not touch other modules, report it instead.

- [ ] **Step 5: Commit**

```bash
cd /Users/govit/Git/Govit/Genealogy
git add js/generations.js tests/generations.test.mjs
git commit -m "$(cat <<'EOF'
feat: assign generations by fixpoint iteration

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Generational layout (js/layout.js)

**Files:**
- Create: `js/layout.js`
- Test: `tests/layout.test.mjs`
- No Modify lines: nothing imports layout.js yet (main.js wires it in Task 5).

**Interfaces:**

Consumes (from earlier tasks):
- `buildGraph(data)` from `js/data.js` (Task 2). Used members: `graph.persons: Map<id, Person>` (insertion order = order of `data.persons`, this is what "gen 0 keeps data order" relies on), `graph.unions: Map<id, Union>`, `graph.parentsOf(id) -> Person[]`, `graph.partnersOf(id) -> Person[]`.
- `assignGenerations(graph)` from `js/generations.js` (Task 3) `-> Map<personId, int>`. Guarantees used here: roots are at 0, all partners of a union share the same level, a child's level = union level + 1 (so every parent is always in a strictly shallower row and is already placed when we lay out the child's row).

Produces (Tasks 5-10 rely on these exact names and shapes):
- `export const SPACING = { colGap: 90, rowGap: 160, coupleGap: 60 }`
- `export function computeLayout(graph, generations)` returning:
  - `nodes: Map<personId, {x, y}>` in SVG user coordinates
  - `links`: array of `{type: "partner", a, b, unionId}` and `{type: "child", unionId, parentIds: string[], childId}` — ids only, NEVER coordinates (themes map ids to their own positions)
  - `rows`: array of `{gen, y, personIds: string[]}` sorted by gen, personIds left to right
  - `width, height`: numbers covering all nodes (x in [0, width], y in [0, height])

Contract rules restated: `y = gen * rowGap`. Gen 0 keeps data order; deeper rows are ordered by mean parent x (barycenter). Partners of a union sit adjacent exactly `coupleGap` apart; the gap between other neighbors is at least `colGap` (blocks are pushed right from their desired barycenter center to keep that minimum). Pure module, no DOM, so it runs under `node --test` directly.

Algorithm in three moves per row: (1) compute each person's barycenter = mean x of already-placed parents and sort the row by it (gen 0 skips the sort); (2) group partner chains into blocks, walking each chain from an endpoint so a remarried person sits between their two spouses and every couple is adjacent; (3) sweep blocks left to right, placing each at its desired barycenter center but never closer than `colGap` to the previous block. Finally shift everything so min x = 0.

- [ ] **Step 1: Write the failing test file**

Write `tests/layout.test.mjs`. Inline fixtures only — do not touch `data/family.json`. The `famille` fixture has 3 generations, two couples, a single-parent union and a gen-1 marriage between two children; `remariage` has a partner chain (rose married twice) which is the case that breaks naive couple grouping.

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildGraph } from "../js/data.js";
import { assignGenerations } from "../js/generations.js";
import { SPACING, computeLayout } from "../js/layout.js";

function person(id) {
  return {
    id,
    firstNames: id,
    lastName: "Test",
    birthName: null,
    sex: null,
    birth: null,
    death: null,
    photo: null,
    bio: null
  };
}

// 3 generations: two root couples, a single-parent root, and a gen-1 couple
const famille = {
  persons: [
    person("albert"), person("berthe"), person("charles"), person("denise"),
    person("solange"), person("edouard"), person("fanny"), person("gilles"),
    person("theo"), person("irene")
  ],
  unions: [
    { id: "u-albert-berthe", partners: ["albert", "berthe"], date: "1950", children: ["edouard", "fanny"] },
    { id: "u-charles-denise", partners: ["charles", "denise"], date: "1952", children: ["gilles"] },
    { id: "u-solange", partners: ["solange"], date: null, children: ["theo"] },
    { id: "u-fanny-gilles", partners: ["fanny", "gilles"], date: "1980", children: ["irene"] }
  ]
};

// rose married twice: the chain jean-rose-luc must lay out with both couples adjacent
const remariage = {
  persons: [person("jean"), person("rose"), person("luc"), person("mia"), person("noe")],
  unions: [
    { id: "u-jean-rose", partners: ["jean", "rose"], date: "1960", children: ["mia"] },
    { id: "u-rose-luc", partners: ["rose", "luc"], date: "1975", children: ["noe"] }
  ]
};

function layoutOf(data) {
  const graph = buildGraph(data);
  const generations = assignGenerations(graph);
  return { graph, generations, layout: computeLayout(graph, generations) };
}

test("SPACING matches the engine contract", () => {
  assert.deepEqual(SPACING, { colGap: 90, rowGap: 160, coupleGap: 60 });
});

test("couple partners are adjacent, exactly coupleGap apart", () => {
  for (const data of [famille, remariage]) {
    const { layout } = layoutOf(data);
    const partnerLinks = layout.links.filter((l) => l.type === "partner");
    assert.ok(partnerLinks.length > 0);
    for (const link of partnerLinks) {
      const a = layout.nodes.get(link.a);
      const b = layout.nodes.get(link.b);
      assert.equal(a.y, b.y, `${link.unionId}: partners on different rows`);
      assert.equal(Math.abs(a.x - b.x), SPACING.coupleGap, `${link.unionId}: not coupleGap apart`);
    }
  }
});

test("every node sits at y = generation * rowGap", () => {
  const { generations, layout } = layoutOf(famille);
  assert.equal(layout.nodes.size, famille.persons.length);
  for (const [id, pos] of layout.nodes) {
    assert.equal(pos.y, generations.get(id) * SPACING.rowGap, id);
  }
});

test("children are centered under their parents within one colGap", () => {
  // tolerance is one colGap: siblings competing for the same slot may be
  // pushed sideways by at most one column
  const { layout } = layoutOf(famille);
  const childLinks = layout.links.filter((l) => l.type === "child");
  assert.equal(childLinks.length, 5);
  for (const link of childLinks) {
    const childX = layout.nodes.get(link.childId).x;
    const xs = link.parentIds.map((id) => layout.nodes.get(id).x);
    const mean = xs.reduce((s, v) => s + v, 0) / xs.length;
    assert.ok(
      Math.abs(childX - mean) <= SPACING.colGap,
      `${link.childId}: x=${childX} too far from parent center ${mean}`
    );
  }
});

test("no two nodes in the same row are closer than coupleGap", () => {
  for (const data of [famille, remariage]) {
    const { layout } = layoutOf(data);
    for (const row of layout.rows) {
      const xs = row.personIds.map((id) => layout.nodes.get(id).x).sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++) {
        assert.ok(xs[i] - xs[i - 1] >= SPACING.coupleGap, `row gen ${row.gen}`);
      }
    }
  }
});

test("links reference only ids present in nodes and carry no coordinates", () => {
  const { layout } = layoutOf(famille);
  for (const link of layout.links) {
    assert.ok(!("x" in link) && !("y" in link));
    if (link.type === "partner") {
      assert.ok(layout.nodes.has(link.a) && layout.nodes.has(link.b));
      assert.equal(typeof link.unionId, "string");
    } else {
      assert.equal(link.type, "child");
      assert.ok(layout.nodes.has(link.childId));
      for (const pid of link.parentIds) assert.ok(layout.nodes.has(pid));
    }
  }
  // u-solange has a single partner: 3 partner links, not 4
  assert.equal(layout.links.filter((l) => l.type === "partner").length, 3);
});

test("width and height cover all nodes", () => {
  for (const data of [famille, remariage]) {
    const { layout } = layoutOf(data);
    for (const pos of layout.nodes.values()) {
      assert.ok(pos.x >= 0 && pos.x <= layout.width);
      assert.ok(pos.y >= 0 && pos.y <= layout.height);
    }
  }
});

test("rows are sorted by generation and gen 0 keeps data order", () => {
  const { layout } = layoutOf(famille);
  assert.deepEqual(layout.rows.map((r) => r.gen), [0, 1, 2]);
  assert.deepEqual(layout.rows[0].personIds, ["albert", "berthe", "charles", "denise", "solange"]);
  for (const row of layout.rows) {
    assert.equal(row.y, row.gen * SPACING.rowGap);
    const xs = row.personIds.map((id) => layout.nodes.get(id).x);
    for (let i = 1; i < xs.length; i++) {
      assert.ok(xs[i] > xs[i - 1], `row gen ${row.gen} personIds not left-to-right`);
    }
  }
});
```

- [ ] **Step 2: Run the tests, expect FAIL**

Run: `node --test tests/layout.test.mjs` (from the repo root)
Expected: FAIL — the test file itself errors with `ERR_MODULE_NOT_FOUND` (`Cannot find module ... js/layout.js`), reported as 1 failing test file. If it fails for any other reason (e.g. cannot find `js/data.js`), stop: Tasks 2-3 are not in place.

- [ ] **Step 3: Implement js/layout.js**

Write `js/layout.js` exactly as follows.

```js
export const SPACING = { colGap: 90, rowGap: 160, coupleGap: 60 };

export function computeLayout(graph, generations) {
  const { colGap, rowGap, coupleGap } = SPACING;
  const nodes = new Map();
  const rows = [];
  const links = [];

  // group person ids by generation, preserving data order within each row
  const byGen = new Map();
  for (const id of graph.persons.keys()) {
    const gen = generations.get(id);
    if (gen === undefined) continue;
    if (!byGen.has(gen)) byGen.set(gen, []);
    byGen.get(gen).push(id);
  }
  const genLevels = [...byGen.keys()].sort((a, b) => a - b);

  for (const gen of genLevels) {
    const ids = byGen.get(gen);
    const y = gen * rowGap;
    const inRow = new Set(ids);
    const partnersInRow = (id) =>
      graph.partnersOf(id).map((p) => p.id).filter((pid) => inRow.has(pid));

    // barycenter: mean x of parents, all placed in shallower rows already
    const bary = new Map();
    for (const id of ids) {
      const xs = graph.parentsOf(id)
        .filter((p) => nodes.has(p.id))
        .map((p) => nodes.get(p.id).x);
      bary.set(id, xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null);
    }

    // gen 0 keeps data order; deeper rows sort by barycenter (stable sort,
    // persons without parents, e.g. married-in partners, go last)
    let ordered = ids;
    if (gen > 0) {
      ordered = [...ids].sort((a, b) => {
        const ba = bary.get(a);
        const bb = bary.get(b);
        if (ba === null && bb === null) return 0;
        if (ba === null) return 1;
        if (bb === null) return -1;
        return ba - bb;
      });
    }

    // group partner chains into blocks; walk each chain from an endpoint so
    // a remarried person ends up between their two spouses (A-B, B-C -> A B C)
    const assigned = new Set();
    const blocks = [];
    for (const seed of ordered) {
      if (assigned.has(seed)) continue;
      const component = [];
      const seen = new Set([seed]);
      const stack = [seed];
      while (stack.length) {
        const cur = stack.pop();
        component.push(cur);
        for (const pid of partnersInRow(cur)) {
          if (!seen.has(pid)) {
            seen.add(pid);
            stack.push(pid);
          }
        }
      }
      let start = component[0];
      for (const id of component) {
        if (partnersInRow(id).length < partnersInRow(start).length) start = id;
      }
      const block = [start];
      const used = new Set([start]);
      let cur = start;
      while (block.length < component.length) {
        const next = partnersInRow(cur).find((pid) => !used.has(pid));
        if (next === undefined) {
          for (const id of component) {
            if (!used.has(id)) {
              used.add(id);
              block.push(id);
            }
          }
          break;
        }
        used.add(next);
        block.push(next);
        cur = next;
      }
      for (const id of block) assigned.add(id);
      blocks.push(block);
    }

    // sweep left to right: each block wants to center on its members' mean
    // barycenter, but never closer than colGap to the previous block;
    // members inside a block are exactly coupleGap apart
    let cursor = null;
    for (const block of blocks) {
      const blockWidth = (block.length - 1) * coupleGap;
      const centers = block.map((id) => bary.get(id)).filter((v) => v !== null);
      let left;
      if (centers.length === 0) {
        left = cursor === null ? 0 : cursor + colGap;
      } else {
        const desired = centers.reduce((s, v) => s + v, 0) / centers.length - blockWidth / 2;
        left = cursor === null ? desired : Math.max(desired, cursor + colGap);
      }
      block.forEach((id, i) => nodes.set(id, { x: left + i * coupleGap, y }));
      cursor = left + blockWidth;
    }

    rows.push({ gen, y, personIds: blocks.flat() });
  }

  // normalize x so the leftmost node sits at 0 (a first block centered on its
  // parents can land at negative x)
  if (nodes.size > 0) {
    let minX = Infinity;
    for (const n of nodes.values()) minX = Math.min(minX, n.x);
    if (minX !== 0) for (const n of nodes.values()) n.x -= minX;
  }

  let width = 0;
  let height = 0;
  for (const n of nodes.values()) {
    width = Math.max(width, n.x);
    height = Math.max(height, n.y);
  }

  // links carry ids only; themes resolve them against their own positions
  for (const union of graph.unions.values()) {
    const partnerIds = union.partners.filter((id) => nodes.has(id));
    if (partnerIds.length === 2) {
      links.push({ type: "partner", a: partnerIds[0], b: partnerIds[1], unionId: union.id });
    }
    for (const childId of union.children) {
      if (!nodes.has(childId)) continue;
      links.push({ type: "child", unionId: union.id, parentIds: partnerIds, childId });
    }
  }

  return { nodes, links, rows, width, height };
}
```

- [ ] **Step 4: Run the tests, expect PASS**

Run: `node --test tests/layout.test.mjs`
Expected: PASS — `# tests 8`, `# pass 8`, `# fail 0`. If "children are centered..." fails, the sweep is not using desired barycenter centers; if "couple partners are adjacent..." fails on `u-jean-rose` or `u-rose-luc`, the endpoint-first chain walk in the block builder is wrong.

- [ ] **Step 5: Run the whole suite for regressions**

Run: `node --test tests/`
Expected: all test files pass (`tests/validate.test.mjs`, `tests/data.test.mjs`, `tests/generations.test.mjs`, `tests/layout.test.mjs`), `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add js/layout.js tests/layout.test.mjs
git commit -m "$(cat <<'EOF'
feat: add generational layout engine (js/layout.js)

Barycenter row ordering, partner-chain couple blocks, SPACING
constants, id-only links, with node --test coverage.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: App shell (index.html, base.css, panzoom, main)

**Files:**
- Create: `tests/hash.test.mjs`
- Create: `js/themes/index.js`
- Create: `js/panzoom.js`
- Create: `js/main.js`
- Create: `css/base.css`
- Modify: `index.html` (full rewrite: the old nested-list markup and its `styles.css`/`script.js` references are replaced entirely by the new shell structure)
- Delete: `script.js`, `styles.css` (git rm)
- Test: `tests/hash.test.mjs`

**Interfaces:**

Consumes (must already exist from Tasks 1-4):
- `data/family.json` at repo root (Task 1) - loaded by the browser check
- `js/data.js`: `export async function loadFamily(url = "data/family.json") -> { data, graph }` (throws `Error` with a French message on HTTP or parse failure); `graph.warnings: string[]`
- `js/generations.js`: `export function assignGenerations(graph) -> Map<personId, int>`
- `js/layout.js`: `export function computeLayout(graph, generations) -> { nodes, links, rows, width, height }`

Produces (later tasks rely on these exact names):
- `js/main.js`: `export function parseHash(hash) -> { theme: string|null, person: string|null }` (theme id not present in THEMES -> null) and `export function buildHash({theme, person}) -> string` ("#theme=x&person=y", omitting null parts, "" if both null). Task 6 extends the boot for panel/search/person deep links.
- `js/panzoom.js`: `export function createPanZoom(svg, opts = {}) -> { flyTo(x, y, scale = 1.2), reset(), destroy() }` - Task 6 calls `flyTo` from search.
- `js/themes/index.js`: `export const THEMES = [];` - Tasks 7-10 each append one import plus one array entry `{ id, label, className: "theme-<id>", render(ctx) }`.
- `index.html` DOM ids: `canvas#backdrop`, `svg#stage`, `aside#panel`, `div#error-banner`, `nav#themes`, `input#search`, `div#search-results`, footer link - Tasks 6-10 target these.
- main.js theme invocation contract: `theme.render({ svg, canvas, graph, generations, layout })` returning `{ positions: Map<personId,{x,y}>, cleanup? }`; main.js stores `cleanup` and calls it before the next render.
- localStorage key: `"genealogie-theme"`.

Constants restated for this task: pan/zoom clamps minScale 0.3 / maxScale 6, flyTo default scale 1.2, flyTo animation 600 ms ease-in-out cubic, fallback message "Aucun thème disponible", error banner shows the French message from the thrown Error. All UI text French, no em dashes or smart quotes anywhere, 2-space indent, semicolons.

- [ ] **Step 1: Write the failing hash test**

Write `tests/hash.test.mjs`. Note it imports only `parseHash`/`buildHash`; the module will keep its DOM boot behind a `typeof document !== "undefined"` guard so this import works under node. THEMES is empty in this task, so every theme id is "unknown" - the unknown-theme test uses a fake id `"inconnu"` so it stays valid after Tasks 7-10 register real themes.

```js
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
```

- [ ] **Step 2: Run the test, expect FAIL**

Run: `node --test tests/hash.test.mjs`
Expected: the test file fails to load with `ERR_MODULE_NOT_FOUND` (Cannot find module `.../js/main.js`). 1 failing test file, 0 passing.

- [ ] **Step 3: Create the empty theme registry**

Write `js/themes/index.js` exactly:

```js
export const THEMES = [];
```

- [ ] **Step 4: Create js/panzoom.js**

Full viewBox math. Scale is defined as `svg.clientWidth / viewBox.width`; clamping a scale therefore clamps the viewBox width between `clientWidth/6` and `clientWidth/0.3`. Pointer capture is taken on `e.target` (not the svg) so that click events still fire on `[data-person-id]` nodes - capturing on the svg would retarget the eventual click and break the delegation Task 6 adds.

```js
export function createPanZoom(svg, opts = {}) {
  const minScale = opts.minScale ?? 0.3;
  const maxScale = opts.maxScale ?? 6;
  const pointers = new Map();
  let anim = null;

  function getViewBox() {
    const vb = svg.viewBox.baseVal;
    return { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
  }

  function setViewBox(vb) {
    svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  }

  const home = getViewBox();

  function clampedWidth(w) {
    const minW = svg.clientWidth / maxScale;
    const maxW = svg.clientWidth / minScale;
    return Math.min(maxW, Math.max(minW, w));
  }

  function zoomAt(clientX, clientY, factor) {
    const vb = getViewBox();
    const rect = svg.getBoundingClientRect();
    const fx = (clientX - rect.left) / rect.width;
    const fy = (clientY - rect.top) / rect.height;
    const newW = clampedWidth(vb.w / factor);
    const newH = newW * (vb.h / vb.w);
    setViewBox({
      x: vb.x + fx * (vb.w - newW),
      y: vb.y + fy * (vb.h - newH),
      w: newW,
      h: newH
    });
  }

  function stopAnim() {
    if (anim !== null) {
      cancelAnimationFrame(anim);
      anim = null;
    }
  }

  function onPointerDown(e) {
    stopAnim();
    // Capture on the original target so click events still reach person nodes.
    e.target.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  function onPointerMove(e) {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (pointers.size === 2) {
      const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)[1];
      const dPrev = Math.hypot(prev.x - other.x, prev.y - other.y);
      const dCur = Math.hypot(cur.x - other.x, cur.y - other.y);
      if (dPrev > 0 && dCur > 0) {
        zoomAt((cur.x + other.x) / 2, (cur.y + other.y) / 2, dCur / dPrev);
      }
    } else if (pointers.size === 1) {
      const rect = svg.getBoundingClientRect();
      const vb = getViewBox();
      vb.x -= ((cur.x - prev.x) / rect.width) * vb.w;
      vb.y -= ((cur.y - prev.y) / rect.height) * vb.h;
      setViewBox(vb);
    }
    pointers.set(e.pointerId, cur);
  }

  function onPointerUp(e) {
    pointers.delete(e.pointerId);
  }

  function onWheel(e) {
    e.preventDefault();
    stopAnim();
    zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.002));
  }

  function flyTo(x, y, scale = 1.2) {
    stopAnim();
    const from = getViewBox();
    const w = clampedWidth(svg.clientWidth / scale);
    const h = w * (from.h / from.w);
    const to = { x: x - w / 2, y: y - h / 2, w, h };
    const start = performance.now();
    const duration = 600;
    function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const k = easeInOutCubic(t);
      setViewBox({
        x: from.x + (to.x - from.x) * k,
        y: from.y + (to.y - from.y) * k,
        w: from.w + (to.w - from.w) * k,
        h: from.h + (to.h - from.h) * k
      });
      anim = t < 1 ? requestAnimationFrame(step) : null;
    }
    anim = requestAnimationFrame(step);
  }

  function reset() {
    stopAnim();
    setViewBox(home);
  }

  function destroy() {
    stopAnim();
    svg.removeEventListener("pointerdown", onPointerDown);
    svg.removeEventListener("pointermove", onPointerMove);
    svg.removeEventListener("pointerup", onPointerUp);
    svg.removeEventListener("pointercancel", onPointerUp);
    svg.removeEventListener("wheel", onWheel);
  }

  svg.addEventListener("pointerdown", onPointerDown);
  svg.addEventListener("pointermove", onPointerMove);
  svg.addEventListener("pointerup", onPointerUp);
  svg.addEventListener("pointercancel", onPointerUp);
  svg.addEventListener("wheel", onWheel, { passive: false });

  return { flyTo, reset, destroy };
}
```

- [ ] **Step 5: Create js/main.js**

Everything DOM-touching lives in `boot()`, invoked only when `document` exists, so node can import `parseHash`/`buildHash`. The initial viewBox is expanded to match the stage aspect ratio so the default `preserveAspectRatio` letterboxing never desynchronizes the panzoom pixel-to-user math. `panzoom` and `positions` are intentionally unused for now: Task 6 wires them to search fly-to. Click-to-panel delegation also arrives in Task 6 - do not add it here.

```js
import { loadFamily } from "./data.js";
import { assignGenerations } from "./generations.js";
import { computeLayout } from "./layout.js";
import { createPanZoom } from "./panzoom.js";
import { THEMES } from "./themes/index.js";

const THEME_STORAGE_KEY = "genealogie-theme";

export function parseHash(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const themeId = params.get("theme");
  return {
    theme: THEMES.some((t) => t.id === themeId) ? themeId : null,
    person: params.get("person") || null
  };
}

export function buildHash({ theme, person }) {
  const parts = [];
  if (theme) parts.push(`theme=${theme}`);
  if (person) parts.push(`person=${person}`);
  return parts.length > 0 ? `#${parts.join("&")}` : "";
}

async function boot() {
  const svg = document.querySelector("#stage");
  const canvas = document.querySelector("#backdrop");
  const errorBanner = document.querySelector("#error-banner");
  const themesNav = document.querySelector("#themes");
  const stageArea = document.querySelector("main");

  function sizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }
  sizeCanvas();
  window.addEventListener("resize", sizeCanvas);

  let family;
  try {
    family = await loadFamily();
  } catch (err) {
    errorBanner.textContent = err.message;
    errorBanner.hidden = false;
    return;
  }
  const graph = family.graph;
  graph.warnings.forEach((w) => console.warn(w));

  const generations = assignGenerations(graph);
  const layout = computeLayout(graph, generations);

  // Expand the viewBox to the stage aspect ratio, content centered, so
  // "meet" letterboxing never skews the panzoom pixel-to-user mapping.
  const contentW = Math.max(1, layout.width);
  const contentH = Math.max(1, layout.height);
  const stageRect = svg.getBoundingClientRect();
  const aspect = stageRect.width / Math.max(1, stageRect.height);
  let vbW = contentW;
  let vbH = contentH;
  if (vbW / vbH < aspect) vbW = vbH * aspect;
  else vbH = vbW / aspect;
  svg.setAttribute("viewBox", `${(contentW - vbW) / 2} ${(contentH - vbH) / 2} ${vbW} ${vbH}`);

  const panzoom = createPanZoom(svg); // Task 6 wires search fly-to to this

  if (THEMES.length === 0) {
    const msg = document.createElement("div");
    msg.className = "stage-message";
    msg.textContent = "Aucun thème disponible";
    stageArea.appendChild(msg);
    return;
  }

  let activeThemeId = null;
  let activeCleanup = null;
  let positions = new Map(); // Task 6 reads this for search fly-to

  function renderTheme(id) {
    const theme = THEMES.find((t) => t.id === id);
    if (!theme || id === activeThemeId) return;
    if (activeCleanup) {
      activeCleanup();
      activeCleanup = null;
    }
    document.body.className = theme.className;
    const result = theme.render({ svg, canvas, graph, generations, layout });
    positions = result.positions;
    activeCleanup = result.cleanup || null;
    activeThemeId = id;
    for (const btn of themesNav.querySelectorAll("button")) {
      btn.classList.toggle("active", btn.dataset.themeId === id);
    }
    localStorage.setItem(THEME_STORAGE_KEY, id);
  }

  for (const theme of THEMES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = theme.label;
    btn.dataset.themeId = theme.id;
    btn.addEventListener("click", () => {
      const { person } = parseHash(location.hash);
      const hash = buildHash({ theme: theme.id, person });
      if (hash !== location.hash) location.hash = hash;
    });
    themesNav.appendChild(btn);
  }

  window.addEventListener("hashchange", () => {
    const { theme } = parseHash(location.hash);
    if (theme) renderTheme(theme);
  });

  const fromHash = parseHash(location.hash);
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  const initial =
    fromHash.theme ||
    (THEMES.some((t) => t.id === stored) ? stored : null) ||
    THEMES[0].id;
  renderTheme(initial);
  if (fromHash.theme !== initial) {
    const hash = buildHash({ theme: initial, person: fromHash.person });
    history.replaceState(null, "", hash || location.pathname + location.search);
  }
}

if (typeof document !== "undefined") {
  boot();
}
```

- [ ] **Step 6: Run tests, expect PASS**

Run: `node --test tests/hash.test.mjs`
Expected: 6 tests, 6 pass, 0 fail.

Run: `node --test`
Expected: the full suite (validate, data, generations, layout, hash) passes - importing `js/main.js` under node must not touch the DOM; if anything here fails with `document is not defined`, the boot guard is broken.

- [ ] **Step 7: Commit the modules and test**

```bash
git add js/themes/index.js js/panzoom.js js/main.js tests/hash.test.mjs
git commit -m "$(cat <<'EOF'
feat: add app shell modules (theme registry, panzoom, main orchestration)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: Rewrite index.html**

Replace the entire existing file (it currently holds the old placeholder site). Only `css/base.css` is linked; Tasks 7-10 each add their own `css/<id>.css` link tag.

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Généalogie de la famille</title>
  <link rel="stylesheet" href="css/base.css">
</head>
<body>
  <header class="toolbar">
    <h1>Notre famille</h1>
    <nav id="themes"></nav>
    <div class="search-box">
      <input id="search" type="search" placeholder="Rechercher une personne..." autocomplete="off">
      <div id="search-results" hidden></div>
    </div>
  </header>
  <main>
    <canvas id="backdrop"></canvas>
    <svg id="stage" xmlns="http://www.w3.org/2000/svg"></svg>
    <aside id="panel" hidden></aside>
    <div id="error-banner" hidden></div>
  </main>
  <footer>
    <a href="contribute.html">Participer</a>
  </footer>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 9: Create css/base.css**

Neutral dark shell chrome only - theme visuals live in per-theme css files scoped under `body.theme-<id>`. The stage (main) fills the viewport between toolbar and footer; canvas sits behind the svg; panel slides over from the right; responsive below 700px.

```css
:root {
  --bg: #14161a;
  --surface: #1e2127;
  --surface-2: #2a2e36;
  --text: #e8e6e1;
  --text-dim: #9aa0a8;
  --accent: #c9a24b;
  --danger: #b33a3a;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  height: 100%;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, sans-serif;
}

body {
  display: flex;
  flex-direction: column;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 56px;
  padding: 8px 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--surface-2);
  position: relative;
  z-index: 10;
}

.toolbar h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  white-space: nowrap;
}

#themes {
  display: flex;
  gap: 8px;
  flex: 1;
}

#themes button {
  background: var(--surface-2);
  color: var(--text);
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 6px 12px;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
}

#themes button:hover { border-color: var(--text-dim); }

#themes button.active {
  border-color: var(--accent);
  color: var(--accent);
}

.search-box { position: relative; }

#search {
  background: var(--surface-2);
  color: var(--text);
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 6px 10px;
  font: inherit;
  font-size: 14px;
  width: 220px;
}

#search:focus {
  outline: none;
  border-color: var(--accent);
}

#search-results {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  width: 280px;
  background: var(--surface);
  border: 1px solid var(--surface-2);
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 20;
}

#search-results button {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  color: var(--text);
  padding: 8px 12px;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

#search-results button:hover { background: var(--surface-2); }

main {
  position: relative;
  flex: 1;
  overflow: hidden;
}

#backdrop {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

#stage {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  touch-action: none;
  user-select: none;
}

.stage-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--text-dim);
  font-size: 18px;
}

#panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(360px, 90vw);
  background: var(--surface);
  border-left: 1px solid var(--surface-2);
  padding: 20px;
  overflow-y: auto;
  z-index: 5;
  transition: transform 0.25s ease, visibility 0.25s;
}

#panel[hidden] {
  display: block;
  visibility: hidden;
  transform: translateX(100%);
}

#error-banner {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  max-width: min(600px, 90vw);
  background: var(--danger);
  color: #ffffff;
  padding: 12px 20px;
  border-radius: 6px;
  font-size: 15px;
  z-index: 30;
}

footer {
  padding: 6px 16px;
  background: var(--surface);
  border-top: 1px solid var(--surface-2);
  font-size: 13px;
  text-align: right;
}

footer a {
  color: var(--text-dim);
  text-decoration: none;
}

footer a:hover { color: var(--accent); }

@media (max-width: 700px) {
  .toolbar {
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 12px;
  }
  .toolbar h1 { font-size: 16px; }
  #themes {
    order: 3;
    width: 100%;
    overflow-x: auto;
  }
  #search { width: 150px; }
  #panel { width: 100vw; }
}
```

- [ ] **Step 10: Remove the old site files**

```bash
git rm script.js styles.css
```

Expected: both files staged as deleted; `index.html` no longer references them (Step 8 removed the references).

- [ ] **Step 11: Browser verification**

Serve the repo root (ES modules refuse to load from file://):

```bash
python3 -m http.server 8000 --directory /Users/govit/Git/Govit/Genealogy
```

Open `http://localhost:8000/` and verify:
- Dark toolbar with "Notre famille" on the left, an empty theme nav (no buttons - THEMES is empty), and the search input showing placeholder "Rechercher une personne...".
- Centered dim message "Aucun thème disponible" in the stage area.
- Footer bar with a "Participer" link on the right.
- DevTools console: zero errors and zero warnings (starter data is clean, so `graph.warnings` logs nothing).
- Dragging and wheel-scrolling on the empty stage throws nothing.
- Narrow the window below 700px: toolbar wraps, nothing overflows horizontally.
- Sanity check the error banner: stop the server, reload the still-open tab or temporarily rename `data/family.json`, confirm a red centered banner with a French message appears; restore before committing.

- [ ] **Step 12: Commit the shell**

```bash
git add index.html css/base.css
git commit -m "$(cat <<'EOF'
feat: replace old site with app shell page and base styles

Removes the placeholder script.js and styles.css.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Person panel and search (panel.js, search.js)

Context you need (restated from the contract, since you see nothing else): the app is plain ES modules, zero dependencies, no build step, served from the repo root. All UI strings are French (accented letters fine; no em dashes, no smart quotes, no decorative Unicode). Style: ES2022, const/let, semicolons, 2-space indent. Tests run with `node --test` and use inline fixtures only. `index.html` (Task 5) provides: `header.toolbar` with `nav#themes`, `input#search` (placeholder "Rechercher une personne..."), `div#search-results`, then `main` with `canvas#backdrop` + `svg#stage` + `aside#panel` (hidden) + `div#error-banner` (hidden). The localStorage theme key is `"genealogie-theme"`. `THEMES` (js/themes/index.js) is still an empty array at this point; themes arrive in Tasks 7-10. All commands run from the repo root `/Users/govit/Git/Govit/Genealogy`.

**Files:**
- Create: `js/search.js`
- Create: `js/panel.js`
- Create: `tests/search.test.mjs`
- Modify: `js/main.js` - anchor: the Task 5 boot wiring (the `[data-person-id]` click delegation, theme selection/render, hash handling, hashchange listener, `.active` nav toggle, stage-message fallback, viewBox aspect expansion, panzoom home capture). The whole file is replaced below; every one of those Task 5 behaviors is carried over, and the exported `parseHash`/`buildHash` keep identical behavior so `tests/hash.test.mjs` from Task 5 must still pass unchanged.
- Modify: `css/base.css` - anchor: append after the last existing rule. panel.js introduces classes (`.panel-close`, `.panel-portrait`, `.initials`, `.panel-birthname`, `.panel-dates`, `.panel-bio`, `.panel-section`, `.chips`, `.chip`) that no stylesheet defines yet.

**Interfaces:**

Consumes (from earlier tasks, exact signatures):
- `js/data.js`: `formatDateFr(dateStr)` -> `"17 mai 1942" | "mai 1942" | "1942" | ""`, `yearOf(dateStr)` -> `int|null`, `loadFamily(url = "data/family.json")` -> `{ data, graph }` (throws French `Error` on failure)
- graph object (Task 2): `graph.persons: Map<id, Person>`, `graph.warnings: string[]`, `graph.parentsOf(id)`, `graph.childrenOf(id)`, `graph.partnersOf(id)`, `graph.siblingsOf(id)` all -> `Person[]`
- `js/generations.js`: `assignGenerations(graph)` -> `Map<personId, int>`
- `js/layout.js`: `computeLayout(graph, generations)` -> `{ nodes, links, rows, width, height }`
- `js/panzoom.js`: `createPanZoom(svg, opts = {})` -> `{ flyTo(x, y, scale = 1.2), reset(), destroy() }`. Note (updates the Task 5 usage note): `createPanZoom` captures its home view from the svg viewBox at creation time, so `main.js` must call it only after a theme render has set a real viewBox - it destroys and recreates the instance at the end of every successful `renderTheme`, and never creates it on the initial 0x0 viewBox
- `js/themes/index.js`: `THEMES` (empty array for now)

Produces (later tasks rely on these exactly):
- `js/panel.js`: `showPanel(personId, ctx)` with `ctx = { graph, generations, onNavigate(id), onClose() }`; `hidePanel()`
- `js/search.js`: `normalize(s)` -> lowercase, diacritics stripped; `searchPersons(graph, query)` -> `Person[]` max 8
- `js/main.js`: keeps exports `parseHash(hash)` / `buildHash({theme, person})`; calls each theme as `theme.render({ svg, canvas, graph, generations, layout })` expecting `{ positions: Map<personId, {x, y}>, cleanup? }`, stores `positions` for fly-to and invokes `cleanup()` before the next render. After each render it expands the theme's content-bounds viewBox to the stage aspect (`expandViewBoxToStageAspect`) and recreates the pan-zoom instance so its home view matches the fresh viewBox; themes never handle letterboxing or home capture themselves. Theme tasks 7-10 plug into exactly this.

- [ ] **Step 1: Write the failing search tests**

Write `tests/search.test.mjs` exactly as below. The fixture is inline; it never touches `data/family.json`.

```js
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
```

- [ ] **Step 2: Run the search tests, expect failure**

Run: `node --test tests/search.test.mjs`
Expected: FAIL - the runner reports the file errored with `ERR_MODULE_NOT_FOUND` because `js/search.js` does not exist yet. Do not proceed until you see this exact failure mode.

- [ ] **Step 3: Implement js/search.js**

```js
export function normalize(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function searchPersons(graph, query) {
  const q = normalize(query).trim();
  if (q === "") return [];
  const results = [];
  for (const person of graph.persons.values()) {
    const first = normalize(person.firstNames);
    const last = normalize(person.lastName);
    const haystacks = [first + " " + last, last + " " + first];
    if (person.birthName) haystacks.push(normalize(person.birthName));
    if (haystacks.some((h) => h.includes(q))) {
      results.push(person);
      if (results.length === 8) break;
    }
  }
  return results;
}
```

- [ ] **Step 4: Run the search tests, expect pass**

Run: `node --test tests/search.test.mjs`
Expected: PASS - 8 tests, 0 failures.

- [ ] **Step 5: Commit the search module**

```bash
git add js/search.js tests/search.test.mjs
git commit -m "$(cat <<'EOF'
feat: accent-insensitive person search (search.js)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Implement js/panel.js**

Panel is DOM-only, so no unit test; visual verification happens in Step 10. Rules encoded here: photo fallback is a `div.initials` with the first letters of `firstNames` and `lastName`; living person gets one birth line like "Née le 17 mai 1942 à Lyon" ("le" only for full dates, "en" for year/month precision, "Né"/"Née"/"Né(e)" by sex); deceased person gets a "17 mai 1942, Lyon - 3 juin 2019, Paris" line; `"née X"` shown when `birthName` is set; chips grouped Parents / Conjoint(e)s / Enfants / Fratrie, each chip calling `ctx.onNavigate(id)`; empty groups are omitted.

```js
import { formatDateFr } from "./data.js";

function initialsOf(person) {
  const first = (person.firstNames || "").trim();
  const last = (person.lastName || "").trim();
  return ((first[0] || "") + (last[0] || "")).toUpperCase();
}

function birthWord(sex) {
  if (sex === "F") return "Née";
  if (sex === "M") return "Né";
  return "Né(e)";
}

function datePhrase(dateStr) {
  const txt = formatDateFr(dateStr);
  if (txt === "") return "";
  return (dateStr && dateStr.length === 10 ? "le " : "en ") + txt;
}

function lifeLine(person) {
  const b = person.birth;
  const d = person.death;
  if (d) {
    const from = b ? [formatDateFr(b.date), b.place].filter(Boolean).join(", ") : "";
    const to = [formatDateFr(d.date), d.place].filter(Boolean).join(", ");
    return [from, to].filter(Boolean).join(" - ");
  }
  if (!b) return "";
  const parts = [birthWord(person.sex)];
  const when = datePhrase(b.date);
  if (when !== "") parts.push(when);
  if (b.place) parts.push("à " + b.place);
  return parts.length > 1 ? parts.join(" ") : "";
}

function chipSection(title, persons, onNavigate) {
  const section = document.createElement("section");
  section.className = "panel-section";
  const heading = document.createElement("h3");
  heading.textContent = title;
  section.appendChild(heading);
  const list = document.createElement("div");
  list.className = "chips";
  for (const p of persons) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = p.firstNames + " " + p.lastName;
    chip.addEventListener("click", () => onNavigate(p.id));
    list.appendChild(chip);
  }
  section.appendChild(list);
  return section;
}

export function showPanel(personId, ctx) {
  const person = ctx.graph.persons.get(personId);
  if (!person) return;
  const panel = document.querySelector("#panel");
  panel.replaceChildren();

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "panel-close";
  closeBtn.textContent = "Fermer";
  closeBtn.addEventListener("click", () => ctx.onClose());
  panel.appendChild(closeBtn);

  if (person.photo) {
    const img = document.createElement("img");
    img.className = "panel-portrait";
    img.src = person.photo;
    img.alt = "Portrait de " + person.firstNames + " " + person.lastName;
    panel.appendChild(img);
  } else {
    const initials = document.createElement("div");
    initials.className = "initials";
    initials.textContent = initialsOf(person);
    panel.appendChild(initials);
  }

  const name = document.createElement("h2");
  name.textContent = person.firstNames + " " + person.lastName;
  panel.appendChild(name);

  if (person.birthName) {
    const born = document.createElement("p");
    born.className = "panel-birthname";
    born.textContent = "née " + person.birthName;
    panel.appendChild(born);
  }

  const line = lifeLine(person);
  if (line !== "") {
    const dates = document.createElement("p");
    dates.className = "panel-dates";
    dates.textContent = line;
    panel.appendChild(dates);
  }

  if (person.bio) {
    const bio = document.createElement("p");
    bio.className = "panel-bio";
    bio.textContent = person.bio;
    panel.appendChild(bio);
  }

  const groups = [
    ["Parents", ctx.graph.parentsOf(personId)],
    ["Conjoint(e)s", ctx.graph.partnersOf(personId)],
    ["Enfants", ctx.graph.childrenOf(personId)],
    ["Fratrie", ctx.graph.siblingsOf(personId)]
  ];
  for (const [title, persons] of groups) {
    if (persons.length > 0) panel.appendChild(chipSection(title, persons, ctx.onNavigate));
  }

  panel.hidden = false;
}

export function hidePanel() {
  const panel = document.querySelector("#panel");
  panel.replaceChildren();
  panel.hidden = true;
}
```

- [ ] **Step 7: Style the panel (css/base.css)**

Append the block below to `css/base.css`, after the last existing rule. Without it the panel classes created by panel.js render unstyled (collapsed portrait, invisible chips). Colors reuse the Task 5 shell variables with inline fallbacks so the block stands alone even if a variable name drifts. The close button is the panel's first child, so `margin-left: auto` parks it top-right without assuming how `#panel` is positioned. No test; verified visually in Step 10.

```css
/* --- Panneau personne (Task 6) --- */
.panel-close {
  display: block;
  margin-left: auto;
  padding: 4px 10px;
  border: 1px solid var(--line, #3a3f45);
  border-radius: 4px;
  background: transparent;
  color: var(--text-dim, #9aa0a6);
  font-size: 0.8rem;
  cursor: pointer;
}

.panel-close:hover {
  color: var(--text, #e8eaed);
  border-color: var(--text-dim, #9aa0a6);
}

.panel-portrait,
.initials {
  width: 96px;
  height: 96px;
  margin: 8px auto 12px;
  border-radius: 50%;
}

.panel-portrait {
  display: block;
  object-fit: cover;
}

.initials {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface, #26292e);
  color: var(--text-dim, #9aa0a6);
  font-size: 2rem;
  font-weight: 600;
}

.panel-birthname,
.panel-dates {
  margin: 2px 0;
  color: var(--text-dim, #9aa0a6);
  font-size: 0.9rem;
}

.panel-birthname {
  font-style: italic;
}

.panel-bio {
  margin: 12px 0;
  line-height: 1.5;
}

.panel-section {
  margin-top: 16px;
}

.panel-section h3 {
  margin: 0 0 6px;
  color: var(--text-dim, #9aa0a6);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  padding: 4px 12px;
  border: 1px solid var(--line, #3a3f45);
  border-radius: 999px;
  background: var(--surface, #26292e);
  color: var(--text, #e8eaed);
  font-size: 0.85rem;
  cursor: pointer;
}

.chip:hover {
  background: var(--line, #3a3f45);
}
```

- [ ] **Step 8: Rewire js/main.js**

Replace the entire contents of `js/main.js` with the code below. It preserves the Task 5 contract exactly: exported `parseHash`/`buildHash` (identical behavior, `tests/hash.test.mjs` passes unchanged), French error banner on load failure, the `div.stage-message` fallback appended to `main` reading "Aucun thème disponible" while `THEMES` is empty (removed as soon as a theme renders), the `"genealogie-theme"` localStorage key, the window `"hashchange"` listener that re-renders when `parseHash(location.hash).theme` changes (deep links, back/forward), the `.active` class toggle on the `nav#themes` buttons inside `renderTheme` (keeps the `#themes button.active` rule in base.css live), the initial `history.replaceState` that syncs a localStorage-restored theme into the hash, the post-render viewBox aspect expansion (Task 5 code extracted into the `expandViewBoxToStageAspect(svg)` helper: themes emit content-bounds viewBoxes, and expanding to the stage aspect keeps "meet" letterboxing from skewing the panzoom cursor math), and `boot()` guarded so Node can import the module for tests. Because `createPanZoom` captures its home view from the viewBox at creation time, the pan-zoom instance is destroyed and recreated at the end of each successful `renderTheme`, after the expanded viewBox exists - never on the initial 0x0 viewBox.

On top of that it adds the Task 6 wiring: click delegation opens the panel, `onNavigate` re-opens the panel and flies to the person, search input renders results (name + birth year) that fly-to + open + set the `person` hash param, Escape closes panel and results, and `person` in the hash is opened on load. Fly-to reads the `positions` map returned by the active theme's `render` (empty until Task 7, so `flyTo` is a silent no-op for now).

```js
import { loadFamily, yearOf } from "./data.js";
import { assignGenerations } from "./generations.js";
import { computeLayout } from "./layout.js";
import { createPanZoom } from "./panzoom.js";
import { showPanel, hidePanel } from "./panel.js";
import { searchPersons } from "./search.js";
import { THEMES } from "./themes/index.js";

const THEME_STORAGE_KEY = "genealogie-theme";

export function parseHash(hash) {
  const params = new URLSearchParams((hash || "").replace(/^#/, ""));
  const theme = params.get("theme");
  const person = params.get("person");
  return {
    theme: theme && THEMES.some((t) => t.id === theme) ? theme : null,
    person: person || null
  };
}

export function buildHash({ theme, person }) {
  const parts = [];
  if (theme) parts.push("theme=" + theme);
  if (person) parts.push("person=" + person);
  return parts.length > 0 ? "#" + parts.join("&") : "";
}

const state = {
  svg: null, canvas: null,
  graph: null, generations: null, layout: null, panZoom: null,
  positions: new Map(), cleanup: null, themeId: null
};

function flyToPerson(id) {
  const pos = state.positions.get(id);
  if (pos) state.panZoom.flyTo(pos.x, pos.y);
}

function setHashPerson(personId) {
  const current = parseHash(location.hash);
  const next = buildHash({ theme: current.theme, person: personId });
  history.replaceState(null, "", next === "" ? location.pathname + location.search : next);
}

function openPerson(id) {
  if (!state.graph.persons.has(id)) return;
  showPanel(id, {
    graph: state.graph,
    generations: state.generations,
    onNavigate: (nextId) => {
      openPerson(nextId);
      flyToPerson(nextId);
    },
    onClose: closePanel
  });
  setHashPerson(id);
}

function closePanel() {
  hidePanel();
  setHashPerson(null);
}

function clearSearchResults() {
  const box = document.querySelector("#search-results");
  box.replaceChildren();
  box.hidden = true;
}

function renderSearchResults(matches) {
  const box = document.querySelector("#search-results");
  box.replaceChildren();
  box.hidden = matches.length === 0;
  for (const person of matches) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "search-result";
    const year = person.birth && person.birth.date ? yearOf(person.birth.date) : null;
    item.textContent = person.firstNames + " " + person.lastName
      + (year !== null ? " (" + year + ")" : "");
    item.addEventListener("click", () => {
      clearSearchResults();
      document.querySelector("#search").value = "";
      flyToPerson(person.id);
      openPerson(person.id);
    });
    box.appendChild(item);
  }
}

function showStageMessage(text) {
  clearStageMessage();
  const message = document.createElement("div");
  message.className = "stage-message";
  message.textContent = text;
  document.querySelector("main").appendChild(message);
}

function clearStageMessage() {
  const existing = document.querySelector("main .stage-message");
  if (existing) existing.remove();
}

function expandViewBoxToStageAspect(svg) {
  const vb = svg.viewBox.baseVal;
  const rect = svg.getBoundingClientRect();
  if (vb.width === 0 || vb.height === 0 || rect.width === 0 || rect.height === 0) return;
  const stageRatio = rect.width / rect.height;
  const boxRatio = vb.width / vb.height;
  if (boxRatio < stageRatio) {
    const width = vb.height * stageRatio;
    vb.x -= (width - vb.width) / 2;
    vb.width = width;
  } else if (boxRatio > stageRatio) {
    const height = vb.width / stageRatio;
    vb.y -= (height - vb.height) / 2;
    vb.height = height;
  }
}

function renderTheme(themeId) {
  const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];
  if (!theme) {
    document.body.className = "";
    state.svg.replaceChildren();
    showStageMessage("Aucun thème disponible");
    return;
  }
  clearStageMessage();
  if (state.cleanup) state.cleanup();
  state.cleanup = null;
  document.body.className = theme.className;
  const result = theme.render({
    svg: state.svg,
    canvas: state.canvas,
    graph: state.graph,
    generations: state.generations,
    layout: state.layout
  });
  state.positions = result.positions;
  if (result.cleanup) state.cleanup = result.cleanup;
  state.themeId = theme.id;
  localStorage.setItem(THEME_STORAGE_KEY, theme.id);

  for (const btn of document.querySelectorAll("#themes button")) {
    btn.classList.toggle("active", btn.dataset.themeId === theme.id);
  }

  expandViewBoxToStageAspect(state.svg);
  if (state.panZoom) state.panZoom.destroy();
  state.panZoom = createPanZoom(state.svg);
}

function buildThemeButtons() {
  const nav = document.querySelector("#themes");
  nav.replaceChildren();
  for (const theme of THEMES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.themeId = theme.id;
    btn.textContent = theme.label;
    btn.addEventListener("click", () => {
      renderTheme(theme.id);
      const current = parseHash(location.hash);
      history.replaceState(null, "",
        buildHash({ theme: theme.id, person: current.person }));
    });
    nav.appendChild(btn);
  }
}

async function boot() {
  state.svg = document.querySelector("#stage");
  state.canvas = document.querySelector("#backdrop");
  const banner = document.querySelector("#error-banner");
  let family;
  try {
    family = await loadFamily();
  } catch (err) {
    banner.textContent = err.message;
    banner.hidden = false;
    return;
  }
  state.graph = family.graph;
  for (const warning of state.graph.warnings) console.warn(warning);
  state.generations = assignGenerations(state.graph);
  state.layout = computeLayout(state.graph, state.generations);

  buildThemeButtons();
  const fromHash = parseHash(location.hash);
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  const initialTheme = fromHash.theme
    || (THEMES.some((t) => t.id === stored) ? stored : null)
    || (THEMES[0] ? THEMES[0].id : null);
  renderTheme(initialTheme);
  if (state.themeId && fromHash.theme !== state.themeId) {
    history.replaceState(null, "",
      buildHash({ theme: state.themeId, person: fromHash.person }));
  }

  window.addEventListener("hashchange", () => {
    const next = parseHash(location.hash);
    if (next.theme && next.theme !== state.themeId) renderTheme(next.theme);
  });

  state.svg.addEventListener("click", (event) => {
    const target = event.target.closest("[data-person-id]");
    if (target) openPerson(target.dataset.personId);
  });

  const searchInput = document.querySelector("#search");
  searchInput.addEventListener("input", () => {
    renderSearchResults(searchPersons(state.graph, searchInput.value));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    clearSearchResults();
    if (!document.querySelector("#panel").hidden) closePanel();
  });

  if (fromHash.person) {
    openPerson(fromHash.person);
    flyToPerson(fromHash.person);
  }
}

if (typeof document !== "undefined") {
  boot();
}
```

- [ ] **Step 9: Run the full test suite**

Run: `npm test`
Expected: PASS - every test file (validate, data, generations, layout, hash, search) passes with 0 failures. In particular `tests/hash.test.mjs` still passes against the rewritten `js/main.js`, proving the module still imports cleanly under Node (the `typeof document` guard) and `parseHash`/`buildHash` behavior is unchanged. If hash tests fail, you broke the Task 5 contract; fix `parseHash`/`buildHash`, do not touch the tests.

- [ ] **Step 10: Visual verification in the browser**

No theme exists yet, so person nodes cannot be clicked on the stage; verify the panel via search (fully wired) and via a temporary console call.

1. Serve the repo root: `python3 -m http.server 8000`, open `http://localhost:8000/`.
2. Page loads with no console errors; `main` contains a `div.stage-message` reading "Aucun thème disponible" (the Task 5 fallback mechanism, styled by the existing base.css rule; the SVG stage itself stays empty).
3. Type the first letters of a starter-data first name into `#search`, without accents: results appear under the input as "Prénom Nom (year)" entries, at most 8. Click one: the panel opens on the right with that person; the URL hash becomes `#person=<id>`. (Fly-to is a silent no-op until Task 7 - expected.)
4. In the panel, the Step 7 styles apply: `div.initials` is a centered circle showing the two initials (starter data has `photo: null`), then full name, muted French date line ("Née le ... à ..." for a living person; "date, lieu - date, lieu" for a deceased one - the starter family has both), bio paragraph, and only the non-empty chip groups among Parents / Conjoint(e)s / Enfants / Fratrie, rendered as pill chips with a hover state and uppercase section headings.
5. Click a chip in Parents or Enfants: the panel re-renders on that person and the hash updates.
6. Press Escape: panel and search results close, `person` disappears from the hash. The "Fermer" button also closes the panel.
7. Reload with `http://localhost:8000/#person=<id>` (use an id you saw in step 3): the panel opens on load.
8. Direct panel check per the task contract - in the browser console, pick any id from `data/family.json` and run:

```js
const { showPanel, hidePanel } = await import("./js/panel.js");
const { loadFamily } = await import("./js/data.js");
const { graph } = await loadFamily();
const ctx = { graph, generations: new Map(), onNavigate: (id) => showPanel(id, ctx), onClose: () => hidePanel() };
showPanel([...graph.persons.keys()][0], ctx);
```

Expected: panel renders that person; clicking chips navigates between relatives via the console `ctx`. Nothing from this snippet persists - it is verification only, no code change.

- [ ] **Step 11: Commit panel, styles and wiring**

```bash
git add js/panel.js css/base.css js/main.js
git commit -m "$(cat <<'EOF'
feat: person detail panel, panel styles and search wiring (panel.js, base.css, main.js)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Theme Frise du temps

**Files:**
- Create: `js/themes/frise.js`
- Create: `css/frise.css`
- Modify: `js/themes/index.js` (anchor: the `export const THEMES = [];` line created in Task 5)
- Modify: `index.html` (anchor: the `<link rel="stylesheet" href="css/base.css">` line in `<head>`)
- Test: none (theme tasks are verified visually in the browser; no unit test file)

**Interfaces:**
- Consumes: `yearOf(dateStr) -> int|null` from `js/data.js` (Task 2); `graph.persons: Map<id, Person>` and `graph.unions: Map<id, Union>` from `buildGraph` (Task 2); `generations: Map<personId, int>` from `assignGenerations` (Task 3); the render context `ctx = { svg, canvas, graph, generations, layout }` passed by `main.js` (Task 5). The frise ignores `ctx.layout` on purpose: a timeline has its own time-based geometry.
- Produces: default export `{ id: "frise", label: "Frise du temps", className: "theme-frise", render(ctx) }` where `render` returns `{ positions: Map<personId, {x, y}> }` in SVG user coordinates (bar centers). `main.js` uses `positions` for search fly-to (wired in Task 6) and the `data-person-id` attribute for click-to-panel delegation. No `cleanup` is returned: this theme runs no timers or rAF loops.

Design decisions pinned for this task (restate of contract + choices the code below implements):
- Horizontal year axis at the top, one tick and label per decade, faint vertical decade gridlines.
- One rounded life-bar per person, from birth year to death year, or to the current year (`new Date().getFullYear()`) when `death` is `null` (living). A person without a parseable birth year cannot be placed on a time axis and is skipped (no bar, no `positions` entry; search fly-to simply will not move for them).
- Lanes: one row per person, rows grouped by generation (ascending), sorted inside a generation by birth year. Bar color = 5-color palette pinned in the code, indexed by `generation % 5`.
- Marriage connector: vertical line at `x(union year)` between the two partners' bar centers, with a dot at each end. Unions with no date or fewer than two plotted partners get no connector.
- Dashed red "aujourd'hui" line at the current year, spanning the full chart height.
- Bar label: `FirstNames LastName (birth-death)`, `(birth)` for living, `(birth-?)` for deceased with unknown death year. Placed inside the bar when it fits (estimated at 6.5 px/char), otherwise just right of the bar.
- The canvas is not used: render clears it once and draws nothing on it.

- [ ] **Step 1: Create css/frise.css**

All selectors scoped under `body.theme-frise` per the theme contract. No smart quotes, no decorative Unicode.

```css
body.theme-frise {
  background: #f7f3ea;
}

body.theme-frise .frise-axis,
body.theme-frise .frise-tick {
  stroke: #6b6257;
  stroke-width: 1.5;
}

body.theme-frise .frise-grid {
  stroke: #6b6257;
  stroke-width: 0.5;
  opacity: 0.18;
}

body.theme-frise .frise-axis-label {
  fill: #6b6257;
  font-family: system-ui, sans-serif;
  font-size: 12px;
}

body.theme-frise .frise-person {
  cursor: pointer;
}

body.theme-frise .frise-person:hover rect {
  filter: brightness(1.15);
}

body.theme-frise .frise-label {
  font-family: system-ui, sans-serif;
  font-size: 11px;
}

body.theme-frise .frise-label-in {
  fill: #ffffff;
}

body.theme-frise .frise-label-out {
  fill: #3d3833;
}

body.theme-frise .frise-union {
  stroke: #8a8178;
  stroke-width: 2;
  opacity: 0.85;
}

body.theme-frise .frise-union-dot {
  fill: #8a8178;
}

body.theme-frise .frise-today {
  stroke: #c0392b;
  stroke-width: 2;
  stroke-dasharray: 6 4;
}

body.theme-frise .frise-today-label {
  fill: #c0392b;
  font-family: system-ui, sans-serif;
  font-size: 12px;
  font-weight: 600;
}
```

- [ ] **Step 2: Create js/themes/frise.js**

Complete module. Every clickable person element is a `<g data-person-id>` containing the rounded rect and its label. `render` sets the SVG viewBox to the chart bounds (this is the theme establishing the initial view; panzoom then manipulates the viewBox from there).

```js
import { yearOf } from "../data.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const PX_PER_YEAR = 8;
const MARGIN = { top: 70, right: 60, bottom: 30, left: 60 };
const BAR_HEIGHT = 22;
const LANE_GAP = 12;
const GEN_GAP = 46;
const MIN_BAR_WIDTH = 24;
const CHAR_WIDTH = 6.5; // rough label width estimate at font-size 11px
// One color per generation, pinned palette, indexed by generation % 5.
const GEN_COLORS = ["#4e79a7", "#e07b39", "#59a14c", "#b0648f", "#3e9d9a"];

function el(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

function textEl(content, attrs) {
  const node = el("text", attrs);
  node.textContent = content;
  return node;
}

export default {
  id: "frise",
  label: "Frise du temps",
  className: "theme-frise",
  render(ctx) {
    const { svg, canvas, graph, generations } = ctx;

    // This theme does not use the backdrop canvas: clear it.
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    svg.replaceChildren();

    const currentYear = new Date().getFullYear();

    // A person without a birth year cannot be placed on a time axis: skipped.
    const plotted = [];
    for (const person of graph.persons.values()) {
      const birthYear = person.birth && person.birth.date ? yearOf(person.birth.date) : null;
      if (birthYear === null) continue;
      let endYear;
      let yearsLabel;
      if (person.death === null) {
        endYear = currentYear;
        yearsLabel = "(" + birthYear + ")";
      } else {
        const deathYear = person.death.date ? yearOf(person.death.date) : null;
        endYear = deathYear === null ? birthYear : deathYear;
        yearsLabel = deathYear === null
          ? "(" + birthYear + "-?)"
          : "(" + birthYear + "-" + deathYear + ")";
      }
      plotted.push({ person, birthYear, endYear, yearsLabel });
    }

    let minYear = currentYear;
    let maxYear = currentYear;
    for (const item of plotted) {
      if (item.birthYear < minYear) minYear = item.birthYear;
      if (item.endYear > maxYear) maxYear = item.endYear;
    }
    const axisStart = Math.floor(minYear / 10) * 10;
    const axisEnd = Math.ceil((maxYear + 1) / 10) * 10;
    const xOf = (year) => MARGIN.left + (year - axisStart) * PX_PER_YEAR;

    // Lanes: one row per person, grouped by generation, sorted by birth year.
    const byGen = new Map();
    for (const item of plotted) {
      const gen = generations.get(item.person.id) ?? 0;
      if (!byGen.has(gen)) byGen.set(gen, []);
      byGen.get(gen).push(item);
    }
    const genList = [...byGen.keys()].sort((a, b) => a - b);
    const laneById = new Map();
    let cursorY = MARGIN.top;
    for (const gen of genList) {
      const items = byGen.get(gen);
      items.sort((a, b) => a.birthYear - b.birthYear || a.person.id.localeCompare(b.person.id));
      for (const item of items) {
        item.gen = gen;
        item.laneY = cursorY;
        laneById.set(item.person.id, item);
        cursorY += BAR_HEIGHT + LANE_GAP;
      }
      cursorY += GEN_GAP - LANE_GAP;
    }
    const bottomY = Math.max(cursorY - GEN_GAP + LANE_GAP, MARGIN.top);
    const width = MARGIN.left + (axisEnd - axisStart) * PX_PER_YEAR + MARGIN.right;
    const height = bottomY + MARGIN.bottom;
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);

    // Axis: baseline, decade gridlines, ticks, year labels.
    const axisY = MARGIN.top - 8;
    svg.appendChild(el("line", {
      x1: xOf(axisStart), y1: axisY, x2: xOf(axisEnd), y2: axisY, class: "frise-axis"
    }));
    for (let year = axisStart; year <= axisEnd; year += 10) {
      const x = xOf(year);
      svg.appendChild(el("line", { x1: x, y1: axisY, x2: x, y2: bottomY, class: "frise-grid" }));
      svg.appendChild(el("line", { x1: x, y1: axisY - 6, x2: x, y2: axisY, class: "frise-tick" }));
      svg.appendChild(textEl(String(year), {
        x, y: axisY - 12, class: "frise-axis-label", "text-anchor": "middle"
      }));
    }

    // Life bars.
    const positions = new Map();
    for (const item of laneById.values()) {
      const barX = xOf(item.birthYear);
      const barWidth = Math.max((item.endYear - item.birthYear) * PX_PER_YEAR, MIN_BAR_WIDTH);
      const centerY = item.laneY + BAR_HEIGHT / 2;
      const group = el("g", { "data-person-id": item.person.id, class: "frise-person" });
      group.appendChild(el("rect", {
        x: barX, y: item.laneY, width: barWidth, height: BAR_HEIGHT,
        rx: BAR_HEIGHT / 2, fill: GEN_COLORS[item.gen % GEN_COLORS.length]
      }));
      const label = item.person.firstNames + " " + item.person.lastName + " " + item.yearsLabel;
      const fitsInside = label.length * CHAR_WIDTH + 16 <= barWidth;
      group.appendChild(textEl(label, fitsInside
        ? { x: barX + 10, y: centerY, class: "frise-label frise-label-in", "dominant-baseline": "central" }
        : { x: barX + barWidth + 8, y: centerY, class: "frise-label frise-label-out", "dominant-baseline": "central" }));
      svg.appendChild(group);
      positions.set(item.person.id, { x: barX + barWidth / 2, y: centerY });
    }

    // Marriage connectors: vertical line at the union year between the two bars.
    for (const union of graph.unions.values()) {
      if (union.partners.length !== 2) continue;
      const unionYear = union.date ? yearOf(union.date) : null;
      if (unionYear === null) continue;
      const a = laneById.get(union.partners[0]);
      const b = laneById.get(union.partners[1]);
      if (!a || !b) continue;
      const x = xOf(unionYear);
      const yA = a.laneY + BAR_HEIGHT / 2;
      const yB = b.laneY + BAR_HEIGHT / 2;
      svg.appendChild(el("line", { x1: x, y1: yA, x2: x, y2: yB, class: "frise-union" }));
      svg.appendChild(el("circle", { cx: x, cy: yA, r: 3.5, class: "frise-union-dot" }));
      svg.appendChild(el("circle", { cx: x, cy: yB, r: 3.5, class: "frise-union-dot" }));
    }

    // Dashed red line at the current year.
    const todayX = xOf(currentYear);
    svg.appendChild(el("line", {
      x1: todayX, y1: axisY, x2: todayX, y2: bottomY, class: "frise-today"
    }));
    svg.appendChild(textEl("aujourd'hui", {
      x: todayX - 6, y: axisY - 26, class: "frise-today-label", "text-anchor": "end"
    }));

    return { positions };
  }
};
```

- [ ] **Step 3: Register the theme in js/themes/index.js**

Task 5 created this file as an empty registry (`export const THEMES = [];`). Replace its content with the following. The pinned final registry order is manuscrit, ciel, hologramme, frise; frise is built first but must stay LAST, so later theme tasks insert their entries before `frise`.

```js
import frise from "./frise.js";

// Final order: manuscrit, ciel, hologramme, frise.
// Later theme tasks insert their entries BEFORE frise in this array.
export const THEMES = [frise];
```

- [ ] **Step 4: Link the stylesheet in index.html**

In `<head>`, directly after the existing base stylesheet line

```html
<link rel="stylesheet" href="css/base.css">
```

add:

```html
<link rel="stylesheet" href="css/frise.css">
```

- [ ] **Step 5: Syntax-check the new modules**

Run: `node --check js/themes/frise.js && node --check js/themes/index.js` (from the repo root `/Users/govit/Git/Govit/Genealogy`; `--check` only parses, so the `document` reference and relative imports are fine).

Expected: no output, exit code 0. Any `SyntaxError` means a typo in Step 2 or 3; fix before proceeding.

- [ ] **Step 6: Browser verification**

Serve the repo root with a static server (ES modules do not load from `file://`):

Run: `python3 -m http.server 8000` from `/Users/govit/Git/Govit/Genealogy`, then open `http://localhost:8000/` in a browser.

Expected, all of the following:
- Toolbar shows a single theme button "Frise du temps" and the page background is light cream (`body` carries class `theme-frise`).
- Horizontal axis at the top with decade ticks and year labels (for the Task 1 starter data: roughly 1930-2030), plus faint vertical decade gridlines.
- One rounded bar per person, grouped in three lane blocks (one per generation), each block a different palette color (blue, orange, green for generations 0, 1, 2).
- Each bar labeled `FirstNames LastName (years)`: white text inside wide bars, dark text to the right of narrow bars.
- The remarried person from the starter data shows two vertical connectors (one per dated union), each with dots at both bar centers.
- Dashed red vertical line at the current year with the label "aujourd'hui" above the axis; living persons' bars end exactly on that line.
- Click a bar: the detail panel opens for that person; close it; click a chip in the panel navigates.
- Type a name in the search field, pick a result: the view animates (fly-to) to that person's bar.
- Drag pans and mouse wheel zooms over the chart.
- Browser console shows no errors.

Theme switching and canvas-clearing across themes cannot be exercised yet (frise is the only registered theme); that is covered when Tasks 8-10 add the others. Stop the server with Ctrl+C when done.

- [ ] **Step 7: Commit**

```bash
cd /Users/govit/Git/Govit/Genealogy
git add css/frise.css js/themes/frise.js js/themes/index.js index.html
git commit -m "$(cat <<'EOF'
feat: add frise du temps theme (timeline rendering)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Theme Manuscrit

**Files:**
- Create: `js/themes/manuscrit.js` (theme module, default export)
- Create: `css/manuscrit.css` (all selectors scoped under `body.theme-manuscrit`)
- Modify: `js/themes/index.js` - anchor: the `import frise from "./frise.js";` line and the `export const THEMES = [frise];` array written by Task 7; add the manuscrit import and put manuscrit FIRST in the array
- Modify: `index.html` - anchor: the `<link rel="stylesheet" href="css/frise.css">` tag in `<head>` written by Task 7; insert the manuscrit link right after it
- Test: none. Themes are verified visually in the browser (per spec "Themes verified visually in the browser during implementation"); a node smoke-import step stands in for a unit test.

**Interfaces:**

Consumes (from earlier tasks, do not reimplement):
- Task 5 `js/main.js` calls `theme.render(ctx)` with `ctx = { svg, canvas, graph, generations, layout }`, sets `body.className = theme.className`, and delegates clicks on any element with `data-person-id` to open the panel. It stores and invokes the previous theme's `cleanup` itself - this theme only has to clear the shared canvas pixels.
- Task 2 `buildGraph`: uses `graph.persons: Map<id, Person>` where `Person = { id, firstNames, lastName, birthName, sex, birth, death, photo, bio }`.
- Task 4 `computeLayout`: uses `layout.nodes: Map<id, {x, y}>`, `layout.links` (entries `{type:"partner", a, b, unionId}` or `{type:"child", unionId, parentIds, childId}` - ids only, never coordinates), `layout.rows: Array<{gen, y, personIds}>`. Layout spacing constants are `SPACING = { colGap: 90, rowGap: 160, coupleGap: 60 }` and `y = gen * rowGap` (gen 0 at layout top; this theme INVERTS that so gen 0 sits at the trunk, bottom).
- Task 6 search fly-to: consumes the `positions` map this render returns, in SVG user coordinates.

Produces (later tasks rely on):
- `js/themes/manuscrit.js` default export: `{ id: "manuscrit", label: "Manuscrit", className: "theme-manuscrit", render(ctx) }` where `render` returns `{ positions: Map<personId, {x, y}> }` (no `cleanup`: this theme runs no timers or rAF loops).
- `js/themes/index.js` now exports `THEMES = [manuscrit, frise]`. Tasks 9 and 10 must insert their entries to reach the final order: manuscrit, ciel, hologramme, frise.

- [ ] **Step 1: Create css/manuscrit.css**

Every selector is scoped under `body.theme-manuscrit` (the class main.js puts on `<body>`). Hover glow is pure CSS on the person groups. Body text keeps the book serif stack; the title cartouche and lettrine use the gothic display stack `"Luminari", "UnifrakturMaguntia", fantasy, serif` (macOS ships Luminari; degrades to serif elsewhere).

```css
/* Theme Manuscrit - tout est scope sous body.theme-manuscrit */

body.theme-manuscrit {
  background: #cdbb96;
}

body.theme-manuscrit #stage {
  font-family: "Iowan Old Style", Georgia, serif;
}

body.theme-manuscrit .ms-person {
  cursor: pointer;
}

body.theme-manuscrit .ms-person:hover {
  filter: drop-shadow(0 0 3px #e9c46a) drop-shadow(0 0 8px #b08d3e);
}

body.theme-manuscrit .ms-name {
  font-style: italic;
  font-size: 14px;
  fill: #3a2a18;
  text-anchor: middle;
}

body.theme-manuscrit .ms-shield-name {
  font-style: italic;
  font-size: 13px;
  fill: #3a2a18;
  text-anchor: middle;
}

body.theme-manuscrit .ms-title {
  font-family: "Luminari", "UnifrakturMaguntia", fantasy, serif;
  font-size: 30px;
  fill: #3a2a18;
  text-anchor: middle;
  letter-spacing: 1px;
}

body.theme-manuscrit .ms-lettrine {
  font-family: "Luminari", "UnifrakturMaguntia", fantasy, serif;
  fill: #7a1f1f;
  font-size: 38px;
}
```

- [ ] **Step 2: Link the stylesheet in index.html**

In `index.html` `<head>`, immediately after the `css/frise.css` link added by Task 7, insert the manuscrit line so the head contains:

```html
    <link rel="stylesheet" href="css/frise.css">
    <link rel="stylesheet" href="css/manuscrit.css">
```

(Selectors are body-class scoped so link order is not functionally significant, but keep it matching registry order for readability.)

- [ ] **Step 3: Create js/themes/manuscrit.js - constants, helpers, SVG defs**

Create the file with this exact content. `buildDefs` installs: the procedural parchment filter (feTurbulence, no image assets), the reusable rinceau vine tile (120px, reused with `<use>` on all four borders), the corner miniature (gold square, oxblood inner, cream fleur), the phylactere banner, and the couple shield.

```js
// Theme Manuscrit : page de manuscrit enlumine.
// Tout est dessine en SVG dans un repere fixe 1200x900 ; l'arbre est mis
// a l'echelle pour tenir dans le cadre (marges 46px). Generations
// INVERSEES par rapport au layout : generation 0 en bas, au pied du tronc.

const SVG_NS = "http://www.w3.org/2000/svg";

const PAGE_W = 1200;
const PAGE_H = 900;
const FRAME = 46;

const OXBLOOD = "#7a1f1f";
const GOLD = "#b08d3e";
const PARCHMENT = "#ecdfc3";
const PARCHMENT_LIGHT = "#f4ead2";
const RED = "#a32020";
const BLUE = "#2f4f8f";
const GREEN_DARK = "#5a7d3a";
const GREEN_LIGHT = "#7a9b52";
const BARK = "#6b4a2a";

function el(name, attrs = {}, parent = null) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (parent) parent.appendChild(node);
  return node;
}

// Pseudo-alea deterministe : la page est identique a chaque rendu.
function jitter(i, k) {
  return ((i * 7349 + k * 911) % 29) - 14;
}

function buildDefs(svg) {
  const defs = el("defs", {}, svg);

  // Parchemin procedural : taches (basse frequence) + grain (haute frequence).
  const filter = el("filter", { id: "ms-parchment", x: "-2%", y: "-2%", width: "104%", height: "104%" }, defs);
  el("feTurbulence", { type: "fractalNoise", baseFrequency: "0.012", numOctaves: "5", seed: "7", result: "blotch" }, filter);
  el("feColorMatrix", {
    in: "blotch", type: "matrix",
    values: "0 0 0 0 0.45  0 0 0 0 0.36  0 0 0 0 0.22  0 0 0 0.28 0",
    result: "stain"
  }, filter);
  el("feTurbulence", { type: "fractalNoise", baseFrequency: "0.55", numOctaves: "2", seed: "11", result: "grainNoise" }, filter);
  el("feColorMatrix", {
    in: "grainNoise", type: "matrix",
    values: "0 0 0 0 0.25  0 0 0 0 0.18  0 0 0 0 0.10  0 0 0 0.08 0",
    result: "grain"
  }, filter);
  const merge = el("feMerge", {}, filter);
  el("feMergeNode", { in: "SourceGraphic" }, merge);
  el("feMergeNode", { in: "stain" }, merge);
  el("feMergeNode", { in: "grain" }, merge);

  // Rinceau : tuile de 120px autour de y=0, reutilisee sur les 4 bordures.
  const vine = el("g", { id: "ms-vine" }, defs);
  el("path", { d: "M0,0 C20,-10 40,10 60,0 C80,-10 100,10 120,0", fill: "none", stroke: "#4c6b2f", "stroke-width": "2" }, vine);
  el("ellipse", { cx: "30", cy: "-6", rx: "7", ry: "3", fill: GREEN_DARK, transform: "rotate(-30 30 -6)" }, vine);
  el("ellipse", { cx: "90", cy: "6", rx: "7", ry: "3", fill: GREEN_DARK, transform: "rotate(30 90 6)" }, vine);
  el("circle", { cx: "15", cy: "4", r: "4", fill: BLUE }, vine);
  el("circle", { cx: "15", cy: "4", r: "1.6", fill: GOLD }, vine);
  el("circle", { cx: "60", cy: "-2", r: "4.5", fill: RED }, vine);
  el("circle", { cx: "60", cy: "-2", r: "1.6", fill: GOLD }, vine);
  el("circle", { cx: "105", cy: "-5", r: "4", fill: BLUE }, vine);
  el("circle", { cx: "105", cy: "-5", r: "1.6", fill: GOLD }, vine);
  el("circle", { cx: "42", cy: "7", r: "1.8", fill: GOLD }, vine);
  el("circle", { cx: "78", cy: "-7", r: "1.8", fill: GOLD }, vine);

  // Miniature de coin : carre or, interieur lie-de-vin, fleur stylisee creme.
  const corner = el("g", { id: "ms-corner" }, defs);
  el("rect", { x: "0", y: "0", width: "52", height: "52", fill: GOLD }, corner);
  el("rect", { x: "5", y: "5", width: "42", height: "42", fill: OXBLOOD }, corner);
  el("rect", { x: "8", y: "8", width: "36", height: "36", fill: "none", stroke: GOLD, "stroke-width": "1" }, corner);
  el("path", { d: "M26,12 C21,20 21,27 26,33 C31,27 31,20 26,12 Z", fill: PARCHMENT_LIGHT }, corner);
  el("path", { d: "M15,25 C12,31 16,35 22,34 C19,30 18,27 19,24 C17,23 16,23 15,25 Z", fill: PARCHMENT_LIGHT }, corner);
  el("path", { d: "M37,25 C40,31 36,35 30,34 C33,30 34,27 33,24 C35,23 36,23 37,25 Z", fill: PARCHMENT_LIGHT }, corner);
  el("rect", { x: "18", y: "33", width: "16", height: "3", fill: GOLD }, corner);
  el("path", { d: "M26,36 C24,39 24,42 26,45 C28,42 28,39 26,36 Z", fill: PARCHMENT_LIGHT }, corner);

  // Phylactere : corps 120x30 centre sur (0,0), queues d'aronde aux bouts.
  const banner = el("g", { id: "ms-banner" }, defs);
  el("path", { d: "M-60,-8 L-72,-13 L-68,0 L-72,13 L-60,8 Z", fill: "#cbb98f", stroke: OXBLOOD, "stroke-width": "1" }, banner);
  el("path", { d: "M60,-8 L72,-13 L68,0 L72,13 L60,8 Z", fill: "#cbb98f", stroke: OXBLOOD, "stroke-width": "1" }, banner);
  el("path", {
    d: "M-60,-15 H60 C64,-15 66,-11 66,-7 V7 C66,11 64,15 60,15 H-60 C-64,15 -66,11 -66,7 V-7 C-66,-11 -64,-15 -60,-15 Z",
    fill: PARCHMENT_LIGHT, stroke: OXBLOOD, "stroke-width": "1.5"
  }, banner);
  el("rect", { x: "-62", y: "-11", width: "124", height: "22", fill: "none", stroke: GOLD, "stroke-width": "0.8" }, banner);

  // Ecu du couple racine : 190x112, bord haut a y=-50, filet or, partition centrale.
  const shield = el("g", { id: "ms-shield" }, defs);
  el("path", { d: "M-95,-50 H95 V5 C95,35 60,52 0,62 C-60,52 -95,35 -95,5 Z", fill: PARCHMENT_LIGHT, stroke: OXBLOOD, "stroke-width": "3" }, shield);
  el("path", { d: "M-88,-43 H88 V4 C88,31 56,46 0,55 C-56,46 -88,31 -88,4 Z", fill: "none", stroke: GOLD, "stroke-width": "1.5" }, shield);
  el("line", { x1: "0", y1: "-43", x2: "0", y2: "52", stroke: GOLD, "stroke-width": "1.5" }, shield);
}
```

- [ ] **Step 4: Append parchment, frame and cartouche drawing**

Append to the end of `js/themes/manuscrit.js`. The frame is a double border (oxblood + gold) on BOTH edges of the fixed 46px band, vine tiles run centered in the band on all four sides (bottom mirrored, left/right rotated), corner miniatures cover the four band corners.

```js
function drawParchment(svg) {
  el("rect", { x: 0, y: 0, width: PAGE_W, height: PAGE_H, fill: PARCHMENT, filter: "url(#ms-parchment)" }, svg);
}

function drawFrame(svg) {
  const g = el("g", { id: "ms-frame" }, svg);

  // Double bordure lie-de-vin + or, sur les deux bords de la bande de 46px.
  el("rect", { x: 4, y: 4, width: PAGE_W - 8, height: PAGE_H - 8, fill: "none", stroke: OXBLOOD, "stroke-width": "5" }, g);
  el("rect", { x: 11, y: 11, width: PAGE_W - 22, height: PAGE_H - 22, fill: "none", stroke: GOLD, "stroke-width": "1.5" }, g);
  el("rect", { x: FRAME, y: FRAME, width: PAGE_W - 2 * FRAME, height: PAGE_H - 2 * FRAME, fill: "none", stroke: OXBLOOD, "stroke-width": "4" }, g);
  el("rect", { x: FRAME - 7, y: FRAME - 7, width: PAGE_W - 2 * (FRAME - 7), height: PAGE_H - 2 * (FRAME - 7), fill: "none", stroke: GOLD, "stroke-width": "1.5" }, g);

  // Rinceaux : repetition de la tuile de 120px, centree dans la bande.
  const TILE = 120;
  const mid = 27;
  const runs = [
    { len: PAGE_W - 140, place: (t) => `translate(${70 + t},${mid})` },
    { len: PAGE_W - 140, place: (t) => `translate(${70 + t},${PAGE_H - mid}) scale(1,-1)` },
    { len: PAGE_H - 140, place: (t) => `translate(${mid},${70 + t}) rotate(90)` },
    { len: PAGE_H - 140, place: (t) => `translate(${PAGE_W - mid},${70 + t}) rotate(90) scale(1,-1)` }
  ];
  for (const run of runs) {
    const n = Math.floor(run.len / TILE);
    const start = (run.len - n * TILE) / 2;
    for (let i = 0; i < n; i++) {
      el("use", { href: "#ms-vine", transform: run.place(start + i * TILE) }, g);
    }
  }

  // Miniatures de coin.
  const c = 52;
  el("use", { href: "#ms-corner", transform: "translate(6,6)" }, g);
  el("use", { href: "#ms-corner", transform: `translate(${PAGE_W - c - 6},6)` }, g);
  el("use", { href: "#ms-corner", transform: `translate(6,${PAGE_H - c - 6})` }, g);
  el("use", { href: "#ms-corner", transform: `translate(${PAGE_W - c - 6},${PAGE_H - c - 6})` }, g);
}

function drawCartouche(svg) {
  const g = el("g", { id: "ms-cartouche" }, svg);
  el("rect", { x: 390, y: 74, width: 420, height: 62, fill: PARCHMENT_LIGHT, stroke: OXBLOOD, "stroke-width": "3" }, g);
  el("rect", { x: 396, y: 80, width: 408, height: 50, fill: "none", stroke: GOLD, "stroke-width": "1.5" }, g);
  const t = el("text", { x: 600, y: 116, class: "ms-title" }, g);
  const lettrine = el("tspan", { class: "ms-lettrine" }, t);
  lettrine.textContent = "A";
  const rest = el("tspan", {}, t);
  rest.textContent = "rbre de la Famille";
}
```

- [ ] **Step 5: Append coordinate mapping, trunk, branches and foliage**

Append to the end of `js/themes/manuscrit.js`. `makeMapping` computes the fit scale from the layout extents into the inner area and INVERTS y (`mapY = baseY - layoutY * scale`, so gen 0 lands at the bottom). `deco` shrinks banners when scaled columns are tight (couples sit `coupleGap = 60` layout units apart, narrower than the 136px banner). Foliage circles use the two greens and fruits are appended after all circles so the gold dots stay on top.

```js
function makeMapping(layout) {
  const innerL = FRAME + 80;
  const innerR = PAGE_W - FRAME - 80;
  const topY = 215;   // sous le cartouche, laisse la place a la canopee
  const baseY = 755;  // bande generation 0, au pied du tronc

  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = 0;
  for (const { x, y } of layout.nodes.values()) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX)) { minX = 0; maxX = 0; }

  const scale = Math.min(
    (innerR - innerL) / Math.max(maxX - minX, 1),
    (baseY - topY) / Math.max(maxY, 1)
  );
  const offX = innerL + ((innerR - innerL) - (maxX - minX) * scale) / 2 - minX * scale;
  const mapX = (x) => offX + x * scale;
  const mapY = (y) => baseY - y * scale;   // INVERSION : generation 0 en bas
  const midX = mapX((minX + maxX) / 2);

  // Echelle des ornements : retrecit les bannieres si les colonnes sont serrees.
  let minGap = Infinity;
  for (const row of layout.rows) {
    for (let i = 1; i < row.personIds.length; i++) {
      const a = layout.nodes.get(row.personIds[i - 1]);
      const b = layout.nodes.get(row.personIds[i]);
      const gap = Math.abs(b.x - a.x) * scale;
      if (gap < minGap) minGap = gap;
    }
  }
  const deco = Math.min(1, (Number.isFinite(minGap) ? minGap : 140) / 140);

  const rowY = new Map(layout.rows.map((r) => [r.gen, mapY(r.y)]));
  const rootGen = Math.min(...rowY.keys());
  const maxGen = Math.max(...rowY.keys());
  return { mapX, mapY, midX, rowY, rootGen, maxGen, deco };
}

function drawTree(svg, layout, m) {
  const g = el("g", { id: "ms-tree" }, svg);
  const footY = m.rowY.get(m.rootGen);
  const trunkTop = m.maxGen > m.rootGen ? m.rowY.get(m.maxGen) - 30 : footY - 120;
  const x = m.midX;

  // Tronc effile.
  el("path", {
    d: `M${x - 24},${footY + 55} C${x - 21},${footY} ${x - 13},${(footY + trunkTop) / 2} ${x - 6},${trunkTop} L${x + 6},${trunkTop} C${x + 13},${(footY + trunkTop) / 2} ${x + 21},${footY} ${x + 24},${footY + 55} Z`,
    fill: BARK
  }, g);

  // Racines evasees a la base.
  for (const [dx, ex] of [[-16, -58], [-6, -24], [8, 30], [18, 62]]) {
    el("path", {
      d: `M${x + dx},${footY + 38} C${x + dx},${footY + 55} ${x + ex * 0.7},${footY + 52} ${x + ex},${footY + 62}`,
      fill: "none", stroke: BARK, "stroke-width": "7", "stroke-linecap": "round"
    }, g);
  }

  // Branches courbes : du tronc vers chaque personne des bandes superieures.
  for (const row of layout.rows) {
    if (row.gen === m.rootGen) continue;
    const py = m.rowY.get(row.gen);
    const below = m.rowY.get(row.gen - 1);
    const startY = below === undefined ? py + 90 : below - 26;
    for (const pid of row.personIds) {
      const px = m.mapX(layout.nodes.get(pid).x);
      const midY = (startY + py) / 2;
      el("path", {
        d: `M${x},${startY} C${x},${midY} ${px},${midY + 30} ${px},${py + 20}`,
        fill: "none", stroke: BARK,
        "stroke-width": String(Math.max(3.5, 13 - 3.5 * row.gen)),
        "stroke-linecap": "round"
      }, g);
    }
  }
}

function drawFoliage(svg, layout, m) {
  const g = el("g", { id: "ms-foliage" }, svg);
  const fruits = [];
  let i = 0;
  for (const row of layout.rows) {
    if (row.gen === m.rootGen) continue;
    const py = m.rowY.get(row.gen);
    for (const pid of row.personIds) {
      const px = m.mapX(layout.nodes.get(pid).x);
      el("circle", { cx: px + jitter(i, 1), cy: py - 12 + jitter(i, 2) / 3, r: 46, fill: GREEN_DARK, opacity: "0.95" }, g);
      el("circle", { cx: px + 18 + jitter(i, 3), cy: py - 26 + jitter(i, 4) / 3, r: 33, fill: GREEN_LIGHT, opacity: "0.95" }, g);
      if (row.gen === m.maxGen) {
        el("circle", { cx: px - 14 + jitter(i, 5), cy: py - 46, r: 38, fill: GREEN_LIGHT, opacity: "0.9" }, g);
      }
      fruits.push({ cx: px - 22 + jitter(i, 6) / 2, cy: py - 34 });
      fruits.push({ cx: px + 27 + jitter(i, 7) / 2, cy: py - 6 });
      i++;
    }
  }
  // Fruits d'or par-dessus tout le feuillage.
  for (const f of fruits) {
    el("circle", { cx: f.cx, cy: f.cy, r: 4, fill: GOLD }, g);
  }
}
```

- [ ] **Step 6: Append person banners, root shields and the default export**

Append to the end of `js/themes/manuscrit.js`. Root couples (both partners in the root row, paired greedily from `layout.links` partner entries, so a remarried root gets one shield and one banner) share a shield; everyone else gets a phylactere banner. Every clickable group carries `data-person-id`. Positions of banner/name centers are returned for search fly-to. The canvas is not used: its pixels are wiped every render (main.js invokes the previous theme's `cleanup` itself).

```js
function displayName(person) {
  return `${person.firstNames.split(" ")[0]} ${person.lastName}`;
}

function drawPersons(svg, graph, layout, m) {
  const g = el("g", { id: "ms-persons" }, svg);
  const positions = new Map();

  // Couples racines -> ecus. Appariement glouton sur les liens partner.
  const rootRow = layout.rows.find((r) => r.gen === m.rootGen);
  const onShield = new Set();
  const shields = [];
  for (const link of layout.links) {
    if (link.type !== "partner") continue;
    if (!rootRow.personIds.includes(link.a) || !rootRow.personIds.includes(link.b)) continue;
    if (onShield.has(link.a) || onShield.has(link.b)) continue;
    onShield.add(link.a);
    onShield.add(link.b);
    shields.push([link.a, link.b]);
  }

  const sy = m.rowY.get(m.rootGen);
  for (const [a, b] of shields) {
    let ax = m.mapX(layout.nodes.get(a).x);
    let bx = m.mapX(layout.nodes.get(b).x);
    let [left, right] = [a, b];
    if (ax > bx) { [left, right] = [b, a]; [ax, bx] = [bx, ax]; }
    const cx = (ax + bx) / 2;
    const grp = el("g", { transform: `translate(${cx},${sy}) scale(${m.deco})` }, g);
    el("use", { href: "#ms-shield" }, grp);
    for (const [pid, dx] of [[left, -47], [right, 47]]) {
      const p = graph.persons.get(pid);
      const pg = el("g", { class: "ms-person", "data-person-id": pid, transform: `translate(${dx},0)` }, grp);
      const t = el("text", { class: "ms-shield-name", y: "-8" }, pg);
      const first = el("tspan", { x: "0" }, t);
      first.textContent = p.firstNames.split(" ")[0];
      const last = el("tspan", { x: "0", dy: "18" }, t);
      last.textContent = p.lastName;
      positions.set(pid, { x: cx + dx * m.deco, y: sy });
    }
  }

  // Tous les autres -> bannieres phylactere.
  for (const row of layout.rows) {
    const py = m.rowY.get(row.gen);
    for (const pid of row.personIds) {
      if (onShield.has(pid)) continue;
      const p = graph.persons.get(pid);
      const px = m.mapX(layout.nodes.get(pid).x);
      const grp = el("g", {
        class: "ms-person", "data-person-id": pid,
        transform: `translate(${px},${py}) scale(${m.deco})`
      }, g);
      el("use", { href: "#ms-banner" }, grp);
      const t = el("text", { class: "ms-name", y: "5" }, grp);
      t.textContent = displayName(p);
      positions.set(pid, { x: px, y: py });
    }
  }
  return positions;
}

export default {
  id: "manuscrit",
  label: "Manuscrit",
  className: "theme-manuscrit",
  render(ctx) {
    const { svg, canvas, graph, layout } = ctx;

    // Pas de canvas dans ce theme : on efface ce qu'un theme precedent a laisse.
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);

    svg.innerHTML = "";
    svg.setAttribute("viewBox", `0 0 ${PAGE_W} ${PAGE_H}`);

    buildDefs(svg);
    drawParchment(svg);

    const m = makeMapping(layout);
    drawTree(svg, layout, m);
    drawFoliage(svg, layout, m);
    const positions = drawPersons(svg, graph, layout, m);
    drawCartouche(svg);
    drawFrame(svg);

    return { positions };
  }
};
```

- [ ] **Step 7: Register the theme in js/themes/index.js**

Task 7 left the file as:

```js
import frise from "./frise.js";

export const THEMES = [frise];
```

Replace its content with (keep whatever Task 7 actually wrote for frise; the invariant is that manuscrit comes BEFORE frise, since the final registry order across Tasks 7-10 is manuscrit, ciel, hologramme, frise):

```js
import manuscrit from "./manuscrit.js";
import frise from "./frise.js";

export const THEMES = [manuscrit, frise];
```

- [ ] **Step 8: Smoke-check the module loads under node**

The module top level touches no DOM (`document` is only used inside functions), so a plain node import must succeed.

Run: `cd /Users/govit/Git/Govit/Genealogy && node -e "import('./js/themes/manuscrit.js').then(m => console.log(m.default.id, m.default.label, m.default.className))"`

Expected: prints exactly `manuscrit Manuscrit theme-manuscrit` with no error. Any SyntaxError or ReferenceError here means a typo in Steps 3-6; fix before touching the browser.

- [ ] **Step 9: Browser verification**

Serve the repo root (zero-dependency static server):

Run: `cd /Users/govit/Git/Govit/Genealogy && python3 -m http.server 8123`

Open `http://localhost:8123/` and click the "Manuscrit" button in the toolbar (it may not be active if localStorage remembers another theme). Verify every item:

- Parchment texture is visibly mottled (stains and grain), not a flat beige.
- Frame: double border (oxblood #7a1f1f outside, gold #b08d3e inside) on BOTH edges of the 46px band, on all four sides.
- Vine scrollwork with red and blue flowers and gold dots runs along all four borders.
- Four corner miniatures: gold square, oxblood inner square, cream fleur.
- Title cartouche "Arbre de la Famille" top center, red lettrine "A", title in a gothic display font (Luminari on macOS; plain serif on other systems is acceptable) over parchment plate.
- Tree is INVERTED: tapered trunk at the BOTTOM with root flare; root couple(s) on shield(s) at the trunk foot; brown branches curve up from the trunk to each upper generation; layered green foliage (two greens) behind the upper generations; gold fruit dots on top of the foliage.
- Every non-root person sits on a phylactere banner with an italic name; no banner collides unreadably with its neighbor.
- Hover a banner: gold glow (drop-shadow). Cursor is a pointer.
- Click a banner: the person panel opens for that person. Click a shield name: same.
- Type a name in the search box, pick a result: the view flies to and centers on that person's banner.
- Switch to "Frise" and back to "Manuscrit": no leftover elements, no console errors.
- URL hash shows `#theme=manuscrit` after switching.

Stop the server (Ctrl+C) when done. Fix and re-verify anything that fails before committing.

- [ ] **Step 10: Commit**

```bash
cd /Users/govit/Git/Govit/Genealogy
git add js/themes/manuscrit.js css/manuscrit.css js/themes/index.js index.html
git commit -m "$(cat <<'EOF'
feat: add manuscrit illuminated manuscript theme

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Theme Ciel étoilé

Repo root: `/Users/govit/Git/Govit/Genealogy` (all paths below are relative to it; run all commands from it).

**Files:**
- Create: `js/themes/ciel.js`
- Create: `css/ciel.css`
- Modify: `js/themes/index.js` (anchor: the import block and the `export const THEMES = [...]` array, which after Task 8 contain `manuscrit` and `frise`)
- Modify: `index.html` (anchor: the theme stylesheet `<link>` tags in `<head>` added by Tasks 7-8, after `css/base.css`)
- Test: none new. Themes are verified visually; the existing suite is run as a regression guard because two shared files are modified.

**Interfaces:**

Consumes (exact shapes from earlier tasks):
- Task 4 `computeLayout` result, received as `layout`: `{ nodes: Map<id, {x, y}>, links: Array<{type:"partner", a, b, unionId} | {type:"child", unionId, parentIds: string[], childId}>, rows, width, height }`. Links carry ids only; this theme maps ids to its own (jittered) positions.
- Task 3 `assignGenerations` result, received as `generations`: `Map<personId, int>`, roots at 0. Every person in the graph has an entry.
- Task 2 graph, received as `graph`: uses `graph.persons: Map<id, Person>`; `Person.death` is `{date, place}` or `null`/absent, where null/absent means living; `firstNames` and `lastName` are required strings.
- Task 5 theme contract: default export `{ id, label, className: "theme-<id>", render(ctx) }` with `ctx = { svg, canvas, graph, generations, layout }`. `svg` is `svg#stage`, `canvas` is `canvas#backdrop` (sits behind the SVG). main.js sets `body.className = theme.className`, click-delegates on `[data-person-id]` to open the panel, and invokes the previous render's returned `cleanup()` before rendering the next theme.

Produces (later tasks rely on):
- `js/themes/ciel.js` default export `{ id: "ciel", label: "Ciel étoilé", className: "theme-ciel", render }` where `render(ctx)` returns `{ positions: Map<personId, {x, y}>, cleanup }`. `positions` are SVG user coordinates (Task 6 search fly-to targets them); `cleanup()` cancels the rAF loop and removes the resize listener.
- Registry order after this task: `[manuscrit, ciel, frise]`. Task 10 will insert `hologramme` between `ciel` and `frise`.

Design constants for this task (restated so nothing is guessed): 200 backdrop stars, all pseudo-randomness via a deterministic sin-hash (never `Math.random`, so reloads are pixel-identical); shooting star every 8-15 s lasting ~0.7 s; person-star jitter max 18px per axis from a hash of the person id; living star fill `#eaf1ff` with white glow, deceased `#ffd27a` with warm glow; partner links `#8fb4ff` bright, child links same hue fainter; star radius shrinks with generation (elders larger): `max(5, 11 - gen * 2)`; labels rest at faint opacity 0.15 and fade to opacity 1 on hover of the star group (CSS transition). The spec's zoom-threshold label reveal is deliberately omitted in v1; hover is the only reveal (accepted deviation, recorded here).

- [ ] **Step 1: Create css/ciel.css (night gradient, link strokes, label fade-in)**

All selectors scoped under `body.theme-ciel` per the theme contract. The `#backdrop` rules re-assert full-viewport coverage so the starfield fills the stage regardless of base.css details. Labels rest nearly invisible (opacity 0.15) and fade to full opacity when the star group (`.ciel-person`) is hovered, via the CSS transition below. The spec also asks for a zoom-threshold reveal; that is deliberately omitted in v1 (hover-only reveal) and recorded as an accepted deviation.

```css
/* Theme Ciel etoile - scoped under body.theme-ciel */

body.theme-ciel main {
  position: relative;
  background: radial-gradient(ellipse at 50% 30%, #16224a 0%, #0a1128 55%, #030614 100%);
}

body.theme-ciel #backdrop {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

body.theme-ciel .ciel-link-partner {
  stroke: #8fb4ff;
  stroke-width: 1.6;
  stroke-opacity: 0.75;
}

body.theme-ciel .ciel-link-child {
  stroke: #8fb4ff;
  stroke-width: 1;
  stroke-opacity: 0.3;
}

body.theme-ciel .ciel-person {
  cursor: pointer;
}

body.theme-ciel .ciel-label {
  fill: #cdd9f7;
  font-size: 11px;
  text-anchor: middle;
  opacity: 0.15;
  transition: opacity 0.15s ease;
  user-select: none;
}

body.theme-ciel .ciel-person:hover .ciel-label {
  opacity: 1;
}
```

- [ ] **Step 2: Create js/themes/ciel.js - deterministic hashes and canvas starfield (first half of the file)**

Write `js/themes/ciel.js` with exactly this content (the render function and export are appended in Step 3; the file is not imported by anything until Step 4, so it may be incomplete between steps):

```js
// Theme "Ciel etoile": canvas starfield backdrop + SVG constellation overlay.
// All pseudo-randomness is a deterministic sin-hash so reloads render identically.

const STAR_COUNT = 200;
const JITTER_MAX = 18;
const SVG_NS = "http://www.w3.org/2000/svg";

function hash01(n, salt) {
  const s = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function idHash01(id, salt) {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) % 1000003;
  return hash01(n, salt);
}

function startBackdrop(canvas) {
  const ctx2d = canvas.getContext("2d");

  const stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      fx: hash01(i, 1),
      fy: hash01(i, 2),
      size: 0.6 + hash01(i, 3) * 1.4,
      phase: hash01(i, 4) * Math.PI * 2,
      speed: 0.5 + hash01(i, 5) * 1.5
    });
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  let rafId = 0;
  let shooting = null;
  let shootCount = 0;
  let nextShootAt = 0;

  function frame(t) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx2d.clearRect(0, 0, w, h);

    for (const s of stars) {
      const twinkle = 0.5 + 0.5 * Math.sin((t / 1000) * s.speed + s.phase);
      ctx2d.globalAlpha = 0.3 + 0.6 * twinkle;
      ctx2d.fillStyle = "#dfe8ff";
      ctx2d.beginPath();
      ctx2d.arc(s.fx * w, s.fy * h, s.size, 0, Math.PI * 2);
      ctx2d.fill();
    }
    ctx2d.globalAlpha = 1;

    // 8-15 s between shooting stars, deterministic per launch index.
    if (nextShootAt === 0) nextShootAt = t + 8000 + hash01(shootCount, 6) * 7000;
    if (shooting === null && t >= nextShootAt) {
      shootCount += 1;
      shooting = {
        x: hash01(shootCount, 7) * w * 0.8,
        y: hash01(shootCount, 8) * h * 0.4,
        angle: Math.PI * 0.15 + hash01(shootCount, 9) * Math.PI * 0.2,
        start: t,
        duration: 700
      };
    }
    if (shooting !== null) {
      const p = (t - shooting.start) / shooting.duration;
      if (p >= 1) {
        shooting = null;
        nextShootAt = t + 8000 + hash01(shootCount, 6) * 7000;
      } else {
        const dist = 260 * p;
        const hx = shooting.x + Math.cos(shooting.angle) * dist;
        const hy = shooting.y + Math.sin(shooting.angle) * dist;
        const tx = hx - Math.cos(shooting.angle) * 70;
        const ty = hy - Math.sin(shooting.angle) * 70;
        const grad = ctx2d.createLinearGradient(tx, ty, hx, hy);
        grad.addColorStop(0, "rgba(255,255,255,0)");
        grad.addColorStop(1, "rgba(255,255,255," + (0.9 * (1 - p)).toFixed(3) + ")");
        ctx2d.strokeStyle = grad;
        ctx2d.lineWidth = 2;
        ctx2d.beginPath();
        ctx2d.moveTo(tx, ty);
        ctx2d.lineTo(hx, hy);
        ctx2d.stroke();
      }
    }

    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);

  return function stop() {
    cancelAnimationFrame(rafId);
    window.removeEventListener("resize", resize);
    ctx2d.setTransform(1, 0, 0, 1, 0, 0);
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  };
}
```

- [ ] **Step 3: Append the SVG constellation render and default export to js/themes/ciel.js**

Append exactly this to the end of the same file:

```js
function el(name, attrs) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

function render({ svg, canvas, graph, generations, layout }) {
  svg.replaceChildren();

  // Layout positions plus deterministic jitter (max 18px per axis) to
  // break the grid into constellation shapes.
  const positions = new Map();
  for (const [id, pos] of layout.nodes) {
    const jx = (idHash01(id, 1) - 0.5) * 2 * JITTER_MAX;
    const jy = (idHash01(id, 2) - 0.5) * 2 * JITTER_MAX;
    positions.set(id, { x: pos.x + jx, y: pos.y + jy });
  }

  // Initial framing; panzoom (Task 5) takes over viewBox manipulation afterwards.
  const margin = 80;
  svg.setAttribute(
    "viewBox",
    `${-margin} ${-margin} ${layout.width + 2 * margin} ${layout.height + 2 * margin}`
  );

  const defs = el("defs", {});
  const glowLiving = el("filter", {
    id: "ciel-glow-living", x: "-150%", y: "-150%", width: "400%", height: "400%"
  });
  glowLiving.appendChild(el("feDropShadow", {
    dx: 0, dy: 0, stdDeviation: 4, "flood-color": "#ffffff", "flood-opacity": 0.85
  }));
  const glowDeceased = el("filter", {
    id: "ciel-glow-deceased", x: "-150%", y: "-150%", width: "400%", height: "400%"
  });
  glowDeceased.appendChild(el("feDropShadow", {
    dx: 0, dy: 0, stdDeviation: 5, "flood-color": "#ffb066", "flood-opacity": 0.9
  }));
  defs.appendChild(glowLiving);
  defs.appendChild(glowDeceased);
  svg.appendChild(defs);

  const linksGroup = el("g", { class: "ciel-links" });
  for (const link of layout.links) {
    if (link.type === "partner") {
      const a = positions.get(link.a);
      const b = positions.get(link.b);
      linksGroup.appendChild(el("line", {
        x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "ciel-link-partner"
      }));
    } else {
      const child = positions.get(link.childId);
      const parents = link.parentIds.map((pid) => positions.get(pid));
      const mx = parents.reduce((sum, p) => sum + p.x, 0) / parents.length;
      const my = parents.reduce((sum, p) => sum + p.y, 0) / parents.length;
      linksGroup.appendChild(el("line", {
        x1: mx, y1: my, x2: child.x, y2: child.y, class: "ciel-link-child"
      }));
    }
  }
  svg.appendChild(linksGroup);

  const personsGroup = el("g", { class: "ciel-persons" });
  for (const [id, pos] of positions) {
    const person = graph.persons.get(id);
    const gen = generations.get(id);
    const radius = Math.max(5, 11 - gen * 2);
    const deceased = person.death != null;
    const g = el("g", { "data-person-id": id, class: "ciel-person" });
    g.appendChild(el("circle", {
      cx: pos.x,
      cy: pos.y,
      r: radius,
      fill: deceased ? "#ffd27a" : "#eaf1ff",
      filter: deceased ? "url(#ciel-glow-deceased)" : "url(#ciel-glow-living)"
    }));
    const label = el("text", { x: pos.x, y: pos.y + radius + 15, class: "ciel-label" });
    label.textContent = `${person.firstNames.split(" ")[0]} ${person.lastName}`;
    g.appendChild(label);
    personsGroup.appendChild(g);
  }
  svg.appendChild(personsGroup);

  const stopBackdrop = startBackdrop(canvas);
  return { positions, cleanup: stopBackdrop };
}

export default { id: "ciel", label: "Ciel étoilé", className: "theme-ciel", render };
```

Notes for the implementer, do not "improve" these away:
- `person.death != null` is a deliberate loose check: `null` and an absent field both mean living.
- No guards around `positions.get(...)` in the links loop: Task 4 guarantees every id in `layout.links` exists in `layout.nodes`, and Task 2 drops dangling refs before layout ever runs.
- Labels stay pointer-enabled on purpose: clicking a label must bubble to `g[data-person-id]` for the panel delegation.

- [ ] **Step 4: Register the theme in js/themes/index.js**

After Task 8 the file imports `manuscrit` and `frise` and exports `THEMES = [manuscrit, frise]`. Add the `ciel` import and place `ciel` between `manuscrit` and `frise`. Target content:

```js
import manuscrit from "./manuscrit.js";
import ciel from "./ciel.js";
import frise from "./frise.js";

export const THEMES = [manuscrit, ciel, frise];
```

If the existing import lines are in a different order, keep them as they are; the only requirements are the new import line and the array order `[manuscrit, ciel, frise]`.

- [ ] **Step 5: Link the stylesheet in index.html**

In `<head>`, after the existing theme stylesheet links from Tasks 7-8 (anchor: the line `<link rel="stylesheet" href="css/manuscrit.css">`), add:

```html
<link rel="stylesheet" href="css/ciel.css">
```

Link order among theme stylesheets is irrelevant (every theme's selectors are scoped under its `body.theme-<id>`); it only needs to come after `css/base.css`.

- [ ] **Step 6: Module smoke check and regression run**

The theme touches no DOM at import time, so it can be import-checked in Node.

Run: `cd /Users/govit/Git/Govit/Genealogy && node -e "import('./js/themes/ciel.js').then(m => console.log(m.default.id, m.default.className, typeof m.default.render))"`
Expected: `ciel theme-ciel function`

Run: `npm test` (equivalent to `node --test`)
Expected: every existing test from Tasks 1-6 still passes, 0 failures. This task adds no tests, but this run is a real import regression guard for the registry change: `tests/hash.test.mjs` imports `js/main.js`, which imports `js/themes/index.js`, which imports every registered theme - so a syntax error in `js/themes/ciel.js` or a broken registry edit fails the suite. `index.html` has no test; Step 7 covers it in the browser.

- [ ] **Step 7: Browser verification**

Serve the repo root (any static server; GitHub Pages equivalence needs nothing more):

```bash
cd /Users/govit/Git/Govit/Genealogy
python3 -m http.server 8000
```

Open `http://localhost:8000/` and click the "Ciel étoilé" button in the toolbar. Verify every item:

1. Stage background is a dark radial night gradient; roughly 200 small stars are visible and visibly twinkle (brightness oscillates at different rates).
2. Within 20 seconds, at least one shooting star crosses the sky: a brief white streak lasting under a second.
3. Persons render as glowing circles: living persons pale `#eaf1ff` with a soft white glow, deceased persons gold `#ffd27a` with a warmer glow. With the Task 1 starter data, the deceased grandparents must be gold.
4. Elder generations have visibly larger stars than younger ones.
5. Person stars are jittered off the strict layout grid; partner lines are brighter blue than the fainter child lines; the family reads as constellations (the y-jitter keeps couple labels from overlapping once revealed).
6. Name labels rest barely visible (opacity 0.15) and fade smoothly to full opacity when hovering a star group (star or label); cursor becomes a pointer over a star or its label. No zoom-based reveal is expected: v1 is hover-only (accepted deviation from the spec).
7. Clicking a star (or its label) opens the detail panel for that person; the URL hash contains `theme=ciel` and the person id.
8. Typing a name in the search box and selecting a result flies the view to that person's star (Task 6 wiring, fed by the returned `positions`).
9. Switch to another theme (Manuscrit or Frise): the starfield vanishes, the backdrop canvas is blank, and no shooting star ever appears afterwards - proof that `cleanup()` cancelled the rAF loop. Resize the window in the other theme: nothing redraws on the canvas (resize listener removed).
10. Switch back to Ciel étoilé and reload the page: star positions and constellation jitter are pixel-identical to before (determinism).

Stop the server with Ctrl+C.

- [ ] **Step 8: Commit**

```bash
cd /Users/govit/Git/Govit/Genealogy
git add js/themes/ciel.js css/ciel.css js/themes/index.js index.html
git commit -m "$(cat <<'EOF'
feat: add theme Ciel etoile (starfield + constellations)

Canvas backdrop with deterministic twinkling stars and periodic shooting
stars; SVG overlay renders persons as glowing stars (gold for deceased),
jittered into constellation shapes; render returns positions + cleanup.
Registered between manuscrit and frise.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Theme Hologramme

**Files:**
- Create: `js/themes/hologramme.js`
- Create: `css/hologramme.css`
- Modify: `js/themes/index.js` (anchor: the import block and the `export const THEMES = [...]` array; insert `hologramme` between `ciel` and `frise`)
- Modify: `index.html` (anchor: the `<link rel="stylesheet" href="css/ciel.css">` tag in `<head>`; add the hologramme stylesheet right after it)
- Test: no unit test file. Themes are verified visually in the browser (per spec); the existing suite is re-run as a regression guard.

**Interfaces:**

Consumes (from earlier tasks):
- `computeLayout(graph, generations)` result passed in as `ctx.layout` (Task 4): `{ nodes: Map<id, {x, y}>, links: Array<{type:"partner", a, b, unionId} | {type:"child", unionId, parentIds: string[], childId}>, rows, width, height }`. Links carry ids only, never coordinates.
- `SPACING = { colGap: 90, rowGap: 160, coupleGap: 60 }` (Task 4) - not imported, but it constrains geometry: couple partners sit 60 SVG units apart center-to-center, so a person card must be strictly narrower than 60 units. Our hexagon is 54 wide.
- `buildGraph` result passed in as `ctx.graph` (Task 2): `persons: Map<id, Person>`, `unions: Map<id, Union>`.
- `export function yearOf(dateStr) -> int|null` from `js/data.js` (Task 2).
- Theme render context from `main.js` (Task 5): `ctx = { svg, canvas, graph, generations, layout }` where `svg` is `svg#stage` and `canvas` is `canvas#backdrop` sitting behind it.
- Click delegation on `[data-person-id]` and search fly-to (Tasks 5/6) - every clickable person element must carry `data-person-id`.

Produces:
- `js/themes/hologramme.js` default export: `{ id: "hologramme", label: "Hologramme", className: "theme-hologramme", render(ctx) -> { positions: Map<personId, {x, y}> } }`. Positions are in SVG user coordinates and are exactly the layout positions (this theme uses them as-is). No `cleanup` is returned: all animation is SMIL (`animateMotion`) and CSS, no JS timers or rAF loops, so there is nothing to stop. `main.js` (Task 5) tolerates a missing `cleanup`.
- Registry entry in `THEMES` at final position 3 of 4: `manuscrit, ciel, hologramme, frise`.

Design constants (restated so you do not improvise): background `#04070d`; faint cyan SVG grid pattern (40x40 tiles, stroke `rgba(39,224,255,0.07)`); hexagonal person cards 54 wide x 44 tall, glassy fill `rgba(9,30,44,0.85)`, cyan `#27e0ff` stroke plus outer glow filter; names uppercase and years in `ui-monospace`; union nodes = small magenta `#ff3df0` diamonds at the midpoint of couples; links = thin cyan paths with SMIL pulse circles traveling along them; hover = CSS `steps()` glitch flicker plus brighter glow; HUD caption top-left reading `GENEALOGIE :: <count> FICHES`. All UI text French; no decorative Unicode anywhere.

- [ ] **Step 1: Write css/hologramme.css**

Every selector is scoped under `body.theme-hologramme` (the contract: `main.js` sets `body.className` to the active theme's `className`). The glitch animation targets an inner group, not the outer card group: the outer `<g>` carries its position in a `transform` *attribute*, and a CSS `transform` on the same element would override that attribute and yank the card to the origin. Nesting avoids that trap.

```css
/* Theme Hologramme - HUD sci-fi. All selectors scoped under body.theme-hologramme. */

body.theme-hologramme,
body.theme-hologramme #stage {
  background: #04070d;
}

body.theme-hologramme .holo-caption {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  fill: #27e0ff;
  letter-spacing: 3px;
  opacity: 0.85;
}

body.theme-hologramme .holo-card {
  cursor: pointer;
}

body.theme-hologramme .holo-hex {
  fill: rgba(9, 30, 44, 0.85);
  stroke: #27e0ff;
  stroke-width: 1.2;
  filter: url(#holo-glow);
}

body.theme-hologramme .holo-card:hover .holo-hex {
  stroke: #b9f4ff;
  filter: url(#holo-glow-strong);
}

body.theme-hologramme .holo-card:hover .holo-card-inner {
  animation: holo-glitch 0.32s steps(2, jump-none) infinite;
}

body.theme-hologramme .holo-name {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  fill: #eafcff;
}

body.theme-hologramme .holo-years {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  fill: #7fdcff;
}

body.theme-hologramme .holo-link {
  fill: none;
  stroke: rgba(39, 224, 255, 0.35);
  stroke-width: 1;
}

body.theme-hologramme .holo-union {
  fill: #ff3df0;
  filter: drop-shadow(0 0 3px #ff3df0);
}

body.theme-hologramme .holo-pulse-cyan {
  fill: #27e0ff;
}

body.theme-hologramme .holo-pulse-magenta {
  fill: #ff3df0;
}

@keyframes holo-glitch {
  0% { opacity: 1; transform: translate(0, 0); }
  20% { opacity: 0.6; transform: translate(1.5px, 0); }
  40% { opacity: 1; transform: translate(-1.5px, 0.5px); }
  60% { opacity: 0.75; transform: translate(0, -1px); }
  80% { opacity: 1; transform: translate(-0.5px, 1px); }
  100% { opacity: 0.85; transform: translate(1px, 0); }
}
```

- [ ] **Step 2: Write js/themes/hologramme.js**

Geometry notes baked into the code: the render sets an explicit `viewBox` first (the other themes do too) - layout bounds plus a 120-unit margin, with 80 extra units above for the caption at y=-60; without it the SVG viewBox is 0x0 on a `#theme=hologramme` deep link, `zoomAt` computes NaN, pan is a no-op, and the caption and negative-coordinate grid are clipped. The hexagon is a flat chip `points="-27,0 -17,-22 17,-22 27,0 17,22 -17,22"` (54 wide, 44 tall), which fits inside the 60-unit couple pitch with 6 units of clearance. Text that would overflow the hex gets squeezed via `textLength` + `lengthAdjust="spacingAndGlyphs"` (monospace advance is roughly 0.62em per char, hence the estimate). Union diamonds are drawn only for unions with two positioned partners; single-parent unions route their child links straight out of the lone parent's card. Pulses are `<circle>` elements carrying an SMIL `<animateMotion>` whose `path` duplicates the link's `d`; negative `begin` offsets desynchronize them without any JS loop. DOM paint order bottom-to-top: grid, links, pulses, union diamonds, cards, caption.

```js
import { yearOf } from "../data.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const HEX_POINTS = "-27,0 -17,-22 17,-22 27,0 17,22 -17,22";
const PULSE_DUR = 3;

function el(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function monoText(str, y, fontSize, maxWidth, cls) {
  const t = el("text", { x: 0, y, class: cls, "font-size": fontSize, "text-anchor": "middle" });
  t.textContent = str;
  if (str.length * fontSize * 0.62 > maxWidth) {
    t.setAttribute("textLength", maxWidth);
    t.setAttribute("lengthAdjust", "spacingAndGlyphs");
  }
  return t;
}

function yearsLabel(person) {
  const b = person.birth ? yearOf(person.birth.date) : null;
  const d = person.death ? yearOf(person.death.date) : null;
  if (b !== null && d !== null) return `${b} - ${d}`;
  if (b !== null) return `${b}`;
  if (d !== null) return `- ${d}`;
  return "";
}

function buildDefs() {
  const defs = el("defs");

  const pattern = el("pattern", {
    id: "holo-grid",
    width: 40,
    height: 40,
    patternUnits: "userSpaceOnUse"
  });
  pattern.appendChild(el("path", {
    d: "M 40 0 L 0 0 L 0 40",
    fill: "none",
    stroke: "rgba(39,224,255,0.07)",
    "stroke-width": 1
  }));
  defs.appendChild(pattern);

  for (const [id, blur] of [["holo-glow", 2.5], ["holo-glow-strong", 5]]) {
    const f = el("filter", { id, x: "-60%", y: "-60%", width: "220%", height: "220%" });
    f.appendChild(el("feGaussianBlur", { stdDeviation: blur, result: "blur" }));
    const merge = el("feMerge");
    merge.appendChild(el("feMergeNode", { in: "blur" }));
    merge.appendChild(el("feMergeNode", { in: "SourceGraphic" }));
    f.appendChild(merge);
    defs.appendChild(f);
  }
  return defs;
}

export default {
  id: "hologramme",
  label: "Hologramme",
  className: "theme-hologramme",
  render(ctx) {
    const { svg, canvas, graph, layout } = ctx;

    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    svg.replaceChildren();

    const m = 120;
    svg.setAttribute("viewBox", `${-m} ${-m - 80} ${layout.width + 2 * m} ${layout.height + 2 * m + 80}`);

    svg.appendChild(buildDefs());

    svg.appendChild(el("rect", {
      x: -2000,
      y: -2000,
      width: layout.width + 4000,
      height: layout.height + 4000,
      fill: "url(#holo-grid)"
    }));

    const unionAnchor = new Map();
    for (const [uid, u] of graph.unions) {
      const pts = u.partners.map(pid => layout.nodes.get(pid)).filter(Boolean);
      if (pts.length === 0) continue;
      unionAnchor.set(uid, {
        x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
        y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
        partnerCount: pts.length
      });
    }

    const linkGroup = el("g");
    const pulseGroup = el("g");
    let pulseIndex = 0;

    const addPulse = (d, cls) => {
      const c = el("circle", { r: 2.5, class: cls });
      c.appendChild(el("animateMotion", {
        dur: `${PULSE_DUR}s`,
        repeatCount: "indefinite",
        begin: `-${((pulseIndex % 8) * PULSE_DUR / 8).toFixed(3)}s`,
        path: d
      }));
      pulseIndex += 1;
      pulseGroup.appendChild(c);
    };

    for (const link of layout.links) {
      if (link.type === "partner") {
        const a = layout.nodes.get(link.a);
        const b = layout.nodes.get(link.b);
        if (!a || !b) continue;
        const d = `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
        linkGroup.appendChild(el("path", { d, class: "holo-link" }));
        addPulse(d, "holo-pulse-magenta");
      } else {
        const from = unionAnchor.get(link.unionId);
        const child = layout.nodes.get(link.childId);
        if (!from || !child) continue;
        const midY = from.y + (child.y - from.y) / 2;
        const d = `M ${from.x} ${from.y} L ${from.x} ${midY} L ${child.x} ${midY} L ${child.x} ${child.y}`;
        linkGroup.appendChild(el("path", { d, class: "holo-link" }));
        addPulse(d, "holo-pulse-cyan");
      }
    }
    svg.appendChild(linkGroup);
    svg.appendChild(pulseGroup);

    const unionGroup = el("g");
    for (const anchor of unionAnchor.values()) {
      if (anchor.partnerCount < 2) continue;
      const { x, y } = anchor;
      unionGroup.appendChild(el("path", {
        d: `M ${x} ${y - 5} L ${x + 5} ${y} L ${x} ${y + 5} L ${x - 5} ${y} Z`,
        class: "holo-union"
      }));
    }
    svg.appendChild(unionGroup);

    const cardGroup = el("g");
    for (const [pid, pos] of layout.nodes) {
      const person = graph.persons.get(pid);
      if (!person) continue;
      const card = el("g", {
        class: "holo-card",
        "data-person-id": pid,
        transform: `translate(${pos.x}, ${pos.y})`
      });
      const inner = el("g", { class: "holo-card-inner" });
      inner.appendChild(el("polygon", { points: HEX_POINTS, class: "holo-hex" }));
      inner.appendChild(monoText(person.firstNames.split(" ")[0].toUpperCase(), -8, 7, 42, "holo-name"));
      inner.appendChild(monoText(person.lastName.toUpperCase(), 2, 7, 46, "holo-name"));
      const years = yearsLabel(person);
      if (years) inner.appendChild(monoText(years, 13, 6, 42, "holo-years"));
      card.appendChild(inner);
      cardGroup.appendChild(card);
    }
    svg.appendChild(cardGroup);

    let minX = 0;
    for (const pos of layout.nodes.values()) minX = Math.min(minX, pos.x);
    const caption = el("text", {
      class: "holo-caption",
      x: minX - 27,
      y: -60,
      "font-size": 11,
      "text-anchor": "start"
    });
    caption.textContent = `GENEALOGIE :: ${graph.persons.size} FICHES`;
    svg.appendChild(caption);

    return { positions: layout.nodes };
  }
};
```

- [ ] **Step 3: Syntax-check the module**

Run: `node --input-type=module --check < /Users/govit/Git/Govit/Genealogy/js/themes/hologramme.js`
Expected: no output, exit code 0. Any syntax error prints here before you touch the registry.

- [ ] **Step 4: Register the theme in js/themes/index.js**

After Task 9 the file contains imports for `manuscrit`, `ciel`, `frise` and `export const THEMES = [manuscrit, ciel, frise];`. Add the hologramme import and insert it into the array between `ciel` and `frise` - the contract fixes the final order as manuscrit, ciel, hologramme, frise. Resulting file:

```js
import manuscrit from "./manuscrit.js";
import ciel from "./ciel.js";
import hologramme from "./hologramme.js";
import frise from "./frise.js";

export const THEMES = [manuscrit, ciel, hologramme, frise];
```

If the import lines in the existing file are in a different order, leave them as they are and only add the `hologramme` import next to them; the `THEMES` array order is what matters.

- [ ] **Step 5: Link the stylesheet in index.html**

In `<head>`, find the last theme stylesheet link (`<link rel="stylesheet" href="css/ciel.css">`) and add immediately after it:

```html
<link rel="stylesheet" href="css/hologramme.css">
```

- [ ] **Step 6: Regression-run the test suite**

The registry edit sits on the import path of `main.js`, which `tests/hash.test.mjs` imports, so a broken import in the theme module would surface here.

Run: `node --test tests/`
Expected: all tests PASS, same count as before this task, zero failures.

- [ ] **Step 7: Browser verification**

Serve the repo root (no build step, plain static files):

```bash
python3 -m http.server 8000 --directory /Users/govit/Git/Govit/Genealogy
```

Open `http://localhost:8000/#theme=hologramme` and verify every item:

- Near-black `#04070d` background with a faint cyan grid behind everything.
- A "Hologramme" button appears in the theme nav between "Ciel" and "Frise"; clicking it activates the theme, sets the hash to `#theme=hologramme`, and the choice survives a page reload (localStorage).
- One hexagonal card per person (12 with the starter data): glassy dark fill, cyan stroke, visible outer glow, first name and last name in uppercase monospace, years line beneath (e.g. `1942 - 2010`, or just the birth year for the living).
- Couple partners' cards do not overlap (hex 54 wide vs 60 couple pitch).
- A small magenta diamond sits at the midpoint of every couple; the single-parent union has no diamond and its child link exits the lone parent's card.
- Thin cyan links: horizontal partner lines, orthogonal elbows down to children; small pulse dots travel along them continuously (cyan on child links, magenta on partner links), desynchronized, with zero JS running (check: no rAF activity from this theme in the Performance tab if you care).
- Hover a card: it flickers with a stepped glitch jitter and the hex glow brightens; the card does not jump to the SVG origin (that would mean the glitch animation landed on the outer positioned group - re-read Step 1).
- Top-left of the scene: `GENEALOGIE :: 12 FICHES` in spaced cyan monospace, visible in the initial view without zooming (the render sets the viewBox with headroom for it).
- Load `http://localhost:8000/#theme=hologramme` directly in a fresh tab: the full scene including the caption and grid renders on first paint, and pan/zoom work immediately (the viewBox is set by render, not inherited from a previous theme).
- Click a card: the detail panel opens for that person. Search a name with accents mishandled on purpose (e.g. "gerard" for "Gérard"), pick a result: the view flies to that person's hex.
- Switch from Ciel étoilé to Hologramme: the starfield stops and the canvas is blank (this theme clears it; `main.js` invoked the previous theme's cleanup).
- Pan (drag), zoom (wheel), and pinch still work; pulses keep moving while zoomed.

Fix anything that fails before committing. Then stop the server.

- [ ] **Step 8: Commit**

```bash
cd /Users/govit/Git/Govit/Genealogy
git add js/themes/hologramme.js css/hologramme.css js/themes/index.js index.html
git commit -m "$(cat <<'EOF'
feat: add hologramme theme (sci-fi HUD)

Hex person cards with cyan glow on a grid backdrop, magenta union
diamonds, SMIL pulses along links, CSS glitch flicker on hover.
Registered between ciel and frise; stylesheet linked in index.html.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Contribution page (contribute.html + js/contribute.js)

**Files:**
- Create: `js/contribute.js` (pure submission logic + DOM wiring behind a `typeof document` guard)
- Create: `contribute.html`
- Create: `css/contribute.css`
- Test: `tests/contribute.test.mjs`
- Modify: none. `index.html` already has the footer link to `contribute.html` ("Participer") from Task 5. Do not touch it.

**Interfaces:**

*Consumes:*
- `data/family.json` shape (Task 1): `{ persons: Person[], unions: Union[] }` with `Person = { id, firstNames, lastName, birthName, sex, birth: {date, place}|null, death: {date, place}|null, photo, bio }` and `Union = { id, partners: [personId] (1 or 2), date: string|null, children: [personId] }`. Fetched at runtime only to populate the person/union pickers. Tests never read this file.
- `js/search.js` (Task 6): `normalize(s)` (NFD, diacritics stripped, lowercase), reused for the accent-insensitive correction picker. The module is DOM-free, so importing it keeps `js/contribute.js` loadable under plain node.
- `css/base.css` (Task 5): linked for the shared look; `css/contribute.css` is linked after it and scoped under `body.contribute-page`.

*Produces (Task 12 `tools/apply-submission.mjs` consumes these exact shapes; it duplicates `slugify` rather than importing it, so this file is the reference implementation):*
- `export const CONTACT_EMAIL = "gregory.gelly@gmail.com"`
- `export function slugify(firstNames, lastName) -> "gregory-gelly"` (NFD normalize, strip `\u0300-\u036f`, lowercase, non-alphanumeric runs collapse to one hyphen, leading/trailing hyphens trimmed)
- `export function buildSubmission(kind, fields) -> { version: 1, type, payload, note, submitterName }` with `type` in `"ajout-personne" | "correction-personne" | "union" | "remarque"`. Payloads:
  - `ajout-personne`: full Person minus `id` (with `photo: null`), plus `photoPromised: bool`, plus optional `parents: { unionId }` or `parents: { parentIds: [id, id?] }`
  - `correction-personne`: `{ id, firstNames, lastName, birthName, sex, birth, death, bio }` - no `photo` key (apply overwrites all provided fields; the form cannot edit the photo path, so it must not be present) and no `photoPromised`
  - `union`: `{ partners: [id, id?], date: string|null, children: [id...] }`
  - `remarque`: `payload: null`, the text lives in `note`
- `export function submissionToMailto(sub, email) -> "mailto:..."` with subject `Généalogie - <type> - <detail>` (detail = "Prénoms Nom" if the payload has them, else partners joined by " & ", else the first 40 chars of the note), body = `JSON.stringify(sub, null, 1)` URL-encoded via `encodeURIComponent`.

Constants restated for this task: dates validate against `^\d{4}(-\d{2}){0,2}$`; sex select maps Homme/Femme/Inconnu to `"M"`/`"F"`/`null`; JSON pretty-print indent is 1 space everywhere (preview, clipboard, mailto body); all UI strings French, straight quotes only, no em dashes.

- [ ] **Step 1: Write the failing test file**

Write `tests/contribute.test.mjs` exactly as follows:

```js
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
```

- [ ] **Step 2: Run the tests, expect failure**

Run: `node --test tests/contribute.test.mjs`
Expected: FAIL. The suite cannot even load: `ERR_MODULE_NOT_FOUND` for `../js/contribute.js`. Any other failure reason means you mistyped the test file.

- [ ] **Step 3: Implement the pure submission logic**

Write `js/contribute.js` exactly as follows (DOM wiring comes in Step 8; this file must import cleanly under plain node):

```js
export const CONTACT_EMAIL = "gregory.gelly@gmail.com";

export function slugify(firstNames, lastName) {
  return `${firstNames} ${lastName}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+)|(-+$)/g, "");
}

function personFields(fields) {
  const birth = fields.birthDate || fields.birthPlace
    ? { date: fields.birthDate || null, place: fields.birthPlace || null }
    : null;
  const death = fields.deathDate || fields.deathPlace
    ? { date: fields.deathDate || null, place: fields.deathPlace || null }
    : null;
  return {
    firstNames: fields.firstNames,
    lastName: fields.lastName,
    birthName: fields.birthName || null,
    sex: fields.sex || null,
    birth,
    death,
    bio: fields.bio || null
  };
}

export function buildSubmission(kind, fields) {
  let payload;
  if (kind === "ajout-personne") {
    payload = { ...personFields(fields), photo: null, photoPromised: Boolean(fields.photoPromised) };
    if (fields.parents) payload.parents = fields.parents;
  } else if (kind === "correction-personne") {
    payload = { id: fields.id, ...personFields(fields) };
  } else if (kind === "union") {
    payload = {
      partners: fields.partners,
      date: fields.date || null,
      children: fields.children || []
    };
  } else if (kind === "remarque") {
    payload = null;
  } else {
    throw new Error(`Type de contribution inconnu : ${kind}`);
  }
  return {
    version: 1,
    type: kind,
    payload,
    note: fields.note || "",
    submitterName: fields.submitterName || ""
  };
}

export function submissionToMailto(sub, email) {
  const p = sub.payload;
  let detail;
  if (p && p.firstNames) detail = `${p.firstNames} ${p.lastName}`;
  else if (p && p.partners) detail = p.partners.join(" & ");
  else detail = (sub.note || "").slice(0, 40);
  const subject = `Généalogie - ${sub.type} - ${detail}`;
  const body = JSON.stringify(sub, null, 1);
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
```

- [ ] **Step 4: Run the tests, expect pass**

Run: `node --test tests/contribute.test.mjs`
Expected: 9 tests, 9 pass, 0 fail.

- [ ] **Step 5: Commit the logic**

```bash
git add tests/contribute.test.mjs js/contribute.js
git commit -F - <<'EOF'
feat: contribution submission logic (slugify, buildSubmission, mailto)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
```

- [ ] **Step 6: Write contribute.html**

Write `contribute.html` exactly as follows. Note the initial `hidden` attributes match the default mode (ajout-personne). The correction picker is a text input plus a clickable results list (accent-insensitive filtering, wired in Step 8), because native `<select>` type-ahead is accent-sensitive; the parent and union partner/children pickers stay plain `<select>` elements on purpose - those lists are bounded and shown in full, so a select is acceptable there and keeps the section small:

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Participer - Généalogie de la famille</title>
  <link rel="stylesheet" href="css/base.css">
  <link rel="stylesheet" href="css/contribute.css">
</head>
<body class="contribute-page">
  <header class="contribute-header">
    <h1>Participer à la généalogie</h1>
    <a href="index.html">Retour à l'arbre</a>
  </header>
  <main class="contribute-main">
    <p class="intro">Proposez un ajout ou une correction. Votre contribution est envoyée par e-mail puis intégrée manuellement au site.</p>
    <form id="contribute-form" novalidate>
      <fieldset id="fs-mode">
        <legend>Que souhaitez-vous faire ?</legend>
        <label><input type="radio" name="mode" value="ajout-personne" checked> Ajouter une personne</label>
        <label><input type="radio" name="mode" value="correction-personne"> Corriger une fiche</label>
        <label><input type="radio" name="mode" value="union"> Ajouter ou corriger une union</label>
        <label><input type="radio" name="mode" value="remarque"> Autre remarque</label>
      </fieldset>

      <fieldset id="fs-picker" hidden>
        <legend>Personne à corriger</legend>
        <label>Rechercher la personne
          <input type="text" id="person-search" placeholder="Prénom ou nom" autocomplete="off">
        </label>
        <ul id="person-results" hidden></ul>
        <p id="person-selected"></p>
      </fieldset>

      <fieldset id="fs-person">
        <legend>Fiche de la personne</legend>
        <label>Prénoms *<input type="text" id="f-firstNames"></label>
        <label>Nom *<input type="text" id="f-lastName"></label>
        <label>Nom de naissance<input type="text" id="f-birthName"></label>
        <label>Sexe
          <select id="f-sex">
            <option value="">Inconnu</option>
            <option value="M">Homme</option>
            <option value="F">Femme</option>
          </select>
        </label>
        <label>Date de naissance<input type="text" id="f-birthDate" placeholder="AAAA-MM-JJ"></label>
        <p class="hint">AAAA ou AAAA-MM suffisent si le jour est inconnu.</p>
        <label>Lieu de naissance<input type="text" id="f-birthPlace"></label>
        <label>Date de décès<input type="text" id="f-deathDate" placeholder="AAAA-MM-JJ"></label>
        <label>Lieu de décès<input type="text" id="f-deathPlace"></label>
        <label>Biographie<textarea id="f-bio" rows="4"></textarea></label>
      </fieldset>

      <fieldset id="fs-ajout-extra">
        <legend>Parents et photo</legend>
        <label>Union des parents (si elle existe déjà)
          <select id="f-parentUnion"><option value="">-- Aucune --</option></select>
        </label>
        <label>Ou parent 1<select id="f-parent1"><option value="">-- Aucun --</option></select></label>
        <label>Et parent 2<select id="f-parent2"><option value="">-- Aucun --</option></select></label>
        <label class="checkbox"><input type="checkbox" id="f-photoPromised"> J'enverrai une photo par e-mail</label>
      </fieldset>

      <fieldset id="fs-union" hidden>
        <legend>Union</legend>
        <label>Partenaire 1 *<select id="f-partner1"><option value="">-- Choisir --</option></select></label>
        <label>Partenaire 2<select id="f-partner2"><option value="">-- Aucun --</option></select></label>
        <label>Date de l'union<input type="text" id="f-unionDate" placeholder="AAAA-MM-JJ"></label>
        <label>Enfants (Ctrl-clic pour en choisir plusieurs)
          <select id="f-children" multiple size="6"></select>
        </label>
      </fieldset>

      <fieldset id="fs-common">
        <legend>Votre message</legend>
        <label>Votre nom *<input type="text" id="f-submitterName"></label>
        <label>Note libre<textarea id="f-note" rows="3"></textarea></label>
      </fieldset>

      <div id="form-errors" class="errors" hidden></div>
      <button type="submit" id="generate-btn">Générer la contribution</button>
    </form>

    <section id="result" hidden>
      <h2>Votre contribution</h2>
      <pre id="json-preview"></pre>
      <div class="actions">
        <a id="mailto-link" href="#">Envoyer par e-mail</a>
        <button type="button" id="copy-btn">Copier le texte</button>
        <span id="copy-status" role="status"></span>
      </div>
    </section>
  </main>
  <script type="module" src="js/contribute.js"></script>
</body>
</html>
```

- [ ] **Step 7: Write css/contribute.css**

Write `css/contribute.css` exactly as follows. Everything is scoped under `body.contribute-page` (or ids unique to this page) so nothing leaks into the main app; the first rule deliberately overrides any full-viewport/no-scroll layout `base.css` sets for the stage page:

```css
/* Page contribution. Complement de css/base.css, tout est scope sous body.contribute-page. */
body.contribute-page {
  overflow: auto;
  height: auto;
  background: #f4f1ea;
  color: #222;
  font-family: system-ui, sans-serif;
}
.contribute-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  max-width: 640px;
  margin: 0 auto;
  padding: 1rem;
}
.contribute-header h1 { font-size: 1.4rem; margin: 0; }
.contribute-header a { color: #1a4d8f; }
.contribute-main { max-width: 640px; margin: 0 auto; padding: 0 1rem 4rem; }
.contribute-page .intro { color: #555; }
.contribute-page fieldset {
  border: 1px solid #c9c2b4;
  border-radius: 6px;
  margin: 0 0 1rem;
  padding: 0.75rem 1rem 1rem;
  background: #fff;
}
.contribute-page legend { font-weight: 600; padding: 0 0.4rem; }
.contribute-page label { display: block; margin-top: 0.6rem; font-size: 0.95rem; }
#fs-mode label { display: inline-flex; align-items: center; gap: 0.4rem; margin-right: 1.2rem; }
.contribute-page label.checkbox { display: flex; align-items: center; gap: 0.4rem; }
.contribute-page input[type="text"],
.contribute-page select,
.contribute-page textarea {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin-top: 0.2rem;
  padding: 0.4rem;
  border: 1px solid #b5ad9d;
  border-radius: 4px;
  font: inherit;
  background: #fff;
}
.contribute-page input[type="radio"],
.contribute-page input[type="checkbox"] { display: inline-block; width: auto; }
.contribute-page .hint { margin: 0.2rem 0 0; font-size: 0.8rem; color: #777; }
#person-results {
  list-style: none;
  margin: 0.3rem 0 0;
  padding: 0;
  border: 1px solid #b5ad9d;
  border-radius: 4px;
  background: #fff;
  max-height: 12rem;
  overflow-y: auto;
}
#person-results li { padding: 0.35rem 0.6rem; cursor: pointer; }
#person-results li:hover { background: #e8eef7; }
#person-selected { margin: 0.4rem 0 0; font-size: 0.9rem; color: #1c6b30; }
.contribute-page .errors {
  border: 1px solid #b3261e;
  background: #fbeae9;
  color: #7a1712;
  border-radius: 6px;
  padding: 0.6rem 1rem;
  margin-bottom: 1rem;
}
.contribute-page .errors p { margin: 0.2rem 0; }
#generate-btn, #copy-btn, #mailto-link {
  display: inline-block;
  padding: 0.5rem 1rem;
  border: 1px solid #1a4d8f;
  border-radius: 4px;
  background: #1a4d8f;
  color: #fff;
  font: inherit;
  cursor: pointer;
  text-decoration: none;
}
#copy-btn { background: #fff; color: #1a4d8f; }
#result { margin-top: 1.5rem; }
#json-preview {
  background: #2b2b2b;
  color: #e8e6e3;
  padding: 1rem;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 0.85rem;
}
#result .actions { display: flex; align-items: center; gap: 0.8rem; margin-top: 0.6rem; flex-wrap: wrap; }
#copy-status { font-size: 0.9rem; color: #1c6b30; }
```

- [ ] **Step 8: Add the DOM wiring to js/contribute.js**

First add this line at the very top of `js/contribute.js` (before `export const CONTACT_EMAIL`); `js/search.js` is DOM-free (Task 6), so node can still import the module for tests:

```js
import { normalize } from "./search.js";
```

Then append the following to the end of the file (anchor: directly after the closing brace of `submissionToMailto`). The `typeof document` guard at the bottom is what keeps node able to import the module for tests - do not call any DOM API outside `initContributePage`:

```js
const DATE_RE = /^\d{4}(-\d{2}){0,2}$/;

function personLabel(p) {
  const year = p.birth && p.birth.date ? p.birth.date.slice(0, 4) : null;
  return `${p.firstNames} ${p.lastName}${year ? ` (${year})` : ""}`;
}

async function initContributePage() {
  const form = document.getElementById("contribute-form");
  const errorsBox = document.getElementById("form-errors");
  const result = document.getElementById("result");
  const preview = document.getElementById("json-preview");
  const mailtoLink = document.getElementById("mailto-link");
  const copyStatus = document.getElementById("copy-status");
  const byId = new Map();
  let unions = [];

  const showErrors = (msgs) => {
    errorsBox.innerHTML = "";
    for (const msg of msgs) {
      const p = document.createElement("p");
      p.textContent = msg;
      errorsBox.appendChild(p);
    }
    errorsBox.hidden = msgs.length === 0;
  };

  try {
    const res = await fetch("data/family.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    for (const p of data.persons) byId.set(p.id, p);
    unions = data.unions;
  } catch {
    showErrors(["Impossible de charger data/family.json : les listes de personnes resteront vides."]);
  }

  const persons = [...byId.values()].sort((a, b) => personLabel(a).localeCompare(personLabel(b), "fr"));
  const personSelects = ["f-parent1", "f-parent2", "f-partner1", "f-partner2", "f-children"]
    .map((id) => document.getElementById(id));
  for (const sel of personSelects) {
    for (const p of persons) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = personLabel(p);
      sel.appendChild(opt);
    }
  }
  const unionSelect = document.getElementById("f-parentUnion");
  for (const u of unions) {
    const names = u.partners.map((id) => (byId.has(id) ? personLabel(byId.get(id)) : id)).join(" & ");
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.textContent = names + (u.date ? ` - ${u.date}` : "");
    unionSelect.appendChild(opt);
  }

  const MODE_FIELDSETS = {
    "ajout-personne": ["fs-person", "fs-ajout-extra"],
    "correction-personne": ["fs-picker", "fs-person"],
    "union": ["fs-union"],
    "remarque": []
  };
  const applyMode = (mode) => {
    const visible = new Set(MODE_FIELDSETS[mode]);
    for (const id of ["fs-picker", "fs-person", "fs-ajout-extra", "fs-union"]) {
      document.getElementById(id).hidden = !visible.has(id);
    }
    result.hidden = true;
    showErrors([]);
  };
  for (const radio of form.querySelectorAll('input[name="mode"]')) {
    radio.addEventListener("change", () => applyMode(radio.value));
  }
  applyMode(form.elements.mode.value);

  const val = (id) => document.getElementById(id).value.trim();

  // Picker de correction : recherche insensible aux accents via normalize (search.js).
  const searchInput = document.getElementById("person-search");
  const resultsList = document.getElementById("person-results");
  const selectedInfo = document.getElementById("person-selected");
  let correctionId = "";

  const prefillPerson = (p) => {
    document.getElementById("f-firstNames").value = p.firstNames || "";
    document.getElementById("f-lastName").value = p.lastName || "";
    document.getElementById("f-birthName").value = p.birthName || "";
    document.getElementById("f-sex").value = p.sex || "";
    document.getElementById("f-birthDate").value = p.birth && p.birth.date ? p.birth.date : "";
    document.getElementById("f-birthPlace").value = p.birth && p.birth.place ? p.birth.place : "";
    document.getElementById("f-deathDate").value = p.death && p.death.date ? p.death.date : "";
    document.getElementById("f-deathPlace").value = p.death && p.death.place ? p.death.place : "";
    document.getElementById("f-bio").value = p.bio || "";
  };

  searchInput.addEventListener("input", () => {
    correctionId = "";
    selectedInfo.textContent = "";
    resultsList.innerHTML = "";
    const q = normalize(searchInput.value.trim());
    const matches = q ? persons.filter((p) => normalize(personLabel(p)).includes(q)) : [];
    for (const p of matches.slice(0, 8)) {
      const li = document.createElement("li");
      li.textContent = personLabel(p);
      li.addEventListener("click", () => {
        correctionId = p.id;
        searchInput.value = personLabel(p);
        selectedInfo.textContent = `Personne sélectionnée : ${personLabel(p)}`;
        resultsList.hidden = true;
        prefillPerson(p);
      });
      resultsList.appendChild(li);
    }
    resultsList.hidden = matches.length === 0;
  });

  const checkDate = (value, label, errors) => {
    if (value && !DATE_RE.test(value)) {
      errors.push(`${label} : format attendu AAAA, AAAA-MM ou AAAA-MM-JJ.`);
    }
  };

  const collectPerson = (errors) => {
    const fields = {
      firstNames: val("f-firstNames"),
      lastName: val("f-lastName"),
      birthName: val("f-birthName"),
      sex: val("f-sex"),
      birthDate: val("f-birthDate"),
      birthPlace: val("f-birthPlace"),
      deathDate: val("f-deathDate"),
      deathPlace: val("f-deathPlace"),
      bio: val("f-bio")
    };
    if (!fields.firstNames) errors.push("Les prénoms sont obligatoires.");
    if (!fields.lastName) errors.push("Le nom est obligatoire.");
    checkDate(fields.birthDate, "Date de naissance", errors);
    checkDate(fields.deathDate, "Date de décès", errors);
    return fields;
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const mode = form.elements.mode.value;
    const errors = [];
    const fields = {
      note: val("f-note"),
      submitterName: val("f-submitterName")
    };
    if (!fields.submitterName) errors.push("Votre nom est obligatoire.");

    if (mode === "ajout-personne") {
      Object.assign(fields, collectPerson(errors), {
        photoPromised: document.getElementById("f-photoPromised").checked
      });
      const unionId = val("f-parentUnion");
      const parentIds = [val("f-parent1"), val("f-parent2")].filter(Boolean);
      if (unionId) fields.parents = { unionId };
      else if (parentIds.length) fields.parents = { parentIds };
    } else if (mode === "correction-personne") {
      if (!correctionId) errors.push("Choisissez la personne à corriger.");
      Object.assign(fields, collectPerson(errors), { id: correctionId });
    } else if (mode === "union") {
      const partners = [val("f-partner1"), val("f-partner2")].filter(Boolean);
      if (!partners.length) errors.push("Le partenaire 1 est obligatoire.");
      if (partners.length === 2 && partners[0] === partners[1]) errors.push("Les deux partenaires doivent être différents.");
      const date = val("f-unionDate");
      checkDate(date, "Date de l'union", errors);
      const children = [...document.getElementById("f-children").selectedOptions].map((o) => o.value);
      Object.assign(fields, { partners, date, children });
    } else if (mode === "remarque") {
      if (!fields.note) errors.push("La remarque ne peut pas être vide.");
    }

    if (errors.length) {
      showErrors(errors);
      result.hidden = true;
      return;
    }
    showErrors([]);
    const sub = buildSubmission(mode, fields);
    preview.textContent = JSON.stringify(sub, null, 1);
    mailtoLink.href = submissionToMailto(sub, CONTACT_EMAIL);
    copyStatus.textContent = "";
    result.hidden = false;
  });

  document.getElementById("copy-btn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(preview.textContent);
      copyStatus.textContent = "Texte copié dans le presse-papiers.";
    } catch {
      copyStatus.textContent = "Copie impossible : sélectionnez le texte à la main.";
    }
  });
}

if (typeof document !== "undefined") {
  initContributePage();
}
```

- [ ] **Step 9: Re-run the node tests to prove the DOM guard works**

Run: `node --test tests/contribute.test.mjs`
Expected: still 9 tests, 9 pass, 0 fail. The `import { normalize }` from `js/search.js` resolves under node because that module is DOM-free (Task 6). If node crashes with `document is not defined` or `fetch` errors, DOM code escaped the guard - fix before continuing.

- [ ] **Step 10: Browser verification**

From the repo root run `python3 -m http.server 8000`, open `http://localhost:8000/contribute.html`, and verify every line:

- Default mode "Ajouter une personne": fieldsets "Fiche de la personne" and "Parents et photo" visible; "Personne à corriger" and "Union" hidden.
- The parent, partner and children selects are populated with entries formatted "Prénom Nom (année)" from the starter data; the union select shows partner names joined by " & ".
- Click "Générer la contribution" with everything empty: red French error box lists "Les prénoms sont obligatoires.", "Le nom est obligatoire.", "Votre nom est obligatoire."; no JSON preview.
- Enter birth date "mai 1950": error "Date de naissance : format attendu AAAA, AAAA-MM ou AAAA-MM-JJ."
- Fill a valid ajout (prénoms, nom, date "1950-03", a parent union, photo checkbox, votre nom), generate: JSON preview appears with `"type": "ajout-personne"`, `"photo": null`, `"photoPromised": true`, `"parents": {"unionId": ...}`, 1-space indent.
- Click "Envoyer par e-mail": the OS mail client opens a draft to gregory.gelly@gmail.com, subject "Généalogie - ajout-personne - <Prénoms Nom>", body containing the JSON. Close the draft without sending.
- Click "Copier le texte": "Texte copié dans le presse-papiers." appears; paste somewhere to confirm the JSON.
- Switch to "Corriger une fiche": the search field appears, "Parents et photo" disappears; generate without picking anyone: "Choisissez la personne à corriger."
- In the search field type "francoise" (no cedilla, no accent): "Françoise ..." appears in the results list (accent-insensitive match); click it - the field shows the full label, "Personne sélectionnée : ..." appears, and all fields prefill from the data; edit one field, generate: payload has `"id"` and no `"photo"` key.
- Still in correction mode: type one more character in the search field - the selection resets ("Personne sélectionnée" disappears) and generating again asks to choose the person.
- Switch to "Ajouter ou corriger une union": only the union fieldset (plus message); generate with no partner: "Le partenaire 1 est obligatoire."; pick partner 1 and two children (Ctrl-clic), generate: payload `partners` array of 1, `children` array of 2.
- Switch to "Autre remarque": only "Votre message" remains; empty note: "La remarque ne peut pas être vide."; filled note: `"payload": null` and the note in `"note"`.
- Switching modes hides the previous result and errors.

- [ ] **Step 11: Commit the page**

```bash
git add contribute.html css/contribute.css js/contribute.js
git commit -F - <<'EOF'
feat: contribution page with per-mode forms and mailto output

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
```

---

### Task 12: Maintainer apply tool (tools/apply-submission.mjs)

**Files:**
- Create: `tools/apply-submission.mjs`
- Create: `tests/apply-submission.test.mjs`
- Test: `tests/apply-submission.test.mjs` (pure-function tests only, zero fs access)

**Interfaces:**
- Consumes: `validateData(data, opts = {}) -> string[]` from `tools/validate.mjs` (Task 1; French error strings, empty array = valid, `opts.checkPhotos` toggles on-disk photo checks). Data shape from Task 1: `{ persons: Person[], unions: Union[] }` with Person keys in order `id, firstNames, lastName, birthName, sex, birth, death, photo, bio` and Union keys in order `id, partners, date, children`. Submission shape from Task 11's `buildSubmission`: `{ version: 1, type, payload, note, submitterName }` with `type` in `"ajout-personne" | "correction-personne" | "union" | "remarque"` - consumed as plain JSON only, NEVER imported from `js/contribute.js`.
- Produces: `export function applySubmission(data, sub) -> { data: newData, summary: string }` (pure: input `data` is never mutated; throws `Error` with a French message on invalid submission) and the CLI `node tools/apply-submission.mjs <file|-> [--dry-run]` run from the repo root. Task 13's README documents the CLI; no other module imports this file.

Contract reminders you must not deviate from:
- `slugify` is duplicated here (the same 8-line helper as `js/contribute.js`): NFD normalize, strip `\u0300-\u036f`, lowercase, non-alphanumeric runs to `-`, trim hyphens. `tools/` never imports from `js/`.
- Id collisions get `-2`, then `-3` suffixes. New unions created from `parents.parentIds` get id `u-<parentId1>-<parentId2>` (ids are already slugs).
- Writes use `JSON.stringify(data, null, 2) + "\n"`. Key order is preserved because every person/union object is (re)built in the canonical key order above and `structuredClone` keeps insertion order.
- The CLI validates the result with `checkPhotos: false`: a promised photo is not on disk yet, and photo existence is enforced by `tools/validate.mjs` in CI (Task 13). One comment in the code states this.
- All user-facing strings French, straight quotes only, plain `->` arrows, no decorative Unicode. Accented French letters are fine.

- [ ] **Step 1: Write the failing test file (all four types, collisions, union find-vs-create, purity)**

Write `tests/apply-submission.test.mjs` exactly:

```js
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
```

- [ ] **Step 2: Run the tests, confirm they fail for the right reason**

Run: `node --test tests/apply-submission.test.mjs`
Expected: the whole file fails to load with `ERR_MODULE_NOT_FOUND` (`Cannot find module '.../tools/apply-submission.mjs'`). If it fails for any other reason, fix the test file before continuing.

- [ ] **Step 3: Implement the pure applySubmission (no CLI yet)**

Write `tools/apply-submission.mjs` exactly:

```js
const PERSON_KEYS = [
  "id", "firstNames", "lastName", "birthName", "sex", "birth", "death", "photo", "bio",
];

// Duplicated from js/contribute.js on purpose: tools/ never imports from js/.
function slugify(firstNames, lastName) {
  return `${firstNames} ${lastName}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueId(base, taken) {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

function requireKnownPersons(data, ids, label) {
  const known = new Set(data.persons.map((p) => p.id));
  for (const id of ids) {
    if (!known.has(id)) throw new Error(`${label} : personne inconnue "${id}".`);
  }
}

function applyAjout(next, payload, lines) {
  if (!payload.firstNames || !payload.lastName) {
    throw new Error("Ajout : firstNames et lastName sont obligatoires.");
  }
  const personIds = new Set(next.persons.map((p) => p.id));
  const id = uniqueId(slugify(payload.firstNames, payload.lastName), personIds);
  next.persons.push({
    id,
    firstNames: payload.firstNames,
    lastName: payload.lastName,
    birthName: payload.birthName ?? null,
    sex: payload.sex ?? null,
    birth: payload.birth ?? null,
    death: payload.death ?? null,
    photo: payload.photo ?? null,
    bio: payload.bio ?? null,
  });
  lines.push(`Personne ajoutée : ${payload.firstNames} ${payload.lastName} (id "${id}").`);

  const parents = payload.parents;
  if (parents && parents.unionId) {
    const union = next.unions.find((u) => u.id === parents.unionId);
    if (!union) throw new Error(`Ajout : union inconnue "${parents.unionId}".`);
    union.children.push(id);
    lines.push(`Rattachée comme enfant de l'union "${union.id}".`);
  } else if (parents && parents.parentIds) {
    requireKnownPersons(next, parents.parentIds, "Ajout");
    const existing = next.unions.find((u) => sameSet(u.partners, parents.parentIds));
    if (existing) {
      existing.children.push(id);
      lines.push(`Rattachée comme enfant de l'union existante "${existing.id}".`);
    } else {
      const unionIds = new Set(next.unions.map((u) => u.id));
      const unionId = uniqueId(`u-${parents.parentIds.join("-")}`, unionIds);
      next.unions.push({ id: unionId, partners: [...parents.parentIds], date: null, children: [id] });
      lines.push(`Union créée : "${unionId}" (parents : ${parents.parentIds.join(", ")}).`);
    }
  }

  if (payload.photoPromised) {
    lines.push(`Rappel : déposer la photo dans assets/photos/${id}.jpg et renseigner le champ "photo".`);
  }
}

function applyCorrection(next, payload, lines) {
  const idx = next.persons.findIndex((p) => p.id === payload.id);
  if (idx === -1) throw new Error(`Correction : personne inconnue "${payload.id}".`);
  const current = next.persons[idx];
  const updated = {};
  const changed = [];
  for (const key of PERSON_KEYS) {
    if (key !== "id" && Object.hasOwn(payload, key)) {
      updated[key] = payload[key];
      changed.push(key);
    } else {
      updated[key] = current[key] ?? null;
    }
  }
  if (changed.length === 0) throw new Error("Correction : aucun champ à modifier.");
  next.persons[idx] = updated;
  lines.push(`Fiche corrigée : "${payload.id}" (champs : ${changed.join(", ")}).`);
}

function applyUnion(next, payload, lines) {
  const partners = payload.partners ?? [];
  if (partners.length < 1 || partners.length > 2) {
    throw new Error("Union : 1 ou 2 partenaires requis.");
  }
  requireKnownPersons(next, partners, "Union");
  const children = payload.children ?? [];
  requireKnownPersons(next, children, "Union");
  const existing = next.unions.find((u) => sameSet(u.partners, partners));
  if (existing) {
    if (payload.date != null) existing.date = payload.date;
    existing.children = [...new Set([...existing.children, ...children])];
    lines.push(`Union mise à jour : "${existing.id}" (date : ${existing.date ?? "?"}, ${existing.children.length} enfant(s)).`);
  } else {
    const unionIds = new Set(next.unions.map((u) => u.id));
    const unionId = uniqueId(`u-${partners.join("-")}`, unionIds);
    next.unions.push({
      id: unionId,
      partners: [...partners],
      date: payload.date ?? null,
      children: [...new Set(children)],
    });
    lines.push(`Union créée : "${unionId}" (${children.length} enfant(s)).`);
  }
}

export function applySubmission(data, sub) {
  if (!sub || sub.version !== 1) {
    throw new Error("Soumission invalide : version 1 attendue.");
  }
  const next = structuredClone(data);
  const lines = [];
  if (sub.type === "ajout-personne") {
    applyAjout(next, sub.payload ?? {}, lines);
  } else if (sub.type === "correction-personne") {
    applyCorrection(next, sub.payload ?? {}, lines);
  } else if (sub.type === "union") {
    applyUnion(next, sub.payload ?? {}, lines);
  } else if (sub.type === "remarque") {
    lines.push(`Remarque de ${sub.submitterName || "anonyme"} : ${sub.note || "(vide)"}`);
    lines.push("Aucune modification des données.");
  } else {
    throw new Error(`Type de soumission inconnu : "${sub.type}".`);
  }
  if (sub.type !== "remarque") {
    if (sub.note) lines.push(`Note : ${sub.note}`);
    if (sub.submitterName) lines.push(`Soumis par : ${sub.submitterName}`);
  }
  return { data: next, summary: lines.join("\n") };
}
```

Notes for the implementer, so you do not "improve" this:
- `structuredClone` + rebuilding persons from `PERSON_KEYS` is what guarantees the canonical key order in the output file. Do not spread `payload` into the person.
- No `includes` check before `children.push(id)` in `applyAjout`: the id was just minted and cannot already be a child.
- `if (payload.date != null)` on union update is deliberate: a family member fixing the children list must not wipe an existing marriage date by leaving the date blank.

- [ ] **Step 4: Run the tests, confirm all pass**

Run: `node --test tests/apply-submission.test.mjs`
Expected: `pass 12`, `fail 0`. If a test fails, fix the implementation, not the test.

- [ ] **Step 5: Add the CLI block**

Two edits to `tools/apply-submission.mjs`. First, add these imports as the very first lines of the file (above `const PERSON_KEYS`):

```js
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { validateData } from "./validate.mjs";
```

Second, append this block at the very end of the file (after `applySubmission`):

```js
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const source = args.find((a) => a !== "--dry-run");
  if (!source) {
    console.error("Usage : node tools/apply-submission.mjs <fichier|-> [--dry-run]");
    console.error("À lancer depuis la racine du dépôt.");
    process.exit(1);
  }
  let sub;
  try {
    sub = JSON.parse(readFileSync(source === "-" ? 0 : source, "utf8"));
  } catch (err) {
    console.error(`Lecture de la soumission impossible : ${err.message}`);
    process.exit(1);
  }
  const dataPath = "data/family.json";
  let data;
  try {
    data = JSON.parse(readFileSync(dataPath, "utf8"));
  } catch (err) {
    console.error(`Lecture de ${dataPath} impossible : ${err.message}`);
    process.exit(1);
  }
  let result;
  try {
    result = applySubmission(data, sub);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  console.log(result.summary);
  console.log(`Personnes : ${data.persons.length} -> ${result.data.persons.length} ; unions : ${data.unions.length} -> ${result.data.unions.length}.`);
  // checkPhotos: false ici : une photo promise n'est pas encore sur le disque.
  // L'existence des photos est verifiee par tools/validate.mjs (localement et en CI).
  const errors = validateData(result.data, { checkPhotos: false });
  if (errors.length > 0) {
    console.error("Données résultantes invalides, aucune écriture :");
    for (const e of errors) console.error(`- ${e}`);
    process.exit(1);
  }
  if (dryRun) {
    console.log("Mode --dry-run : rien n'a été écrit.");
  } else {
    writeFileSync(dataPath, JSON.stringify(result.data, null, 2) + "\n");
    console.log(`${dataPath} mis à jour. Relire avec git diff avant de committer.`);
  }
}
```

`readFileSync(0, "utf8")` is the stdin read for the `-` case. The `pathToFileURL` guard keeps the CLI inert when the module is imported by the tests.

- [ ] **Step 6: Smoke-test the CLI from the repo root (stdin + --dry-run, no writes)**

Run from `/Users/govit/Git/Govit/Genealogy`:

```bash
printf '%s' '{"version":1,"type":"remarque","payload":null,"note":"Test de la CLI.","submitterName":"Moi"}' | node tools/apply-submission.mjs - --dry-run
printf '%s' '{"version":1,"type":"ajout-personne","payload":{"firstNames":"Test","lastName":"Cli","photoPromised":true},"note":null,"submitterName":null}' | node tools/apply-submission.mjs - --dry-run
printf '%s' '{"version":1,"type":"correction-personne","payload":{"id":"nexiste-pas","bio":"x"},"note":null,"submitterName":null}' | node tools/apply-submission.mjs - --dry-run; echo "exit=$?"
git status --porcelain data/family.json
```

Expected:
- Command 1: `Remarque de Moi : Test de la CLI.`, `Aucune modification des données.`, identical before/after counts, `Mode --dry-run : rien n'a été écrit.`
- Command 2: `Personne ajoutée : Test Cli (id "test-cli").`, the reminder line containing `assets/photos/test-cli.jpg`, person count increased by 1, the dry-run line.
- Command 3: `Correction : personne inconnue "nexiste-pas".` then `exit=1`.
- `git status` prints nothing: `data/family.json` untouched.

- [ ] **Step 7: Run the full suite to check for regressions**

Run: `node --test tests/`
Expected: every test file passes (`fail 0`), including this task's 12 tests. The CLI guard means importing the module in tests must not print anything or touch `data/family.json`.

- [ ] **Step 8: Commit**

```bash
cd /Users/govit/Git/Govit/Genealogy
git add tools/apply-submission.mjs tests/apply-submission.test.mjs
git commit -m "$(cat <<'EOF'
feat: add maintainer apply-submission tool with tests

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: CI workflow and French README

**Files:**
- Create: `.github/workflows/validate.yml`
- Modify: `README.md` - full content replacement (anchor: the entire existing English README describing the old placeholder site is discarded and rewritten)
- Test: none. This is a docs + CI task; there is no `node --test` cycle. Verification is Steps 2 and 5 below.

**Interfaces:**
- Consumes:
  - `package.json` scripts (Task 1): `npm test` runs the full `node --test` suite; `npm run validate` runs the validator.
  - `tools/validate.mjs` CLI (Task 1): `node tools/validate.mjs [path]`, default path `data/family.json`, prints French error messages, exit code 1 when invalid, 0 when valid.
  - `tools/apply-submission.mjs` CLI (Task 12): `node tools/apply-submission.mjs <file|-> [--dry-run]` - documented verbatim in the README.
  - `contribute.html` (Task 11) - linked from the README.
- Produces: no code interface. `.github/workflows/validate.yml` becomes the CI gate GitHub runs on every push and pull request. `README.md` is documentation only; nothing imports it.

- [ ] **Step 1: Create the GitHub Actions workflow**

Create `.github/workflows/validate.yml` (create the `.github/workflows/` directories first) with exactly this content. Node 22 is required because the test suite and tools use `node --test` and ES modules; the version is quoted so YAML keeps it a string.

```yaml
name: Validate

on:
  push:
  pull_request:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - name: Run unit tests
        run: npm test
      - name: Validate family data
        run: node tools/validate.mjs
```

- [ ] **Step 2: Verify the workflow locally**

There is no way to fully execute a GitHub Actions workflow locally without extra tooling, so the check is: lint with `actionlint` if it happens to be installed, otherwise a visual check; then run the two commands the workflow runs, since those are what CI will actually execute.

Run (from `/Users/govit/Git/Govit/Genealogy`):

```bash
command -v actionlint >/dev/null && actionlint .github/workflows/validate.yml || echo "actionlint not installed - do the visual check below"
npm test
node tools/validate.mjs
```

Expected:
- `actionlint` prints nothing (no findings), or the echo line appears. If doing the visual check, confirm: top-level keys are exactly `name`, `on`, `jobs`; indentation is 2 spaces everywhere; both `uses:` lines end in `@v4`; `node-version` is quoted `"22"`; the two `run:` lines are `npm test` and `node tools/validate.mjs`.
- `npm test`: all tests pass, exit code 0.
- `node tools/validate.mjs`: exit code 0, no error lines (success output as defined by Task 1's CLI).

- [ ] **Step 3: Commit the workflow**

```bash
git add .github/workflows/validate.yml
git commit -m "$(cat <<'EOF'
chore: add CI workflow running tests and data validation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Rewrite README.md in French**

Replace the ENTIRE contents of `/Users/govit/Git/Govit/Genealogy/README.md` with exactly this. Watch the character rules: no em dashes, no smart quotes, straight ASCII apostrophes only; accented French letters are correct and expected.

````markdown
# Généalogie de la famille

Site statique de généalogie familiale, hébergé sur GitHub Pages.
Toutes les données vivent dans un seul fichier, `data/family.json`
(personnes + unions), et quatre rendus visuels ("thèmes") affichent le
même arbre avec les mêmes interactions : panneau de détail au clic,
recherche insensible aux accents avec vol vers la personne, zoom et
déplacement, liens profonds par URL
(`#theme=ciel&person=gregory-gelly`).

Aucune dépendance, aucune étape de build : HTML, CSS et JavaScript
(modules ES) servis tels quels.

## Les quatre thèmes

| Thème | Ambiance |
|---|---|
| Manuscrit | Page de manuscrit enluminé : parchemin, rinceaux, bannières posées sur un arbre peint |
| Ciel étoilé | Ciel nocturne animé : chaque personne est une étoile, les familles forment des constellations |
| Hologramme | Interface science-fiction : cartes hexagonales, néons cyan et magenta, impulsions animées le long des liens |
| Frise du temps | Chronologie : une barre de vie par personne sur un axe des années, ligne rouge "aujourd'hui" |

Le dernier thème choisi est mémorisé dans le navigateur.

## Participer (pour la famille)

Aucun compte nécessaire, tout passe par e-mail.

1. Ouvrir la page [Participer](contribute.html) du site (`/contribute.html`).
2. Choisir le mode : Ajouter une personne, Corriger une fiche, Ajouter
   ou corriger une union, ou Autre remarque.
3. Remplir le formulaire, puis cliquer sur "Envoyer par e-mail"
   (ou "Copier le texte" et coller le résultat dans un e-mail).
4. Pour une photo : la joindre directement à l'e-mail. Le formulaire
   indique dans la soumission qu'une photo arrive.

## Appliquer une soumission (mainteneur)

1. Enregistrer le JSON reçu par e-mail dans un fichier, par exemple
   `soumission.json`.
2. Créer une branche :

   ```bash
   git switch -c feature/ajout-prenom-nom
   ```

3. Vérifier la soumission sans rien écrire :

   ```bash
   node tools/apply-submission.mjs soumission.json --dry-run
   ```

4. Appliquer. L'outil valide les données résultantes et refuse
   d'écrire `data/family.json` en cas d'erreur :

   ```bash
   node tools/apply-submission.mjs soumission.json
   ```

   La soumission peut aussi être lue sur l'entrée standard :
   `node tools/apply-submission.mjs -`.

5. Si la soumission annonce une photo, enregistrer le portrait joint à
   l'e-mail sous `assets/photos/<id>.jpg` (le résumé imprimé par
   l'outil rappelle l'id exact).
6. Contrôler puis valider :

   ```bash
   node tools/validate.mjs
   git diff data/family.json
   git add data/family.json assets/photos/
   git commit
   ```

7. Fusionner la branche dans `main` : GitHub Pages publie
   automatiquement.

## Développement

- Aucune étape de build, aucune dépendance. Servir la racine du dépôt
  avec n'importe quel serveur statique (nécessaire pour les modules ES
  et `fetch`) :

  ```bash
  python3 -m http.server 8000
  ```

  puis ouvrir <http://localhost:8000>.

- Tests unitaires (`node --test`, Node 22) :

  ```bash
  npm test
  ```

- Validation des données (unicité des ids, champs requis, formats de
  date, références, photos présentes sur le disque) :

  ```bash
  node tools/validate.mjs
  ```

  (`npm run validate` est un raccourci équivalent.)

- Intégration continue : `.github/workflows/validate.yml` rejoue ces
  deux commandes à chaque push et pull request.
- Déploiement : GitHub Pages sert la racine du dépôt depuis la branche
  `main`. Fusionner dans `main` suffit à publier.

## Modèle de données

Un seul fichier, `data/family.json` :
`{ "persons": [...], "unions": [...] }`.

Les enfants appartiennent aux unions, pas aux personnes. Parent unique
ou inconnu = union à un seul partenaire. Une personne est enfant d'au
plus une union.

### Personne

| Champ | Type | Obligatoire | Notes |
|---|---|---|---|
| `id` | slug | oui | lisible, ex. `gregory-gelly` ; le nom du fichier photo le reprend |
| `firstNames` | chaîne | oui | prénoms |
| `lastName` | chaîne | oui | nom d'usage |
| `birthName` | chaîne ou `null` | non | nom de naissance ("née X") |
| `sex` | `"M"`, `"F"` ou `null` | non | `null` = inconnu |
| `birth` | `{ "date", "place" }` ou `null` | non | date `"1942"`, `"1942-05"` ou `"1942-05-17"` |
| `death` | `{ "date", "place" }` ou `null` | non | `null` = personne vivante |
| `photo` | chemin ou `null` | non | ex. `assets/photos/gregory-gelly.jpg` |
| `bio` | chaîne | non | texte libre en français |

### Union

| Champ | Type | Notes |
|---|---|---|
| `id` | slug | ex. `u-gregory-marie` |
| `partners` | 1 ou 2 ids de personnes | partenaire unique autorisé |
| `date` | chaîne ou `null` | même format que les autres dates |
| `children` | liste d'ids de personnes | chaque enfant apparaît dans au plus une union |
````

- [ ] **Step 5: Verify the README**

Run the exact commands the README documents for development, and check the character rules with a Unicode-escape regex (no forbidden characters embedded in the command itself):

```bash
npm test
node tools/validate.mjs
rg -nP '[\x{2013}\x{2014}\x{2018}\x{2019}\x{201C}\x{201D}]' README.md
ls contribute.html
```

Expected:
- `npm test`: all tests pass, exit 0.
- `node tools/validate.mjs`: exit 0, no error lines.
- `rg`: NO output, exit code 1 (meaning zero em dashes, en dashes, or smart quotes slipped in).
- `ls contribute.html`: file exists (the README links to it).

Then a 30-second visual read of the rendered file (`bat --paging=never README.md` or open it on GitHub after merge): every command block matches the CLIs defined in Tasks 1 and 12 verbatim, the photo path in step 5 of the maintainer section reads `assets/photos/<id>.jpg`, and `--dry-run` appears before the apply command.

- [ ] **Step 6: Commit the README**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: rewrite README in French for the redesigned site

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Final verification and branch commit

**Files:**
- No new files. Verification only, then the branch-wide commit pass.

**Interfaces:**
- Consumes: everything Tasks 1-13 produced.
- Produces: a verified, committed `feature/genealogy-redesign` branch ready for the maintainer to merge.

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: every suite passes (validate, data, generations, layout, hash, search, contribute, apply-submission), zero failures.

- [ ] **Step 2: Data validation**

Run: `node tools/validate.mjs`
Expected: no output errors, exit code 0.

- [ ] **Step 3: Browser pass, all four themes**

Serve the repo root with a static server and open `index.html`. For each theme button, verify:

- Manuscrit: rinceaux frame on all four sides, corner miniatures, parchment texture, tree with roots couple on a shield at the trunk, banners clickable, hover glow, gothic title with red lettrine.
- Ciel étoilé: starfield twinkles, a shooting star appears within ~20 s, deceased persons gold, labels fade in on hover, switching away stops the animation (no rAF leak in the performance panel).
- Hologramme: grid and hex cards visible on first load via direct link `#theme=hologramme`, pulses travel along links, hover glitch, magenta union diamonds.
- Frise du temps: decade axis, bars colored by generation, remarriage person shows two marriage connectors, dashed red today line.

Cross-theme, in each: click a person opens the panel with correct chips (the remarriage person shows children from both unions; the single-parent child shows one parent), search "camille" flies to Camille, deep link `#theme=ciel&person=camille-lefevre` restores theme, position, and open panel on reload. No console errors anywhere.

- [ ] **Step 4: Contribution flow end-to-end**

Open `contribute.html`: each of the four modes produces a correct JSON preview; the correction mode picker matches "francoise" to "Françoise"; the mailto link opens a draft addressed to the maintainer with the JSON body; the copy button confirms in French. Then pipe a saved add-person submission through `node tools/apply-submission.mjs /tmp/sub.json --dry-run` and verify the summary, then without `--dry-run` and verify `git diff data/family.json` shows the new person, then `git checkout -- data/family.json` to restore.

- [ ] **Step 5: Commit the branch with smart-commit**

Invoke the `smart-commit` skill and tell it to take the whole `feature/genealogy-redesign` branch into account (docs sync + final commit of anything uncommitted). Do not push.
