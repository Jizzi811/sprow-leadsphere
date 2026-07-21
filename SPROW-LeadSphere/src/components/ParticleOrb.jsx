import { useEffect, useRef } from "react";

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  return m
    ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
    : [77, 229, 129];
}

/**
 * Atmende Partikelkugel im getlayers-"Blob"-Stil: eine flüssige Sphäre aus
 * glühenden Punkten, die langsam rotiert, periodisch zu einer Wolke zerstäubt
 * und sich wieder zusammenzieht. Akzentfarbe folgt der gewählten Branche.
 */
export function ParticleOrb({ searching, accent }) {
  const canvasRef = useRef(null);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const [cr, cg, cb] = hexToRgb(accent);
    let frame, t = Math.random() * 100;
    let rotX = 0, rotY = 0;

    const N = 1400;
    const particles = Array.from({ length: N }, (_, i) => ({
      phi: Math.acos(1 - 2 * (i + 0.5) / N),
      theta: Math.PI * (1 + Math.sqrt(5)) * i,
      size: 0.4 + Math.random() * 1.5,
      drift: Math.random() * 6.28,
      burst: 0.25 + Math.random() * Math.random() * 1.6,
    }));

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onPointer = (e) => {
      const r = canvas.getBoundingClientRect();
      pointer.current = {
        x: ((e.clientX - r.left) / r.width - 0.5) * 2,
        y: ((e.clientY - r.top) / r.height - 0.5) * 2,
      };
    };

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * 0.3;
      ctx.clearRect(0, 0, w, h);

      t += searching ? 0.02 : 0.007;
      // Sanfte Maus-Parallaxe
      rotX += (pointer.current.y * 0.35 - rotX) * 0.04;
      rotY += (pointer.current.x * 0.55 - rotY) * 0.04;

      // Atem-/Zerstäubungszyklus: 0 = kompakte Sphäre, 1 = aufgelöste Wolke
      const cycle = (Math.sin(t * (searching ? 0.9 : 0.42)) + 1) / 2;
      const disperse = Math.pow(cycle, 2.6) * (searching ? 0.9 : 0.55);
      const pulse = 1 + Math.sin(t * 2.1) * 0.02;

      // Glühender Kern
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.15);
      core.addColorStop(0, `rgba(${cr},${cg},${cb},${0.16 + disperse * 0.05})`);
      core.addColorStop(0.55, `rgba(${cr},${cg},${cb},0.05)`);
      core.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = core;
      ctx.fillRect(0, 0, w, h);

      for (const p of particles) {
        const th = p.theta + t + rotY;
        const ph = p.phi + rotX * 0.35;
        const wave = Math.sin(p.phi * 4 + t * 2 + p.drift) * (searching ? 8 : 3.5);
        const scatter =
          disperse * p.burst * radius *
          (0.55 + 0.45 * Math.sin(t * 1.4 + p.drift * 3));
        const r = (radius + wave + scatter) * pulse;
        const x3 = Math.sin(ph) * Math.cos(th);
        const y3 = Math.cos(ph);
        const z3 = Math.sin(ph) * Math.sin(th);
        const perspective = 0.76 + (z3 + 1) * 0.14;
        const alpha =
          (0.16 + (z3 + 1) * 0.3) * (1 - disperse * 0.35 * (p.burst > 1 ? 1 : 0));
        ctx.beginPath();
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
        ctx.shadowColor = `rgb(${cr},${cg},${cb})`;
        ctx.shadowBlur = p.size > 1.5 ? 8 : 0;
        ctx.arc(
          cx + x3 * r * perspective,
          cy + y3 * r,
          p.size * perspective,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      frame = requestAnimationFrame(draw);
    };

    resize();
    draw();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    window.addEventListener("pointermove", onPointer, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
    };
  }, [searching, accent]);

  return (
    <canvas
      ref={canvasRef}
      className={`orb ${searching ? "searching" : ""}`}
      aria-label="Animierter LeadSphere Agent"
    />
  );
}
