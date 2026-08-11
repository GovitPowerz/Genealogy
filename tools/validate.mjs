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
