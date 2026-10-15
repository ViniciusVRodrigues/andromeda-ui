/* Política de privacidade pública (/privacidade) — telemetria-validacao, D14.
 * Sem login e fora do /:orgSlug. Coluna de até 68ch, sem rolagem horizontal em 320 px. */

import React from "react";
import { Wordmark } from "../../components/Wordmark.jsx";

const CONTACT = "privacidade@andromeda.ia.br";

function MailLink() {
  return (
    <a className="text-accent-text underline underline-offset-[3px]" href={`mailto:${CONTACT}`}>
      {CONTACT}
    </a>
  );
}

function Section({ title, children }) {
  return (
    <section className="mt-10">
      <h2 className="serif text-fg mb-3 text-[22px] leading-tight">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function List({ items }) {
  return (
    <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

export function PrivacyPage() {
  React.useEffect(() => {
    const prev = document.title;
    document.title = "Privacidade · Andrômeda";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="bg-bg text-fg min-h-full">
      <header className="px-5 py-5 md:px-10">
        <a href="/" aria-label="Andrômeda — página inicial" className="inline-block">
          <Wordmark size="sm" />
        </a>
      </header>
      <main className="text-fg-muted mx-auto w-full max-w-[68ch] px-5 pb-16 text-[length:var(--mono-md)] leading-[1.65] break-words md:px-10">
        <div className="mono text-fg-dim text-[11px] tracking-[0.22em] uppercase">Privacidade</div>
        <h1 className="serif text-fg mt-3 mb-2 text-[clamp(30px,6vw,44px)] leading-[1.1]">
          Como usamos seus <span className="text-accent-text italic">dados</span>
        </h1>
        <p className="mono text-fg-dim m-0 text-[12px]">Atualizada em 18 de outubro de 2026</p>

        <section className="border-line mt-8 rounded-lg border p-4">
          <h2 className="serif text-fg mb-3 text-[20px]">Em resumo</h2>
          <List
            items={[
              "Registramos telas, tempo, cliques e erros.",
              "Nunca registramos o que você digita.",
              "Os registros são apagados em 180 dias.",
            ]}
          />
        </section>

        <Section title="Quem é responsável">
          <p>
            O Andrômeda é um Trabalho de Conclusão de Curso (TCC) do Bacharelado em Engenharia de
            Software da Pontifícia Universidade Católica do Paraná (PUCPR), em Curitiba.
          </p>
          <p>
            Feito por Natália Molini Buffa, Pedro Henrique Silva Cabral e Vinícius Veiga Rodrigues.
          </p>
          <p>
            Contato: <MailLink />
          </p>
        </Section>

        <Section title="Dados da sua conta">
          <p>Nome, e-mail, cargo, senioridade, organização, projetos e convites.</p>
          <p>A senha é guardada de um jeito que nem nós conseguimos ler.</p>
        </Section>

        <Section title="Dados que a sua organização conecta">
          <p>
            Itens de trabalho e sprints do Azure DevOps, repositórios e pull requests do GitHub ou
            do Azure Repos, e o consumo de IA enviado pelo conector.
          </p>
          <p>Esses dados servem para montar os painéis.</p>
        </Section>

        <Section title="Como você usa o Andrômeda">
          <List
            items={[
              "As telas que você abre e quanto tempo cada uma fica visível.",
              "Os botões e links em que você clica, pelo nome do botão. Em listas e tabelas, sem o nome do item.",
              "Data e hora de entrada.",
              "Os erros que aparecerem para você: só o código e a tela, sem a mensagem.",
            ]}
          />
        </Section>

        <Section title="Etapas do cadastro e do convite">
          <p>Registramos quais etapas você percorreu, sem nada do que você digitou.</p>
          <p>
            Elas ficam anônimas e, quando você conclui, são ligadas à sua conta e à sua organização.
          </p>
          <p>Se você abandonar o fluxo, continuam anônimas e são apagadas em 180 dias.</p>
        </Section>

        <Section title="O que não registramos">
          <List
            items={[
              "O que você digita.",
              "Gravação de tela, posição do mouse e localização.",
              "Nenhuma ferramenta de análise de terceiros é usada.",
              "Os dados não são vendidos.",
            ]}
          />
          <p>
            Como em qualquer site, os servidores que entregam o Andrômeda podem manter registros
            técnicos de acesso.
          </p>
        </Section>

        <Section title="Para quê">
          <List
            items={[
              "Fazer o Andrômeda funcionar.",
              "A pesquisa do TCC: medir como a plataforma é usada.",
              "Para quem responder ao questionário de avaliação, o uso é cruzado com as respostas pelo e-mail de login.",
            ]}
          />
          <p>Os resultados publicados são agregados, sem identificar ninguém.</p>
        </Section>

        <Section title="Por quanto tempo">
          <List
            items={[
              "Registros de uso e de etapas: 180 dias, depois apagados automaticamente.",
              "Conta: enquanto existir, ou até você pedir a exclusão, feita manualmente pela equipe.",
            ]}
          />
        </Section>

        <Section title="Quem acessa e onde fica">
          <List
            items={[
              "Os autores do projeto.",
              "O administrador da sua organização pode exportar o registro de uso das pessoas da organização, com o e-mail.",
              "Os dados ficam no servidor do Andrômeda.",
            ]}
          />
        </Section>

        <Section title="Seus direitos (LGPD, Lei 13.709/2018)">
          <p>
            Você pode pedir acesso, correção ou exclusão dos seus dados, ou deixar de participar da
            pesquisa.
          </p>
          <p>
            Basta escrever para <MailLink />. Respondemos em até 15 dias.
          </p>
        </Section>

        <Section title="Mudanças">
          <p>Quando esta página mudar, a data no topo muda junto.</p>
        </Section>

        <p className="mt-12">
          <a className="text-accent-text underline underline-offset-[3px]" href="/">
            Voltar ao início
          </a>
        </p>
      </main>
    </div>
  );
}

export default PrivacyPage;
