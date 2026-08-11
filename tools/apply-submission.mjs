import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { validateData } from "./validate.mjs";

const PERSON_KEYS = [
  "id", "firstNames", "lastName", "birthName", "sex", "birth", "death", "photo", "bio",
];

// Duplicated from js/contribute.js on purpose: tools/ never imports from js/.
function slugify(firstNames, lastName) {
  return `${firstNames} ${lastName}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
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
