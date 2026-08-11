import { normalize } from "./search.js";

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
