import { loadFamily, yearOf } from "./data.js";
import { assignGenerations } from "./generations.js";
import { computeLayout } from "./layout.js";
import { createPanZoom } from "./panzoom.js";
import { showPanel, hidePanel } from "./panel.js";
import { searchPersons } from "./search.js";
import { THEMES } from "./themes/index.js";

const THEME_STORAGE_KEY = "genealogie-theme";

export function parseHash(hash) {
  const params = new URLSearchParams((hash || "").replace(/^#/, ""));
  const theme = params.get("theme");
  const person = params.get("person");
  return {
    theme: theme && THEMES.some((t) => t.id === theme) ? theme : null,
    person: person || null
  };
}

export function buildHash({ theme, person }) {
  const parts = [];
  if (theme) parts.push("theme=" + theme);
  if (person) parts.push("person=" + person);
  return parts.length > 0 ? "#" + parts.join("&") : "";
}

const state = {
  svg: null, canvas: null,
  graph: null, generations: null, layout: null, panZoom: null,
  positions: new Map(), cleanup: null, themeId: null, personId: null
};

function flyToPerson(id) {
  const pos = state.positions.get(id);
  if (pos) state.panZoom.flyTo(pos.x, pos.y);
}

function setHashPerson(personId) {
  const current = parseHash(location.hash);
  const next = buildHash({ theme: current.theme, person: personId });
  history.replaceState(null, "", next === "" ? location.pathname + location.search : next);
}

function openPerson(id) {
  if (!state.graph.persons.has(id)) return;
  showPanel(id, {
    graph: state.graph,
    generations: state.generations,
    onNavigate: (nextId) => {
      openPerson(nextId);
      flyToPerson(nextId);
    },
    onClose: closePanel
  });
  state.personId = id;
  setHashPerson(id);
}

function closePanel() {
  hidePanel();
  state.personId = null;
  setHashPerson(null);
}

function clearSearchResults() {
  const box = document.querySelector("#search-results");
  box.replaceChildren();
  box.hidden = true;
}

function renderSearchResults(matches) {
  const box = document.querySelector("#search-results");
  box.replaceChildren();
  box.hidden = matches.length === 0;
  for (const person of matches) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "search-result";
    const year = person.birth && person.birth.date ? yearOf(person.birth.date) : null;
    item.textContent = person.firstNames + " " + person.lastName
      + (year !== null ? " (" + year + ")" : "");
    item.addEventListener("click", () => {
      clearSearchResults();
      document.querySelector("#search").value = "";
      flyToPerson(person.id);
      openPerson(person.id);
    });
    box.appendChild(item);
  }
}

function showStageMessage(text) {
  clearStageMessage();
  const message = document.createElement("div");
  message.className = "stage-message";
  message.textContent = text;
  document.querySelector("main").appendChild(message);
}

function clearStageMessage() {
  const existing = document.querySelector("main .stage-message");
  if (existing) existing.remove();
}

function expandViewBoxToStageAspect(svg) {
  const vb = svg.viewBox.baseVal;
  const rect = svg.getBoundingClientRect();
  if (vb.width === 0 || vb.height === 0 || rect.width === 0 || rect.height === 0) return;
  const stageRatio = rect.width / rect.height;
  const boxRatio = vb.width / vb.height;
  if (boxRatio < stageRatio) {
    const width = vb.height * stageRatio;
    vb.x -= (width - vb.width) / 2;
    vb.width = width;
  } else if (boxRatio > stageRatio) {
    const height = vb.width / stageRatio;
    vb.y -= (height - vb.height) / 2;
    vb.height = height;
  }
}

function renderTheme(themeId) {
  const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];
  if (!theme) {
    document.body.className = "";
    state.svg.replaceChildren();
    showStageMessage("Aucun thème disponible");
    return;
  }
  clearStageMessage();
  if (state.cleanup) state.cleanup();
  state.cleanup = null;
  document.body.className = theme.className;
  const result = theme.render({
    svg: state.svg,
    canvas: state.canvas,
    graph: state.graph,
    generations: state.generations,
    layout: state.layout
  });
  state.positions = result.positions;
  if (result.cleanup) state.cleanup = result.cleanup;
  state.themeId = theme.id;
  localStorage.setItem(THEME_STORAGE_KEY, theme.id);

  for (const btn of document.querySelectorAll("#themes button")) {
    btn.classList.toggle("active", btn.dataset.themeId === theme.id);
  }

  expandViewBoxToStageAspect(state.svg);
  if (state.panZoom) state.panZoom.destroy();
  state.panZoom = createPanZoom(state.svg);
}

function buildThemeButtons() {
  const nav = document.querySelector("#themes");
  nav.replaceChildren();
  for (const theme of THEMES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.themeId = theme.id;
    btn.textContent = theme.label;
    btn.addEventListener("click", () => {
      renderTheme(theme.id);
      const current = parseHash(location.hash);
      history.replaceState(null, "",
        buildHash({ theme: theme.id, person: current.person }));
    });
    nav.appendChild(btn);
  }
}

async function boot() {
  state.svg = document.querySelector("#stage");
  state.canvas = document.querySelector("#backdrop");
  const banner = document.querySelector("#error-banner");
  let family;
  try {
    family = await loadFamily();
  } catch (err) {
    banner.textContent = err.message;
    banner.hidden = false;
    return;
  }
  state.graph = family.graph;
  for (const warning of state.graph.warnings) console.warn(warning);
  state.generations = assignGenerations(state.graph);
  state.layout = computeLayout(state.graph, state.generations);

  buildThemeButtons();
  const fromHash = parseHash(location.hash);
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  const initialTheme = fromHash.theme
    || (THEMES.some((t) => t.id === stored) ? stored : null)
    || (THEMES[0] ? THEMES[0].id : null);
  renderTheme(initialTheme);
  if (state.themeId && fromHash.theme !== state.themeId) {
    history.replaceState(null, "",
      buildHash({ theme: state.themeId, person: fromHash.person }));
  }

  window.addEventListener("hashchange", () => {
    const next = parseHash(location.hash);
    if (next.theme && next.theme !== state.themeId) renderTheme(next.theme);
    if (next.person !== state.personId) {
      if (next.person) {
        openPerson(next.person);
        flyToPerson(next.person);
      } else {
        hidePanel();
        state.personId = null;
      }
    }
  });

  state.svg.addEventListener("click", (event) => {
    const target = event.target.closest("[data-person-id]");
    if (target) openPerson(target.dataset.personId);
  });

  const searchInput = document.querySelector("#search");
  searchInput.addEventListener("input", () => {
    renderSearchResults(searchPersons(state.graph, searchInput.value));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    clearSearchResults();
    if (!document.querySelector("#panel").hidden) closePanel();
  });

  if (fromHash.person) {
    openPerson(fromHash.person);
    requestAnimationFrame(() => flyToPerson(fromHash.person));
  }
}

if (typeof document !== "undefined") {
  boot();
}
