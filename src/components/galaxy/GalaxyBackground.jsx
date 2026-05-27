import React from "react";

/* Galaxy starfield background — canvas with parallax stars + slow rotating spiral nebula */

function GalaxyBackground({ intensity = 1, accent = "#C68B66", paletteKey = "default" }) {
  const canvasRef = React.useRef(null);
  const rafRef = React.useRef(0);
  const mouseRef = React.useRef({ x: 0.5, y: 0.5 });
  const stateRef = React.useRef({ stars: [], shooters: [], spirals: 0, w: 0, h: 0 });

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ctx = canvas.getContext("2d");

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stateRef.current.w = w;
      stateRef.current.h = h;
      initStars();
    };

    const initStars = () => {
      const { w, h } = stateRef.current;
      const total = Math.floor((w * h) / 4200 * intensity);
      const stars = [];
      for (let i = 0; i < total; i++) {
        const depth = Math.random();
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          z: depth,
          r: 0.3 + depth * 1.6 + (Math.random() < 0.04 ? 1.2 : 0),
          tw: Math.random() * Math.PI * 2,
          twSpeed: 0.4 + Math.random() * 0.8,
          drift: 0.02 + depth * 0.06,
          hue: Math.random() < 0.12 ? "accent" : "white",
        });
      }
      stateRef.current.stars = stars;
    };

    const spawnShooter = () => {
      const { w, h } = stateRef.current;
      const fromLeft = Math.random() < 0.5;
      const y0 = Math.random() * h * 0.7;
      const len = 80 + Math.random() * 140;
      const angle = (-25 + (Math.random() - 0.5) * 20) * Math.PI / 180;
      stateRef.current.shooters.push({
        x: fromLeft ? -len : w + len,
        y: y0,
        vx: (fromLeft ? 1 : -1) * (8 + Math.random() * 4),
        vy: Math.sin(angle) * 6,
        life: 0,
        maxLife: 60 + Math.random() * 40,
        len,
      });
    };

    let last = performance.now();
    let shooterTimer = 0;

    const tick = (now) => {
      const dt = Math.min(50, now - last) / 16.67;
      last = now;
      const { w, h, stars, shooters } = stateRef.current;
      ctx.clearRect(0, 0, w, h);

      // soft radial vignette nebula
      const g = ctx.createRadialGradient(
        w * 0.65, h * 0.35, 50,
        w * 0.65, h * 0.35, Math.max(w, h) * 0.8
      );
      g.addColorStop(0, "rgba(198,139,102,0.06)");
      g.addColorStop(0.4, "rgba(166,102,71,0.025)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      if (paletteKey === "default") {
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      // second nebula bottom-left
      const g2 = ctx.createRadialGradient(
        w * 0.15, h * 0.85, 30,
        w * 0.15, h * 0.85, Math.max(w, h) * 0.55
      );
      g2.addColorStop(0, paletteKey === "default" ? "rgba(244,227,201,0.04)" : "rgba(255,255,255,0.025)");
      g2.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);

      // parallax offset from mouse
      const mx = (mouseRef.current.x - 0.5) * 30;
      const my = (mouseRef.current.y - 0.5) * 30;

      // draw stars
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.tw += s.twSpeed * 0.02 * dt;
        s.x += s.drift * dt;
        if (s.x > w + 5) s.x = -5;
        const tw = 0.6 + 0.4 * Math.sin(s.tw);
        const px = s.x + mx * s.z;
        const py = s.y + my * s.z;
        const alpha = (0.35 + 0.55 * s.z) * tw;

        if (s.hue === "accent" && paletteKey === "default") {
          ctx.fillStyle = `rgba(198,139,102,${alpha})`;
        } else {
          ctx.fillStyle = `rgba(244,227,201,${alpha})`;
        }
        if (paletteKey === "mono") {
          ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        }
        ctx.beginPath();
        ctx.arc(px, py, s.r, 0, Math.PI * 2);
        ctx.fill();

        // soft glow for the largest
        if (s.r > 1.4) {
          const glow = ctx.createRadialGradient(px, py, 0, px, py, s.r * 6);
          if (s.hue === "accent" && paletteKey === "default") {
            glow.addColorStop(0, `rgba(198,139,102,${alpha * 0.4})`);
          } else {
            glow.addColorStop(0, `rgba(244,227,201,${alpha * 0.3})`);
          }
          if (paletteKey === "mono") {
            glow.addColorStop(0, `rgba(255,255,255,${alpha * 0.3})`);
          }
          glow.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(px, py, s.r * 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // shooters
      shooterTimer += dt;
      if (shooterTimer > 110 + Math.random() * 200) {
        shooterTimer = 0;
        if (Math.random() < 0.6) spawnShooter();
      }
      for (let i = shooters.length - 1; i >= 0; i--) {
        const sh = shooters[i];
        sh.life += dt;
        sh.x += sh.vx * dt;
        sh.y += sh.vy * dt;
        const tnorm = sh.life / sh.maxLife;
        if (tnorm > 1) { shooters.splice(i, 1); continue; }
        const a = Math.sin(tnorm * Math.PI) * 0.9;
        const grad = ctx.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * 8, sh.y - sh.vy * 8);
        grad.addColorStop(0, paletteKey === "default" ? `rgba(244,227,201,${a})` : `rgba(255,255,255,${a})`);
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(sh.x, sh.y);
        ctx.lineTo(sh.x - sh.vx * 8, sh.y - sh.vy * 8);
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    const onMove = (e) => {
      mouseRef.current.x = e.clientX / window.innerWidth;
      mouseRef.current.y = e.clientY / window.innerHeight;
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
    };
  }, [intensity, paletteKey]);

  return <canvas ref={canvasRef} className="galaxy-canvas" />;
}

