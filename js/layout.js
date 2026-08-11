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
