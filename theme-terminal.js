/* ============================================================
   ORBITAL TERMINAL THEME — theme-terminal.js
   Space station audio-only soundscape for sorcrpg.com
   Exposes: window.terminalTheme = { start, stop }
   ============================================================ */
(function () {
  'use strict';

  var audioCtx = null;
  var audioStarted = false;
  var masterGain = null;
  var timeouts = [];
  var allGains = [];
  var allSources = [];

  function rnd(min, max) { return min + Math.random() * (max - min); }
  function rndInt(min, max) { return Math.floor(rnd(min, max + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function sched(fn, minS, maxS) {
    var id = setTimeout(fn, rnd(minS, maxS) * 1000);
    timeouts.push(id);
    return id;
  }

  function makeNoiseBuffer() {
    var frames = audioCtx.sampleRate * 2;
    var buf = audioCtx.createBuffer(1, frames, audioCtx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function makeOneShotNoise(dur) {
    var frames = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
    var buf = audioCtx.createBuffer(1, frames, audioCtx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function makeLoopingNoise(buf) {
    var src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    allSources.push(src);
    return src;
  }

  function makeOsc(type, freq) {
    var osc = audioCtx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq || 440;
    allSources.push(osc);
    return osc;
  }

  function makeGain(value) {
    var g = audioCtx.createGain();
    g.gain.value = (value !== undefined) ? value : 1;
    allGains.push(g);
    return g;
  }

  function makeFilter(type, freq, q) {
    var f = audioCtx.createBiquadFilter();
    f.type = type || 'lowpass';
    f.frequency.value = freq || 1000;
    if (q !== undefined) f.Q.value = q;
    return f;
  }

  /* ── AMBIENT BED 1: Station machinery hum — steady, no LFO swell ── */
  function startMachineryHum() {
    /* Harmonic series: 55 Hz fundamental + overtones — sounds mechanical, not oceanic */
    [55, 110, 165].forEach(function (freq, idx) {
      var gain = idx === 0 ? 0.038 : idx === 1 ? 0.016 : 0.008;
      var osc = makeOsc('sine', freq);
      var g = makeGain(gain);
      osc.connect(g);
      g.connect(masterGain);

      /* Tiny pitch drift only — imperceptible as modulation, just prevents static feel */
      var pitchLfo = makeOsc('sine', rnd(0.008, 0.018));
      var pitchDepth = makeGain(0.3);
      pitchLfo.connect(pitchDepth);
      pitchDepth.connect(osc.frequency);
      pitchLfo.start();
      osc.start();
    });

    /* Second harmonic cluster at 60 Hz power supply frequency */
    [60, 120].forEach(function (freq) {
      var osc = makeOsc('sine', freq);
      var g = makeGain(0.007);
      osc.connect(g);
      g.connect(masterGain);
      osc.start();
    });
  }

  /* ── AMBIENT BED 2: Air recycling — constant filtered noise, no swell ── */
  function startAirRecycling() {
    var src = makeLoopingNoise(makeNoiseBuffer());
    var lpf = makeFilter('lowpass', 240, 0.7);
    var g = makeGain(0.014);
    src.connect(lpf);
    lpf.connect(g);
    g.connect(masterGain);
    src.start();
  }

  /* ── EVENT: Pressure door thump + hiss ── */
  function schedulePressureDoor() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;

      var osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = rnd(75, 105);
      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0.16, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
      osc.connect(g); g.connect(masterGain);
      osc.start(now); osc.stop(now + 0.42);

      var noiseSrc = audioCtx.createBufferSource();
      noiseSrc.buffer = makeOneShotNoise(0.32);
      var bpf = makeFilter('bandpass', rnd(1000, 1400), 4);
      var hg = audioCtx.createGain();
      hg.gain.setValueAtTime(0.055, now + 0.06);
      hg.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
      noiseSrc.connect(bpf); bpf.connect(hg); hg.connect(masterGain);
      noiseSrc.start(now + 0.06);

      schedulePressureDoor();
    }, 22, 55);
  }

  /* ── EVENT: Hydraulic clank with short room reverb ── */
  function scheduleHydraulicClank() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;

      function clank(startAt) {
        var osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = rnd(220, 380);
        var g = audioCtx.createGain();
        g.gain.setValueAtTime(0, startAt);
        g.gain.linearRampToValueAtTime(0.11, startAt + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.16);

        var delay = audioCtx.createDelay(0.3);
        delay.delayTime.value = 0.04;
        var delayG = audioCtx.createGain();
        delayG.gain.value = 0.22;

        osc.connect(g);
        g.connect(masterGain);
        g.connect(delay);
        delay.connect(delayG);
        delayG.connect(masterGain);
        osc.start(startAt); osc.stop(startAt + 0.2);
      }

      clank(now);
      clank(now + rnd(0.09, 0.18));
      scheduleHydraulicClank();
    }, 28, 65);
  }

  /* ── EVENT: Computer beep sequence ── */
  function scheduleBeepSequence() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;
      var freqs = [880, 1047, 1175, 1319, 1397, 1568, 1760];
      var count = rndInt(3, 6);
      var cursor = now;

      for (var i = 0; i < count; i++) {
        (function (f, start, dur) {
          var osc = audioCtx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = f * rnd(0.98, 1.02);
          var g = audioCtx.createGain();
          g.gain.setValueAtTime(0.05 * rnd(0.8, 1.2), start);
          g.gain.setValueAtTime(0.05 * rnd(0.8, 1.2), start + dur - 0.005);
          g.gain.linearRampToValueAtTime(0, start + dur);
          osc.connect(g); g.connect(masterGain);
          osc.start(start); osc.stop(start + dur + 0.01);
        })(pick(freqs), cursor, rnd(0.065, 0.12));
        cursor += rnd(0.07, 0.2);
      }

      scheduleBeepSequence();
    }, 30, 85);
  }

  /* ── EVENT: Intercom crackle burst ── */
  function scheduleIntercomCrackle() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;

      function burst(startAt, dur) {
        var src = audioCtx.createBufferSource();
        src.buffer = makeOneShotNoise(dur);
        var bpf = makeFilter('bandpass', rnd(700, 950), rnd(1.5, 2.5));
        var g = audioCtx.createGain();
        g.gain.setValueAtTime(0.038 * rnd(0.8, 1.2), startAt);
        g.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
        src.connect(bpf); bpf.connect(g); g.connect(masterGain);
        src.start(startAt);
      }

      burst(now, 0.08);
      burst(now + 0.2, 0.06);
      scheduleIntercomCrackle();
    }, 45, 110);
  }

  /* ── EVENT: Spacecraft flyby — Doppler noise sweep ── */
  function scheduleShipFlyby() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;

      var isLarge = Math.random() < 0.35;
      var dur = isLarge ? rnd(5, 9) : rnd(1.8, 3.5);
      var startFreq = isLarge ? rnd(1200, 2200) : rnd(3500, 5500);
      var endFreq   = isLarge ? rnd(150,  350)  : rnd(700, 1400);
      var peakGain  = isLarge ? rnd(0.10, 0.14) : rnd(0.055, 0.085);
      var Q         = isLarge ? 1.4 : 2.2;

      var src = audioCtx.createBufferSource();
      src.buffer = makeOneShotNoise(dur + 0.5);

      var bpf = audioCtx.createBiquadFilter();
      bpf.type = 'bandpass';
      bpf.frequency.setValueAtTime(startFreq, now);
      bpf.frequency.exponentialRampToValueAtTime(endFreq, now + dur);
      bpf.Q.value = Q;

      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.exponentialRampToValueAtTime(peakGain, now + dur * 0.28);
      g.gain.setValueAtTime(peakGain, now + dur * 0.52);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);

      src.connect(bpf); bpf.connect(g); g.connect(masterGain);
      src.start(now);

      scheduleShipFlyby();
    }, 18, 55);
  }

  /* ── EVENT: Hull stress creak ── */
  function scheduleHullCreak() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;
      var dur = rnd(0.5, 0.75);

      var osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(rnd(170, 230), now);
      osc.frequency.exponentialRampToValueAtTime(rnd(55, 90), now + dur);
      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0.032 * rnd(0.85, 1.15), now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.05);
      osc.connect(g); g.connect(masterGain);
      osc.start(now); osc.stop(now + dur + 0.08);

      scheduleHullCreak();
    }, 55, 140);
  }

  /* ── EVENT: Alert ping (40% chance) ── */
  function scheduleAlertPing() {
    sched(function () {
      if (!audioCtx || !masterGain) return;

      if (Math.random() < 0.4) {
        var now = audioCtx.currentTime;
        var gain = 0.038 * rnd(0.85, 1.15);

        function ping(freq, startAt, dur) {
          var osc = audioCtx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = freq * rnd(0.98, 1.02);
          var g = audioCtx.createGain();
          g.gain.setValueAtTime(gain, startAt);
          g.gain.setValueAtTime(gain, startAt + dur - 0.01);
          g.gain.linearRampToValueAtTime(0, startAt + dur);
          osc.connect(g); g.connect(masterGain);
          osc.start(startAt); osc.stop(startAt + dur + 0.01);
        }

        ping(1760, now, 0.14);
        ping(1318, now + 0.16, 0.14);
      }

      scheduleAlertPing();
    }, 65, 150);
  }

  /* ── EVENT: Footsteps on metal grating ── */
  function scheduleFootsteps() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;
      var count = rndInt(4, 8);
      var cursor = now;

      for (var i = 0; i < count; i++) {
        (function (startAt) {
          var src = audioCtx.createBufferSource();
          src.buffer = makeOneShotNoise(0.022);
          var hpf = makeFilter('highpass', rnd(2600, 3300));
          var g = audioCtx.createGain();
          g.gain.setValueAtTime(rnd(0.038, 0.072), startAt);
          g.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.02);
          src.connect(hpf); hpf.connect(g); g.connect(masterGain);
          src.start(startAt);
        })(cursor);
        cursor += rnd(0.12, 0.24);
      }

      scheduleFootsteps();
    }, 28, 65);
  }

  /* ── EVENT: Distant structural impact ── */
  function scheduleDistantImpact() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;

      var osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(38, now);
      osc.frequency.linearRampToValueAtTime(18, now + 0.8);
      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0.022, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
      osc.connect(g); g.connect(masterGain);
      osc.start(now); osc.stop(now + 0.9);

      scheduleDistantImpact();
    }, 80, 200);
  }

  /* ── START ── */
  function startAudio() {
    if (audioStarted) return;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { return; }

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 1.0;
    masterGain.connect(audioCtx.destination);
    allGains.push(masterGain);

    startMachineryHum();
    startAirRecycling();

    schedulePressureDoor();
    scheduleHydraulicClank();
    scheduleBeepSequence();
    scheduleIntercomCrackle();
    scheduleShipFlyby();
    scheduleHullCreak();
    scheduleAlertPing();
    scheduleFootsteps();
    scheduleDistantImpact();

    audioStarted = true;
  }

  /* ── STOP ── */
  function stopAudio() {
    if (!audioStarted) return;
    timeouts.forEach(function (id) { clearTimeout(id); });
    timeouts = [];

    if (masterGain && audioCtx) {
      var now = audioCtx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(0, now + 0.3);
    }

    var ctx = audioCtx;
    setTimeout(function () {
      allSources.forEach(function (s) { try { s.stop(); } catch(e){} try { s.disconnect(); } catch(e){} });
      allGains.forEach(function (g) { try { g.disconnect(); } catch(e){} });
      if (ctx) { try { ctx.close(); } catch(e){} }
    }, 350);

    audioCtx = null; masterGain = null; audioStarted = false;
    allSources = []; allGains = [];
  }

  var interactionHandlerAdded = false;
  var themeActive = false;

  function onUserInteraction() {
    if (themeActive && !audioStarted) startAudio();
  }

  function addInteractionListeners() {
    if (interactionHandlerAdded) return;
    interactionHandlerAdded = true;
    ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(function (e) {
      document.addEventListener(e, onUserInteraction, { once: false, passive: true });
    });
  }

  function removeInteractionListeners() {
    ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(function (e) {
      document.removeEventListener(e, onUserInteraction);
    });
    interactionHandlerAdded = false;
  }

  function start() {
    themeActive = true;
    addInteractionListeners();
    if (!audioStarted) startAudio();
  }

  function stop() {
    themeActive = false;
    removeInteractionListeners();
    stopAudio();
  }

  window.terminalTheme = { start: start, stop: stop };
})();
