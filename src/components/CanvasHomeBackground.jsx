import { useEffect, useRef } from 'react';

const CONNECTION_DISTANCE = 140;

function readThemeColors() {
  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const dot = styles.getPropertyValue('--canvas-home-particle-dot').trim() || 'rgba(56, 189, 248, 0.55)';
  const line = styles.getPropertyValue('--canvas-home-particle-line').trim() || 'rgba(56, 189, 248, 0.12)';
  return { dot, line };
}

export function CanvasHomeBackground() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animationId = 0;
    let particles = [];
    let width = 0;
    let height = 0;
    let dpr = 1;

    const handleMouseMove = (event) => {
      mouseRef.current = { x: event.clientX, y: event.clientY };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };

    const initParticles = () => {
      const area = width * height;
      const count = Math.min(72, Math.max(28, Math.floor(area / 22000)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * (prefersReduced ? 0 : 0.22),
        vy: (Math.random() - 0.5) * (prefersReduced ? 0 : 0.22),
        radius: Math.random() * 1.4 + 0.8,
        pulse: Math.random() * Math.PI * 2,
      }));
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles();
    };

    const draw = () => {
      const { dot, line } = readThemeColors();
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i];
        if (!prefersReduced) {
          particle.x += particle.vx;
          particle.y += particle.vy;
          particle.pulse += 0.015;

          if (particle.x <= 0 || particle.x >= width) particle.vx *= -1;
          if (particle.y <= 0 || particle.y >= height) particle.vy *= -1;

          const dx = mouseRef.current.x - particle.x;
          const dy = mouseRef.current.y - particle.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 120 && dist > 0) {
            particle.x -= (dx / dist) * 0.35;
            particle.y -= (dy / dist) * 0.35;
          }
        }

        for (let j = i + 1; j < particles.length; j += 1) {
          const other = particles[j];
          const linkDx = particle.x - other.x;
          const linkDy = particle.y - other.y;
          const linkDist = Math.hypot(linkDx, linkDy);
          if (linkDist > CONNECTION_DISTANCE) continue;

          ctx.globalAlpha = (1 - linkDist / CONNECTION_DISTANCE) * 0.55;
          ctx.strokeStyle = line;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(particle.x, particle.y);
          ctx.lineTo(other.x, other.y);
          ctx.stroke();
        }

        ctx.globalAlpha = 1;
        const pulseScale = prefersReduced ? 1 : 1 + Math.sin(particle.pulse) * 0.18;
        ctx.fillStyle = dot;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius * pulseScale, 0, Math.PI * 2);
        ctx.fill();
      }

      animationId = window.requestAnimationFrame(draw);
    };

    resize();
    draw();

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <div className="canvas-home-bg" aria-hidden="true">
      <canvas ref={canvasRef} className="canvas-home-bg-canvas" />
      <div className="canvas-home-bg-grid" />
      <div className="canvas-home-bg-orb canvas-home-bg-orb-1" />
      <div className="canvas-home-bg-orb canvas-home-bg-orb-2" />
      <div className="canvas-home-bg-orb canvas-home-bg-orb-3" />
      <div className="canvas-home-bg-vignette" />
    </div>
  );
}
