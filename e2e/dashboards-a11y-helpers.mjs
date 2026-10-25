/* Medidores compartilhados dos e2e de acessibilidade e usabilidade dos dashboards v2
 * (dashboards-a11y.spec.js e dashboards-usabilidade.spec.js). */

/**
 * Textos visíveis do dashboard com contraste < mínimo (4,5:1; 3:1 para texto grande).
 * Compõe o fundo efetivo (camadas semitransparentes) e a opacidade dos ancestrais.
 */
export function lowContrastTexts(page, root = "[data-dashboard-v2]") {
  return page.evaluate((sel) => {
    const parse = (c) => {
      if (!c || c === "transparent") return [0, 0, 0, 0];
      const n = c.match(/[\d.]+/g).map(Number);
      if (c.startsWith("color(srgb")) return [n[0] * 255, n[1] * 255, n[2] * 255, n[3] ?? 1];
      return [n[0], n[1], n[2], n[3] ?? 1];
    };
    const over = (top, base) => [0, 1, 2].map((i) => top[i] * top[3] + base[i] * (1 - top[3]));
    const lum = (rgb) => {
      const [r, g, b] = rgb.map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const bgOf = (el) => {
      const layers = [];
      for (let e = el; e; e = e.parentElement) {
        const c = parse(getComputedStyle(e).backgroundColor);
        if (c[3] > 0) layers.push(c);
        if (c[3] >= 1) break;
      }
      let bg = parse(getComputedStyle(document.body).backgroundColor).slice(0, 3);
      for (const l of layers.reverse()) bg = over(l, bg);
      return bg;
    };
    const out = [];
    const rootEl = document.querySelector(sel);
    if (!rootEl) return ["sem raiz " + sel];
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || seen.has(el) || !n.textContent.trim()) continue;
      seen.add(el);
      if (el.closest("svg, .sr-only, [aria-hidden=true], [inert], button:disabled")) continue;
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const cs = getComputedStyle(el);
      let opacity = 1;
      for (let e = el; e; e = e.parentElement) opacity *= Number(getComputedStyle(e).opacity);
      const c = parse(cs.color);
      const bg = bgOf(el);
      const fg = over([c[0], c[1], c[2], c[3] * opacity], bg);
      const size = parseFloat(cs.fontSize);
      const bold = Number(cs.fontWeight) >= 700;
      const large = size >= 24 || (bold && size >= 18.66);
      const min = large ? 3 : 4.5;
      const k = ratio(fg, bg);
      if (k < min - 0.005)
        out.push(`${n.textContent.trim().slice(0, 40)} — ${k.toFixed(2)} (${el.className})`);
    }
    return [...new Set(out)];
  }, root);
}

/** Caixas dos controles + quem ficou < 44 px, coberto ou a < 8 px do vizinho. */
export function targetProblems(page, selector) {
  return page.evaluate((sel) => {
    const els = [...document.querySelectorAll(sel)].filter((e) => {
      if (!e.getClientRects().length || e.closest("[inert]")) return false;
      const r = e.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    });
    const label = (e) => (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 30);
    const problems = [];
    const boxes = els.map((e) => ({ e, r: e.getBoundingClientRect() }));
    for (const { e, r } of boxes) {
      if (r.width < 44 - 0.5 || r.height < 44 - 0.5)
        problems.push(`${label(e)} ${Math.round(r.width)}×${Math.round(r.height)}`);
      /* o alvo é o próprio elemento: nada por cima nos cantos internos (se visível no recorte) */
      /* pontos internos (fora do raio dos cantos arredondados) */
      const ix = Math.min(10, r.width / 4);
      const iy = Math.min(10, r.height / 4);
      for (const [x, y] of [
        [r.left + ix, r.top + iy],
        [r.right - ix, r.bottom - iy],
      ]) {
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
        const hit = document.elementFromPoint(x, y);
        let clipped = false;
        for (let p = e.parentElement; p; p = p.parentElement) {
          const o = getComputedStyle(p).overflowX;
          if (o === "auto" || o === "hidden" || o === "scroll") {
            const pr = p.getBoundingClientRect();
            if (x < pr.left || x > pr.right || y < pr.top || y > pr.bottom) clipped = true;
          }
        }
        /* atrás da barra fixa (rolagem) não conta: a barra cobre de propósito */
        const underBar = hit?.closest("[data-dash-filters]") && !e.closest("[data-dash-filters]");
        if (!clipped && hit && !e.contains(hit) && !underBar)
          problems.push(`${label(e)} coberto por ${hit.tagName}.${hit.className}`);
      }
    }
    /* espaçamento: ≥ 8 px entre áreas; opções do mesmo grupo segmentado só não se sobrepõem */
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const gx = Math.max(b.r.left - a.r.right, a.r.left - b.r.right);
        const gy = Math.max(b.r.top - a.r.bottom, a.r.top - b.r.bottom);
        const gap = Math.max(gx, gy);
        const group =
          a.e.parentElement === b.e.parentElement &&
          (a.e.getAttribute("role") === "radio" || a.e.hasAttribute("aria-pressed"));
        const min = group ? -0.5 : 8 - 0.5;
        if (gap < min) problems.push(`${label(a.e)} ↔ ${label(b.e)} ${gap.toFixed(1)} px`);
      }
    return problems;
  }, selector);
}
