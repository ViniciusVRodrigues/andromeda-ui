/* Wordmark — logotipo da Andrômeda em três variações de paleta. */

function Wordmark({ size = "md", style }) {
  const cls = "wordmark" + (size === "sm" ? " sm" : size === "lg" ? " lg" : size === "xl" ? " xl" : "");
  return (
    <span className={cls} style={style}>
      <img src="/assets/wordmark-color.svg" alt="Andrômeda" className="wordmark-color" />
      <img src="/assets/wordmark-mono.svg" alt="Andrômeda" className="wordmark-mono" />
      <img src="/assets/wordmark-cream.svg" alt="Andrômeda" className="wordmark-cream" />
    </span>
  );
}

export { Wordmark };
