import manuscrit from "./manuscrit.js";
import ciel from "./ciel.js";
import frise from "./frise.js";

// Final order: manuscrit, ciel, hologramme, frise.
// Later theme tasks insert their entries BEFORE frise in this array.
export const THEMES = [manuscrit, ciel, frise];
