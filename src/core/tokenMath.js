/**
 * Unidades de token. Provedores de IA precificam por MILHÃO de tokens
 * ($/M — ver tabela em features/ai-usage AiPricingTab), então toda grandeza
 * de tokens exibida ao usuário (totais, eixos de gráfico, tooltips) usa a
 * mesma unidade. Razões como tokens por ponto de complexidade ficam em tokens crus — em milhões
 * virariam 0,0015 sem leitura útil.
 */

/**
 * Formata uma contagem de tokens em milhões: 1_250_000 → "1,25M",
 * 18_000 → "0,018M", 0 → "0". Casa decimal por vírgula (pt-BR); precisão
 * adaptativa para não virar "0,00M" em sprints pequenas.
 * @param {number|null|undefined} value contagem de tokens (não é valor em M)
 */
export function fmtTokensM(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const m = Number(value) / 1e6;
  if (m === 0) return "0";
  const decimals = m >= 10 ? 1 : m >= 1 ? 2 : 3;
  return `${m.toFixed(decimals).replace(".", ",")}M`;
}
