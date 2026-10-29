import React from "react";

/* Bloco de código copiável. O texto copiado é exatamente o exibido. A linha
 * longa rola dentro do <pre>; `min-w-0` em toda a cadeia flex impede que ele
 * empurre a largura da página. */
export default function CopyBlock({ text, label = "Copiar" }) {
  const [copied, setCopied] = React.useState(false);

  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="border-line bg-bg-deep rounded-btn mt-1 flex min-w-0 flex-col gap-2 border p-2 sm:flex-row sm:items-start">
      <pre
        tabIndex={0}
        className="text-fg focus-visible:outline-accent m-0 min-w-0 flex-1 overflow-x-auto font-mono text-xs whitespace-pre focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {text}
      </pre>
      <button
        type="button"
        className="btn btn-ghost min-h-[44px] min-w-[44px] shrink-0"
        onClick={copy}
      >
        {copied ? "Copiado!" : label}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Copiado!" : ""}
      </span>
    </div>
  );
}
