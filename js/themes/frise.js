import { yearOf } from "../data.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const PX_PER_YEAR = 8;
const MARGIN = { top: 70, right: 60, bottom: 30, left: 60 };
const BAR_HEIGHT = 22;
const LANE_GAP = 12;
const GEN_GAP = 46;
const MIN_BAR_WIDTH = 24;
const CHAR_WIDTH = 6.5; // rough label width estimate at font-size 11px
// One color per generation, pinned palette, indexed by generation % 5.
const GEN_COLORS = ["#4e79a7", "#e07b39", "#59a14c", "#b0648f", "#3e9d9a"];

function el(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

function textEl(content, attrs) {
  const node = el("text", attrs);
  node.textContent = content;
  return node;
}

export default {
  id: "frise",
  label: "Frise du temps",
  className: "theme-frise",
  render(ctx) {
    const { svg, canvas, graph, generations } = ctx;

    // This theme does not use the backdrop canvas: clear it.
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    svg.replaceChildren();

    const currentYear = new Date().getFullYear();

    // A person without a birth year cannot be placed on a time axis: skipped.
    const plotted = [];
    for (const person of graph.persons.values()) {
      const birthYear = person.birth && person.birth.date ? yearOf(person.birth.date) : null;
      if (birthYear === null) continue;
      let endYear;
      let yearsLabel;
      if (person.death === null) {
        endYear = currentYear;
        yearsLabel = "(" + birthYear + ")";
      } else {
        const deathYear = person.death.date ? yearOf(person.death.date) : null;
        endYear = deathYear === null ? birthYear : deathYear;
        yearsLabel = deathYear === null
          ? "(" + birthYear + "-?)"
          : "(" + birthYear + "-" + deathYear + ")";
      }
      plotted.push({ person, birthYear, endYear, yearsLabel });
    }

    let minYear = currentYear;
    let maxYear = currentYear;
    for (const item of plotted) {
      if (item.birthYear < minYear) minYear = item.birthYear;
      if (item.endYear > maxYear) maxYear = item.endYear;
    }
    const axisStart = Math.floor(minYear / 10) * 10;
    const axisEnd = Math.ceil((maxYear + 1) / 10) * 10;
    const xOf = (year) => MARGIN.left + (year - axisStart) * PX_PER_YEAR;

    // Lanes: one row per person, grouped by generation, sorted by birth year.
    const byGen = new Map();
    for (const item of plotted) {
      const gen = generations.get(item.person.id) ?? 0;
      if (!byGen.has(gen)) byGen.set(gen, []);
      byGen.get(gen).push(item);
    }
    const genList = [...byGen.keys()].sort((a, b) => a - b);
    const laneById = new Map();
    let cursorY = MARGIN.top;
    for (const gen of genList) {
      const items = byGen.get(gen);
      items.sort((a, b) => a.birthYear - b.birthYear || a.person.id.localeCompare(b.person.id));
      for (const item of items) {
        item.gen = gen;
        item.laneY = cursorY;
        laneById.set(item.person.id, item);
        cursorY += BAR_HEIGHT + LANE_GAP;
      }
      cursorY += GEN_GAP - LANE_GAP;
    }
    const bottomY = Math.max(cursorY - GEN_GAP + LANE_GAP, MARGIN.top);
    const width = MARGIN.left + (axisEnd - axisStart) * PX_PER_YEAR + MARGIN.right;
    const height = bottomY + MARGIN.bottom;
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);

    // Axis: baseline, decade gridlines, ticks, year labels.
    const axisY = MARGIN.top - 8;
    svg.appendChild(el("line", {
      x1: xOf(axisStart), y1: axisY, x2: xOf(axisEnd), y2: axisY, class: "frise-axis"
    }));
    for (let year = axisStart; year <= axisEnd; year += 10) {
      const x = xOf(year);
      svg.appendChild(el("line", { x1: x, y1: axisY, x2: x, y2: bottomY, class: "frise-grid" }));
      svg.appendChild(el("line", { x1: x, y1: axisY - 6, x2: x, y2: axisY, class: "frise-tick" }));
      svg.appendChild(textEl(String(year), {
        x, y: axisY - 12, class: "frise-axis-label", "text-anchor": "middle"
      }));
    }

    // Life bars.
    const positions = new Map();
    for (const item of laneById.values()) {
      const barX = xOf(item.birthYear);
      const barWidth = Math.max((item.endYear - item.birthYear) * PX_PER_YEAR, MIN_BAR_WIDTH);
      const centerY = item.laneY + BAR_HEIGHT / 2;
      const group = el("g", { "data-person-id": item.person.id, class: "frise-person" });
      group.appendChild(el("rect", {
        x: barX, y: item.laneY, width: barWidth, height: BAR_HEIGHT,
        rx: BAR_HEIGHT / 2, fill: GEN_COLORS[item.gen % GEN_COLORS.length]
      }));
      const label = item.person.firstNames + " " + item.person.lastName + " " + item.yearsLabel;
      const fitsInside = label.length * CHAR_WIDTH + 16 <= barWidth;
      group.appendChild(textEl(label, fitsInside
        ? { x: barX + 10, y: centerY, class: "frise-label frise-label-in", "dominant-baseline": "central" }
        : { x: barX + barWidth + 8, y: centerY, class: "frise-label frise-label-out", "dominant-baseline": "central" }));
      svg.appendChild(group);
      positions.set(item.person.id, { x: barX + barWidth / 2, y: centerY });
    }

    // Marriage connectors: vertical line at the union year between the two bars.
    for (const union of graph.unions.values()) {
      if (union.partners.length !== 2) continue;
      const unionYear = union.date ? yearOf(union.date) : null;
      if (unionYear === null) continue;
      const a = laneById.get(union.partners[0]);
      const b = laneById.get(union.partners[1]);
      if (!a || !b) continue;
      const x = xOf(unionYear);
      const yA = a.laneY + BAR_HEIGHT / 2;
      const yB = b.laneY + BAR_HEIGHT / 2;
      svg.appendChild(el("line", { x1: x, y1: yA, x2: x, y2: yB, class: "frise-union" }));
      svg.appendChild(el("circle", { cx: x, cy: yA, r: 3.5, class: "frise-union-dot" }));
      svg.appendChild(el("circle", { cx: x, cy: yB, r: 3.5, class: "frise-union-dot" }));
    }

    // Dashed red line at the current year.
    const todayX = xOf(currentYear);
    svg.appendChild(el("line", {
      x1: todayX, y1: axisY, x2: todayX, y2: bottomY, class: "frise-today"
    }));
    svg.appendChild(textEl("aujourd'hui", {
      x: todayX - 6, y: axisY - 26, class: "frise-today-label", "text-anchor": "end"
    }));

    return { positions };
  }
};
