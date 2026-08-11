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
