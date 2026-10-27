/**
 * De quem é a visão Individual (individual-outra-pessoa). Na própria visão nada muda (1ª pessoa);
 * ao ver outra pessoa os textos passam para a 3ª pessoa com o primeiro nome. Um contexto evita
 * passar o assunto por cada widget e componente do kit.
 */

import React from "react";

export const SELF_SUBJECT = Object.freeze({ self: true, name: null, first: null });

/** @param {{ name?: string|null } | null | undefined} person  a pessoa vista (null = a própria). */
export function makeSubject(person) {
  if (!person) return SELF_SUBJECT;
  const known = !!person.name;
  const name = person.name || "Pessoa selecionada";
  return { self: false, name, first: known ? name.split(/\s+/)[0] : name };
}

const SubjectContext = React.createContext(SELF_SUBJECT);

export function SubjectProvider({ subject, children }) {
  return <SubjectContext.Provider value={subject}>{children}</SubjectContext.Provider>;
}

export const useSubject = () => React.useContext(SubjectContext);

/**
 * `t(minha, deles)`: o texto na 1ª pessoa, ou o da 3ª (string ou função do primeiro nome).
 * Fora do React (funções puras como os destaques) use `pickText(subject, minha, deles)`.
 */
export function pickText(subject, mine, theirs) {
  if (!subject || subject.self) return mine;
  return typeof theirs === "function" ? theirs(subject.first) : theirs;
}

export function useT() {
  const subject = useSubject();
  return React.useCallback((mine, theirs) => pickText(subject, mine, theirs), [subject]);
}

/** Título e pergunta das seções da Individual na 3ª pessoa (os da própria visão vêm do catálogo). */
const OTHER_SECTION = {
  resumo: { question: (n) => `Como está o ritmo de ${n} nesta sprint?` },
  "ia-entrega": { question: (n) => `O uso de IA de ${n} acompanha o que é entregue?` },
  trabalho: {
    title: (n) => `Trabalho de ${n}`,
    question: (n) => `O que ${n} já entregou e o que ainda falta?`,
  },
  codigo: { question: (n) => `Como andam os pull requests e as reviews de ${n}?` },
  historico: { question: (n) => `${n} está evoluindo de uma sprint para outra?` },
};

export function sectionText(section, subject) {
  if (!subject || subject.self) return { title: section.title, question: section.question };
  const o = OTHER_SECTION[section.id] || {};
  return {
    title: o.title ? o.title(subject.first) : section.title,
    question: o.question ? o.question(subject.first) : section.question,
  };
}
