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

/* Só o texto próprio do <label>: um label que envolve o controle traria junto as <option>
 * (nomes de projeto, cargos) e o caret "▾". */
const LABEL_NOISE = "select, option, input, textarea, button, svg, [aria-hidden=true]";

function labelOwnText(label) {
  const copy = label.cloneNode(true);
  copy.querySelectorAll(LABEL_NOISE).forEach((n) => n.remove());
  return copy.textContent.replace(/[^\p{L}\p{N}\s.,:;!?'"()#-]/gu, " ");
}

function associatedLabelText(el) {
  const labels = el.labels;
  if (labels && labels.length) return labelOwnText(labels[0]);
  const wrap = el.closest?.("label");
  return wrap ? labelOwnText(wrap) : "";
}

/* Texto de um "botão simples": só vale se vier de UM único elemento com texto próprio
 * (ignorando svg e aria-hidden). Cartões e botões de usuário têm dois ou mais blocos
 * (nome + org, nome + descrição) e carregam dado digitado: viram [item]. */
function simpleButtonText(el) {
  const blocks = new Map();
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        const t = child.textContent.trim();
        if (t) blocks.set(node, (blocks.get(node) || "") + " " + t);
      } else if (child.nodeType === 1) {
        if (child.tagName.toLowerCase() === "svg" || child.getAttribute("aria-hidden") === "true")
          continue;
        walk(child);
      }
    }
  };
  walk(el);
  return blocks.size === 1 ? [...blocks.values()][0] : "";
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
  // aria-label nunca vira rótulo: costuma interpolar o nome do item ("Remover Maria Souza").
  // Botão de ícone só ganha nome com data-track.
  if (tracked) raw = tracked;
  else if (element === "option" || el.closest(ITEM_CONTEXT)) raw = "[item]";
  else if (element === "select") raw = associatedLabelText(el);
  else raw = associatedLabelText(el) || simpleButtonText(el) || "[item]";

  const label = raw === "[item]" ? raw : sanitizeLabel(raw);
  return { element, label: label || null, area: areaOf(el), node: el };
}
