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
