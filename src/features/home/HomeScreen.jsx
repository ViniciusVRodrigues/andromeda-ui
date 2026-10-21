/* Home (landing page) */

import { Wordmark } from "../../components/Wordmark.jsx";
import { TEAM } from "../../data/team.js";
import dashboardPreview from "../../assets/dashboard-preview.png";

const STEPS = [
  {
    n: "01",
    title: "Conecte",
    desc: "Conecte seus repositórios (GitHub ou Azure Repos), o Azure Boards e seus provedores de IA. Leva minutos — sem instalar agentes, sem plugins de IDE.",
  },
  {
    n: "02",
    title: "Sincronize",
    desc: "Commits, PRs, sprints e chamadas de API viram dados estruturados em segundo plano, automaticamente.",
  },
  {
    n: "03",
    title: "Correlacione",
    desc: "Cada entrega ganha uma dimensão computacional: quanto de IA — em tokens e em reais — ela custou, ao lado de DORA, cycle time e velocity.",
  },
];

function HomeHeader({ onLogin, onSignup }) {
  return (
    <header className="home-nav">
      <div className="home-nav-inner">
        <a className="home-brand" href="#top">
          <Wordmark size="sm" />
        </a>
        <nav className="home-nav-links">
          <a href="#problema">O problema</a>
          <a href="#como-funciona">Como funciona</a>
          <a href="#metricas">Métricas</a>
          <a href="#produto">Produto</a>
          <a href="#equipe">Equipe</a>
        </nav>
        <div className="home-nav-actions">
          <button className="btn-ghost btn" onClick={onLogin}>
            Entrar
          </button>
          <button className="btn" onClick={onSignup}>
            Criar conta
          </button>
        </div>
      </div>
    </header>
  );
}

function TeamAvatar({ name, photo }) {
  if (photo) {
    return (
      <div className="team-avatar">
        <img src={photo} alt="" />
      </div>
    );
  }
  const initials = name
    .split(" ")
    .filter((w) => w.length > 2 || w === name.split(" ")[0])
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div className="team-avatar team-avatar-fallback" aria-hidden="true">
      <span>{initials}</span>
    </div>
  );
}

// Display order is fixed (not object-key order) so every card lists its links the same way,
// regardless of how the keys happen to be written in team.js.
const LINK_ORDER = ["linkedin", "github", "instagram", "email"];
const LINK_LABELS = {
  linkedin: "LinkedIn",
  github: "GitHub",
  instagram: "Instagram",
  email: "E-mail",
  site: "Site",
};

// `email` may be written as a bare address ("nome@dominio.com") or as a full "mailto:" URL —
// accept both so team.js stays comfortable to edit.
function hrefFor(key, value) {
  if (key !== "email") return value;
  return value.startsWith("mailto:") ? value : `mailto:${value}`;
}

function TeamLinks({ links }) {
  const present = Object.entries(links || {}).filter(([, v]) => v && String(v).trim());
  if (present.length === 0) return null;
  const ordered = [
    ...LINK_ORDER.filter((k) => present.some(([key]) => key === k)).map((k) => [
      k,
      present.find(([key]) => key === k)[1],
    ]),
    ...present.filter(([k]) => !LINK_ORDER.includes(k)),
  ];
  return (
    <div className="team-links">
      {ordered.map(([key, value]) => (
        <a
          key={key}
          href={hrefFor(key, value)}
          {...(key === "email" ? {} : { target: "_blank", rel: "noreferrer" })}
          className="team-link"
        >
          {LINK_LABELS[key] || key}
        </a>
      ))}
    </div>
  );
}

