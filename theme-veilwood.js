/* ============================================================
   VEILWOOD THEME — theme-veilwood.js
   Living forest audio-only soundscape for sorcrpg.com
   Exposes: window.veilwoodTheme = { start, stop }
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

  /* Make a one-shot noise buffer of given seconds */
  function makeOneShotNoise(durationS) {
    var frames = Math.max(1, Math.floor(audioCtx.sampleRate * durationS));
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

  /* ── AMBIENT BED 1: Wind through canopy (three independent noise layers) ── */
  function startWindCanopy() {
    var noiseBuf = makeNoiseBuffer();

    /* Layer 1: low-mid, 200Hz cutoff */
    (function () {
      var src = makeLoopingNoise(noiseBuf);
      var lpf = makeFilter('lowpass', 200);
      var g = makeGain(0.025);
      var lfo = makeOsc('sine', 0.04);
      var lfoDepth = makeGain(0.012);

      src.connect(lpf);
      lpf.connect(g);
      g.connect(masterGain);
      lfo.connect(lfoDepth);
      lfoDepth.connect(g.gain);
      src.start();
      lfo.start();
    })();

    /* Layer 2: mid, 600Hz cutoff, Q 0.6, phase-offset LFO */
    (function () {
      /* Use a fresh noise buffer so layers are independent */
      var frames = audioCtx.sampleRate * 2;
      var buf2 = audioCtx.createBuffer(1, frames, audioCtx.sampleRate);
      var d = buf2.getChannelData(0);
      for (var i = 0; i < frames; i++) d[i] = Math.random() * 2 - 1;

      var src = audioCtx.createBufferSource();
      src.buffer = buf2;
      src.loop = true;
      allSources.push(src);

      var lpf = makeFilter('lowpass', 600, 0.6);
      var g = makeGain(0.012);
      var lfo = makeOsc('sine', 0.07);
      var lfoDepth = makeGain(0.006);

      /* Phase offset: delay LFO start slightly */
      src.connect(lpf);
      lpf.connect(g);
      g.connect(masterGain);
      lfo.connect(lfoDepth);
      lfoDepth.connect(g.gain);
      src.start();
      lfo.start(audioCtx.currentTime + 2.3); /* phase offset */
    })();

    /* Layer 3: deep rumble, 80Hz cutoff */
    (function () {
      var frames = audioCtx.sampleRate * 2;
      var buf3 = audioCtx.createBuffer(1, frames, audioCtx.sampleRate);
      var d = buf3.getChannelData(0);
      for (var i = 0; i < frames; i++) d[i] = Math.random() * 2 - 1;

      var src = audioCtx.createBufferSource();
      src.buffer = buf3;
      src.loop = true;
      allSources.push(src);

      var lpf = makeFilter('lowpass', 80);
      var g = makeGain(0.035);
      var lfo = makeOsc('sine', rnd(0.025, 0.05));
      var lfoDepth = makeGain(0.018);

      src.connect(lpf);
      lpf.connect(g);
      g.connect(masterGain);
      lfo.connect(lfoDepth);
      lfoDepth.connect(g.gain);
      src.start();
      lfo.start(audioCtx.currentTime + 5.1); /* phase offset */
    })();
  }

  /* ── AMBIENT BED 2: Forest floor insects (cricket/cicada texture) ── */
  function startInsects() {
    var noiseBuf = makeNoiseBuffer();
    var src = makeLoopingNoise(noiseBuf);
    var bpf = makeFilter('bandpass', 4800, 15);
    var g = makeGain(0.014);

    /* AM at 22Hz for chirp texture */
    var amOsc = makeOsc('sine', 22);
    var amDepth = makeGain(0.007);

    src.connect(bpf);
    bpf.connect(g);
    g.connect(masterGain);

    /* AM modulation: add modulator to gain */
    amOsc.connect(amDepth);
    amDepth.connect(g.gain);
    src.start();
    amOsc.start();
  }

  /* ── AMBIENT BED 3: Distant stream (six sine oscillators) ── */
  function startStream() {
    for (var i = 0; i < 6; i++) {
      (function () {
        var freq = rnd(300, 900);
        var osc = makeOsc('sine', freq);
        var g = makeGain(0.006);
        var lfoRate = rnd(8, 14);
        var lfo = makeOsc('sine', lfoRate);
        var lfoDepth = makeGain(0.006 * 0.7); /* depth 0.7 of base */

        osc.connect(g);
        g.connect(masterGain);
        lfo.connect(lfoDepth);
        lfoDepth.connect(g.gain);
        osc.start();
        /* Stagger LFO starts for non-synchronized babbling */
        lfo.start(audioCtx.currentTime + i * 0.7);
      })();
    }
  }

  /* ── EVENT 4: Robin-like bird ── */
  function scheduleRobin() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;
      var gain = 0.065 * rnd(0.85, 1.15);

      /* First phrase: descending 2400→1600 over 0.35s */
      (function () {
        var osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(rnd(2200, 2600), now);
        osc.frequency.exponentialRampToValueAtTime(rnd(1500, 1700), now + 0.35);

        /* Slight vibrato */
        var vibOsc = audioCtx.createOscillator();
        vibOsc.type = 'sine';
        vibOsc.frequency.value = rnd(5, 8);
        var vibDepth = audioCtx.createGain();
        vibDepth.gain.value = rnd(15, 35);
        vibOsc.connect(vibDepth);
        vibDepth.connect(osc.frequency);

        var g = audioCtx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(gain, now + 0.04);
        g.gain.setValueAtTime(gain, now + 0.3);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

        osc.connect(g);
        g.connect(masterGain);
        vibOsc.start(now);
        osc.start(now);
        osc.stop(now + 0.4);
        vibOsc.stop(now + 0.4);
      })();

      /* Second phrase: 1800→1200 over 0.25s, starts after brief gap */
      var gap = rnd(0.08, 0.18);
      (function () {
        var start2 = now + 0.35 + gap;
        var osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(rnd(1700, 1900), start2);
        osc.frequency.exponentialRampToValueAtTime(rnd(1100, 1300), start2 + 0.25);

        var vibOsc = audioCtx.createOscillator();
        vibOsc.type = 'sine';
        vibOsc.frequency.value = rnd(5, 8);
        var vibDepth = audioCtx.createGain();
        vibDepth.gain.value = rnd(10, 25);
        vibOsc.connect(vibDepth);
        vibDepth.connect(osc.frequency);

        var g = audioCtx.createGain();
        g.gain.setValueAtTime(0, start2);
        g.gain.linearRampToValueAtTime(gain * 0.85, start2 + 0.03);
        g.gain.setValueAtTime(gain * 0.85, start2 + 0.2);
        g.gain.exponentialRampToValueAtTime(0.0001, start2 + 0.28);

        osc.connect(g);
        g.connect(masterGain);
        vibOsc.start(start2);
        osc.start(start2);
        osc.stop(start2 + 0.3);
        vibOsc.stop(start2 + 0.3);
      })();

      scheduleRobin();
    }, 12, 30);
  }

  /* ── EVENT 5: Warbler ── */
  function scheduleWarbler() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;
      var baseFreq = rnd(3000, 3400);
      var dur = rnd(0.4, 0.7);
      var lfoRate = rnd(18, 24);
      var gain = 0.055 * rnd(0.85, 1.15);

      var osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);

      var lfo = audioCtx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = lfoRate;
      var lfoDepth = audioCtx.createGain();
      lfoDepth.gain.value = 400;

      lfo.connect(lfoDepth);
      lfoDepth.connect(osc.frequency);

      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(gain, now + 0.04);
      g.gain.setValueAtTime(gain, now + dur - 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.02);

      osc.connect(g);
      g.connect(masterGain);
      lfo.start(now);
      osc.start(now);
      osc.stop(now + dur + 0.04);
      lfo.stop(now + dur + 0.04);

      scheduleWarbler();
    }, 20, 50);
  }

  /* ── EVENT 6: Owl hoot (50% chance) ── */
  function scheduleOwl() {
    sched(function () {
      if (!audioCtx || !masterGain) return;

      if (Math.random() < 0.5) {
        var now = audioCtx.currentTime;
        var freq = 220 + rnd(-15, 15);
        var gain = 0.07 * rnd(0.85, 1.15);

        function hoot(startAt) {
          var osc = audioCtx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = freq;

          /* AM at 2.5 Hz */
          var amOsc = audioCtx.createOscillator();
          amOsc.type = 'sine';
          amOsc.frequency.value = 2.5;
          var amDepth = audioCtx.createGain();
          amDepth.gain.value = gain * 0.3;
          amOsc.connect(amDepth);

          var g = audioCtx.createGain();
          g.gain.setValueAtTime(0, startAt);
          g.gain.linearRampToValueAtTime(gain, startAt + 0.06);
          g.gain.setValueAtTime(gain, startAt + 0.44);
          g.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.52);

          amDepth.connect(g.gain);
          osc.connect(g);
          g.connect(masterGain);
          amOsc.start(startAt);
          osc.start(startAt);
          osc.stop(startAt + 0.55);
          amOsc.stop(startAt + 0.55);
        }

        hoot(now);
        hoot(now + 0.8); /* second hoot after pause */
      }

      scheduleOwl();
    }, 60, 140);
  }

  /* ── EVENT 7: Jay/crow call ── */
  function scheduleJayCrow() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;
      var freq = 600 + rnd(-80, 80);
      var gain = 0.06 * rnd(0.85, 1.15);

      for (var i = 0; i < 3; i++) {
        (function (startAt) {
          var osc = audioCtx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.value = freq * rnd(0.97, 1.03);

          var bpf = makeFilter('bandpass', 800, 3);

          var g = audioCtx.createGain();
          g.gain.setValueAtTime(0, startAt);
          g.gain.linearRampToValueAtTime(gain, startAt + 0.02);
          g.gain.setValueAtTime(gain, startAt + 0.13);
          g.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.16);

          osc.connect(bpf);
          bpf.connect(g);
          g.connect(masterGain);
          osc.start(startAt);
          osc.stop(startAt + 0.18);
        })(now + i * 0.27);
      }

      scheduleJayCrow();
    }, 45, 100);
  }

  /* ── EVENT 8: Woodpecker (60% chance) ── */
  function scheduleWoodpecker() {
    sched(function () {
      if (!audioCtx || !masterGain) return;

      if (Math.random() < 0.6) {
        var now = audioCtx.currentTime;
        var count = rndInt(6, 10);
        var cursor = now;

        for (var i = 0; i < count; i++) {
          (function (startAt) {
            var buf = makeOneShotNoise(0.02);
            var src = audioCtx.createBufferSource();
            src.buffer = buf;
            var hpf = makeFilter('highpass', rnd(1300, 1700));
            var g = audioCtx.createGain();
            g.gain.setValueAtTime(0.07 * rnd(0.85, 1.15), startAt);
            g.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.02);
            src.connect(hpf);
            hpf.connect(g);
            g.connect(masterGain);
            src.start(startAt);
          })(cursor);
          cursor += rnd(0.06, 0.09);
        }
      }

      scheduleWoodpecker();
    }, 50, 120);
  }

  /* ── EVENT 9: Leaf rustle gust ── */
  function scheduleLeafRustle() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;
      var dur = rnd(0.3, 0.8);
      var gainVal = rnd(0.03, 0.06);

      var buf = makeOneShotNoise(dur + 0.1);
      var src = audioCtx.createBufferSource();
      src.buffer = buf;
      var bpf = makeFilter('bandpass', rnd(1000, 1400), rnd(1.2, 1.8));
      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(gainVal, now + dur * 0.15);
      g.gain.setValueAtTime(gainVal, now + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.05);
      src.connect(bpf);
      bpf.connect(g);
      g.connect(masterGain);
      src.start(now);

      scheduleLeafRustle();
    }, 8, 20);
  }

  /* ── EVENT 10: Frog croak (55% chance) ── */
  function scheduleFrogCroak() {
    sched(function () {
      if (!audioCtx || !masterGain) return;

      if (Math.random() < 0.55) {
        var now = audioCtx.currentTime;
        var freq = 180 + rnd(-20, 20);
        var gain = 0.06 * rnd(0.85, 1.15);

        function croak(startAt) {
          var osc = audioCtx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = freq * rnd(0.97, 1.03);

          /* AM at 6 Hz */
          var amOsc = audioCtx.createOscillator();
          amOsc.type = 'sine';
          amOsc.frequency.value = 6;
          var amDepth = audioCtx.createGain();
          amDepth.gain.value = gain * 0.4;
          amOsc.connect(amDepth);

          var g = audioCtx.createGain();
          g.gain.setValueAtTime(0, startAt);
          g.gain.linearRampToValueAtTime(gain, startAt + 0.03);
          g.gain.setValueAtTime(gain, startAt + 0.22);
          g.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.27);

          amDepth.connect(g.gain);
          osc.connect(g);
          g.connect(masterGain);
          amOsc.start(startAt);
          osc.start(startAt);
          osc.stop(startAt + 0.3);
          amOsc.stop(startAt + 0.3);
        }

        croak(now);
        croak(now + 0.45);
      }

      scheduleFrogCroak();
    }, 40, 90);
  }

  /* ── EVENT 11: Branch snap (45% chance) ── */
  function scheduleBranchSnap() {
    sched(function () {
      if (!audioCtx || !masterGain) return;

      if (Math.random() < 0.45) {
        var now = audioCtx.currentTime;
        var buf = makeOneShotNoise(0.05);
        var src = audioCtx.createBufferSource();
        src.buffer = buf;
        var lpf = makeFilter('lowpass', rnd(350, 450));
        var g = audioCtx.createGain();
        g.gain.setValueAtTime(0.09 * rnd(0.8, 1.2), now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
        src.connect(lpf);
        lpf.connect(g);
        g.connect(masterGain);
        src.start(now);
      }

      scheduleBranchSnap();
    }, 60, 150);
  }

  /* ── EVENT 12: Distant thunder (35% chance) ── */
  function scheduleDistantThunder() {
    sched(function () {
      if (!audioCtx || !masterGain) return;

      if (Math.random() < 0.35) {
        var now = audioCtx.currentTime;

        /* Deep sine sweep 40→15 Hz over 2s */
        var osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(40, now);
        osc.frequency.linearRampToValueAtTime(15, now + 2);
        var g = audioCtx.createGain();
        g.gain.setValueAtTime(0.022, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 2.1);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now);
        osc.stop(now + 2.2);

        /* White noise lowpass 100Hz, fades over 2.5s */
        var buf = makeOneShotNoise(2.6);
        var src = audioCtx.createBufferSource();
        src.buffer = buf;
        var lpf = makeFilter('lowpass', 100);
        var ng = audioCtx.createGain();
        ng.gain.setValueAtTime(0.018, now);
        ng.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
        src.connect(lpf);
        lpf.connect(ng);
        ng.connect(masterGain);
        src.start(now);
      }

      scheduleDistantThunder();
    }, 120, 300);
  }

  /* ── EVENT 13: Multiple bird chorus ── */
  function scheduleBirdChorus() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;
      var count = rndInt(3, 5);

      var birdTypes = [
        /* Robin-like */
        function (startAt) {
          var osc = audioCtx.createOscillator();
          osc.type = 'sine';
          var f1 = rnd(2000, 2800);
          var f2 = rnd(1400, 1800);
          osc.frequency.setValueAtTime(f1, startAt);
          osc.frequency.exponentialRampToValueAtTime(f2, startAt + rnd(0.2, 0.4));
          var g = audioCtx.createGain();
          g.gain.setValueAtTime(0, startAt);
          g.gain.linearRampToValueAtTime(rnd(0.04, 0.07), startAt + 0.03);
          g.gain.exponentialRampToValueAtTime(0.0001, startAt + rnd(0.25, 0.45));
          osc.connect(g);
          g.connect(masterGain);
          osc.start(startAt);
          osc.stop(startAt + 0.5);
        },
        /* Warbler-like */
        function (startAt) {
          var osc = audioCtx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = rnd(2800, 3600);
          var lfo = audioCtx.createOscillator();
          lfo.type = 'sine';
          lfo.frequency.value = rnd(15, 25);
          var ld = audioCtx.createGain();
          ld.gain.value = rnd(200, 500);
          lfo.connect(ld);
          ld.connect(osc.frequency);
          var dur = rnd(0.3, 0.6);
          var g = audioCtx.createGain();
          g.gain.setValueAtTime(0, startAt);
          g.gain.linearRampToValueAtTime(rnd(0.03, 0.055), startAt + 0.03);
          g.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
          osc.connect(g);
          g.connect(masterGain);
          lfo.start(startAt);
          osc.start(startAt);
          osc.stop(startAt + dur + 0.02);
          lfo.stop(startAt + dur + 0.02);
        },
        /* High chirp */
        function (startAt) {
          var osc = audioCtx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(rnd(4000, 5500), startAt);
          osc.frequency.exponentialRampToValueAtTime(rnd(3000, 4000), startAt + 0.15);
          var g = audioCtx.createGain();
          g.gain.setValueAtTime(0, startAt);
          g.gain.linearRampToValueAtTime(rnd(0.025, 0.05), startAt + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.18);
          osc.connect(g);
          g.connect(masterGain);
          osc.start(startAt);
          osc.stop(startAt + 0.22);
        }
      ];

      for (var i = 0; i < count; i++) {
        var offset = rnd(0, 0.4);
        var birdFn = birdTypes[Math.floor(Math.random() * birdTypes.length)];
        birdFn(now + offset);
      }

      scheduleBirdChorus();
    }, 80, 200);
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
    startWindCanopy();
    startInsects();
    startStream();

    /* Schedule all random events */
    scheduleRobin();
    scheduleWarbler();
    scheduleOwl();
    scheduleJayCrow();
    scheduleWoodpecker();
    scheduleLeafRustle();
    scheduleFrogCroak();
    scheduleBranchSnap();
    scheduleDistantThunder();
    scheduleBirdChorus();

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

  window.veilwoodTheme = { start: start, stop: stop };

})();
