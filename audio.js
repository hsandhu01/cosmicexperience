/* ============================================
   COSMOS — Ambient Sleep Soundscape Engine
   Full mixer with 9 sound layers:
   Pink noise, Rain, Binaural beats, Dream pads,
   Breathing tone, Ocean, Thunderstorm, Forest, Fireplace
   ============================================ */

const AudioEngine = (() => {
  let audioCtx = null;
  let analyser = null;
  let canvas, ctx;
  let width, height;
  let isPlaying = false;
  let masterGain = null;
  let dataArray = null;
  let bufferLength = 0;

  // Individual layer tracking
  const layers = {};
  const layerDefaults = {
    'pink-noise': 0.35,
    'rain': 0.5,
    'binaural': 0.06,
    'pads': 1.0,
    'breath': 1.0,
    'ocean': 0,
    'thunder': 0,
    'forest': 0,
    'fireplace': 0
  };
  const layerVolumes = { ...layerDefaults };

  // Pad oscillators for chord transitions
  let padNodes = [];
  let lfoNodes = [];

  // ───── AMBIENT PAD CONFIG ─────
  const chordProgressions = [
    [65.41, 82.41, 98.00, 130.81, 146.83],
    [55.00, 69.30, 82.41, 110.00, 130.81],
    [43.65, 65.41, 82.41, 110.00, 130.81],
    [36.71, 55.00, 73.42, 87.31, 110.00],
    [49.00, 65.41, 73.42, 98.00, 110.00],
    [41.20, 55.00, 73.42, 82.41, 98.00],
  ];

  let currentChord = 0;
  let chordTimer = null;

  const binauralConfig = { baseFreq: 120, beatFreq: 2.5 };

  // ───── SLEEP TIMER ─────
  let sleepTimerMinutes = 0;
  let sleepTimerEnd = 0;
  let sleepTimerInterval = null;
  let fadeOutDuration = 60;

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  function createAudioContext() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.85;
    bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(analyser);
    analyser.connect(audioCtx.destination);
  }

  // ───── LAYER GAIN HELPER ─────
  function createLayerGain(layerName) {
    const gain = audioCtx.createGain();
    gain.gain.value = layerVolumes[layerName];
    gain.connect(masterGain);
    layers[layerName] = { gain, sources: [] };
    return gain;
  }

  function addSource(layerName, source) {
    if (layers[layerName]) {
      layers[layerName].sources.push(source);
    }
  }

  // ───── PINK NOISE ─────
  function createPinkNoise() {
    const gain = createLayerGain('pink-noise');
    const bufferSize = audioCtx.sampleRate * 4;
    const buffer = audioCtx.createBuffer(2, bufferSize, audioCtx.sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.015;
        b6 = white * 0.115926;
      }
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    lp.Q.value = 0.5;
    source.connect(lp);
    lp.connect(gain);
    source.start();
    addSource('pink-noise', source);
  }

  // ───── RAIN ─────
  function createRainTexture() {
    const gain = createLayerGain('rain');
    const bufferSize = audioCtx.sampleRate * 6;
    const buffer = audioCtx.createBuffer(2, bufferSize, audioCtx.sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < bufferSize; i++) {
        const drop = Math.random() < 0.003 ? (Math.random() * 0.5 - 0.25) : 0;
        const wash = (Math.random() * 2 - 1) * 0.008;
        data[i] = drop + wash;
      }
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2000;
    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 8000;
    source.connect(hp);
    hp.connect(lp);
    lp.connect(gain);
    source.start();
    addSource('rain', source);
  }

  // ───── BINAURAL BEATS ─────
  function createBinauralBeats() {
    const gain = createLayerGain('binaural');
    const { baseFreq, beatFreq } = binauralConfig;

    const oscL = audioCtx.createOscillator();
    oscL.type = 'sine';
    oscL.frequency.value = baseFreq;
    const panL = audioCtx.createStereoPanner();
    panL.pan.value = -1;
    oscL.connect(panL);
    panL.connect(gain);
    oscL.start();

    const oscR = audioCtx.createOscillator();
    oscR.type = 'sine';
    oscR.frequency.value = baseFreq + beatFreq;
    const panR = audioCtx.createStereoPanner();
    panR.pan.value = 1;
    oscR.connect(panR);
    panR.connect(gain);
    oscR.start();

    addSource('binaural', oscL);
    addSource('binaural', oscR);
  }

  // ───── DREAM PADS ─────
  function createDreamPad(freqs) {
    if (!layers['pads']) createLayerGain('pads');
    const padGain = layers['pads'].gain;

    freqs.forEach((freq, i) => {
      [-4, 0, 4].forEach(detune => {
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.detune.value = detune + (Math.random() * 2 - 1);

        const lfo = audioCtx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.05 + Math.random() * 0.08;
        const lfoGain = audioCtx.createGain();
        lfoGain.gain.value = freq * 0.003;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();

        const g = audioCtx.createGain();
        g.gain.value = 0;
        const targetVol = 0.02 / (i + 1);
        g.gain.linearRampToValueAtTime(targetVol, audioCtx.currentTime + 8 + i * 0.5);

        osc.connect(g);
        g.connect(padGain);
        osc.start();

        padNodes.push({ osc, gain: g });
        lfoNodes.push({ osc: lfo, gain: lfoGain });
      });
    });
  }

  function transitionToNextChord() {
    currentChord = (currentChord + 1) % chordProgressions.length;
    padNodes.forEach(({ osc, gain }) => {
      gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 6);
      setTimeout(() => { try { osc.stop(); } catch(e) {} }, 7000);
    });
    const oldLfos = [...lfoNodes];
    setTimeout(() => {
      oldLfos.forEach(({ osc }) => { try { osc.stop(); } catch(e) {} });
    }, 7500);
    padNodes = [];
    lfoNodes = [];
    setTimeout(() => {
      if (isPlaying) createDreamPad(chordProgressions[currentChord]);
    }, 4000);
  }

  // ───── BREATHING TONE ─────
  function createBreathingPulse() {
    const gain = createLayerGain('breath');
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 174.61;

    const lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 1 / 12;
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 0.012;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();

    const innerGain = audioCtx.createGain();
    innerGain.gain.value = 0;
    innerGain.gain.linearRampToValueAtTime(0.015, audioCtx.currentTime + 10);
    osc.connect(innerGain);
    innerGain.connect(gain);
    osc.start();

    addSource('breath', osc);
    addSource('breath', lfo);
  }

  // ───── OCEAN WAVES ─────
  function createOceanWaves() {
    const gain = createLayerGain('ocean');
    const bufferSize = audioCtx.sampleRate * 8;
    const buffer = audioCtx.createBuffer(2, bufferSize, audioCtx.sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      const waveLen = audioCtx.sampleRate * 6; // ~6 second wave period
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Wave envelope: slow swell + retreat
        const phase = (i % waveLen) / waveLen;
        const envelope = Math.pow(Math.sin(phase * Math.PI), 1.5) * 0.7 + 0.1;
        // Secondary micro-waves
        const micro = Math.sin(i / (audioCtx.sampleRate * 0.8)) * 0.15 + 0.85;
        data[i] = white * 0.04 * envelope * micro;
      }
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // Warm filter for ocean depth
    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 800;
    lp.Q.value = 0.7;

    const hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 60;

    source.connect(hp);
    hp.connect(lp);
    lp.connect(gain);
    source.start();
    addSource('ocean', source);
  }

  // ───── THUNDERSTORM ─────
  function createThunderstorm() {
    const gain = createLayerGain('thunder');

    // Base: deep rumble noise
    const rumbleSize = audioCtx.sampleRate * 10;
    const rumbleBuffer = audioCtx.createBuffer(2, rumbleSize, audioCtx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = rumbleBuffer.getChannelData(ch);
      for (let i = 0; i < rumbleSize; i++) {
        const white = Math.random() * 2 - 1;
        // Slow thunder roll envelope
        const roll = Math.sin((i / rumbleSize) * Math.PI * 3) * 0.5 + 0.5;
        const crack = Math.random() < 0.0001 ? Math.random() * 0.8 : 0;
        data[i] = (white * 0.025 * roll) + crack * 0.3;
      }
    }

    const rumble = audioCtx.createBufferSource();
    rumble.buffer = rumbleBuffer;
    rumble.loop = true;

    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 200;
    lp.Q.value = 0.3;

    rumble.connect(lp);
    lp.connect(gain);
    rumble.start();

    // Rain layer specific to storm (heavier)
    const rainSize = audioCtx.sampleRate * 4;
    const rainBuffer = audioCtx.createBuffer(2, rainSize, audioCtx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = rainBuffer.getChannelData(ch);
      for (let i = 0; i < rainSize; i++) {
        const drop = Math.random() < 0.008 ? (Math.random() * 0.4 - 0.2) : 0;
        const wash = (Math.random() * 2 - 1) * 0.012;
        data[i] = drop + wash;
      }
    }

    const rain = audioCtx.createBufferSource();
    rain.buffer = rainBuffer;
    rain.loop = true;
    const rainHp = audioCtx.createBiquadFilter();
    rainHp.type = 'highpass';
    rainHp.frequency.value = 1500;
    rain.connect(rainHp);
    rainHp.connect(gain);
    rain.start();

    addSource('thunder', rumble);
    addSource('thunder', rain);
  }

  // ───── FOREST ─────
  function createForest() {
    const gain = createLayerGain('forest');

    // Wind through trees
    const windSize = audioCtx.sampleRate * 8;
    const windBuffer = audioCtx.createBuffer(2, windSize, audioCtx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = windBuffer.getChannelData(ch);
      for (let i = 0; i < windSize; i++) {
        const white = Math.random() * 2 - 1;
        const gust = Math.sin(i / (audioCtx.sampleRate * 4) * Math.PI) * 0.4 + 0.6;
        const rustle = Math.sin(i / (audioCtx.sampleRate * 0.3)) * 0.1 + 0.9;
        data[i] = white * 0.015 * gust * rustle;
      }
    }

    const wind = audioCtx.createBufferSource();
    wind.buffer = windBuffer;
    wind.loop = true;
    const windLp = audioCtx.createBiquadFilter();
    windLp.type = 'lowpass';
    windLp.frequency.value = 1200;
    const windHp = audioCtx.createBiquadFilter();
    windHp.type = 'highpass';
    windHp.frequency.value = 100;
    wind.connect(windHp);
    windHp.connect(windLp);
    windLp.connect(gain);
    wind.start();

    // Bird chirps: very subtle, sparse sine blips
    const chirpSize = audioCtx.sampleRate * 12;
    const chirpBuffer = audioCtx.createBuffer(2, chirpSize, audioCtx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = chirpBuffer.getChannelData(ch);
      for (let i = 0; i < chirpSize; i++) {
        // Sparse chirps
        if (Math.random() < 0.00003) {
          const chirpLen = Math.floor(audioCtx.sampleRate * (0.05 + Math.random() * 0.1));
          const freq = 2000 + Math.random() * 3000;
          for (let j = 0; j < chirpLen && (i + j) < chirpSize; j++) {
            const env = Math.sin((j / chirpLen) * Math.PI);
            data[i + j] += Math.sin((i + j) * freq * Math.PI * 2 / audioCtx.sampleRate) * 0.02 * env;
          }
        }
      }
    }

    const chirps = audioCtx.createBufferSource();
    chirps.buffer = chirpBuffer;
    chirps.loop = true;
    chirps.connect(gain);
    chirps.start();

    addSource('forest', wind);
    addSource('forest', chirps);
  }

  // ───── FIREPLACE ─────
  function createFireplace() {
    const gain = createLayerGain('fireplace');

    const bufferSize = audioCtx.sampleRate * 6;
    const buffer = audioCtx.createBuffer(2, bufferSize, audioCtx.sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < bufferSize; i++) {
        // Base crackle
        const crackle = Math.random() < 0.01
          ? (Math.random() * 0.6 - 0.3) * Math.exp(-Math.random() * 5)
          : 0;
        // Warm rumble
        const rumble = (Math.random() * 2 - 1) * 0.006;
        // Pop
        const pop = Math.random() < 0.0005
          ? (Math.random() * 0.4 - 0.2)
          : 0;
        data[i] = crackle + rumble + pop;
      }
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // Warm, low-passed for cozy feeling
    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3000;
    lp.Q.value = 0.4;

    const hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 80;

    source.connect(hp);
    hp.connect(lp);
    lp.connect(gain);
    source.start();
    addSource('fireplace', source);
  }

  // ───── PLAY / STOP ─────
  function playAmbient() {
    if (isPlaying) return;
    createAudioContext();
    isPlaying = true;

    masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
    masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.7, audioCtx.currentTime + 5);

    // Core layers
    createPinkNoise();
    createRainTexture();
    createBinauralBeats();
    createDreamPad(chordProgressions[currentChord]);
    createBreathingPulse();

    // Nature layers (start at 0 volume by default)
    createOceanWaves();
    createThunderstorm();
    createForest();
    createFireplace();

    chordTimer = setInterval(() => {
      if (isPlaying) transitionToNextChord();
    }, 25000);
  }

  function stopAmbient() {
    if (!isPlaying) return;
    isPlaying = false;
    clearInterval(chordTimer);
    clearSleepTimer();

    if (masterGain) {
      masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 3);
    }

    setTimeout(() => {
      Object.values(layers).forEach(layer => {
        layer.sources.forEach(s => {
          try { s.stop(); } catch(e) {}
        });
        layer.sources = [];
      });
      padNodes.forEach(({ osc }) => { try { osc.stop(); } catch(e) {} });
      lfoNodes.forEach(({ osc }) => { try { osc.stop(); } catch(e) {} });
      padNodes = [];
      lfoNodes = [];
      // Clear layer references
      Object.keys(layers).forEach(k => delete layers[k]);
    }, 3500);
  }

  function toggle() {
    if (isPlaying) stopAmbient();
    else playAmbient();
    return isPlaying;
  }

  // ───── MIXER API ─────
  function setLayerVolume(layerName, value) {
    // value: 0.0 to 1.0
    layerVolumes[layerName] = value;
    if (layers[layerName]) {
      layers[layerName].gain.gain.linearRampToValueAtTime(
        value, audioCtx ? audioCtx.currentTime + 0.1 : 0
      );
    }
  }

  function getLayerVolumes() {
    return { ...layerVolumes };
  }

  function getLayerNames() {
    return [
      { id: 'pink-noise', label: 'Pink Noise', icon: '〰', group: 'core' },
      { id: 'rain', label: 'Rain', icon: '🌧', group: 'core' },
      { id: 'binaural', label: 'Binaural', icon: '🧠', group: 'core' },
      { id: 'pads', label: 'Dream Pads', icon: '✧', group: 'core' },
      { id: 'breath', label: 'Breath Tone', icon: '🫁', group: 'core' },
      { id: 'ocean', label: 'Ocean', icon: '🌊', group: 'nature' },
      { id: 'thunder', label: 'Thunder', icon: '⛈', group: 'nature' },
      { id: 'forest', label: 'Forest', icon: '🌲', group: 'nature' },
      { id: 'fireplace', label: 'Fire', icon: '🔥', group: 'nature' },
    ];
  }

  // ───── SLEEP TIMER ─────
  function setSleepTimer(minutes) {
    clearSleepTimer();
    if (minutes <= 0) { sleepTimerMinutes = 0; return; }
    sleepTimerMinutes = minutes;
    sleepTimerEnd = Date.now() + minutes * 60 * 1000;
    sleepTimerInterval = setInterval(() => {
      const remaining = sleepTimerEnd - Date.now();
      if (remaining <= 0) { stopAmbient(); clearSleepTimer(); return; }
      if (remaining <= fadeOutDuration * 1000 && masterGain) {
        const fadeProgress = remaining / (fadeOutDuration * 1000);
        masterGain.gain.linearRampToValueAtTime(0.7 * fadeProgress, audioCtx.currentTime + 1);
      }
    }, 1000);
  }

  function clearSleepTimer() {
    clearInterval(sleepTimerInterval);
    sleepTimerInterval = null;
    sleepTimerMinutes = 0;
    sleepTimerEnd = 0;
  }

  function getSleepTimerRemaining() {
    if (!sleepTimerEnd) return null;
    const remaining = Math.max(0, sleepTimerEnd - Date.now());
    return { mins: Math.floor(remaining / 60000), secs: Math.floor((remaining % 60000) / 1000), total: remaining };
  }

  // ───── VISUALIZER ─────
  function render() {
    ctx.clearRect(0, 0, width, height);
    if (!isPlaying || !analyser || !dataArray) return;
    analyser.getByteFrequencyData(dataArray);

    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) * 0.2;
    const time = Date.now() * 0.0003;

    ctx.save();

    // Soft orbital rings
    for (let ring = 0; ring < 4; ring++) {
      const r = maxRadius * (0.4 + ring * 0.2);
      const segments = 64;
      ctx.beginPath();
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2 + time * (0.3 + ring * 0.1);
        const idx = Math.floor((i / segments) * bufferLength * 0.5);
        const value = (dataArray[idx] || 0) / 255;
        const wobble = value * maxRadius * 0.15;
        const x = centerX + Math.cos(angle) * (r + wobble);
        const y = centerY + Math.sin(angle) * (r + wobble);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      const hue = 220 + ring * 30;
      ctx.strokeStyle = `hsla(${hue}, 60%, 70%, ${0.12 - ring * 0.02})`;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = `hsla(${hue}, 60%, 70%, 0.15)`;
      ctx.shadowBlur = 15;
      ctx.stroke();
    }

    // Central glow
    const bass = (dataArray[0] + dataArray[1] + dataArray[2] + dataArray[3]) / (4 * 255);
    const br = maxRadius * (0.25 + bass * 0.15);
    const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, br);
    glow.addColorStop(0, `rgba(147, 130, 220, ${bass * 0.12})`);
    glow.addColorStop(0.5, `rgba(100, 140, 200, ${bass * 0.06})`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(centerX, centerY, br, 0, Math.PI * 2);
    ctx.fill();

    // Frequency dots
    for (let i = 0; i < bufferLength; i += 4) {
      const value = dataArray[i] / 255;
      if (value < 0.1) continue;
      const angle = (i / bufferLength) * Math.PI * 2 + time * 0.5;
      const dist = maxRadius * 0.3 + value * maxRadius * 0.5;
      const x = centerX + Math.cos(angle) * dist;
      const y = centerY + Math.sin(angle) * dist;
      ctx.fillStyle = `hsla(${200 + (i / bufferLength) * 80}, 50%, 75%, ${value * 0.3})`;
      ctx.beginPath();
      ctx.arc(x, y, value * 2.5 + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function getIsPlaying() { return isPlaying; }

  return {
    init, render, toggle, getIsPlaying,
    setSleepTimer, getSleepTimerRemaining, clearSleepTimer,
    setLayerVolume, getLayerVolumes, getLayerNames
  };
})();
