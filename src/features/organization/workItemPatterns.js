/* Padrão único de branch → work item (agente-telas, D5). Funções puras.
 *
 * O servidor guarda regex Java (`(?i)\QAB#\E(\d+)(?!\d)`); aqui só montamos o
 * texto amigável e fazemos a checagem barata de cliente. A sintaxe de verdade
 * fica com o servidor (prévia e PUT). */

export const MAX_PATTERNS = 10;
export const MAX_REGEX_LENGTH = 200;

/** Branches de exemplo da prévia (D5). */
export const SAMPLE_BRANCHES = [
  "feature/AB#1234-login",
  "1234-corrige-login",
  "PROJ-88_ajuste",
  "hotfix/ajuste-css",
  "main",
];

const QUOTE_OPEN = "\\Q";
const QUOTE_CLOSE = "\\E";

/** Texto literal entre `\Q` e `\E`, ou null. */
export function extractQuoted(regex) {
  const s = String(regex || "");
  const start = s.indexOf(QUOTE_OPEN);
  if (start === -1) return null;
  const end = s.indexOf(QUOTE_CLOSE, start + QUOTE_OPEN.length);
  if (end === -1) return null;
  return s.slice(start + QUOTE_OPEN.length, end);
}

/** Rótulo amigável de um padrão a partir do preset (e do regex, para PREFIX). */
export function friendlyPatternLabel({ preset, regex } = {}) {
  switch (preset) {
    case "AB_HASH":
      return "AB#123";
    case "PREFIX": {
      const prefix = extractQuoted(regex);
      return prefix ? `${prefix}123` : "Prefixo";
    }
    case "JIRA_KEY":
      return "PROJ-123";
    case "NUMBER":
      return "número na branch (feature/123-…)";
    default:
      return "Personalizado";
  }
}

/** Rótulo do botão de adicionar um preset. */
export function presetButtonLabel(id) {
  return id === "NUMBER" ? "Número na branch" : friendlyPatternLabel({ preset: id });
}

function prefixRegexUnchecked(prefix) {
  return `(?i)${QUOTE_OPEN}${prefix}${QUOTE_CLOSE}(\\d+)(?!\\d)`;
}

/** Mensagem de erro do prefixo, ou null. */
export function prefixError(prefix) {
  const p = String(prefix ?? "");
  if (!p.trim()) return "Informe o prefixo.";
  if (p.includes(QUOTE_CLOSE)) return "O prefixo não pode conter \\E.";
  if (prefixRegexUnchecked(p).length > MAX_REGEX_LENGTH) return "Prefixo longo demais.";
  return null;
}

/** `task-` → `(?i)\Qtask-\E(\d+)(?!\d)`; null para prefixo vazio ou com `\E`. */
export function buildPrefixRegex(prefix) {
  const p = String(prefix ?? "");
  if (!p.trim() || p.includes(QUOTE_CLOSE)) return null;
  return prefixRegexUnchecked(p);
}

/** Quantidade de grupos de captura (`(` não escapado e não seguido de `?`;
 * `(?<nome>` conta). Ignora `\Q…\E` e classes `[...]`. */
export function countCaptureGroups(regex) {
  const s = String(regex || "");
  let count = 0;
  let inClass = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") {
      if (s[i + 1] === "Q") {
        const end = s.indexOf(QUOTE_CLOSE, i + 2);
        if (end === -1) break;
        i = end + 1;
      } else {
        i += 1;
      }
      continue;
    }
    if (inClass) {
      if (c === "]") inClass = false;
      continue;
    }
    if (c === "[") {
      inClass = true;
      continue;
    }
    if (c !== "(") continue;
    if (s[i + 1] !== "?") {
      count += 1;
    } else if (s[i + 2] === "<" && s[i + 3] !== "=" && s[i + 3] !== "!") {
      count += 1;
    }
  }
  return count;
}

/** Erro barato de cliente (vazio, tamanho, sem grupo), ou null. */
export function clientPatternError(regex) {
  const r = String(regex ?? "");
  if (!r.trim()) return "Informe a expressão.";
  if (r.length > MAX_REGEX_LENGTH) return `Use no máximo ${MAX_REGEX_LENGTH} caracteres.`;
  if (countCaptureGroups(r) < 1) {
    return "Falta um grupo entre parênteses com o número, ex.: (\\d+).";
  }
  return null;
}

export const MODE_LABELS = {
  DEFAULT: "Padrão",
  DETECTED: "Detectado automaticamente",
  CUSTOM: "Personalizado",
};
