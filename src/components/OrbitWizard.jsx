/* Andrômeda · OrbitWizard — wizard multi-etapas com a órbita lateral animada.
 *
 * Componente GENÉRICO e reutilizável: detém toda a mecânica orbital (régua,
 * brilho, pills, motor de física por mola, moldura do card e navegação). Cada
 * página passa, via props, só o que muda — os passos, a validade e o conteúdo.
 * Editar este arquivo atualiza TODAS as páginas que o consomem (signup,
 * onboarding, etc.), sem duplicação.
 *
 * A órbita percorre a BORDA ESQUERDA da tela. A etapa-alvo fica amarrada ao
 * meio: ao navegar, a ponta do brilho ALCANÇA a etapa e depois a REÚNE no meio.
 *
 * Props:
 *   steps        [{ id, label, title, accent, lede, noContinue? }]  — etapas da órbita
 *                noContinue: esconde o botão "Continuar" (etapa avança por outro caminho)
 *   validity     boolean[]   — se é permitido avançar DE cada etapa (default: tudo true)
 *   renderStep   (i, nav) => Node — conteúdo do corpo do card; nav = { next, back, goTo }
 *   continueLabel string     — rótulo do botão de avançar (default "Continuar →")
 *   finalLabel    string     — rótulo do botão da última etapa (default "Concluir →")
 *   onComplete   () => void   — chamado ao concluir a última etapa
 *   onCancel     () => void   — opcional; se presente, mostra o "voltar ao início"
 *   onStepChange (index) => void — opcional; chamado quando a etapa muda (não na montagem)
 *   versionmark  string       — opcional; marca de versão no rodapé
 */

import React from "react";
import { Wordmark } from "./Wordmark.jsx";
import {
  ORBIT_PATH,
  ORBIT_GAP,
  ORBIT_MIDDLE_Y,
  orbitFillPathTo,
  orbitItemPoint,
  orbitPointAtY,
} from "../lib/orbit.js";

/* A órbita é animada por uma MOLA criticamente amortecida (sem overshoot):
   acelera a partir do repouso e desacelera ao chegar — dá o "peso" orbital,
   sem rigidez. A velocidade é carregada entre fases e entre redirecionamentos,
   então cliques sobrepostos fluem em vez de cortar seco.
   - ALCANÇAR (reach):  a ponta do brilho dispara até a etapa-alvo (mais ágil).
   - REUNIR   (gather): o item-alvo é trazido ao meio, mais encorpado/lento.
   ω = rigidez (rad/ms): maior = mais rápido/firme.                           */
const OMEGA_REACH = 0.0135;
const OMEGA_GATHER = 0.0092;
const REACH_SNAP = 0.8; // y%: perto o bastante do item p/ começar a reunir
const END_SNAP = 0.12; // y%: tolerância p/ assentar no meio
const VEL_SNAP = 0.004; // y%/ms: velocidade baixa o bastante p/ parar
const EPS = 1e-3;

/* Passo analítico (exato p/ qualquer dt) de uma mola criticamente amortecida:
   x(t) = alvo + (c1 + c2·t)·e^(−ω·t). Retorna [nova posição, nova velocidade]. */
function springStep(x, v, target, dt, omega) {
  const e = Math.exp(-omega * dt);
  const c1 = x - target;
  const c2 = v + omega * c1;
  const nx = target + (c1 + c2 * dt) * e;
  const nv = (c2 - omega * (c1 + c2 * dt)) * e;
  return [nx, nv];
}

