/* Home (landing page) */

import { Wordmark } from "../../components/Wordmark.jsx";
import { PLANS } from "../../data/plans.js";

const FEATURES = [
  {
    n: "01",
    title: "Coleta passiva",
    desc: "Conecte GitHub, Azure DevOps e seus provedores de IA. A sincronização roda em segundo plano a cada 30 minutos — ninguém preenche planilhas.",
  },
  {
    n: "02",
    title: "Tokens × Story Points",
    desc: "Cada entrega ganha uma dimensão computacional. Veja quantos tokens — e quantos reais — uma feature custou em IA além do esforço humano.",
  },
  {
    n: "03",
    title: "DORA + IA",
    desc: "Deployment Frequency, Lead Time, Change Failure Rate e MTTR convivendo com métricas de uso de IA por dev, por squad e por sprint.",
  },
  {
    n: "04",
    title: "Três órbitas",
    desc: "Dashboards específicos para desenvolvedor, tech lead e gestor de projetos — cada papel vê o que importa, sem ruído.",
  },
  {
    n: "05",
    title: "Sem agentes invasivos",
    desc: "Nada de keylogger ou rastreio de tela. Só os rastros digitais que sua engenharia já gera: commits, PRs, sprints, chamadas de API.",
  },
  {
    n: "06",
    title: "Privacidade por padrão",
    desc: "Conteúdo de prompts nunca é armazenado. Métricas agregadas, código sob LGPD, contratos com cláusula de não-treinamento.",
  },
];

function HomeHeader({ palette, setPalette, onLogin, onSignup }) {
  return (
    <header className="home-nav">
      <div className="home-nav-inner">
        <a className="home-brand" href="#top">
          <Wordmark size="sm" />
        </a>
        <nav className="home-nav-links">
          <a href="#sistema">O sistema</a>
          <a href="#metricas">Métricas</a>
          <a href="#planos">Planos</a>
          <a href="#tcc">TCC</a>
        </nav>
        <div className="home-nav-actions">
          <button className="btn-ghost btn" onClick={onLogin}>Entrar</button>
          <button className="btn" onClick={onSignup}>Criar conta</button>
        </div>
      </div>
    </header>
  );
}