/* Orbital page transition — when page key changes, draw a rotating arc sweep across the screen */
function OrbitTransition({ trigger }) {
  const canvasRef = React.useRef(null);
  const animRef = React.useRef(0);

  React.useEffect(() => {
    if (!trigger) return;
    const canvas = canvasRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ctx = canvas.getContext("2d");
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = w / 2, cy = h / 2;
    const t0 = performance.now();
    const dur = 900;

    // pre-create some orbital "particles" that follow elliptical paths
    const particles = [];
    for (let i = 0; i < 40; i++) {
      particles.push({
        a: 60 + Math.random() * Math.max(w, h) * 0.55,
        b: 30 + Math.random() * Math.max(w, h) * 0.30,
        ang: Math.random() * Math.PI * 2,
        speed: 4 + Math.random() * 6,
        size: 0.6 + Math.random() * 2,
        tilt: Math.random() * Math.PI,
        delay: Math.random() * 0.3,
        accent: Math.random() < 0.5,
      });
    }

    const draw = (now) => {
      const t = (now - t0) / dur;
      if (t >= 1) {
        ctx.clearRect(0, 0, w, h);
        return;
      }
      ctx.clearRect(0, 0, w, h);

      // sweeping arc
      const sweepAng = -Math.PI / 2 + t * Math.PI * 2.2;
      const sweepLen = (1 - Math.abs(0.5 - t) * 2) * Math.PI * 0.8 + 0.1;
      ctx.strokeStyle = `rgba(198,139,102,${0.35 * Math.sin(t * Math.PI)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(w, h) * 0.42, sweepAng - sweepLen, sweepAng);
      ctx.stroke();

      // inner counter-sweep
      ctx.strokeStyle = `rgba(244,227,201,${0.25 * Math.sin(t * Math.PI)})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(w, h) * 0.30, sweepAng + Math.PI - sweepLen, sweepAng + Math.PI);
      ctx.stroke();

      // particles on orbits
      for (const p of particles) {
        const lt = Math.max(0, (t - p.delay) / (1 - p.delay));
        if (lt <= 0) continue;
        p.ang += 0.02 * p.speed;
        const px = cx + Math.cos(p.ang) * p.a * Math.cos(p.tilt) - Math.sin(p.ang) * p.b * Math.sin(p.tilt);
        const py = cy + Math.cos(p.ang) * p.a * Math.sin(p.tilt) + Math.sin(p.ang) * p.b * Math.cos(p.tilt);
        const a = Math.sin(lt * Math.PI) * 0.9;
        ctx.fillStyle = p.accent ? `rgba(198,139,102,${a})` : `rgba(244,227,201,${a})`;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();

        // tail
        const tailAng = p.ang - 0.06;
        const tx = cx + Math.cos(tailAng) * p.a * Math.cos(p.tilt) - Math.sin(tailAng) * p.b * Math.sin(p.tilt);
        const ty = cy + Math.cos(tailAng) * p.a * Math.sin(p.tilt) + Math.sin(tailAng) * p.b * Math.cos(p.tilt);
        const tg = ctx.createLinearGradient(px, py, tx, ty);
        tg.addColorStop(0, p.accent ? `rgba(198,139,102,${a * 0.7})` : `rgba(244,227,201,${a * 0.5})`);
        tg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.strokeStyle = tg;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [trigger]);

  return <canvas ref={canvasRef} className="orbit-overlay" />;
}

export { GalaxyBackground, OrbitTransition };
