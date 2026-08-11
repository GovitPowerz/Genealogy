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
