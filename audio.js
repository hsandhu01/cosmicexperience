/* ============================================
   COSMOS — Audio Synthesizer & Visualizer
   ============================================ */

const AudioEngine = (() => {
  let audioCtx = null;
  let analyser = null;
  let canvas, ctx;
  let width, height;
  let isPlaying = false;
  let masterGain = null;
  let oscillators = [];
  let dataArray = null;
  let bufferLength = 0;

  // Ambient chord progressions (frequencies)
  const chords = [
    [130.81, 164.81, 196.00, 261.63], // C major
    [146.83, 174.61, 220.00, 293.66], // D minor
    [164.81, 196.00, 246.94, 329.63], // E minor
    [174.61, 220.00, 261.63, 349.23], // F major
    [196.00, 246.94, 293.66, 392.00], // G major
    [110.00, 138.59, 164.81, 220.00], // A minor
  ];

  let currentChord = 0;
  let chordInterval = null;

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
    bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(analyser);
    analyser.connect(audioCtx.destination);
  }

  function playAmbient() {
    if (isPlaying) return;
    createAudioContext();
    isPlaying = true;

    // Fade in master volume
    masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
    masterGain.gain.setValueAtTime(masterGain.gain.value, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 2);

    startChord(chords[currentChord]);

    // Progress through chords
    chordInterval = setInterval(() => {
      currentChord = (currentChord + 1) % chords.length;
      transitionChord(chords[currentChord]);
    }, 8000);
  }

  function startChord(freqs) {
    // Clean up existing oscillators
    stopOscillators();

    freqs.forEach((freq, i) => {
      // Main tone
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      gain.gain.value = 0.03;
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start();
      oscillators.push({ osc, gain });

      // Sub-octave pad
      const sub = audioCtx.createOscillator();
      const subGain = audioCtx.createGain();
      sub.type = 'sine';
      sub.frequency.value = freq / 2;
      subGain.gain.value = 0.02;
      sub.connect(subGain);
      subGain.connect(masterGain);
      sub.start();
      oscillators.push({ osc: sub, gain: subGain });
    });

    // Add a gentle noise layer
    const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.015;
    }
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 500;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.value = 0.5;
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    noiseSource.start();
    oscillators.push({ osc: noiseSource, gain: noiseGain });
  }

  function transitionChord(freqs) {
    // Fade out existing
    oscillators.forEach(({ osc, gain }) => {
      gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2);
      setTimeout(() => {
        try { osc.stop(); } catch(e) {}
      }, 2500);
    });
    oscillators = [];

    // Start new after brief pause
    setTimeout(() => {
      if (isPlaying) startChord(freqs);
    }, 1500);
  }

  function stopOscillators() {
    oscillators.forEach(({ osc, gain }) => {
      try {
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
        setTimeout(() => {
          try { osc.stop(); } catch(e) {}
        }, 600);
      } catch(e) {}
    });
    oscillators = [];
  }

  function stopAmbient() {
    if (!isPlaying) return;
    isPlaying = false;
    clearInterval(chordInterval);

    if (masterGain) {
      masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1);
    }

    setTimeout(() => {
      stopOscillators();
    }, 1200);
  }

  function toggle() {
    if (isPlaying) {
      stopAmbient();
    } else {
      playAmbient();
    }
    return isPlaying;
  }

  function render() {
    ctx.clearRect(0, 0, width, height);

    if (!isPlaying || !analyser || !dataArray) return;

    analyser.getByteFrequencyData(dataArray);

    // Circular visualizer in the center
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.15;

    ctx.save();
    ctx.globalAlpha = 0.6;

    // Draw frequency bars in a circle
    const barCount = bufferLength;
    const angleStep = (Math.PI * 2) / barCount;

    for (let i = 0; i < barCount; i++) {
      const value = dataArray[i] / 255;
      const barHeight = value * radius * 0.8;

      if (barHeight < 2) continue;

      const angle = i * angleStep - Math.PI / 2;
      const x1 = centerX + Math.cos(angle) * radius;
      const y1 = centerY + Math.sin(angle) * radius;
      const x2 = centerX + Math.cos(angle) * (radius + barHeight);
      const y2 = centerY + Math.sin(angle) * (radius + barHeight);

      const hue = (i / barCount) * 360;
      ctx.strokeStyle = `hsla(${hue}, 80%, 65%, ${value * 0.5})`;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Mirror inner
      const x3 = centerX + Math.cos(angle) * (radius - barHeight * 0.3);
      const y3 = centerY + Math.sin(angle) * (radius - barHeight * 0.3);
      ctx.strokeStyle = `hsla(${hue}, 80%, 65%, ${value * 0.2})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x3, y3);
      ctx.stroke();
    }

    // Center ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Pulsing inner glow based on bass
    const bass = (dataArray[0] + dataArray[1] + dataArray[2]) / (3 * 255);
    const glowRadius = radius * (0.8 + bass * 0.4);
    const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowRadius);
    glow.addColorStop(0, `rgba(124, 58, 237, ${bass * 0.1})`);
    glow.addColorStop(0.5, `rgba(6, 182, 212, ${bass * 0.05})`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function getIsPlaying() { return isPlaying; }

  return { init, render, toggle, getIsPlaying };
})();
