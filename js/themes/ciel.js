// Theme "Ciel etoile": canvas starfield backdrop + SVG constellation overlay.
// All pseudo-randomness is a deterministic sin-hash so reloads render identically.

const STAR_COUNT = 200;
const JITTER_MAX = 18;
const SVG_NS = "http://www.w3.org/2000/svg";

function hash01(n, salt) {
  const s = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function idHash01(id, salt) {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) % 1000003;
  return hash01(n, salt);
}

function startBackdrop(canvas) {
  const ctx2d = canvas.getContext("2d");

  const stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      fx: hash01(i, 1),
      fy: hash01(i, 2),
      size: 0.6 + hash01(i, 3) * 1.4,
      phase: hash01(i, 4) * Math.PI * 2,
      speed: 0.5 + hash01(i, 5) * 1.5
    });
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  let rafId = 0;
  let shooting = null;
  let shootCount = 0;
  let nextShootAt = 0;

  function frame(t) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx2d.clearRect(0, 0, w, h);

    for (const s of stars) {
      const twinkle = 0.5 + 0.5 * Math.sin((t / 1000) * s.speed + s.phase);
      ctx2d.globalAlpha = 0.3 + 0.6 * twinkle;
      ctx2d.fillStyle = "#dfe8ff";
      ctx2d.beginPath();
      ctx2d.arc(s.fx * w, s.fy * h, s.size, 0, Math.PI * 2);
      ctx2d.fill();
    }
    ctx2d.globalAlpha = 1;

    // 8-15 s between shooting stars, deterministic per launch index.
    if (nextShootAt === 0) nextShootAt = t + 8000 + hash01(shootCount, 6) * 7000;
    if (shooting === null && t >= nextShootAt) {
      shootCount += 1;
      shooting = {
        x: hash01(shootCount, 7) * w * 0.8,
        y: hash01(shootCount, 8) * h * 0.4,
        angle: Math.PI * 0.15 + hash01(shootCount, 9) * Math.PI * 0.2,
        start: t,
        duration: 700
      };
    }
    if (shooting !== null) {
      const p = (t - shooting.start) / shooting.duration;
      if (p >= 1) {
        shooting = null;
        nextShootAt = t + 8000 + hash01(shootCount, 6) * 7000;
      } else {
        const dist = 260 * p;
        const hx = shooting.x + Math.cos(shooting.angle) * dist;
        const hy = shooting.y + Math.sin(shooting.angle) * dist;
        const tx = hx - Math.cos(shooting.angle) * 70;
        const ty = hy - Math.sin(shooting.angle) * 70;
        const grad = ctx2d.createLinearGradient(tx, ty, hx, hy);
        grad.addColorStop(0, "rgba(255,255,255,0)");
        grad.addColorStop(1, "rgba(255,255,255," + (0.9 * (1 - p)).toFixed(3) + ")");
        ctx2d.strokeStyle = grad;
        ctx2d.lineWidth = 2;
        ctx2d.beginPath();
        ctx2d.moveTo(tx, ty);
        ctx2d.lineTo(hx, hy);
        ctx2d.stroke();
      }
    }

    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);

  return function stop() {
    cancelAnimationFrame(rafId);
    window.removeEventListener("resize", resize);
    ctx2d.setTransform(1, 0, 0, 1, 0, 0);
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  };
}

function el(name, attrs) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

function render({ svg, canvas, graph, generations, layout }) {
  svg.replaceChildren();

  // Layout positions plus deterministic jitter (max 18px per axis) to
  // break the grid into constellation shapes.
  const positions = new Map();
  for (const [id, pos] of layout.nodes) {
    const jx = (idHash01(id, 1) - 0.5) * 2 * JITTER_MAX;
    const jy = (idHash01(id, 2) - 0.5) * 2 * JITTER_MAX;
    positions.set(id, { x: pos.x + jx, y: pos.y + jy });
  }

  // Initial framing; panzoom (Task 5) takes over viewBox manipulation afterwards.
  const margin = 80;
  svg.setAttribute(
    "viewBox",
    `${-margin} ${-margin} ${layout.width + 2 * margin} ${layout.height + 2 * margin}`
  );

  const defs = el("defs", {});
  const glowLiving = el("filter", {
    id: "ciel-glow-living", x: "-150%", y: "-150%", width: "400%", height: "400%"
  });
  glowLiving.appendChild(el("feDropShadow", {
    dx: 0, dy: 0, stdDeviation: 4, "flood-color": "#ffffff", "flood-opacity": 0.85
  }));
  const glowDeceased = el("filter", {
    id: "ciel-glow-deceased", x: "-150%", y: "-150%", width: "400%", height: "400%"
  });
  glowDeceased.appendChild(el("feDropShadow", {
    dx: 0, dy: 0, stdDeviation: 5, "flood-color": "#ffb066", "flood-opacity": 0.9
  }));
  defs.appendChild(glowLiving);
  defs.appendChild(glowDeceased);
  svg.appendChild(defs);

  const linksGroup = el("g", { class: "ciel-links" });
  for (const link of layout.links) {
    if (link.type === "partner") {
      const a = positions.get(link.a);
      const b = positions.get(link.b);
      linksGroup.appendChild(el("line", {
        x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "ciel-link-partner"
      }));
    } else {
      const child = positions.get(link.childId);
      const parents = link.parentIds.map((pid) => positions.get(pid));
      const mx = parents.reduce((sum, p) => sum + p.x, 0) / parents.length;
      const my = parents.reduce((sum, p) => sum + p.y, 0) / parents.length;
      linksGroup.appendChild(el("line", {
        x1: mx, y1: my, x2: child.x, y2: child.y, class: "ciel-link-child"
      }));
    }
  }
  svg.appendChild(linksGroup);

  const personsGroup = el("g", { class: "ciel-persons" });
  for (const [id, pos] of positions) {
    const person = graph.persons.get(id);
    const gen = generations.get(id);
    const radius = Math.max(5, 11 - gen * 2);
    const deceased = person.death != null;
    const g = el("g", { "data-person-id": id, class: "ciel-person" });
    g.appendChild(el("circle", {
      cx: pos.x,
      cy: pos.y,
      r: radius,
      fill: deceased ? "#ffd27a" : "#eaf1ff",
      filter: deceased ? "url(#ciel-glow-deceased)" : "url(#ciel-glow-living)"
    }));
    const label = el("text", { x: pos.x, y: pos.y + radius + 15, class: "ciel-label" });
    label.textContent = `${person.firstNames.split(" ")[0]} ${person.lastName}`;
    g.appendChild(label);
    personsGroup.appendChild(g);
  }
  svg.appendChild(personsGroup);

  const stopBackdrop = startBackdrop(canvas);
  return { positions, cleanup: stopBackdrop };
}

export default { id: "ciel", label: "Ciel étoilé", className: "theme-ciel", render };
