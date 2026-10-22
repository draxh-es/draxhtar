/* ==========================================================================
   CHIPTUNE — tiny WebAudio synth: square/triangle/noise sound effects and a
   looping medieval-ish tune in D minor. No audio files needed.
   ========================================================================== */
const Chip = (() => {
  let ctx = null, master, sfxBus, musicBus, noiseBuf;
  let sfxOn = true, musicOn = false;
  let seqTimer = null, nextNoteTime = 0, step = 0;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.5; sfxBus.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.28; musicBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  function tone(freq, at, dur, { type = 'square', vol = 0.2, slide = null, bus = sfxBus } = {}) {
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(at, dur, { vol = 0.3, freq = 1000, type = 'lowpass', sweep = null, bus = sfxBus } = {}) {
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // Wrap every sfx so it is a no-op when muted or before the first gesture.
  const fx = fn => (...a) => { if (sfxOn && ctx) fn(...a); };

  const sfx = {
    hover: fx(() => tone(1200, 0, 0.03, { vol: 0.05 })),
    click: fx(() => { tone(660, 0, 0.05, { vol: 0.12 }); tone(990, 0.05, 0.07, { vol: 0.12 }); }),
    blip: fx(() => tone(480 + Math.random() * 80, 0, 0.025, { vol: 0.05 })),
    coin: fx(() => { tone(988, 0, 0.08, { vol: 0.15 }); tone(1319, 0.08, 0.3, { vol: 0.15 }); }),
    jump: fx(() => tone(260, 0, 0.18, { vol: 0.14, slide: 820 })),
    door: fx(() => { noise(0, 1.6, { vol: 0.5, freq: 300, sweep: 80 }); tone(70, 0, 1.4, { type: 'sawtooth', vol: 0.12, slide: 40 }); }),
    start: fx(() => {
      [62, 66, 69, 74, 69, 74, 78].forEach((n, i) => tone(midi(n), i * 0.09, 0.16, { vol: 0.13 }));
      tone(midi(86), 0.63, 0.6, { vol: 0.12 });
      tone(midi(50), 0.63, 0.6, { type: 'triangle', vol: 0.3 });
    }),
    levelUp: fx(() => {
      [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone(midi(n), i * 0.06, 0.12, { vol: 0.12 }));
      tone(midi(84), 0.42, 0.5, { vol: 0.1 });
    }),
    achievement: fx(() => {
      tone(midi(76), 0, 0.1, { vol: 0.12 }); tone(midi(79), 0.1, 0.1, { vol: 0.12 });
      tone(midi(88), 0.2, 0.35, { vol: 0.12 });
    }),
    thunder: fx(() => {
      noise(0, 0.25, { vol: 0.7, freq: 4000, sweep: 300 });
      noise(0.15, 2.2, { vol: 0.6, freq: 500, sweep: 60 });
    }),
    fire: fx(() => noise(0, 0.9, { vol: 0.35, freq: 2500, type: 'bandpass', sweep: 400 })),
    roar: fx(() => {
      tone(140, 0, 1.0, { type: 'sawtooth', vol: 0.2, slide: 55 });
      tone(147, 0, 1.0, { type: 'square', vol: 0.08, slide: 60 });
      noise(0, 1.1, { vol: 0.35, freq: 900, sweep: 120 });
    }),
    whoosh: fx(() => noise(0, 0.5, { vol: 0.25, freq: 400, type: 'bandpass', sweep: 3000 })),
    error: fx(() => { tone(200, 0, 0.12, { vol: 0.15 }); tone(150, 0.12, 0.2, { vol: 0.15 }); }),
  };

  /* ---------- music: [midi|null, eighths] ---------- */
  const MELODY = [
    [62, 2], [65, 1], [67, 1], [69, 2], [67, 1], [65, 1],
    [64, 2], [62, 1], [64, 1], [65, 2], [64, 1], [62, 1],
    [60, 2], [62, 1], [64, 1], [65, 2], [67, 1], [69, 1],
    [67, 3], [65, 1], [64, 2], [61, 2],
    [69, 2], [72, 1], [70, 1], [69, 2], [67, 1], [65, 1],
    [67, 2], [69, 1], [67, 1], [65, 2], [64, 1], [65, 1],
    [62, 2], [64, 1], [65, 1], [67, 1], [65, 1], [64, 1], [60, 1],
    [62, 6], [null, 2],
  ];
  const BASS = [38, 36, 41, 33, 41, 36, 34, 38]; // one root per bar
  const EIGHTH = 60 / 132 / 2;

  // Expand melody into a per-eighth lookup: note starts only.
  const lead = [];
  MELODY.forEach(([n, len]) => { lead.push([n, len]); for (let i = 1; i < len; i++) lead.push(null); });
  const LOOP = lead.length; // 64 eighths = 8 bars

  function scheduleStep(i, t) {
    const at = t - ctx.currentTime;
    const ev = lead[i];
    if (ev && ev[0] !== null) tone(midi(ev[0]), at, ev[1] * EIGHTH * 0.9, { vol: 0.09, bus: musicBus });
    const root = BASS[Math.floor(i / 8)];
    tone(midi(root + (i % 2 ? 12 : 0)), at, EIGHTH * 0.8, { type: 'triangle', vol: 0.35, bus: musicBus });
    if (i % 4 === 0) tone(120, at, 0.12, { type: 'sine', vol: 0.4, slide: 40, bus: musicBus });
    if (i % 4 === 2) noise(at, 0.08, { vol: 0.18, freq: 3000, type: 'highpass', bus: musicBus });
  }

  function scheduler() {
    while (nextNoteTime < ctx.currentTime + 0.12) {
      scheduleStep(step, nextNoteTime);
      nextNoteTime += EIGHTH;
      step = (step + 1) % LOOP;
    }
  }

  function setMusic(on) {
    musicOn = on;
    if (on) {
      if (!ensure()) return;
      step = 0;
      nextNoteTime = ctx.currentTime + 0.05;
      clearInterval(seqTimer);
      seqTimer = setInterval(scheduler, 25);
    } else {
      clearInterval(seqTimer);
      seqTimer = null;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  return {
    unlock: ensure,
    sfx,
    get sfxOn() { return sfxOn; },
    set sfxOn(v) { sfxOn = v; },
    get musicOn() { return musicOn; },
    setMusic,
  };
})();
