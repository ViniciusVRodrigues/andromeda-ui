/* Aviso de coleta da etapa 01 do cadastro e do convite (telemetria-validacao, D14).
 * Parágrafo comum — sem role de alerta — porque é informação, não erro. O link abre
 * em nova aba para o assistente (que não persiste estado) continuar preenchido. */

export function PrivacyLink({ children, className = "" }) {
  return (
    <a
      href="/privacidade"
      target="_blank"
      rel="noopener noreferrer"
      className={`text-accent-text underline underline-offset-[3px] ${className}`}
    >
      {children}
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  );
}

export function UsageNotice({ className = "" }) {
  return (
    <p
      className={`text-fg-muted col-span-full m-0 mt-3.5 max-w-[68ch] text-[length:var(--mono-sm)] leading-[1.55] ${className}`}
      style={{ gridColumn: "1 / -1" }}
    >
      Registramos telas, tempo e cliques (nunca o que você digita) para uma pesquisa da PUCPR.{" "}
      <PrivacyLink>Como usamos seus dados</PrivacyLink>
    </p>
  );
}

export default UsageNotice;
