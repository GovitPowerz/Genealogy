import { yearOf } from "../data.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const HEX_POINTS = "-27,0 -17,-22 17,-22 27,0 17,22 -17,22";
const PULSE_DUR = 3;

function el(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function monoText(str, y, fontSize, maxWidth, cls) {
  const t = el("text", { x: 0, y, class: cls, "font-size": fontSize, "text-anchor": "middle" });
  t.textContent = str;
  if (str.length * fontSize * 0.62 > maxWidth) {
    t.setAttribute("textLength", maxWidth);
    t.setAttribute("lengthAdjust", "spacingAndGlyphs");
  }
  return t;
}

function yearsLabel(person) {
  const b = person.birth ? yearOf(person.birth.date) : null;
  const d = person.death ? yearOf(person.death.date) : null;
  if (b !== null && d !== null) return `${b} - ${d}`;
  if (b !== null) return `${b}`;
  if (d !== null) return `- ${d}`;
  return "";
}

function buildDefs() {
  const defs = el("defs");

  const pattern = el("pattern", {
    id: "holo-grid",
    width: 40,
    height: 40,
    patternUnits: "userSpaceOnUse"
  });
  pattern.appendChild(el("path", {
    d: "M 40 0 L 0 0 L 0 40",
    fill: "none",
    stroke: "rgba(39,224,255,0.07)",
    "stroke-width": 1
  }));
  defs.appendChild(pattern);

  for (const [id, blur] of [["holo-glow", 2.5], ["holo-glow-strong", 5]]) {
    const f = el("filter", { id, x: "-60%", y: "-60%", width: "220%", height: "220%" });
    f.appendChild(el("feGaussianBlur", { stdDeviation: blur, result: "blur" }));
    const merge = el("feMerge");
    merge.appendChild(el("feMergeNode", { in: "blur" }));
    merge.appendChild(el("feMergeNode", { in: "SourceGraphic" }));
    f.appendChild(merge);
    defs.appendChild(f);
  }
  return defs;
}

export default {
  id: "hologramme",
  label: "Hologramme",
  className: "theme-hologramme",
  render(ctx) {
    const { svg, canvas, graph, layout } = ctx;

    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    svg.replaceChildren();

    const m = 120;
    svg.setAttribute("viewBox", `${-m} ${-m - 80} ${layout.width + 2 * m} ${layout.height + 2 * m + 80}`);

    svg.appendChild(buildDefs());

    svg.appendChild(el("rect", {
      x: -2000,
      y: -2000,
      width: layout.width + 4000,
      height: layout.height + 4000,
      fill: "url(#holo-grid)"
    }));

    const unionAnchor = new Map();
    for (const [uid, u] of graph.unions) {
      const pts = u.partners.map(pid => layout.nodes.get(pid)).filter(Boolean);
      if (pts.length === 0) continue;
      unionAnchor.set(uid, {
        x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
        y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
        partnerCount: pts.length
      });
    }

    const linkGroup = el("g");
    const pulseGroup = el("g");
    let pulseIndex = 0;

    const addPulse = (d, cls) => {
      const c = el("circle", { r: 2.5, class: cls });
      c.appendChild(el("animateMotion", {
        dur: `${PULSE_DUR}s`,
        repeatCount: "indefinite",
        begin: `-${((pulseIndex % 8) * PULSE_DUR / 8).toFixed(3)}s`,
        path: d
      }));
      pulseIndex += 1;
      pulseGroup.appendChild(c);
    };

    for (const link of layout.links) {
      if (link.type === "partner") {
        const a = layout.nodes.get(link.a);
        const b = layout.nodes.get(link.b);
        if (!a || !b) continue;
        const d = `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
        linkGroup.appendChild(el("path", { d, class: "holo-link" }));
        addPulse(d, "holo-pulse-magenta");
      } else {
        const from = unionAnchor.get(link.unionId);
        const child = layout.nodes.get(link.childId);
        if (!from || !child) continue;
        const midY = from.y + (child.y - from.y) / 2;
        const d = `M ${from.x} ${from.y} L ${from.x} ${midY} L ${child.x} ${midY} L ${child.x} ${child.y}`;
        linkGroup.appendChild(el("path", { d, class: "holo-link" }));
        addPulse(d, "holo-pulse-cyan");
      }
    }
    svg.appendChild(linkGroup);
    svg.appendChild(pulseGroup);

    const unionGroup = el("g");
    for (const anchor of unionAnchor.values()) {
      if (anchor.partnerCount < 2) continue;
      const { x, y } = anchor;
      unionGroup.appendChild(el("path", {
        d: `M ${x} ${y - 5} L ${x + 5} ${y} L ${x} ${y + 5} L ${x - 5} ${y} Z`,
        class: "holo-union"
      }));
    }
    svg.appendChild(unionGroup);

    const cardGroup = el("g");
    for (const [pid, pos] of layout.nodes) {
      const person = graph.persons.get(pid);
      if (!person) continue;
      const card = el("g", {
        class: "holo-card",
        "data-person-id": pid,
        transform: `translate(${pos.x}, ${pos.y})`
      });
      const inner = el("g", { class: "holo-card-inner" });
      inner.appendChild(el("polygon", { points: HEX_POINTS, class: "holo-hex" }));
      inner.appendChild(monoText(person.firstNames.split(" ")[0].toUpperCase(), -8, 7, 42, "holo-name"));
      inner.appendChild(monoText(person.lastName.toUpperCase(), 2, 7, 46, "holo-name"));
      const years = yearsLabel(person);
      if (years) inner.appendChild(monoText(years, 13, 6, 42, "holo-years"));
      card.appendChild(inner);
      cardGroup.appendChild(card);
    }
    svg.appendChild(cardGroup);

    let minX = 0;
    for (const pos of layout.nodes.values()) minX = Math.min(minX, pos.x);
    const caption = el("text", {
      class: "holo-caption",
      x: minX - 27,
      y: -60,
      "font-size": 11,
      "text-anchor": "start"
    });
    caption.textContent = `GENEALOGIE :: ${graph.persons.size} FICHES`;
    svg.appendChild(caption);

    return { positions: layout.nodes };
  }
};