function HomeScreen({ palette, setPalette, onLogin, onSignup }) {
  return (
    <div className="home-stage" id="top">
      <HomeHeader palette={palette} setPalette={setPalette} onLogin={onLogin} onSignup={onSignup} />

      {/* Hero */}
      <section className="home-hero">
        <div className="home-hero-grid">
          <div className="home-hero-copy">
            <div className="eyebrow">
              <span className="dot"></span>
              <span>Software Engineering Intelligence · v0.1 beta</span>
            </div>
            <h1 className="serif home-h1">
              A constelação que mede sua engenharia <span className="ital accent">— inclusive a IA.</span>
            </h1>
            <p className="home-lede">
              <strong>Andrômeda</strong> correlaciona o esforço computacional da IA — em tokens — com as métricas tradicionais de desenvolvimento ágil. Cycle time, lead time, velocity, DORA, e agora também o custo computacional de cada entrega, tudo num só sistema solar.
            </p>
            <div className="home-hero-cta">
              <button className="btn btn-lg" onClick={onSignup}>
                Criar organização →
              </button>
              <button className="btn-ghost btn btn-lg" onClick={onLogin}>
                Já tenho conta
              </button>
            </div>
            <div className="home-hero-meta">
              <span><strong>0.30</strong> · BRL por 1k tokens médios</span>
              <span><strong>30min</strong> · janela de sincronização</span>
              <span><strong>3</strong> · papéis de dashboard</span>
            </div>
          </div>

          <aside className="home-hero-viz" aria-hidden="true">
            <div className="orbit-system">
              <div className="orbit orbit-1"></div>
              <div className="orbit orbit-2"></div>
              <div className="orbit orbit-3"></div>
              <div className="orbit-core">
                <div className="orbit-core-num">2.4M</div>
                <div className="orbit-core-label">tokens · sprint 14</div>
              </div>
              <span className="orbit-planet p1" title="GitHub">GH</span>
              <span className="orbit-planet p2" title="Azure DevOps">AZ</span>
              <span className="orbit-planet p3" title="OpenAI">AI</span>
              <span className="orbit-planet p4" title="Anthropic">CL</span>
              <span className="orbit-planet p5" title="Google">GG</span>
            </div>
            <div className="orbit-caption">
              fontes em órbita ao redor do sprint atual
            </div>
          </aside>
        </div>
      </section>

      {/* Sistema */}
      <section className="home-section" id="sistema">
        <div className="section-head">
          <div className="section-eyebrow">§ 01 · sobre</div>
          <h2 className="serif section-title">
            O que é a Andrômeda<span className="accent">.</span>
          </h2>
          <p className="section-lede">
            Em times que adotam IA, a produtividade clássica não conta a história inteira. Andrômeda é uma plataforma de <em>SEI — Software Engineering Intelligence</em> que junta as duas pontas: o que o time entrega, e quanto a IA consumiu — em prompt, em token e em real — para que isso acontecesse.
          </p>
        </div>

        <div className="feature-grid">
          {FEATURES.map((f) => (
            <article key={f.n} className="feature-card">
              <div className="feature-n mono">{f.n}</div>
              <h3 className="serif feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Métricas */}
      <section className="home-section home-section-band" id="metricas">
        <div className="section-head">
          <div className="section-eyebrow">§ 02 · métricas</div>
          <h2 className="serif section-title">
            O que medimos<span className="accent">.</span>
          </h2>
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

      {/* Planos */}
      <section className="home-section" id="planos">
        <div className="section-head">
          <div className="section-eyebrow">§ 03 · planos</div>
          <h2 className="serif section-title">
            Escolha sua órbita<span className="accent">.</span>
          </h2>
          <p className="section-lede">
            Os planos escalam com o tamanho do seu time. Durante o beta, valores ainda não foram fixados — entre em contato e a gente cota.
          </p>
        </div>

        <div className="plan-grid">
          {PLANS.map((p) => (
            <article key={p.id} className={"plan-card" + (p.highlight ? " is-highlight" : "")}>
              {p.highlight && <div className="plan-badge">mais escolhido</div>}
              <div className="plan-name serif">{p.name}</div>
              <div className="plan-sub">{p.sub}</div>
              <div className="plan-seats mono">{p.seats}</div>
              <div className="plan-price serif">{p.price}</div>
              <div className="plan-period">{p.period}</div>
              <ul className="plan-features">
                {p.features.map((f, i) => (
                  <li key={i}>
                    <span className="plan-check" aria-hidden="true">✦</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                className={p.highlight ? "btn" : "btn-ghost btn"}
                style={{ width: "100%" }}
                onClick={onSignup}
              >
                {p.cta} →
              </button>
            </article>
          ))}
        </div>
      </section>

      {/* TCC */}
      <section className="home-section home-section-band" id="tcc">
        <div className="section-head">
          <div className="section-eyebrow">§ 04 · contexto</div>
          <h2 className="serif section-title">
            Um TCC com cara de produto<span className="accent">.</span>
          </h2>
          <p className="section-lede">
            Andrômeda nasce como trabalho de conclusão do curso de Bacharelado em Engenharia de Software. A intenção, porém, é entregar uma plataforma utilizável de verdade, em uso real, com dados reais — não uma maquete acadêmica. O código é aberto para banca e parceiros.
          </p>
        </div>
        <div className="cta-band">
          <div>
            <div className="serif cta-band-title">Pronto pra orbitar?</div>
            <div className="cta-band-sub">Crie sua conta de administrador e configure sua organização em três passos.</div>
          </div>
          <button className="btn btn-lg" onClick={onSignup}>
            Criar conta →
          </button>
        </div>
      </section>

      <footer className="home-foot">
        <div><Wordmark size="sm" /></div>
        <div className="home-foot-meta mono">
          <span>v0.1 · build 2026.05.15</span>
          <span>TCC · BES</span>
          <span>© 2026 Andrômeda</span>
        </div>
      </footer>
    </div>
  );
}

export { HomeScreen };
