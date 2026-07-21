import { useEffect, useRef } from "react";

export function ParticleOrb({ searching }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let frame, t = 0;
    const N = 1180;
    const particles = Array.from({ length: N }, (_, i) => ({
      phi: Math.acos(1 - 2 * (i + 0.5) / N),
      theta: Math.PI * (1 + Math.sqrt(5)) * i,
      size: 0.45 + Math.random() * 1.45,
      drift: Math.random() * 6.28,
    }));

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * 0.31;
      ctx.clearRect(0, 0, w, h);
      t += searching ? 0.018 : 0.006;
      const pulse = 1 + Math.sin(t * 2.1) * 0.025;

      for (const p of particles) {
        const th = p.theta + t;
        const wave = Math.sin(p.phi * 4 + t * 2 + p.drift) * (searching ? 9 : 3);
        const r = (radius + wave) * pulse;
        const x3 = Math.sin(p.phi) * Math.cos(th);
        const y3 = Math.cos(p.phi);
        const z3 = Math.sin(p.phi) * Math.sin(th);
        const perspective = 0.78 + (z3 + 1) * 0.13;
        ctx.beginPath();
        const alpha = 0.18 + (z3 + 1) * 0.31;
        ctx.fillStyle = searching
          ? `rgba(114,255,153,${alpha})`
          : `rgba(80,239,126,${alpha})`;
        ctx.shadowColor = "#42e878";
        ctx.shadowBlur = p.size > 1.5 ? 7 : 0;
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
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [searching]);

  return (
    <canvas
      ref={canvasRef}
      className={`orb ${searching ? "searching" : ""}`}
      aria-label="Animierter LeadSphere Agent"
    />
  );
}
