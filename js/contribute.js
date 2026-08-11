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
