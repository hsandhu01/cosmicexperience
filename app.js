/* ============================================
   COSMOS — Main Application Controller
   Sleep & Relaxation Edition
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
  const btnTimer = document.getElementById('btn-timer');
  const btnGravity = document.getElementById('btn-gravity');
  const btnTrails = document.getElementById('btn-trails');

  const statParticles = document.getElementById('stat-particles');
  const statFps = document.getElementById('stat-fps');
  const statDimension = document.getElementById('stat-dimension');
  const statTimer = document.getElementById('stat-timer');

  const paletteIndicator = document.getElementById('palette-indicator');
  const paletteDots = paletteIndicator.querySelector('.palette-dots');
  const paletteName = paletteIndicator.querySelector('.palette-name');

  // Sleep Timer Panel
  const timerPanel = document.getElementById('timer-panel');
  const timerClose = document.getElementById('timer-close');
  const timerOptions = document.querySelectorAll('.timer-option');
  const timerDisplay = document.getElementById('timer-display');
  const timerRemaining = document.getElementById('timer-remaining');
  const timerCancel = document.getElementById('timer-cancel');

  // State
  let gravityOn = true;
  let trailsOn = true;
  let audioOn = false;
  let timerPanelOpen = false;
  let paletteTimeout = null;
  let timerUpdateInterval = null;

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
        }, 8000);
      }, 500);
    }, 2500);

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

      // Update button label
      const label = btnAudio.querySelector('.ctrl-label');
      const icon = btnAudio.querySelector('.ctrl-icon');
      if (audioOn) {
        label.textContent = 'PLAYING';
        icon.textContent = '🌙';
      } else {
        label.textContent = 'SLEEP';
        icon.textContent = '🌙';
      }
    });

    // Timer panel toggle
    btnTimer.addEventListener('click', () => {
      timerPanelOpen = !timerPanelOpen;
      if (timerPanelOpen) {
        timerPanel.classList.remove('hidden');
        requestAnimationFrame(() => {
          timerPanel.classList.add('show');
        });
      } else {
        closeTimerPanel();
      }
    });

    timerClose.addEventListener('click', closeTimerPanel);

    // Timer options
    timerOptions.forEach(btn => {
      btn.addEventListener('click', () => {
        const minutes = parseInt(btn.dataset.minutes);

        // Start audio if not already playing
        if (!audioOn) {
          audioOn = AudioEngine.toggle();
          btnAudio.classList.add('active');
          const label = btnAudio.querySelector('.ctrl-label');
          label.textContent = 'PLAYING';
        }

        // Set selected style
        timerOptions.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        // Set the timer
        AudioEngine.setSleepTimer(minutes);

        // Show countdown
        timerDisplay.classList.remove('hidden');

        // Start updating countdown display
        clearInterval(timerUpdateInterval);
        timerUpdateInterval = setInterval(updateTimerDisplay, 1000);
        updateTimerDisplay();

        btnTimer.classList.add('active');
      });
    });

    // Cancel timer
    timerCancel.addEventListener('click', () => {
      AudioEngine.clearSleepTimer();
      timerDisplay.classList.add('hidden');
      timerOptions.forEach(b => b.classList.remove('selected'));
      clearInterval(timerUpdateInterval);
      btnTimer.classList.remove('active');
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
        case 's':
          btnTimer.click();
          break;
        case 'g':
          btnGravity.click();
          break;
        case 't':
          btnTrails.click();
          break;
        case 'escape':
          if (timerPanelOpen) closeTimerPanel();
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

  function closeTimerPanel() {
    timerPanelOpen = false;
    timerPanel.classList.remove('show');
    setTimeout(() => {
      timerPanel.classList.add('hidden');
    }, 400);
  }

  function updateTimerDisplay() {
    const remaining = AudioEngine.getSleepTimerRemaining();
    if (!remaining || remaining.total <= 0) {
      timerDisplay.classList.add('hidden');
      timerOptions.forEach(b => b.classList.remove('selected'));
      clearInterval(timerUpdateInterval);
      btnTimer.classList.remove('active');
      audioOn = false;
      btnAudio.classList.remove('active');
      const label = btnAudio.querySelector('.ctrl-label');
      label.textContent = 'SLEEP';
      return;
    }
    const mins = String(remaining.mins).padStart(2, '0');
    const secs = String(remaining.secs).padStart(2, '0');
    timerRemaining.textContent = `${mins}:${secs}`;
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

    // Update timer stat
    const remaining = AudioEngine.getSleepTimerRemaining();
    if (remaining && remaining.total > 0) {
      const mins = String(remaining.mins).padStart(2, '0');
      const secs = String(remaining.secs).padStart(2, '0');
      statTimer.textContent = `${mins}:${secs}`;
    } else {
      statTimer.textContent = audioOn ? 'ON' : 'OFF';
    }
  }

  // ───── START ─────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