function OrbitWizard({
  steps,
  validity,
  renderStep,
  continueLabel = "Continuar →",
  finalLabel = "Concluir →",
  onComplete,
  onCancel,
  onStepChange,
  versionmark,
  shiftY = "0px", // deslocamento vertical da órbita+card (default: centralizado)
}) {
  const [step, setStep] = React.useState(0);
  const [direction, setDir] = React.useState(1);

  const total = steps.length;
  const meta = steps[step];
  const canAdvance = !validity || validity[step] !== false;

  // Órbita: estado animado, DESACOPLADO do conteúdo.
  //   orbitPos — qual etapa está (continuamente) ancorada no meio. As pills são
  //              posicionadas por (i − orbitPos).
  //   glowY    — y% da ponta do brilho (= marcador).
  // O alvo é sempre `step` (que troca na hora ao clicar). Um laço rAF leva a
  // órbita até lá em duas fases: ALCANÇAR a etapa-alvo, depois REUNIR no meio.
  const [orbitPos, setOrbitPos] = React.useState(0);
  const [glowY, setGlowY] = React.useState(ORBIT_MIDDLE_Y);

  const posRef = React.useRef(0); // orbitPos vivo
  const glowRef = React.useRef(ORBIT_MIDDLE_Y); // glowY vivo
  const velRef = React.useRef(0); // velocidade da mola (y%/ms)
  const frozenRef = React.useRef(0); // pos congelado na fase reach
  const goalRef = React.useRef(0); // etapa-alvo
  const phaseRef = React.useRef("idle"); // "idle" | "reach" | "gather"
  const rafRef = React.useRef(0);
  const lastRef = React.useRef(0);
  const stepRef = React.useRef(0); // step vivo (p/ closures estáveis)
  stepRef.current = step;

  const frame = (now) => {
    const dt = Math.min(48, now - lastRef.current); // clampa após aba inativa
    lastRef.current = now;
    const goal = goalRef.current;
    let pos = posRef.current;
    let glow = glowRef.current;
    let vel = velRef.current;

    if (phaseRef.current === "reach") {
      // a ponta dispara até a posição ATUAL da etapa-alvo (pos fica congelado)
      pos = frozenRef.current;
      const target = ORBIT_MIDDLE_Y + (goal - pos) * ORBIT_GAP;
      [glow, vel] = springStep(glow, vel, target, dt, OMEGA_REACH);
      if (Math.abs(glow - target) < REACH_SNAP) {
        if (Math.abs(goal - pos) < EPS) {
          // já estava no lugar
          glow = ORBIT_MIDDLE_Y;
          pos = goal;
          vel = 0;
          phaseRef.current = "idle";
        } else {
          phaseRef.current = "gather"; // mantém a velocidade
        }
      }
    } else if (phaseRef.current === "gather") {
      // traz a etapa-alvo ao meio; a ponta a acompanha (pos derivado de glow)
      [glow, vel] = springStep(glow, vel, ORBIT_MIDDLE_Y, dt, OMEGA_GATHER);
      pos = goal - (glow - ORBIT_MIDDLE_Y) / ORBIT_GAP;
      if (Math.abs(glow - ORBIT_MIDDLE_Y) < END_SNAP && Math.abs(vel) < VEL_SNAP) {
        glow = ORBIT_MIDDLE_Y;
        pos = goal;
        vel = 0; // assenta exato no meio
        phaseRef.current = "idle";
      }
    }

    posRef.current = pos;
    glowRef.current = glow;
    velRef.current = vel;
    setOrbitPos(pos);
    setGlowY(glow);

    if (phaseRef.current === "idle") {
      rafRef.current = 0; // assentou no meio: para
    } else {
      rafRef.current = requestAnimationFrame(frame);
    }
  };

  const runOrbit = () => {
    if (rafRef.current) return; // laço já rodando
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(frame);
  };

  // Navega para a etapa `s`: troca o conteúdo NA HORA e (re)mira a órbita.
  const goTo = (s) => {
    const cur = stepRef.current;
    s = Math.max(0, Math.min(total - 1, s));
    if (s === cur && phaseRef.current === "idle") return;
    setDir(s >= cur ? 1 : -1);
    setStep(s); // conteúdo troca imediato
    goalRef.current = s;
    frozenRef.current = posRef.current; // congela pos p/ a fase reach
    phaseRef.current = "reach"; // sempre realcança o alvo
    runOrbit(); // velocidade é preservada
  };

  React.useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const next = () => {
    if (canAdvance) goTo(step + 1);
  };
  const back = () => goTo(step - 1);
  const jump = (i) => {
    if (i <= step) goTo(i);
  };
  const finish = () => {
    if (canAdvance && onComplete) onComplete();
  };

  // Avisa a troca de etapa (funil de telemetria); não dispara na montagem.
  const onStepChangeRef = React.useRef(onStepChange);
  onStepChangeRef.current = onStepChange;
  const mountedRef = React.useRef(false);
  React.useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    onStepChangeRef.current?.(step);
  }, [step]);

  // Foca o primeiro campo ao entrar em cada etapa — o usuário preenche o
  // formulário inteiro sem tocar no mouse. O corpo remonta a cada etapa
  // (key={step}), então o ref já aponta para o nó recém-montado.
  const bodyRef = React.useRef(null);
  React.useEffect(() => {
    const first = bodyRef.current?.querySelector(
      'input:not([type="checkbox"]):not([type="radio"]):not([readonly]):not([disabled]),' +
        " select:not([disabled]), textarea:not([disabled])",
    );
    first?.focus({ preventScroll: true });
  }, [step]);

  // Enter avança para a próxima etapa sempre que o botão estiver desbloqueado.
  // Ignora: textarea (Enter = quebra de linha), links e botões (o clique nativo já
  // navega) e eventos já tratados por um filho (ex.: adicionar chip/convite,
  // que chamam preventDefault). next()/finish() já respeitam canAdvance.
  const onKeyDownAdvance = (e) => {
    if (e.key !== "Enter" || e.defaultPrevented) return;
    const tag = e.target.tagName;
    if (tag === "TEXTAREA" || tag === "BUTTON" || tag === "A") return; // link: Enter abre o link
    if (meta.noContinue) return; // etapa sem botão de avançar (ex.: verificação)
    e.preventDefault();
    if (step < total - 1) next();
    else finish();
  };

  return (
    <div className="signup-stage signup-stage--orbital" onKeyDown={onKeyDownAdvance}>
      {onCancel && (
        <button
          className="signup-orbit-exit"
          onClick={onCancel}
          aria-label="Voltar ao início"
          type="button"
        >
          <span aria-hidden="true">←</span>
          <Wordmark size="sm" />
        </button>
      )}
      {versionmark && <span className="signup-orbit-versionmark mono">{versionmark}</span>}

      <div className="signup-orbit-scene" style={{ "--orbit-shift-y": shiftY }}>
        <OrbitFrame steps={steps} step={step} orbitPos={orbitPos} glowY={glowY} onJump={jump} />

        <div className="signup-orbit-card">
          <div className="signup-orbit-eyebrow mono">
            ETAPA {String(step + 1).padStart(2, "0")} <span className="sep">/</span>{" "}
            {String(total).padStart(2, "0")}
          </div>
          <h1 className="serif signup-orbit-title">
            {meta.title} <span className="ital accent">{meta.accent}</span>
          </h1>
          <p className="signup-orbit-sub">{meta.lede}</p>

          <div
            ref={bodyRef}
            className={"signup-orbit-body sd-" + (direction > 0 ? "fwd" : "back")}
            key={step}
          >
            {renderStep(step, { next, back, goTo })}
          </div>

          <div className="signup-orbit-actions">
            <button
              className="btn-ghost btn signup-orbit-back"
              onClick={back}
              type="button"
              style={{ visibility: step === 0 ? "hidden" : "visible" }}
            >
              ← Voltar
            </button>
            {!meta.noContinue &&
              (step < total - 1 ? (
                <button
                  className="btn signup-orbit-cta"
                  onClick={next}
                  type="button"
                  disabled={!canAdvance}
                  style={{ opacity: canAdvance ? 1 : 0.45 }}
                >
                  {continueLabel}
                </button>
              ) : (
                <button
                  className="btn signup-orbit-cta"
                  onClick={finish}
                  type="button"
                  disabled={!canAdvance}
                  style={{ opacity: canAdvance ? 1 : 0.45 }}
                >
                  {finalLabel}
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Órbita: régua vertical na borda esquerda ─────────────────────────────
   - As pills são posicionadas por (i − orbitPos), contínuo e animado por rAF.
   - A etapa ancorada no meio é orbitPos; ao assentar, a etapa ativa fica nele.
   - O brilho (fill) vai do TOPO até a ponta (glowY): alcança a etapa-alvo e
     depois recua ao meio trazendo o item junto.                              */
function OrbitFrame({ steps, step, orbitPos, glowY, onJump }) {
  const tip = orbitPointAtY(glowY); // ponta do brilho = marcador

  return (
    <div className="signup-orbit-rail" aria-hidden="false">
      <svg className="signup-orbit-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="orbitFillGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-soft)" />
            <stop offset="40%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-deep)" />
          </linearGradient>
        </defs>
        {/* trilha pontilhada (órbita inteira, esmaecida) */}
        <path d={ORBIT_PATH} className="orbit-track" vectorEffect="non-scaling-stroke" />
        {/* brilho: do topo até a ponta (glowY) — desce de cima para baixo */}
        <path d={orbitFillPathTo(glowY)} className="orbit-fill" vectorEffect="non-scaling-stroke" />
      </svg>

      {/* ponta do brilho (atrás das pills, não tampa o texto da etapa) */}
      <span className="signup-orbit-marker" style={{ left: `${tip.x}%`, top: `${tip.y}%` }}>
        <span className="signup-orbit-marker-core" />
      </span>

      {steps.map((s, i) => {
        const offset = i - orbitPos; // posição contínua na órbita
        const pt = orbitItemPoint(offset);
        const state = i === step ? "active" : i < step ? "done" : "idle";
        const visible = pt.y >= 2 && pt.y <= 98;
        return (
          <button
            key={s.id}
            className={"signup-orbit-pill is-" + state}
            style={{
              left: `${pt.x}%`,
              top: `${pt.y}%`,
              opacity: visible ? 1 : 0,
              pointerEvents: visible ? "auto" : "none",
            }}
            onClick={() => onJump(i)}
            disabled={i > step}
            aria-current={i === step ? "step" : undefined}
            type="button"
          >
            <span className="signup-orbit-pill-num mono">{String(i + 1).padStart(2, "0")}</span>
            <span className="signup-orbit-pill-label">{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export { OrbitWizard };