function HomeScreen({ onLogin, onSignup }) {
  return (
    <div className="home-stage" id="top">
      <HomeHeader onLogin={onLogin} onSignup={onSignup} />

      {/* Hero */}
      <section className="home-hero">
        <div className="home-hero-orbit-accent" aria-hidden="true">
          <div className="hero-orbit-ring r1"></div>
          <div className="hero-orbit-ring r2"></div>
        </div>
        <div className="home-hero-inner">
          <h1 className="serif home-h1">
            Quanto sua IA <span className="ital accent">custou</span> por entrega
            <span className="accent">.</span>
          </h1>
          <p className="home-lede">
            A <strong>Andrômeda</strong> liga GitHub, Azure DevOps e seus provedores de IA para
            mostrar, em cada entrega, quanto de IA foi gasto ao lado das métricas que a liderança já
            acompanha: DORA, cycle time, lead time e velocity.
          </p>
          <div className="home-hero-cta">
            <button className="btn btn-lg" onClick={onSignup}>
              Criar organização →
            </button>
            <button className="btn-ghost btn btn-lg" onClick={onLogin}>
              Já tenho conta
            </button>
          </div>
        </div>
      </section>

      {/* O problema */}
      <section className="home-section home-section-narrow" id="problema">
        <div className="problem-block">
          <p className="problem-lede">
            <span className="serif ital">A velocity subiu.</span> Ninguém sabe dizer o quanto disso
            veio de Copilot, Claude ou ChatGPT — nem quanto custou.
          </p>
          <p className="problem-sub">
            Os times adotaram IA generativa mais rápido do que conseguiram medi-la. O board mostra
            mais pontos entregues; a fatura da API, mais gasto. Os dois números vivem em sistemas
            diferentes, e quase ninguém os cruza por feature, por pessoa ou por sprint.
          </p>
        </div>
      </section>

      {/* Como funciona */}
      <section className="home-section" id="como-funciona">
        <div className="section-head">
          <h2 className="serif section-title">
            Como funciona<span className="accent">.</span>
          </h2>
          <p className="section-lede">
            Três passos, sem trabalho manual depois da configuração inicial.
          </p>
        </div>

        <div className="steps-grid">
          {STEPS.map((s, i) => (
            <article key={s.n} className="step-card">
              <div className="step-n mono">{s.n}</div>
              <h3 className="serif step-title">{s.title}</h3>
              <p className="step-desc">{s.desc}</p>
              {i < STEPS.length - 1 && <div className="step-connector" aria-hidden="true"></div>}
            </article>
          ))}
        </div>
      </section>

      {/* Métricas */}
      <section className="home-section home-section-band" id="metricas">
        <div className="section-head">
          <h2 className="serif section-title">
            O que medimos<span className="accent">.</span>
          </h2>
          <p className="section-lede">
            Quatro dimensões, um só painel — nenhuma delas isolada das outras.
          </p>
        </div>

        <div className="metric-grid">
          <div className="metric-block">
            <div className="metric-cat mono">DORA</div>
            <ul className="metric-list">
              <li>Deployment Frequency</li>
              <li>Lead Time for Changes</li>
              <li>Change Failure Rate</li>
              <li>Mean Time to Restore</li>
            </ul>
          </div>
          <div className="metric-block">
            <div className="metric-cat mono">FLOW</div>
            <ul className="metric-list">
              <li>Cycle Time por PR</li>
              <li>Velocity por squad</li>
              <li>Story points / sprint</li>
              <li>WIP médio</li>
            </ul>
          </div>
          <div className="metric-block">
            <div className="metric-cat mono">IA</div>
            <ul className="metric-list">
              <li>Tokens por commit</li>
              <li>Tokens por story point</li>
              <li>Custo BRL / feature</li>
              <li>Distribuição por provedor</li>
            </ul>
          </div>
          <div className="metric-block">
            <div className="metric-cat mono">QUALIDADE</div>
            <ul className="metric-list">
              <li>Code review turnaround</li>
              <li>PRs revertidos</li>
              <li>Bugs por release</li>
              <li>Coverage delta</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Produto */}
      <section className="home-section" id="produto">
        <div className="section-head">
          <h2 className="serif section-title">
            O painel, de verdade<span className="accent">.</span>
          </h2>
          <p className="section-lede">
            Sem maquete. Sprint atual, burndown, planejado × entregue × uso de IA entre sprints e o
            custo de IA de cada work item — tudo montado a partir do que é sincronizado do Azure
            DevOps e dos provedores de IA da equipe.
          </p>
        </div>

        <div className="product-frame">
          <div className="product-frame-chrome">
            <span className="product-frame-dot"></span>
            <span className="product-frame-dot"></span>
            <span className="product-frame-dot"></span>
            <span className="product-frame-url mono">andromeda.ia.br/andromeda/dashboard</span>
          </div>
          <div className="product-frame-body">
            <img
              src={dashboardPreview}
              alt="Dashboard individual da Andrômeda: burndown da sprint atual, gráfico comparativo de planejado × entregue × custo e tokens de IA entre as últimas sprints, painéis de em andamento e KPIs com variação contra a sprint anterior"
            />
          </div>
        </div>
      </section>

      {/* Equipe */}
      <section className="home-section home-section-band" id="equipe">
        <div className="section-head">
          <h2 className="serif section-title">
            Quem faz<span className="accent">.</span>
          </h2>
          <p className="section-lede">Os três autores do TCC que constrói a Andrômeda.</p>
        </div>

        <div className="team-grid">
          {TEAM.map((p) => (
            <article key={p.id} className="team-card">
              <TeamAvatar name={p.name} photo={p.photo} />
              <div className="team-name serif">{p.name}</div>
              <div className="team-role">{p.role}</div>
              <TeamLinks links={p.links} />
            </article>
          ))}
        </div>
      </section>

      {/* TCC */}
      <section className="home-section" id="tcc">
        <div className="tcc-band">
          <p className="tcc-band-text">
            Andrômeda nasce como Trabalho de Conclusão de Curso em Engenharia de Software — mas
            construída para uso real, com dados reais, não como maquete acadêmica. Código aberto
            para banca e parceiros.
          </p>
        </div>
      </section>

      <section className="home-section home-section-cta">
        <div className="cta-band">
          <div>
            <div className="serif cta-band-title">Pronto para medir o custo real da sua IA?</div>
            <div className="cta-band-sub">
              Crie sua conta de administrador e configure sua organização em três passos.
            </div>
          </div>
          <button className="btn btn-lg" onClick={onSignup}>
            Criar conta →
          </button>
        </div>
      </section>

      <footer className="home-foot">
        <div>
          <Wordmark size="sm" />
        </div>
        <div className="home-foot-meta mono">
          <span>v1.0</span>
          <span>TCC · BES</span>
          <a href="/privacidade" className="hover:text-fg text-inherit underline">
            Privacidade
          </a>
          <span>© 2026 Andrômeda</span>
        </div>
      </footer>
    </div>
  );
}

export { HomeScreen };
