/* ============================================
   COSMOS — Main Application Controller
   Sleep & Relaxation Edition v2
   Features: Sound Mixer, Breathing Guide, Dim Mode, Timer
   ============================================ */

(function () {
  'use strict';

  // ───── DOM REFS ─────
  const loader = document.getElementById('loader');
  const cosmosCanvas = document.getElementById('cosmos');
  const auroraCanvas = document.getElementById('aurora');
  const audioCanvas = document.getElementById('audioViz');
  const uiOverlay = document.getElementById('ui-overlay');
  const welcome = document.getElementById('welcome');
  const dimOverlay = document.getElementById('dim-overlay');

  // Buttons
  const btnAudio = document.getElementById('btn-audio');
  const btnMixer = document.getElementById('btn-mixer');
  const btnBreathe = document.getElementById('btn-breathe');
  const btnTimer = document.getElementById('btn-timer');
  const btnDim = document.getElementById('btn-dim');
  const btnMode = document.getElementById('btn-mode');

  // Stats
  const statParticles = document.getElementById('stat-particles');
  const statFps = document.getElementById('stat-fps');
  const statDimension = document.getElementById('stat-dimension');
  const statTimer = document.getElementById('stat-timer');

  // Palette
  const paletteIndicator = document.getElementById('palette-indicator');
  const paletteDots = paletteIndicator.querySelector('.palette-dots');
  const paletteName = paletteIndicator.querySelector('.palette-name');

  // Timer Panel
  const timerPanel = document.getElementById('timer-panel');
  const timerClose = document.getElementById('timer-close');
  const timerOptions = document.querySelectorAll('.timer-option');
  const timerDisplay = document.getElementById('timer-display');
  const timerRemaining = document.getElementById('timer-remaining');
  const timerCancel = document.getElementById('timer-cancel');

  // Mixer Panel
  const mixerPanel = document.getElementById('mixer-panel');
  const mixerClose = document.getElementById('mixer-close');
  const mixerSlidersCore = document.getElementById('mixer-sliders');
  const mixerSlidersNature = document.getElementById('mixer-sliders-nature');

  // Breathing Guide
  const breathingGuide = document.getElementById('breathing-guide');
  const breathCircle = document.getElementById('breath-circle');
  const breathText = document.getElementById('breath-text');
  const breathCount = document.getElementById('breath-count');
  const breathClose = document.getElementById('breathe-close');
  const patternBtns = document.querySelectorAll('.breath-pattern-btn');

  // ───── STATE ─────
  let audioOn = false;
  let timerPanelOpen = false;
  let mixerPanelOpen = false;
  let breathingOn = false;
  let dimModeOn = false;
  let paletteTimeout = null;
  let timerUpdateInterval = null;

  // Breathing state
  let breathInterval = null;
  let breathCountdown = null;
  let currentPattern = '478'; // '478' or '44'
  const patterns = {
    '478': [
      { phase: 'inhale', text: 'Breathe In', duration: 4 },
      { phase: 'hold', text: 'Hold', duration: 7 },
      { phase: 'exhale', text: 'Breathe Out', duration: 8 }
    ],
    '44': [
      { phase: 'inhale', text: 'Breathe In', duration: 4 },
      { phase: 'exhale', text: 'Breathe Out', duration: 4 }
    ]
  };

  // Dim mode
  let dimProgress = 0;
  let dimAnimFrame = null;
  const DIM_DURATION = 600; // 10 minutes in seconds
  const DIM_MAX = 0.85; // max opacity

  // ───── INIT ─────
  function init() {
    CosmosEngine.init(cosmosCanvas);
    AuroraEngine.init(auroraCanvas);
    AudioEngine.init(audioCanvas);

    setTimeout(() => {
      loader.classList.add('hidden');
      setTimeout(() => {
        uiOverlay.classList.add('visible');
        CosmosEngine.start();
        startRenderLoop();
        setTimeout(() => welcome.classList.add('hidden'), 8000);
      }, 500);
    }, 2500);

    setupControls();
    buildMixerSliders();
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

  // ───── BUILD MIXER SLIDERS ─────
  function buildMixerSliders() {
    const layerNames = AudioEngine.getLayerNames();
    const volumes = AudioEngine.getLayerVolumes();

    layerNames.forEach(layer => {
      const container = layer.group === 'core' ? mixerSlidersCore : mixerSlidersNature;
      const row = document.createElement('div');
      row.className = 'mixer-row';

      const vol = volumes[layer.id] || 0;
      const pct = Math.round(vol * 100);

      row.innerHTML = `
        <span class="mixer-row-icon">${layer.icon}</span>
        <span class="mixer-row-label">${layer.label}</span>
        <input type="range" class="mixer-row-slider" min="0" max="100" value="${pct}" data-layer="${layer.id}">
        <span class="mixer-row-value" data-value-for="${layer.id}">${pct}%</span>
      `;

      const slider = row.querySelector('.mixer-row-slider');
      const valueLabel = row.querySelector('.mixer-row-value');

      slider.addEventListener('input', () => {
        const val = parseInt(slider.value);
        valueLabel.textContent = `${val}%`;

        // Map slider value to appropriate range for each layer
        let mappedValue;
        switch (layer.id) {
          case 'binaural': mappedValue = (val / 100) * 0.15; break;
          case 'pink-noise': mappedValue = (val / 100) * 0.7; break;
          case 'rain': mappedValue = (val / 100) * 1.0; break;
          case 'pads': mappedValue = (val / 100) * 1.5; break;
          case 'breath': mappedValue = (val / 100) * 1.5; break;
          default: mappedValue = (val / 100) * 1.0; break;
        }
        AudioEngine.setLayerVolume(layer.id, mappedValue);
      });

      container.appendChild(row);
    });
  }

  // ───── CONTROLS ─────
  function setupControls() {
    // Audio toggle
    btnAudio.addEventListener('click', () => {
      audioOn = AudioEngine.toggle();
      btnAudio.classList.toggle('active', audioOn);
      const label = btnAudio.querySelector('.ctrl-label');
      label.textContent = audioOn ? 'PLAYING' : 'SLEEP';
    });

    // Mixer panel toggle
    btnMixer.addEventListener('click', toggleMixer);
    mixerClose.addEventListener('click', closeMixer);

    // Breathing guide toggle
    btnBreathe.addEventListener('click', toggleBreathing);
    breathClose.addEventListener('click', stopBreathing);

    patternBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        currentPattern = btn.dataset.pattern;
        patternBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (breathingOn) {
          stopBreathCycle();
          startBreathCycle();
        }
      });
    });

    // Timer panel
    btnTimer.addEventListener('click', toggleTimer);
    timerClose.addEventListener('click', closeTimer);

    timerOptions.forEach(btn => {
      btn.addEventListener('click', () => {
        const minutes = parseInt(btn.dataset.minutes);
        if (!audioOn) {
          audioOn = AudioEngine.toggle();
          btnAudio.classList.add('active');
          btnAudio.querySelector('.ctrl-label').textContent = 'PLAYING';
        }
        timerOptions.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        AudioEngine.setSleepTimer(minutes);
        timerDisplay.classList.remove('hidden');
        clearInterval(timerUpdateInterval);
        timerUpdateInterval = setInterval(updateTimerDisplay, 1000);
        updateTimerDisplay();
        btnTimer.classList.add('active');
      });
    });

    timerCancel.addEventListener('click', () => {
      AudioEngine.clearSleepTimer();
      timerDisplay.classList.add('hidden');
      timerOptions.forEach(b => b.classList.remove('selected'));
      clearInterval(timerUpdateInterval);
      btnTimer.classList.remove('active');
    });

    // Dim mode toggle
    btnDim.addEventListener('click', toggleDim);

    // Mode / Palette switch
    btnMode.addEventListener('click', () => {
      const palette = CosmosEngine.nextPalette();
      AuroraEngine.setPalette(palette.name);
      showPaletteIndicator(palette);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      switch (e.key.toLowerCase()) {
        case 'a': btnAudio.click(); break;
        case 'x': toggleMixer(); break;
        case 'b': toggleBreathing(); break;
        case 's': toggleTimer(); break;
        case 'd': toggleDim(); break;
        case 'm': btnMode.click(); break;
        case 'escape':
          if (mixerPanelOpen) closeMixer();
          if (timerPanelOpen) closeTimer();
          if (breathingOn) stopBreathing();
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

    // Click outside panels to close them
    document.addEventListener('click', (e) => {
      // Close mixer if click is outside mixer panel and mixer button
      if (mixerPanelOpen && !mixerPanel.contains(e.target) && !btnMixer.contains(e.target)) {
        closeMixer();
      }
      // Close timer if click is outside timer panel and timer button
      if (timerPanelOpen && !timerPanel.contains(e.target) && !btnTimer.contains(e.target)) {
        closeTimer();
      }
    });
  }

  // ───── MIXER ─────
  function toggleMixer() {
    mixerPanelOpen = !mixerPanelOpen;
    if (mixerPanelOpen) {
      if (timerPanelOpen) closeTimer();
      if (breathingOn) stopBreathing();
      mixerPanel.classList.remove('hidden');
      requestAnimationFrame(() => mixerPanel.classList.add('show'));
      btnMixer.classList.add('active');
    } else closeMixer();
  }

  function closeMixer() {
    mixerPanelOpen = false;
    mixerPanel.classList.remove('show');
    btnMixer.classList.remove('active');
    setTimeout(() => mixerPanel.classList.add('hidden'), 400);
  }

  // ───── TIMER ─────
  function toggleTimer() {
    timerPanelOpen = !timerPanelOpen;
    if (timerPanelOpen) {
      if (mixerPanelOpen) closeMixer();
      if (breathingOn) stopBreathing();
      timerPanel.classList.remove('hidden');
      requestAnimationFrame(() => timerPanel.classList.add('show'));
    } else closeTimer();
  }

  function closeTimer() {
    timerPanelOpen = false;
    timerPanel.classList.remove('show');
    setTimeout(() => timerPanel.classList.add('hidden'), 400);
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
      btnAudio.querySelector('.ctrl-label').textContent = 'SLEEP';
      return;
    }
    const mins = String(remaining.mins).padStart(2, '0');
    const secs = String(remaining.secs).padStart(2, '0');
    timerRemaining.textContent = `${mins}:${secs}`;
  }

  // ───── BREATHING GUIDE ─────
  function toggleBreathing() {
    if (breathingOn) stopBreathing();
    else startBreathing();
  }

  function startBreathing() {
    if (mixerPanelOpen) closeMixer();
    if (timerPanelOpen) closeTimer();
    breathingOn = true;
    btnBreathe.classList.add('active');
    breathingGuide.classList.remove('hidden');
    requestAnimationFrame(() => breathingGuide.classList.add('show'));
    startBreathCycle();
  }

  function stopBreathing() {
    breathingOn = false;
    btnBreathe.classList.remove('active');
    breathingGuide.classList.remove('show');
    setTimeout(() => breathingGuide.classList.add('hidden'), 800);
    stopBreathCycle();
    breathCircle.className = 'breath-circle';
  }

  function startBreathCycle() {
    const pattern = patterns[currentPattern];
    let phaseIdx = 0;
    let countdown = 0;

    function nextPhase() {
      const phase = pattern[phaseIdx % pattern.length];
      countdown = phase.duration;

      // Update circle
      breathCircle.className = 'breath-circle ' + phase.phase;
      breathText.textContent = phase.text;
      breathCount.textContent = countdown;

      breathCountdown = setInterval(() => {
        countdown--;
        if (countdown <= 0) {
          clearInterval(breathCountdown);
          phaseIdx++;
          if (breathingOn) nextPhase();
        } else {
          breathCount.textContent = countdown;
        }
      }, 1000);
    }

    nextPhase();
  }

  function stopBreathCycle() {
    clearInterval(breathCountdown);
    breathCountdown = null;
  }

  // ───── DIM MODE ─────
  function toggleDim() {
    dimModeOn = !dimModeOn;
    btnDim.classList.toggle('active', dimModeOn);

    const icon = btnDim.querySelector('.ctrl-icon');
    const label = btnDim.querySelector('.ctrl-label');

    if (dimModeOn) {
      icon.textContent = '◑';
      label.textContent = 'DIMMING';
      startDimming();
    } else {
      icon.textContent = '◐';
      label.textContent = 'DIM';
      stopDimming();
    }
  }

  function startDimming() {
    const startTime = performance.now();
    const startOpacity = dimProgress * DIM_MAX;

    function dimStep(now) {
      if (!dimModeOn) return;
      const elapsed = (now - startTime) / 1000;
      dimProgress = Math.min(1, dimProgress + (1 / DIM_DURATION) * (elapsed > 0 ? elapsed / elapsed : 1/60));
      dimOverlay.style.opacity = dimProgress * DIM_MAX;

      // Reduce UI opacity as screen dims
      const uiOpacity = Math.max(0.3, 1 - dimProgress * 0.6);
      uiOverlay.style.opacity = uiOpacity;

      if (dimProgress < 1 && dimModeOn) {
        dimAnimFrame = requestAnimationFrame(dimStep);
      }
    }

    // Use interval for smooth, consistent dimming
    clearInterval(dimAnimFrame);
    dimAnimFrame = setInterval(() => {
      if (!dimModeOn || dimProgress >= 1) {
        clearInterval(dimAnimFrame);
        return;
      }
      dimProgress += 1 / (DIM_DURATION * 2); // step every 500ms
      dimOverlay.style.opacity = Math.min(dimProgress * DIM_MAX, DIM_MAX);
      uiOverlay.style.opacity = Math.max(0.3, 1 - dimProgress * 0.6);
    }, 500);
  }

  function stopDimming() {
    clearInterval(dimAnimFrame);
    // Fade back to full brightness over 3 seconds
    dimOverlay.style.transition = 'opacity 3s ease';
    dimOverlay.style.opacity = 0;
    uiOverlay.style.transition = 'opacity 1.5s ease';
    uiOverlay.style.opacity = 1;
    dimProgress = 0;

    setTimeout(() => {
      dimOverlay.style.transition = 'opacity 1s ease';
      uiOverlay.style.transition = 'opacity 1.5s ease';
    }, 3000);
  }

  // ───── PALETTE INDICATOR ─────
  function showPaletteIndicator(palette) {
    paletteIndicator.classList.remove('hidden');
    paletteDots.innerHTML = '';
    palette.colors.forEach(color => {
      const dot = document.createElement('div');
      dot.className = 'palette-dot';
      dot.style.background = color;
      paletteDots.appendChild(dot);
    });
    paletteName.textContent = palette.name;
    requestAnimationFrame(() => paletteIndicator.classList.add('show'));

    clearTimeout(paletteTimeout);
    paletteTimeout = setTimeout(() => {
      paletteIndicator.classList.remove('show');
      setTimeout(() => paletteIndicator.classList.add('hidden'), 500);
    }, 2000);
  }

  // ───── STATS ─────
  function updateStats() {
    const stats = CosmosEngine.getStats();
    statParticles.textContent = stats.particles;
    statFps.textContent = stats.fps;
    statDimension.textContent = stats.dimension;

    const remaining = AudioEngine.getSleepTimerRemaining();
    if (remaining && remaining.total > 0) {
      statTimer.textContent = `${String(remaining.mins).padStart(2, '0')}:${String(remaining.secs).padStart(2, '0')}`;
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
