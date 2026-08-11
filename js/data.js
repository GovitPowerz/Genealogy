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

export function buildGraph(data) {
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

  return {
    persons, unions, parentUnionOf, unionsOf, warnings,
    parentsOf, childrenOf, partnersOf, siblingsOf,
  };
}
