/* ============================================
   COSMOS — Aurora Borealis Overlay
   ============================================ */

const AuroraEngine = (() => {
  let canvas, ctx;
  let width, height;
  let time = 0;
  let enabled = true;
  let intensity = 0.4;
  let mouse = { x: 0.5, y: 0.5 };

  // Aurora wave parameters
  const waves = [
    { amplitude: 0.15, frequency: 0.3, speed: 0.008, phase: 0, color: [124, 58, 237] },
    { amplitude: 0.12, frequency: 0.5, speed: 0.012, phase: 2, color: [6, 182, 212] },
    { amplitude: 0.1, frequency: 0.7, speed: 0.006, phase: 4, color: [16, 185, 129] },
    { amplitude: 0.08, frequency: 0.4, speed: 0.015, phase: 1, color: [244, 63, 94] },
  ];

  const paletteMaps = {
    'NEBULA': [[124, 58, 237], [6, 182, 212], [139, 92, 246], [168, 85, 247]],
    'AURORA': [[16, 185, 129], [52, 211, 153], [6, 182, 212], [110, 231, 183]],
    'SUPERNOVA': [[244, 63, 94], [249, 115, 22], [251, 113, 133], [253, 186, 116]],
    'SINGULARITY': [[139, 92, 246], [168, 85, 247], [236, 72, 153], [192, 132, 252]],
    'VOID': [[100, 116, 139], [148, 163, 184], [203, 213, 225], [226, 232, 240]],
  };

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);

    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX / width;
      mouse.y = e.clientY / height;
    });
  }

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  function setPalette(paletteName) {
    const colors = paletteMaps[paletteName];
    if (colors) {
      waves.forEach((w, i) => {
        w.color = colors[i % colors.length];
      });
    }
  }

  function render(timestamp) {
    if (!enabled) {
      ctx.clearRect(0, 0, width, height);
      return;
    }

    time += 1;
    ctx.clearRect(0, 0, width, height);

    // Draw each aurora wave
    waves.forEach((wave, waveIdx) => {
      ctx.save();

      const yBase = height * (0.2 + waveIdx * 0.12);
      const mouseInfluence = (mouse.y - 0.5) * 80;

      // Build wave path
      ctx.beginPath();
      ctx.moveTo(0, height);

      const points = [];
      for (let x = 0; x <= width; x += 4) {
        const normalX = x / width;
        const mouseDistX = Math.abs(normalX - mouse.x);
        const mouseWarp = Math.exp(-mouseDistX * mouseDistX * 8) * 40 * intensity;

        const y = yBase +
          Math.sin(normalX * Math.PI * 2 * wave.frequency + time * wave.speed + wave.phase) *
          wave.amplitude * height +
          Math.sin(normalX * Math.PI * 3.7 + time * wave.speed * 0.7) *
          wave.amplitude * height * 0.3 +
          mouseInfluence -
          mouseWarp;

        points.push({ x, y });
        ctx.lineTo(x, y);
      }

      ctx.lineTo(width, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();

      // Gradient fill
      const grad = ctx.createLinearGradient(0, yBase - wave.amplitude * height, 0, yBase + 100);
      const [r, g, b] = wave.color;
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
      grad.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, ${0.03 * intensity})`);
      grad.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${0.06 * intensity})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

      ctx.fillStyle = grad;
      ctx.fill();

      // Edge glow line
      ctx.beginPath();
      points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.2 * intensity})`;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${0.3 * intensity})`;
      ctx.shadowBlur = 20;
      ctx.stroke();

      ctx.restore();
    });

    // Vertical light rays
    for (let i = 0; i < 3; i++) {
      const rx = (width * (0.2 + i * 0.3)) + Math.sin(time * 0.005 + i) * 100;
      const rayGrad = ctx.createLinearGradient(rx, 0, rx, height * 0.6);
      const wave = waves[i % waves.length];
      const [r, g, b] = wave.color;
      rayGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.02 * intensity})`);
      rayGrad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${0.015 * intensity})`);
      rayGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

      ctx.save();
      ctx.fillStyle = rayGrad;
      ctx.fillRect(rx - 30, 0, 60, height * 0.6);
      ctx.restore();
    }
  }

  function setEnabled(val) {
    enabled = val;
  }

  function setIntensity(val) {
    intensity = val;
  }

  return { init, render, setPalette, setEnabled, setIntensity };
})();
