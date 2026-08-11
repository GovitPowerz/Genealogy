# Genealogy Site Redesign - Design

Date: 2026-08-11
Status: approved pending final spec review

## Context

The current site is a placeholder: sample data, nested-list tree, one style.
Rebuild it as a real family genealogy site. Hard constraints:

- GitHub Pages hosting: plain HTML/CSS/JS, static data, no build step.
- Family members (no dev knowledge, no GitHub accounts) must be able to
  submit new data or corrections.
- Multiple visual renderings of the same family data.

## Decisions

- Data model: full genealogy (persons + unions), not a single-root tree.
- Scale: starting from scratch, under ~100 people, entered over time.
- Privacy: public site is acceptable, full data allowed.
- Contributions: email-based (no GitHub accounts). Site form generates a
  structured submission; maintainer applies it with a local tool.
- Renderings: four distinct worlds sharing one engine - Manuscrit,
  Ciel etoile, Hologramme, Frise du temps.
- Features v1: person detail panel, search with fly-to, one portrait photo
  per person, timeline rendering.
- Language: French only.
- Architecture: zero-dependency SVG theme engine. Canvas only for
  background effects.

## Data model

One file, `data/family.json`:

```json
{
  "persons": [
    {
      "id": "gregory-gelly",
      "firstNames": "Grégory",
      "lastName": "Gelly",
      "birthName": null,
      "sex": "M",
      "birth": { "date": "1980", "place": "Lyon" },
      "death": null,
      "photo": "assets/photos/gregory-gelly.jpg",
      "bio": "Texte libre en français."
    }
  ],
  "unions": [
    {
      "id": "u-gregory-marie",
      "partners": ["gregory-gelly", "marie-dupont"],
      "date": "2005",
      "children": ["enfant-1"]
    }
  ]
}
```

Rules:

- Children belong to unions, not persons. Single/unknown parent = union
  with one partner. A person appears as child of at most one union.
- Dates are strings with flexible precision: `"1942"`, `"1942-05"`,
  `"1942-05-17"`. Engine logic only uses the year; display renders the
  precision available. `death: null` means living.
- `sex` is `"M"`, `"F"`, or `null` (unknown).
- IDs are human-readable slugs; photo filename matches the id.
- One portrait per person at `assets/photos/<id>.<ext>` (any web image
  format; the explicit path stored in `photo` is authoritative, nullable).
  No galleries in v1.
- Required fields: `id`, `firstNames`, `lastName`. Everything else
  optional/nullable so partially-known ancestors are representable.

## Architecture

Plain ES modules, no build step, no dependencies:

```
index.html            app shell: theme switcher, search, SVG stage, panel
contribute.html       family contribution form
data/family.json      the data
assets/photos/        portraits
css/                  base.css + one small css per theme
js/
  data.js             fetch family.json, build kinship graph
  generations.js      generation assignment (BFS from roots, partners
                      pulled to same level)
  layout.js           shared generational layout: couple-blocks, children
                      rows beneath
  panzoom.js          pointer + wheel + touch pan/zoom on SVG viewBox
  panel.js            person detail panel
  search.js           accent-insensitive search + fly-to
  main.js             orchestration, theme registry, URL hash state
  themes/manuscrit.js ciel.js  hologramme.js  frise.js
tools/
  validate.mjs        data validator (node, zero deps)
  apply-submission.mjs maintainer tool: submission JSON -> family.json edit
.github/workflows/validate.yml  runs validator on push/PR
```

### Theme interface

Each theme exports `{ id, label, render(stage, graph, layout) }` and draws
its world into the SVG stage (plus optional background canvas). Themes tag
person nodes with `data-person-id`; everything interactive (panel, search,
fly-to, pan/zoom) is shared engine code. Adding a theme = one file + one
registry line.

### Shared behavior

- Click person -> detail panel: photo, French-formatted dates/places, bio,
  clickable chips for parents/partners/children/siblings.
- Search: accent-insensitive; selecting a result animates pan/zoom to the
  person in the active theme.
- URL hash state: `#theme=ciel&person=gregory-gelly` for shareable deep
  links; last theme remembered in localStorage.
- French everywhere: UI strings, date formatting ("17 mai 1942"),
  relationship labels.

## The four renderings

All four show the same graph, same interactions; only the world changes.

1. **Manuscrit** - illuminated manuscript page. Enluminures live on the
   frame: vine scrollwork (rinceaux) with red/blue flowers and gold dots
   on all four borders, corner miniatures, double border in oxblood and
   gold. Center is a real tree: tapered trunk, curving branches, layered
   canopy with golden fruit. Ancestors at the trunk (couple shield),
   descendants rise into branches on phylactere banners. Gothic display
   font with red lettrines, procedural parchment texture (SVG
   feTurbulence). Banners glow on hover. (Direction validated on mockup
   v2.)
2. **Ciel etoile** - animated night sky. Canvas starfield background with
   twinkle and occasional shooting star; persons are stars (SVG overlay),
   family units form constellations via link lines; deceased shine gold;
   labels fade in on hover/zoom.
3. **Hologramme** - sci-fi HUD. Dark grid, hexagonal glass cards, cyan
   and magenta neon, animated pulses traveling along union/child links,
   monospace type.
4. **Frise du temps** - chronology. Horizontal year axis, one life-bar
   per person (birth to death/today), lanes grouped and colored by
   generation, marriage connectors, dashed red "aujourd'hui" line.

## Contribution flow

Family side (`contribute.html`, no login, French):

- Modes: Ajouter une personne / Corriger une fiche / Ajouter ou corriger
  une union / Autre remarque (free text).
- Corriger: accent-insensitive person picker, form pre-filled from
  current data.
- Ajouter: person fields + optional parent linkage (existing union or
  two persons).
- Output: compact JSON submission `{type, payload, note, submitterName}`
  with two actions: "Envoyer par e-mail" (mailto: to the maintainer,
  JSON in body) and "Copier le texte" (clipboard). Photos: attach to the
  email; submission notes a photo is coming.

Maintainer side:

- `tools/apply-submission.mjs`: reads submission JSON (file or stdin),
  validates against current data, prints the intended change, applies it
  to `data/family.json`. Review via git diff, commit on a feature
  branch. Node (not Python) so validation logic is shared with the site;
  keeps the repo single-language.

## Validation and CI

`tools/validate.mjs` checks: id uniqueness, dangling references, date
format, at most one parent-union per person, photo paths that exist.
Runs locally and in GitHub Actions on every push/PR.

## Error handling

- `family.json` load/parse failure -> French error banner in the stage.
- Dangling references -> skipped with console warning; site renders the
  valid remainder.
- Contribution form -> inline French validation messages before output is
  generated.

## Testing

- `node --test` unit tests: graph building, generation assignment,
  layout, validator, apply-submission.
- Themes verified visually in the browser during implementation.

## Deployment

No build step. GitHub Pages serves the repo root from `main`. Work on
feature branches, maintainer merges.

## Starter data

Fictional French family, ~12 persons, 3 generations, including one
remarriage and one single-parent union, so every theme and edge case is
exercisable before real data arrives.

## Out of scope (v1)

- Photo galleries (one portrait per person only)
- GEDCOM import/export
- GitHub-account-based PR automation for contributors
- English/bilingual UI
- Private hosting / access control
