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
