/* Elemento clicado → { element, label, area } sanitizado, ou null (telemetria-validacao, D6).
 * Nunca lê valor de input, href nem coordenadas. */

const SELECTOR = [
  "button",
  "a",
  "summary",
  "select",
  "[role=tab]",
  "[role=menuitem]",
  "[role=option]",
  "[role=checkbox]",
  "[role=radio]",
  "[role=switch]",
  "input[type=checkbox]",
  "input[type=radio]",
].join(",");

const ROLES = ["tab", "menuitem", "option", "checkbox", "radio", "switch"];
const ITEM_CONTEXT = "table, [role=row], [role=grid], li";
const AREA_RE = /^[a-z][a-z-]{0,31}$/;
const MAX_LABEL = 60;

export function sanitizeLabel(raw) {
  if (raw == null) return "";
  return String(raw)
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]")
    .replace(/\d/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_LABEL)
    .trim();
}

function elementKind(el) {
  const role = el.getAttribute("role");
  if (role && ROLES.includes(role)) return role;
  const tag = el.tagName.toLowerCase();
  if (tag === "a") return "link";
  if (tag === "input") return el.type === "radio" ? "radio" : "checkbox";
  return tag; // button | summary | select
}

function associatedLabelText(el) {
  const labels = el.labels;
  if (labels && labels.length) return labels[0].textContent;
  const wrap = el.closest?.("label");
  return wrap ? wrap.textContent : "";
}

function areaOf(el) {
  const marked = el.closest("[data-track-area]")?.getAttribute("data-track-area");
  if (marked && AREA_RE.test(marked)) return marked;
  if (el.closest("dialog, [role=dialog], [role=alertdialog]")) return "dialog";
  if (el.closest("nav, aside")) return "nav";
  if (el.closest("header")) return "header";
  if (el.closest("main")) return "main";
  return "other";
}

/**
 * @param {EventTarget | null} target alvo do evento de clique
 * @returns {{element: string, label: string | null, area: string, node: Element} | null}
 */
export function describeClick(target) {
  if (!target || typeof target.closest !== "function") return null;
  const el = target.closest(SELECTOR);
  if (!el || el.closest("[data-track-ignore]")) return null;

  const element = elementKind(el);
  const tracked = el.getAttribute("data-track");
  let raw;
  if (tracked) raw = tracked;
  else if (element === "option" || el.closest(ITEM_CONTEXT)) raw = "[item]";
  else
    raw =
      el.getAttribute("aria-label") ||
      associatedLabelText(el) ||
      (element === "select" ? "" : el.textContent);

  const label = raw === "[item]" ? raw : sanitizeLabel(raw);
  return { element, label: label || null, area: areaOf(el), node: el };
}
