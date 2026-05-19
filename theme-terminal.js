/* ============================================================
   ORBITAL TERMINAL THEME — theme-terminal.js
   Space station audio-only soundscape for sorcrpg.com
   Exposes: window.terminalTheme = { start, stop }
   NO canvas, NO drawing, NO requestAnimationFrame.
   Pure Web Audio API engine.
   ============================================================ */
(function () {
  'use strict';

  /* ── AUDIO STATE ── */
  var audioCtx = null;
  var audioStarted = false;
  var masterGain = null;

  /* Track all timeout IDs so we can cancel on stop */
  var timeouts = [];

  /* Track all GainNodes for fade-out on stop */
  var allGains = [];

  /* Track all oscillators and noise sources for disconnect on stop */
  var allSources = [];

  /* ── HELPERS ── */
  function rnd(min, max) {
    return min + Math.random() * (max - min);
  }

  function rndInt(min, max) {
    return Math.floor(rnd(min, max + 1));
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function sched(fn, minS, maxS) {
    var id = setTimeout(fn, rnd(minS, maxS) * 1000);
    timeouts.push(id);
    return id;
  }

  /* Create white noise buffer (2 seconds, looped) */
  function makeNoiseBuffer() {
    if (!audioCtx) return null;
    var frames = audioCtx.sampleRate * 2;
    var buf = audioCtx.createBuffer(1, frames, audioCtx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /* Start a looping noise source */
  function makeLoopingNoise(buffer) {
    var src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    allSources.push(src);
    return src;
  }

  /* Make a one-shot noise buffer of given seconds */
  function makeOneShotNoise(durationS) {
    var frames = Math.floor(audioCtx.sampleRate * durationS);
    var buf = audioCtx.createBuffer(1, frames, audioCtx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /* Convenience: create + register an oscillator */
  function makeOsc(type, freq) {
    var osc = audioCtx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq || 440;
    allSources.push(osc);
    return osc;
  }

  /* Convenience: create + register a gain node */
  function makeGain(value) {
    var g = audioCtx.createGain();
    g.gain.value = (value !== undefined) ? value : 1;
    allGains.push(g);
    return g;
  }

  /* Convenience: create a biquad filter */
  function makeFilter(type, freq, q) {
    var f = audioCtx.createBiquadFilter();
    f.type = type || 'lowpass';
    f.frequency.value = freq || 1000;
    if (q !== undefined) f.Q.value = q;
    return f;
  }

  /* ── AMBIENT BED 1: Machinery hum ── */
  function startMachineryHum() {
    var noiseBuffer = makeNoiseBuffer(); // unused here but consistent
    var baseFreqs = [57, 60, 63];
    var harmGain = makeGain(0.015);
    harmGain.connect(masterGain);
    var harmOsc = makeOsc('sine', 120);
    harmOsc.connect(harmGain);
    harmOsc.start();

    baseFreqs.forEach(function (baseF, idx) {
      var osc = makeOsc('sine', baseF);
      var gainNode = makeGain(0.05);
      osc.connect(gainNode);
      gainNode.connect(masterGain);
      osc.start();

      /* Pitch LFO: 0.03–0.07 Hz, ±2 Hz deviation */
      var pitchLfoRate = rnd(0.03, 0.07);
      var pitchLfo = makeOsc('sine', pitchLfoRate);
      var pitchDepth = makeGain(2); // ±2 Hz
      pitchLfo.connect(pitchDepth);
      pitchDepth.connect(osc.frequency);
      pitchLfo.start();

      /* Amplitude LFO: independent rate, ±15% of base gain 0.05 */
      var ampLfoRate = rnd(0.03, 0.07);
      var ampLfo = makeOsc('sine', ampLfoRate);
      /* offset ampLfo phase by staggering start slightly */
      var ampDepth = makeGain(0.0075); // 15% of 0.05
      ampLfo.connect(ampDepth);
      ampDepth.connect(gainNode.gain);
      ampLfo.start();
    });
  }

  /* ── AMBIENT BED 2: Air recycling system ── */
  function startAirRecycling() {
    var noiseBuf = makeNoiseBuffer();
    var noiseSrc = makeLoopingNoise(noiseBuf);
    var lpf = makeFilter('lowpass', 280, 0.8);
    var gainNode = makeGain(0.018);

    noiseSrc.connect(lpf);
    lpf.connect(gainNode);
    gainNode.connect(masterGain);
    noiseSrc.start();

    /* Very slow amplitude swell: 0.025 Hz LFO, depth 0.6 of base */
    var lfo = makeOsc('sine', 0.025);
    var lfoDepth = makeGain(0.018 * 0.6); // depth = 60% of base gain
    lfo.connect(lfoDepth);
    lfoDepth.connect(gainNode.gain);
    lfo.start();
  }

  /* ── AMBIENT BED 3: Electrical hum + occasional spikes ── */
  function startElectricalHum() {
    [50, 100].forEach(function (freq) {
      var osc = makeOsc('sine', freq);
      var g = makeGain(0.008);
      osc.connect(g);
      g.connect(masterGain);
      osc.start();
    });

    /* Occasional brief amplitude spike */
    function scheduleSpike() {
      sched(function () {
        if (!audioCtx || !masterGain) return;
        var now = audioCtx.currentTime;
        /* Create a tiny sine burst at 50Hz with spike gain */
        var osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 50;
        var g = audioCtx.createGain();
        g.gain.setValueAtTime(0.038, now);
        g.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.1);
        scheduleSpike();
      }, 30, 80);
    }
    scheduleSpike();
  }

  /* ── EVENT 4: Pressure door ── */
  function schedulePressureDoor() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;
      var freq = rnd(80, 110);

      /* Low thump */
      var osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0.18, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.42);

      /* Metallic hiss immediately after */
      var noiseBuf = makeOneShotNoise(0.3);
      var noiseSrc = audioCtx.createBufferSource();
      noiseSrc.buffer = noiseBuf;
      var bpf = makeFilter('bandpass', 1200, 4);
      var hissGain = audioCtx.createGain();
      hissGain.gain.setValueAtTime(0.06, now + 0.05);
      hissGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      noiseSrc.connect(bpf);
      bpf.connect(hissGain);
      hissGain.connect(masterGain);
      noiseSrc.start(now + 0.05);

      schedulePressureDoor();
    }, 18, 45);
  }

  /* ── EVENT 5: Hydraulic clank ── */
  function scheduleHydraulicClank() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;
      var gap = rnd(0.08, 0.15);

      /* Short delay node for subtle reverb feel */
      function clank(startAt) {
        var freq = rnd(200, 400);
        var osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        var g = audioCtx.createGain();
        g.gain.setValueAtTime(0, startAt);
        g.gain.linearRampToValueAtTime(0.12, startAt + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.17);

        /* Simple delay for reverb */
        var delay = audioCtx.createDelay(0.3);
        delay.delayTime.value = 0.045;
        var delayGain = audioCtx.createGain();
        delayGain.gain.value = 0.25;

        osc.connect(g);
        g.connect(masterGain);
        g.connect(delay);
        delay.connect(delayGain);
        delayGain.connect(masterGain);

        osc.start(startAt);
        osc.stop(startAt + 0.2);
      }

      clank(now);
      clank(now + gap);

      scheduleHydraulicClank();
    }, 25, 60);
  }

  /* ── EVENT 6: Computer terminal beep sequence ── */
  function scheduleBeepSequence() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;
      var freqs = [880, 1047, 1175, 1319, 1397, 1568];
      var count = rndInt(3, 6);
      var cursor = now;

      for (var i = 0; i < count; i++) {
        var freq = pick(freqs) * rnd(0.97, 1.03); // slight pitch variation
        var dur = rnd(0.06, 0.12);
        var gap = rnd(0.05, 0.18);

        (function (f, start, d) {
          var osc = audioCtx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = f;
          var g = audioCtx.createGain();
          g.gain.setValueAtTime(0.055 * rnd(0.8, 1.2), start);
          g.gain.setValueAtTime(0.055 * rnd(0.8, 1.2), start + d - 0.005);
          g.gain.linearRampToValueAtTime(0, start + d);
          osc.connect(g);
          g.connect(masterGain);
          osc.start(start);
          osc.stop(start + d + 0.01);
        })(freq, cursor, dur);

        cursor += dur + gap;
      }

      scheduleBeepSequence();
    }, 35, 90);
  }

  /* ── EVENT 7: Intercom crackle ── */
  function scheduleIntercomCrackle() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;

      function crackleBurst(startAt, durationS) {
        var buf = makeOneShotNoise(durationS);
        var src = audioCtx.createBufferSource();
        src.buffer = buf;
        var bpf = makeFilter('bandpass', rnd(700, 900), rnd(1.5, 2.5));
        var g = audioCtx.createGain();
        g.gain.setValueAtTime(0.04 * rnd(0.8, 1.2), startAt);
        g.gain.exponentialRampToValueAtTime(0.0001, startAt + durationS);
        src.connect(bpf);
        bpf.connect(g);
        g.connect(masterGain);
        src.start(startAt);
      }

      crackleBurst(now, 0.08);
      crackleBurst(now + 0.18, 0.05);

      scheduleIntercomCrackle();
    }, 50, 120);
  }

  /* ── EVENT 8: Distant explosion/impact ── */
  function scheduleDistantImpact() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;

      /* Deep sine sweep 40→20 Hz */
      var osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(40, now);
      osc.frequency.linearRampToValueAtTime(20, now + 0.8);
      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0.025, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.9);

      /* High-frequency rattle simultaneously */
      var rattleBuf = makeOneShotNoise(0.3);
      var rattleSrc = audioCtx.createBufferSource();
      rattleSrc.buffer = rattleBuf;
      var bpf = makeFilter('bandpass', 2000, 3);
      var rattleGain = audioCtx.createGain();
      rattleGain.gain.setValueAtTime(0.015, now);
      rattleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      rattleSrc.connect(bpf);
      bpf.connect(rattleGain);
      rattleGain.connect(masterGain);
      rattleSrc.start(now);

      scheduleDistantImpact();
    }, 90, 180);
  }

  /* ── EVENT 9: Hull stress creak ── */
  function scheduleHullCreak() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;

      var startFreq = rnd(180, 240);
      var endFreq = rnd(60, 100);
      var dur = rnd(0.5, 0.7);

      var osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);

      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0.035 * rnd(0.85, 1.15), now);
      g.gain.linearRampToValueAtTime(0.025, now + dur * 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.05);

      osc.connect(g);
      g.connect(masterGain);
      osc.start(now);
      osc.stop(now + dur + 0.08);

      scheduleHullCreak();
    }, 60, 150);
  }

  /* ── EVENT 10: Alert ping (40% chance) ── */
  function scheduleAlertPing() {
    sched(function () {
      if (!audioCtx || !masterGain) return;

      if (Math.random() < 0.4) {
        var now = audioCtx.currentTime;
        var gain = 0.04 * rnd(0.85, 1.15);

        function pingTone(freq, startAt, dur) {
          var osc = audioCtx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = freq * rnd(0.98, 1.02);
          var g = audioCtx.createGain();
          g.gain.setValueAtTime(gain, startAt);
          g.gain.setValueAtTime(gain, startAt + dur - 0.01);
          g.gain.linearRampToValueAtTime(0, startAt + dur);
          osc.connect(g);
          g.connect(masterGain);
          osc.start(startAt);
          osc.stop(startAt + dur + 0.01);
        }

        pingTone(1760, now, 0.15);
        pingTone(1318, now + 0.17, 0.15);
      }

      scheduleAlertPing();
    }, 70, 160);
  }

  /* ── EVENT 11: Footsteps on grating ── */
  function scheduleFootsteps() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;
      var count = rndInt(4, 7);
      var cursor = now;

      for (var i = 0; i < count; i++) {
        var spacing = rnd(0.12, 0.22);
        (function (startAt) {
          var buf = makeOneShotNoise(0.02);
          var src = audioCtx.createBufferSource();
          src.buffer = buf;
          var hpf = makeFilter('highpass', rnd(2800, 3200));
          var g = audioCtx.createGain();
          g.gain.setValueAtTime(rnd(0.04, 0.08), startAt);
          g.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.018);
          src.connect(hpf);
          hpf.connect(g);
          g.connect(masterGain);
          src.start(startAt);
        })(cursor);
        cursor += spacing;
      }

      scheduleFootsteps();
    }, 30, 70);
  }

  /* ── START AUDIO ── */
  function startAudio() {
    if (audioStarted) return;

    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      return;
    }

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 1.0;
    masterGain.connect(audioCtx.destination);
    allGains.push(masterGain);

    /* Start all ambient beds */
    startMachineryHum();
    startAirRecycling();
    startElectricalHum();

    /* Schedule all random events */
    schedulePressureDoor();
    scheduleHydraulicClank();
    scheduleBeepSequence();
    scheduleIntercomCrackle();
    scheduleDistantImpact();
    scheduleHullCreak();
    scheduleAlertPing();
    scheduleFootsteps();

    audioStarted = true;
  }

  /* ── STOP AUDIO ── */
  function stopAudio() {
    if (!audioStarted) return;

    /* Cancel all pending timeouts */
    timeouts.forEach(function (id) { clearTimeout(id); });
    timeouts = [];

    /* Fade out master gain then close context */
    if (masterGain && audioCtx) {
      var now = audioCtx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(0, now + 0.3);
    }

    /* Disconnect everything after fade */
    var ctx = audioCtx;
    setTimeout(function () {
      allSources.forEach(function (src) {
        try { src.stop(); } catch (e) {}
        try { src.disconnect(); } catch (e) {}
      });
      allGains.forEach(function (g) {
        try { g.disconnect(); } catch (e) {}
      });
      if (ctx) {
        try { ctx.close(); } catch (e) {}
      }
    }, 350);

    audioCtx = null;
    masterGain = null;
    audioStarted = false;
    allSources = [];
    allGains = [];
  }

  /* ── LAZY INIT ON FIRST USER INTERACTION ── */
  var interactionHandlerAdded = false;
  var themeActive = false;

  function onUserInteraction() {
    if (themeActive && !audioStarted) {
      startAudio();
    }
  }

  function addInteractionListeners() {
    if (interactionHandlerAdded) return;
    interactionHandlerAdded = true;
    ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(function (evt) {
      document.addEventListener(evt, onUserInteraction, { once: false, passive: true });
    });
  }

  function removeInteractionListeners() {
    ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(function (evt) {
      document.removeEventListener(evt, onUserInteraction);
    });
    interactionHandlerAdded = false;
  }

  /* ── PUBLIC API ── */
  function start() {
    themeActive = true;
    addInteractionListeners();
    /* Attempt immediate start in case context already unlocked */
    if (!audioStarted) {
      startAudio();
    }
  }

  function stop() {
    themeActive = false;
    removeInteractionListeners();
    stopAudio();
  }

  window.terminalTheme = { start: start, stop: stop };

})();
