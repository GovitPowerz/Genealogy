import { loadFamily } from "./data.js";
import { assignGenerations } from "./generations.js";
import { computeLayout } from "./layout.js";
import { createPanZoom } from "./panzoom.js";
import { THEMES } from "./themes/index.js";

const THEME_STORAGE_KEY = "genealogie-theme";

export function parseHash(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const themeId = params.get("theme");
  return {
    theme: THEMES.some((t) => t.id === themeId) ? themeId : null,
    person: params.get("person") || null
  };
}

export function buildHash({ theme, person }) {
  const parts = [];
  if (theme) parts.push(`theme=${theme}`);
  if (person) parts.push(`person=${person}`);
  return parts.length > 0 ? `#${parts.join("&")}` : "";
}

async function boot() {
  const svg = document.querySelector("#stage");
  const canvas = document.querySelector("#backdrop");
  const errorBanner = document.querySelector("#error-banner");
  const themesNav = document.querySelector("#themes");
  const stageArea = document.querySelector("main");

  function sizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }
  sizeCanvas();
  window.addEventListener("resize", sizeCanvas);

  let family;
  try {
    family = await loadFamily();
  } catch (err) {
    errorBanner.textContent = err.message;
    errorBanner.hidden = false;
    return;
  }
  const graph = family.graph;
  graph.warnings.forEach((w) => console.warn(w));

  const generations = assignGenerations(graph);
  const layout = computeLayout(graph, generations);

  // Expand the viewBox to the stage aspect ratio, content centered, so
  // "meet" letterboxing never skews the panzoom pixel-to-user mapping.
  const contentW = Math.max(1, layout.width);
  const contentH = Math.max(1, layout.height);
  const stageRect = svg.getBoundingClientRect();
  const aspect = stageRect.width / Math.max(1, stageRect.height);
  let vbW = contentW;
  let vbH = contentH;
  if (vbW / vbH < aspect) vbW = vbH * aspect;
  else vbH = vbW / aspect;
  svg.setAttribute("viewBox", `${(contentW - vbW) / 2} ${(contentH - vbH) / 2} ${vbW} ${vbH}`);

  const panzoom = createPanZoom(svg); // Task 6 wires search fly-to to this

  if (THEMES.length === 0) {
    const msg = document.createElement("div");
    msg.className = "stage-message";
    msg.textContent = "Aucun thème disponible";
    stageArea.appendChild(msg);
    return;
  }

  let activeThemeId = null;
  let activeCleanup = null;
  let positions = new Map(); // Task 6 reads this for search fly-to

  function renderTheme(id) {
    const theme = THEMES.find((t) => t.id === id);
    if (!theme || id === activeThemeId) return;
    if (activeCleanup) {
      activeCleanup();
      activeCleanup = null;
    }
    document.body.className = theme.className;
    const result = theme.render({ svg, canvas, graph, generations, layout });
    positions = result.positions;
    activeCleanup = result.cleanup || null;
    activeThemeId = id;
    for (const btn of themesNav.querySelectorAll("button")) {
      btn.classList.toggle("active", btn.dataset.themeId === id);
    }
    localStorage.setItem(THEME_STORAGE_KEY, id);
  }

  for (const theme of THEMES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = theme.label;
    btn.dataset.themeId = theme.id;
    btn.addEventListener("click", () => {
      const { person } = parseHash(location.hash);
      const hash = buildHash({ theme: theme.id, person });
      if (hash !== location.hash) location.hash = hash;
    });
    themesNav.appendChild(btn);
  }

  window.addEventListener("hashchange", () => {
    const { theme } = parseHash(location.hash);
    if (theme) renderTheme(theme);
  });

  const fromHash = parseHash(location.hash);
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  const initial =
    fromHash.theme ||
    (THEMES.some((t) => t.id === stored) ? stored : null) ||
    THEMES[0].id;
  renderTheme(initial);
  if (fromHash.theme !== initial) {
    const hash = buildHash({ theme: initial, person: fromHash.person });
    history.replaceState(null, "", hash || location.pathname + location.search);
  }
}

if (typeof document !== "undefined") {
  boot();
}
