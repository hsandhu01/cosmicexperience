/* ============================================
   COSMOS — Main Application Controller
   ============================================ */

(function () {
  'use strict';

  // DOM refs
  const loader = document.getElementById('loader');
  const cosmosCanvas = document.getElementById('cosmos');
  const auroraCanvas = document.getElementById('aurora');
  const audioCanvas = document.getElementById('audioViz');
  const uiOverlay = document.getElementById('ui-overlay');
  const welcome = document.getElementById('welcome');

  const btnMode = document.getElementById('btn-mode');
  const btnAudio = document.getElementById('btn-audio');
  const btnGravity = document.getElementById('btn-gravity');
  const btnTrails = document.getElementById('btn-trails');

  const statParticles = document.getElementById('stat-particles');
  const statFps = document.getElementById('stat-fps');
  const statDimension = document.getElementById('stat-dimension');
  const statVelocity = document.getElementById('stat-velocity');

  const paletteIndicator = document.getElementById('palette-indicator');
  const paletteDots = paletteIndicator.querySelector('.palette-dots');
  const paletteName = paletteIndicator.querySelector('.palette-name');

  // State
  let gravityOn = true;
  let trailsOn = true;
  let audioOn = false;
  let paletteTimeout = null;

  // ───── INIT ─────
  function init() {
    // Initialize engines
    CosmosEngine.init(cosmosCanvas);
    AuroraEngine.init(auroraCanvas);
    AudioEngine.init(audioCanvas);

    // Simulate loading
    setTimeout(() => {
      loader.classList.add('hidden');

      setTimeout(() => {
        uiOverlay.classList.add('visible');
        CosmosEngine.start();
        startRenderLoop();

        // Hide welcome text after a few seconds
        setTimeout(() => {
          welcome.classList.add('hidden');
        }, 6000);
      }, 500);
    }, 2000);

    // Setup controls
    setupControls();
  }

  // ───── RENDER LOOP ─────
  function startRenderLoop() {
    function loop(time) {
      AuroraEngine.render(time);
      AudioEngine.render();
      updateStats();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  // ───── CONTROLS ─────
  function setupControls() {
    // Mode / Palette switch
    btnMode.addEventListener('click', () => {
      const palette = CosmosEngine.nextPalette();
      AuroraEngine.setPalette(palette.name);
      showPaletteIndicator(palette);
    });

    // Audio toggle
    btnAudio.addEventListener('click', () => {
      audioOn = AudioEngine.toggle();
      btnAudio.classList.toggle('active', audioOn);
    });

    // Gravity toggle
    btnGravity.addEventListener('click', () => {
      gravityOn = !gravityOn;
      CosmosEngine.setGravity(gravityOn);
      btnGravity.classList.toggle('active', gravityOn);
    });

    // Trails toggle
    btnTrails.addEventListener('click', () => {
      trailsOn = !trailsOn;
      CosmosEngine.setTrails(trailsOn);
      btnTrails.classList.toggle('active', trailsOn);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      switch (e.key.toLowerCase()) {
        case 'm':
          btnMode.click();
          break;
        case 'a':
          btnAudio.click();
          break;
        case 'g':
          btnGravity.click();
          break;
        case 't':
          btnTrails.click();
          break;
        case '1': case '2': case '3': case '4': case '5':
          const idx = parseInt(e.key) - 1;
          CosmosEngine.setPalette(idx);
          const pal = CosmosEngine.getCurrentPalette();
          AuroraEngine.setPalette(pal.name);
          showPaletteIndicator(pal);
          break;
      }
    });
  }

  // ───── PALETTE INDICATOR ─────
  function showPaletteIndicator(palette) {
    paletteIndicator.classList.remove('hidden');

    // Build dots
    paletteDots.innerHTML = '';
    palette.colors.forEach(color => {
      const dot = document.createElement('div');
      dot.className = 'palette-dot';
      dot.style.background = color;
      paletteDots.appendChild(dot);
    });

    paletteName.textContent = palette.name;

    // Animate in
    requestAnimationFrame(() => {
      paletteIndicator.classList.add('show');
    });

    // Hide after 2s
    clearTimeout(paletteTimeout);
    paletteTimeout = setTimeout(() => {
      paletteIndicator.classList.remove('show');
      setTimeout(() => {
        paletteIndicator.classList.add('hidden');
      }, 500);
    }, 2000);
  }

  // ───── STATS UPDATE ─────
  function updateStats() {
    const stats = CosmosEngine.getStats();
    statParticles.textContent = stats.particles;
    statFps.textContent = stats.fps;
    statDimension.textContent = stats.dimension;
    statVelocity.textContent = stats.velocity;
  }

  // ───── START ─────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
