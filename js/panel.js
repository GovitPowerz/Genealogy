import { formatDateFr } from "./data.js";

function initialsOf(person) {
  const first = (person.firstNames || "").trim();
  const last = (person.lastName || "").trim();
  return ((first[0] || "") + (last[0] || "")).toUpperCase();
}

function birthWord(sex) {
  if (sex === "F") return "Née";
  if (sex === "M") return "Né";
  return "Né(e)";
}

function datePhrase(dateStr) {
  const txt = formatDateFr(dateStr);
  if (txt === "") return "";
  return (dateStr && dateStr.length === 10 ? "le " : "en ") + txt;
}

function lifeLine(person) {
  const b = person.birth;
  const d = person.death;
  if (d) {
    const from = b ? [formatDateFr(b.date), b.place].filter(Boolean).join(", ") : "";
    const to = [formatDateFr(d.date), d.place].filter(Boolean).join(", ");
    return [from, to].filter(Boolean).join(" - ");
  }
  if (!b) return "";
  const parts = [birthWord(person.sex)];
  const when = datePhrase(b.date);
  if (when !== "") parts.push(when);
  if (b.place) parts.push("à " + b.place);
  return parts.length > 1 ? parts.join(" ") : "";
}

function chipSection(title, persons, onNavigate) {
  const section = document.createElement("section");
  section.className = "panel-section";
  const heading = document.createElement("h3");
  heading.textContent = title;
  section.appendChild(heading);
  const list = document.createElement("div");
  list.className = "chips";
  for (const p of persons) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = p.firstNames + " " + p.lastName;
    chip.addEventListener("click", () => onNavigate(p.id));
    list.appendChild(chip);
  }
  section.appendChild(list);
  return section;
}

export function showPanel(personId, ctx) {
  const person = ctx.graph.persons.get(personId);
  if (!person) return;
  const panel = document.querySelector("#panel");
  panel.replaceChildren();

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "panel-close";
  closeBtn.textContent = "Fermer";
  closeBtn.addEventListener("click", () => ctx.onClose());
  panel.appendChild(closeBtn);

  if (person.photo) {
    const img = document.createElement("img");
    img.className = "panel-portrait";
    img.src = person.photo;
    img.alt = "Portrait de " + person.firstNames + " " + person.lastName;
    panel.appendChild(img);
  } else {
    const initials = document.createElement("div");
    initials.className = "initials";
    initials.textContent = initialsOf(person);
    panel.appendChild(initials);
  }

  const name = document.createElement("h2");
  name.textContent = person.firstNames + " " + person.lastName;
  panel.appendChild(name);

  if (person.birthName) {
    const born = document.createElement("p");
    born.className = "panel-birthname";
    born.textContent = "née " + person.birthName;
    panel.appendChild(born);
  }

  const line = lifeLine(person);
  if (line !== "") {
    const dates = document.createElement("p");
    dates.className = "panel-dates";
    dates.textContent = line;
    panel.appendChild(dates);
  }

  if (person.bio) {
    const bio = document.createElement("p");
    bio.className = "panel-bio";
    bio.textContent = person.bio;
    panel.appendChild(bio);
  }

  const groups = [
    ["Parents", ctx.graph.parentsOf(personId)],
    ["Conjoint(e)s", ctx.graph.partnersOf(personId)],
    ["Enfants", ctx.graph.childrenOf(personId)],
    ["Fratrie", ctx.graph.siblingsOf(personId)]
  ];
  for (const [title, persons] of groups) {
    if (persons.length > 0) panel.appendChild(chipSection(title, persons, ctx.onNavigate));
  }

  panel.hidden = false;
}

export function hidePanel() {
  const panel = document.querySelector("#panel");
  panel.replaceChildren();
  panel.hidden = true;
}
