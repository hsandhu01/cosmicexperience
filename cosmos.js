/* ============================================
   COSMOS — Particle Universe Engine
   ============================================ */

const CosmosEngine = (() => {
  // ───── CONFIG ─────
  const PARTICLE_COUNT = 800;
  const STAR_COUNT = 200;
  const SHOOTING_STAR_INTERVAL = 4000;
  const CONNECTION_DIST = 120;
  const MOUSE_RADIUS = 250;
  const GRAVITY_STRENGTH = 0.08;
  const DAMPING = 0.97;
  const TRAIL_ALPHA = 0.08;

  // ───── COLOR PALETTES ─────
  const palettes = [
    {
      name: 'NEBULA',
      colors: ['#7c3aed', '#a78bfa', '#c4b5fd', '#06b6d4', '#22d3ee'],
      bg: [3, 0, 20]
    },
    {
      name: 'AURORA',
      colors: ['#10b981', '#34d399', '#6ee7b7', '#06b6d4', '#67e8f9'],
      bg: [0, 10, 15]
    },
    {
      name: 'SUPERNOVA',
      colors: ['#f43f5e', '#fb7185', '#fda4af', '#f97316', '#fdba74'],
      bg: [15, 2, 5]
    },
    {
      name: 'SINGULARITY',
      colors: ['#8b5cf6', '#a855f7', '#c084fc', '#ec4899', '#f472b6'],
      bg: [8, 0, 20]
    },
    {
      name: 'VOID',
      colors: ['#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0', '#f1f5f9'],
      bg: [5, 5, 10]
    }
  ];

  // ───── STATE ─────
  let canvas, ctx;
  let width, height;
  let particles = [];
  let stars = [];
  let shootingStars = [];
  let mouse = { x: -1000, y: -1000, vx: 0, vy: 0, prevX: 0, prevY: 0 };
  let currentPalette = 0;
  let gravityEnabled = true;
  let trailsEnabled = true;
  let animId;
  let lastTime = 0;
  let fps = 60;
  let fpsHistory = [];
  let scrollWarp = 0;
  let particleBurst = [];

  // ───── PARTICLE CLASS ─────
  class Particle {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.baseX = this.x;
      this.baseY = this.y;
      this.vx = (Math.random() - 0.5) * 0.5;
      this.vy = (Math.random() - 0.5) * 0.5;
      this.radius = Math.random() * 2.5 + 0.5;
      this.baseRadius = this.radius;
      this.colorIdx = Math.floor(Math.random() * 5);
      this.alpha = Math.random() * 0.6 + 0.4;
      this.pulseSpeed = Math.random() * 0.02 + 0.01;
      this.pulseOffset = Math.random() * Math.PI * 2;
      this.life = 1;
    }

    update(time, dt) {
      const palette = palettes[currentPalette];

      // Pulse
      this.alpha = 0.4 + Math.sin(time * this.pulseSpeed + this.pulseOffset) * 0.3;
      this.radius = this.baseRadius + Math.sin(time * this.pulseSpeed * 1.5 + this.pulseOffset) * 0.5;

      // Mouse gravity
      if (gravityEnabled) {
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < MOUSE_RADIUS && dist > 1) {
          const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS * GRAVITY_STRENGTH;
          this.vx += (dx / dist) * force;
          this.vy += (dy / dist) * force;

          // Enlarge near cursor
          this.radius = this.baseRadius + (1 - dist / MOUSE_RADIUS) * 3;
          this.alpha = Math.min(1, this.alpha + (1 - dist / MOUSE_RADIUS) * 0.5);
        }
      }

      // Warp effect from scroll
      if (scrollWarp > 0) {
        const cx = width / 2;
        const cy = height / 2;
        const dx = this.x - cx;
        const dy = this.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        this.vx += (dx / dist) * scrollWarp * 0.3;
        this.vy += (dy / dist) * scrollWarp * 0.3;
      }

      // Apply velocity
      this.vx *= DAMPING;
      this.vy *= DAMPING;
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // Gentle return to base
      this.x += (this.baseX - this.x) * 0.001 * dt;
      this.y += (this.baseY - this.y) * 0.001 * dt;

      // Wrap around edges
      if (this.x < -50) this.x = width + 50;
      if (this.x > width + 50) this.x = -50;
      if (this.y < -50) this.y = height + 50;
      if (this.y > height + 50) this.y = -50;
    }

    draw(ctx, time) {
      const palette = palettes[currentPalette];
      const color = palette.colors[this.colorIdx];

      ctx.save();
      ctx.globalAlpha = this.alpha;

      // Glow
      const glow = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius * 4);
      glow.addColorStop(0, color);
      glow.addColorStop(0.5, color + '40');
      glow.addColorStop(1, 'transparent');

      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 4, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // ───── STAR CLASS ─────
  class Star {
    constructor() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.radius = Math.random() * 1.2 + 0.2;
      this.alpha = Math.random() * 0.8;
      this.twinkleSpeed = Math.random() * 0.03 + 0.005;
      this.twinkleOffset = Math.random() * Math.PI * 2;
    }

    draw(ctx, time) {
      const a = this.alpha * (0.5 + Math.sin(time * this.twinkleSpeed + this.twinkleOffset) * 0.5);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ───── SHOOTING STAR CLASS ─────
  class ShootingStar {
    constructor() {
      this.reset();
    }

    reset() {
      const side = Math.random();
      if (side < 0.5) {
        this.x = Math.random() * width;
        this.y = -10;
      } else {
        this.x = width + 10;
        this.y = Math.random() * height * 0.5;
      }
      this.angle = Math.PI / 4 + Math.random() * Math.PI / 4;
      this.speed = 8 + Math.random() * 12;
      this.length = 60 + Math.random() * 100;
      this.alpha = 1;
      this.decay = 0.008 + Math.random() * 0.01;
      this.active = true;
    }

    update(dt) {
      this.x += Math.cos(this.angle) * this.speed * dt;
      this.y += Math.sin(this.angle) * this.speed * dt;
      this.alpha -= this.decay * dt;
      if (this.alpha <= 0) this.active = false;
    }

    draw(ctx) {
      if (!this.active) return;
      const tailX = this.x - Math.cos(this.angle) * this.length;
      const tailY = this.y - Math.sin(this.angle) * this.length;

      const gradient = ctx.createLinearGradient(this.x, this.y, tailX, tailY);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${this.alpha})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.save();
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();

      // Head glow
      ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // ───── BURST PARTICLE ─────
  class BurstParticle {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.radius = Math.random() * 3 + 1;
      this.alpha = 1;
      this.decay = 0.015 + Math.random() * 0.02;
      this.colorIdx = Math.floor(Math.random() * 5);
    }

    update(dt) {
      this.vx *= 0.98;
      this.vy *= 0.98;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.alpha -= this.decay * dt;
      return this.alpha > 0;
    }

    draw(ctx) {
      const palette = palettes[currentPalette];
      const color = palette.colors[this.colorIdx];
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ───── DRAW CONNECTIONS ─────
  function drawConnections(ctx, time) {
    const palette = palettes[currentPalette];
    ctx.save();
    ctx.lineWidth = 0.5;

    for (let i = 0; i < particles.length; i++) {
      const p1 = particles[i];
      // Check connections to mouse
      const mdx = mouse.x - p1.x;
      const mdy = mouse.y - p1.y;
      const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
      if (mdist < MOUSE_RADIUS * 0.8) {
        const alpha = (1 - mdist / (MOUSE_RADIUS * 0.8)) * 0.3;
        ctx.strokeStyle = palette.colors[p1.colorIdx] + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.stroke();
      }

      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CONNECTION_DIST) {
          const alpha = (1 - dist / CONNECTION_DIST) * 0.15;
          ctx.strokeStyle = palette.colors[p1.colorIdx] + Math.floor(alpha * 255).toString(16).padStart(2, '0');
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  // ───── INIT ─────
  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resize();

    // Create particles
    particles = Array.from({ length: PARTICLE_COUNT }, () => new Particle());
    stars = Array.from({ length: STAR_COUNT }, () => new Star());

    // Shooting star timer
    setInterval(() => {
      if (shootingStars.length < 3) {
        shootingStars.push(new ShootingStar());
      }
    }, SHOOTING_STAR_INTERVAL);

    window.addEventListener('resize', resize);

    // Mouse
    canvas.addEventListener('mousemove', (e) => {
      mouse.prevX = mouse.x;
      mouse.prevY = mouse.y;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.vx = mouse.x - mouse.prevX;
      mouse.vy = mouse.y - mouse.prevY;
    });

    canvas.addEventListener('click', (e) => {
      // Particle burst
      for (let i = 0; i < 30; i++) {
        particleBurst.push(new BurstParticle(e.clientX, e.clientY));
      }
    });

    canvas.addEventListener('mouseleave', () => {
      mouse.x = -1000;
      mouse.y = -1000;
    });

    // Touch
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      mouse.prevX = mouse.x;
      mouse.prevY = mouse.y;
      mouse.x = t.clientX;
      mouse.y = t.clientY;
    }, { passive: false });

    canvas.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      mouse.x = t.clientX;
      mouse.y = t.clientY;
      for (let i = 0; i < 30; i++) {
        particleBurst.push(new BurstParticle(t.clientX, t.clientY));
      }
    });

    canvas.addEventListener('touchend', () => {
      mouse.x = -1000;
      mouse.y = -1000;
    });

    // Scroll warp
    window.addEventListener('wheel', (e) => {
      scrollWarp = Math.min(3, scrollWarp + Math.abs(e.deltaY) * 0.005);
    });
  }

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;

    // Re-distribute particles on resize
    particles.forEach(p => {
      p.baseX = Math.random() * width;
      p.baseY = Math.random() * height;
    });

    stars.forEach(s => {
      s.x = Math.random() * width;
      s.y = Math.random() * height;
    });
  }

  // ───── RENDER LOOP ─────
  function render(time) {
    const now = performance.now();
    const rawDt = now - lastTime;
    lastTime = now;

    // FPS calculation
    fpsHistory.push(1000 / rawDt);
    if (fpsHistory.length > 30) fpsHistory.shift();
    fps = Math.round(fpsHistory.reduce((a, b) => a + b) / fpsHistory.length);

    // Normalize dt for consistent physics
    const dt = Math.min(rawDt / 16.67, 3);

    const palette = palettes[currentPalette];

    // Clear / Trails
    if (trailsEnabled) {
      ctx.fillStyle = `rgba(${palette.bg[0]}, ${palette.bg[1]}, ${palette.bg[2]}, ${TRAIL_ALPHA})`;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = `rgb(${palette.bg[0]}, ${palette.bg[1]}, ${palette.bg[2]})`;
      ctx.fillRect(0, 0, width, height);
    }

    // Decay scroll warp
    scrollWarp *= 0.95;
    if (scrollWarp < 0.01) scrollWarp = 0;

    // Render stars
    stars.forEach(s => s.draw(ctx, time));

    // Render shooting stars
    shootingStars.forEach(s => {
      s.update(dt);
      s.draw(ctx);
    });
    shootingStars = shootingStars.filter(s => s.active);

    // Update & render particles
    particles.forEach(p => {
      p.update(time, dt);
      p.draw(ctx, time);
    });

    // Connections
    drawConnections(ctx, time);

    // Burst particles
    particleBurst = particleBurst.filter(p => {
      const alive = p.update(dt);
      if (alive) p.draw(ctx);
      return alive;
    });

    // Mouse glow
    if (mouse.x > 0 && mouse.y > 0) {
      const mouseGlow = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, MOUSE_RADIUS * 0.6);
      mouseGlow.addColorStop(0, palette.colors[0] + '15');
      mouseGlow.addColorStop(0.5, palette.colors[1] + '08');
      mouseGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = mouseGlow;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, MOUSE_RADIUS * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    animId = requestAnimationFrame(render);
  }

  function start() {
    lastTime = performance.now();
    render(0);
  }

  function stop() {
    cancelAnimationFrame(animId);
  }

  function setPalette(idx) {
    currentPalette = idx % palettes.length;
  }

  function nextPalette() {
    currentPalette = (currentPalette + 1) % palettes.length;
    return palettes[currentPalette];
  }

  function setGravity(enabled) {
    gravityEnabled = enabled;
  }

  function setTrails(enabled) {
    trailsEnabled = enabled;
  }

  function getStats() {
    return {
      particles: PARTICLE_COUNT,
      fps,
      dimension: palettes[currentPalette].name,
      velocity: Math.sqrt(mouse.vx * mouse.vx + mouse.vy * mouse.vy).toFixed(2)
    };
  }

  function getPalettes() {
    return palettes;
  }

  function getCurrentPalette() {
    return palettes[currentPalette];
  }

  return {
    init, start, stop, setPalette, nextPalette,
    setGravity, setTrails, getStats, getPalettes,
    getCurrentPalette
  };
})();
