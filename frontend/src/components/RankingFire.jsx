import { useRef, useEffect, useCallback } from 'react';

/**
 * RankingFire — 火焰粒子 Canvas 层
 *
 * 三种粒子类型：
 *   ember — 灰烬粒子，缓慢上升，用于所有活跃小组
 *   spark — 火花粒子，随机喷射，用于 TOP3
 *   lava  — 熔岩粒子，从底部涌出，用于第1名
 *
 * 消耗 activePlayers 数据，通过 data-rank 属性与 DOM 卡片位置对齐。
 * 完全独立于 React 渲染周期，通过 requestAnimationFrame 驱动。
 */

const CONFIG = {
  ember: { count: 40,  speed: 0.3, lifetime: 4000, colors: ['#fb923c', '#f97316', '#ea580c'], size: 2, spawnChance: 0.3 },
  spark: { count: 20,  speed: 1.5, lifetime: 1500, colors: ['#fbbf24', '#fcd34d', '#f59e0b'], size: 3, spawnChance: 0.15 },
  lava:  { count: 15,  speed: 0.8, lifetime: 3000, colors: ['#ef4444', '#dc2626', '#f97316'], size: 4, spawnChance: 0.25 },
};

export default function RankingFire({ activePlayers, topCardRefs }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const particlesRef = useRef([]);
  const maxParticles = 80;

  // 粒子工厂
  const spawnParticle = useCallback((type, x, y) => {
    const cfg = CONFIG[type];
    const angle = type === 'lava'
      ? -Math.PI / 2 + (Math.random() - 0.5) * 0.5  // 熔岩向上升
      : -Math.PI / 2 + (Math.random() - 0.5) * Math.PI; // 火花随机方向
    const speed = cfg.speed * (0.5 + Math.random());
    return {
      x, y,
      vx: Math.cos(angle) * speed * (0.3 + Math.random() * 0.7),
      vy: Math.sin(angle) * speed * (0.5 + Math.random() * 0.5),
      life: 1,
      decay: 1 / (cfg.lifetime / 16), // 基于 60fps ≈ 16ms
      color: cfg.colors[Math.floor(Math.random() * cfg.colors.length)],
      size: cfg.size * (0.5 + Math.random()),
      type,
    };
  }, []);

  // 动画循环
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // 半透明清除产生拖尾
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.fillRect(0, 0, W, H);

    const particles = particlesRef.current;

    // 更新 & 绘制
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy -= 0.003; // 微弱上升
      p.life -= p.decay;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      // 发光绘制
      const alpha = p.life * 0.8;
      ctx.save();
      ctx.globalAlpha = alpha;

      // 外发光
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
      grd.addColorStop(0, p.color);
      grd.addColorStop(0.5, p.color + '88');
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.fillRect(p.x - p.size * 3, p.y - p.size * 3, p.size * 6, p.size * 6);

      // 核心亮点
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.size * 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // 从活跃小组卡片位置生成粒子
    if (activePlayers && activePlayers.length > 0 && topCardRefs && topCardRefs.current) {
      const now = Date.now();
      activePlayers.forEach((player, idx) => {
        const cardEl = topCardRefs.current[player.id || player.name];
        if (!cardEl) return;

        const rect = cardEl.getBoundingClientRect();
        const score = player.score ?? 0;

        // 根据分数决定粒子类型和生成概率
        let type, cfg;
        if (idx === 0 && score >= 3000) {
          type = 'lava'; cfg = CONFIG.lava;
        } else if (idx < 3 && score >= 2000) {
          type = 'spark'; cfg = CONFIG.spark;
        } else if (score >= 1000) {
          type = 'ember'; cfg = CONFIG.ember;
        } else {
          return; // 分数太低不生成粒子
        }

        if (Math.random() > cfg.spawnChance) return;

        const srcX = rect.left + Math.random() * rect.width;
        const srcY = rect.top + rect.height * 0.5;
        particles.push(spawnParticle(type, srcX, srcY));
      });
    }

    // 限流
    while (particles.length > maxParticles) {
      particles.shift();
    }

    rafRef.current = requestAnimationFrame(animate);
  }, [activePlayers, topCardRefs, spawnParticle]);

  // ── 生命周期 ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      particlesRef.current = [];
    };
  }, [animate]);

  return (
    <canvas
      ref={canvasRef}
      className="fire-canvas"
      aria-hidden="true"
    />
  );
}
