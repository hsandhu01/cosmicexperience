/* ============================================
   COSMOS — Ambient Sleep Soundscape Engine
   Binaural beats, pink noise, ambient pads,
   rain textures, and a sleep timer.
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

  // Active audio nodes
  let activeNodes = [];

  // ───── AMBIENT PAD CONFIG ─────
  // Dreamy, slow-evolving chord voicings (very low frequencies for sleep)
  const chordProgressions = [
    // Cmaj9 - ethereal
    [65.41, 82.41, 98.00, 130.81, 146.83],
    // Am7 - melancholic calm
    [55.00, 69.30, 82.41, 110.00, 130.81],
    // Fmaj7 - warm resolve
    [43.65, 65.41, 82.41, 110.00, 130.81],
    // Dm9 - soft drift
    [36.71, 55.00, 73.42, 87.31, 110.00],
    // G7sus4 - floating
    [49.00, 65.41, 73.42, 98.00, 110.00],
    // Em11 - vast, open
    [41.20, 55.00, 73.42, 82.41, 98.00],
  ];

  let currentChord = 0;
  let chordTimer = null;

  // Binaural beat config (delta waves for deep sleep: 0.5-4 Hz)
  const binauralConfig = {
    baseFreq: 120,     // base tone Hz
    beatFreq: 2.5,     // difference Hz (delta wave ~ deep sleep)
  };

  // ───── SLEEP TIMER ─────
  let sleepTimerMinutes = 0;
  let sleepTimerEnd = 0;
  let sleepTimerInterval = null;
  let fadeOutDuration = 60; // seconds to fade out at end

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

  // ───── PINK NOISE GENERATOR ─────
  function createPinkNoise() {
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

    // Filter to make it extra soft and warm
    const lpFilter = audioCtx.createBiquadFilter();
    lpFilter.type = 'lowpass';
    lpFilter.frequency.value = 400;
    lpFilter.Q.value = 0.5;

    const gain = audioCtx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.35, audioCtx.currentTime + 4);

    source.connect(lpFilter);
    lpFilter.connect(gain);
    gain.connect(masterGain);
    source.start();

    activeNodes.push({ node: source, gain, type: 'pink-noise' });
    return { source, gain, filter: lpFilter };
  }

  // ───── RAIN TEXTURE GENERATOR ─────
  function createRainTexture() {
    const bufferSize = audioCtx.sampleRate * 6;
    const buffer = audioCtx.createBuffer(2, bufferSize, audioCtx.sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < bufferSize; i++) {
        // Random rain drops — sparse crackle pattern
        const drop = Math.random() < 0.003 ? (Math.random() * 0.5 - 0.25) : 0;
        // Continuous soft wash
        const wash = (Math.random() * 2 - 1) * 0.008;
        data[i] = drop + wash;
      }
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const hpFilter = audioCtx.createBiquadFilter();
    hpFilter.type = 'highpass';
    hpFilter.frequency.value = 2000;

    const lpFilter = audioCtx.createBiquadFilter();
    lpFilter.type = 'lowpass';
    lpFilter.frequency.value = 8000;

    const gain = audioCtx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 5);

    source.connect(hpFilter);
    hpFilter.connect(lpFilter);
    lpFilter.connect(gain);
    gain.connect(masterGain);
    source.start();

    activeNodes.push({ node: source, gain, type: 'rain' });
    return { source, gain };
  }

  // ───── BINAURAL BEATS (DELTA WAVES) ─────
  function createBinauralBeats() {
    const { baseFreq, beatFreq } = binauralConfig;

    // Left ear
    const oscLeft = audioCtx.createOscillator();
    oscLeft.type = 'sine';
    oscLeft.frequency.value = baseFreq;
    const gainLeft = audioCtx.createGain();
    gainLeft.gain.value = 0;
    gainLeft.gain.linearRampToValueAtTime(0.06, audioCtx.currentTime + 6);
    const panLeft = audioCtx.createStereoPanner();
    panLeft.pan.value = -1;
    oscLeft.connect(gainLeft);
    gainLeft.connect(panLeft);
    panLeft.connect(masterGain);
    oscLeft.start();

    // Right ear (offset by beatFreq for binaural effect)
    const oscRight = audioCtx.createOscillator();
    oscRight.type = 'sine';
    oscRight.frequency.value = baseFreq + beatFreq;
    const gainRight = audioCtx.createGain();
    gainRight.gain.value = 0;
    gainRight.gain.linearRampToValueAtTime(0.06, audioCtx.currentTime + 6);
    const panRight = audioCtx.createStereoPanner();
    panRight.pan.value = 1;
    oscRight.connect(gainRight);
    gainRight.connect(panRight);
    panRight.connect(masterGain);
    oscRight.start();

    activeNodes.push(
      { node: oscLeft, gain: gainLeft, type: 'binaural' },
      { node: oscRight, gain: gainRight, type: 'binaural' }
    );
  }

  // ───── AMBIENT DREAM PADS ─────
  function createDreamPad(freqs) {
    const padNodes = [];

    freqs.forEach((freq, i) => {
      // Detuned pad voices for width
      [-4, 0, 4].forEach(detuneCents => {
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.detune.value = detuneCents + (Math.random() * 2 - 1);

        // Slow LFO on frequency for organic drift
        const lfo = audioCtx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.05 + Math.random() * 0.08;
        const lfoGain = audioCtx.createGain();
        lfoGain.gain.value = freq * 0.003; // very subtle pitch drift
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();

        const gain = audioCtx.createGain();
        gain.gain.value = 0;

        // Slow fade in over 8 seconds
        const targetVol = 0.02 / (i + 1); // higher partials quieter
        gain.gain.linearRampToValueAtTime(targetVol, audioCtx.currentTime + 8 + i * 0.5);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start();

        padNodes.push({ node: osc, gain, type: 'pad' });
        activeNodes.push({ node: osc, gain, type: 'pad' });
        activeNodes.push({ node: lfo, gain: lfoGain, type: 'lfo' });
      });
    });

    return padNodes;
  }

  // ───── CHORD TRANSITIONS ─────
  function transitionToNextChord() {
    currentChord = (currentChord + 1) % chordProgressions.length;

    // Fade out existing pads
    const pads = activeNodes.filter(n => n.type === 'pad');
    pads.forEach(({ node, gain }) => {
      gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 6);
      setTimeout(() => {
        try { node.stop(); } catch (e) {}
      }, 7000);
    });

    // Remove faded pads from active list
    setTimeout(() => {
      activeNodes = activeNodes.filter(n => n.type !== 'pad' && n.type !== 'lfo');
    }, 7500);

    // Start new chord after crossfade gap
    setTimeout(() => {
      if (isPlaying) {
        createDreamPad(chordProgressions[currentChord]);
      }
    }, 4000);
  }

  // ───── BREATHING GUIDE (subtle volume pulse) ─────
  function createBreathingPulse() {
    // 4-7-8 breathing pattern encoded as volume LFO
    // ~19 second cycle
    const breathOsc = audioCtx.createOscillator();
    breathOsc.type = 'sine';
    breathOsc.frequency.value = 174.61; // F3 — healing frequency

    const breathGain = audioCtx.createGain();
    breathGain.gain.value = 0;

    // Very gentle volume modulation
    const breathLfo = audioCtx.createOscillator();
    breathLfo.type = 'sine';
    breathLfo.frequency.value = 1 / 12; // ~12 second breath cycle
    const breathLfoGain = audioCtx.createGain();
    breathLfoGain.gain.value = 0.012;
    breathLfo.connect(breathLfoGain);
    breathLfoGain.connect(breathGain.gain);
    breathLfo.start();

    breathGain.gain.linearRampToValueAtTime(0.015, audioCtx.currentTime + 10);

    breathOsc.connect(breathGain);
    breathGain.connect(masterGain);
    breathOsc.start();

    activeNodes.push(
      { node: breathOsc, gain: breathGain, type: 'breath' },
      { node: breathLfo, gain: breathLfoGain, type: 'lfo' }
    );
  }

  // ───── PLAY / STOP ─────
  function playAmbient() {
    if (isPlaying) return;
    createAudioContext();
    isPlaying = true;

    // Gentle master fade in
    masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
    masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.7, audioCtx.currentTime + 5);

    // Layer 1: Pink noise bed
    createPinkNoise();

    // Layer 2: Rain texture
    createRainTexture();

    // Layer 3: Binaural beats (delta waves for deep sleep)
    createBinauralBeats();

    // Layer 4: Dream pads
    createDreamPad(chordProgressions[currentChord]);

    // Layer 5: Breathing guide tone
    createBreathingPulse();

    // Evolve chords every 25 seconds
    chordTimer = setInterval(() => {
      if (isPlaying) transitionToNextChord();
    }, 25000);
  }

  function stopAmbient() {
    if (!isPlaying) return;
    isPlaying = false;
    clearInterval(chordTimer);
    clearSleepTimer();

    // Gentle fade out
    if (masterGain) {
      masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 3);
    }

    setTimeout(() => {
      activeNodes.forEach(({ node, gain }) => {
        try {
          gain.gain.value = 0;
          node.stop();
        } catch (e) {}
      });
      activeNodes = [];
    }, 3500);
  }

  function toggle() {
    if (isPlaying) {
      stopAmbient();
    } else {
      playAmbient();
    }
    return isPlaying;
  }

  // ───── SLEEP TIMER ─────
  function setSleepTimer(minutes) {
    clearSleepTimer();
    if (minutes <= 0) {
      sleepTimerMinutes = 0;
      return;
    }

    sleepTimerMinutes = minutes;
    sleepTimerEnd = Date.now() + minutes * 60 * 1000;

    sleepTimerInterval = setInterval(() => {
      const remaining = sleepTimerEnd - Date.now();

      if (remaining <= 0) {
        stopAmbient();
        clearSleepTimer();
        return;
      }

      // Start fading out in the last 60 seconds
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
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    return { mins, secs, total: remaining };
  }

  // ───── VISUALIZER RENDER ─────
  function render() {
    ctx.clearRect(0, 0, width, height);
    if (!isPlaying || !analyser || !dataArray) return;

    analyser.getByteFrequencyData(dataArray);

    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) * 0.2;

    ctx.save();

    // Soft orbital rings — dreamy, slow
    const ringCount = 4;
    const time = Date.now() * 0.0003;

    for (let ring = 0; ring < ringCount; ring++) {
      const ringRadius = maxRadius * (0.4 + ring * 0.2);
      const segments = 64;
      const angleStep = (Math.PI * 2) / segments;

      ctx.beginPath();
      for (let i = 0; i <= segments; i++) {
        const angle = i * angleStep + time * (0.3 + ring * 0.1);
        const dataIdx = Math.floor((i / segments) * bufferLength * 0.5);
        const value = (dataArray[dataIdx] || 0) / 255;
        const wobble = value * maxRadius * 0.15;
        const r = ringRadius + wobble;

        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      const hue = 220 + ring * 30; // cool blue-purple tones
      ctx.strokeStyle = `hsla(${hue}, 60%, 70%, ${0.12 - ring * 0.02})`;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = `hsla(${hue}, 60%, 70%, 0.15)`;
      ctx.shadowBlur = 15;
      ctx.stroke();
    }

    // Central breathing glow
    const bass = (dataArray[0] + dataArray[1] + dataArray[2] + dataArray[3]) / (4 * 255);
    const breathRadius = maxRadius * (0.25 + bass * 0.15);
    const breathGlow = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, breathRadius
    );
    breathGlow.addColorStop(0, `rgba(147, 130, 220, ${bass * 0.12})`);
    breathGlow.addColorStop(0.5, `rgba(100, 140, 200, ${bass * 0.06})`);
    breathGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = breathGlow;
    ctx.beginPath();
    ctx.arc(centerX, centerY, breathRadius, 0, Math.PI * 2);
    ctx.fill();

    // Floating frequency dots
    for (let i = 0; i < bufferLength; i += 4) {
      const value = dataArray[i] / 255;
      if (value < 0.1) continue;

      const angle = (i / bufferLength) * Math.PI * 2 + time * 0.5;
      const dist = maxRadius * 0.3 + value * maxRadius * 0.5;
      const x = centerX + Math.cos(angle) * dist;
      const y = centerY + Math.sin(angle) * dist;
      const dotSize = value * 2.5 + 0.5;

      const hue = 200 + (i / bufferLength) * 80;
      ctx.fillStyle = `hsla(${hue}, 50%, 75%, ${value * 0.3})`;
      ctx.beginPath();
      ctx.arc(x, y, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function getIsPlaying() { return isPlaying; }

  return {
    init, render, toggle, getIsPlaying,
    setSleepTimer, getSleepTimerRemaining, clearSleepTimer
  };
})();
