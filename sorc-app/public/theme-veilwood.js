/* ============================================================
   THE VEILWOOD - theme-veilwood.js
   Four-movement soundscape cycling morning to night:
   1. Whimsy Woods    - warm, whimsical, morning
   2. Crystalline Woods - ethereal, crystalline, midday
   3. Northern Vale   - Nordic, melancholic, dusk
   4. Darkwood        - tense, sparse, night dread
   3 min each, 30s crossfade, loops forever.
   Exposes: window.veilwoodTheme = { start, stop }
   ============================================================ */
(function () {
  'use strict';

  var audioCtx = null;
  var audioStarted = false;
  var masterGain = null;
  var timeouts = [];
  var allGains = [];
  var allSources = [];
  var keepAliveId = null;

  var MOVEMENT_DUR  = 180;  /* 3 minutes per movement */
  var CROSSFADE_DUR = 30;   /* 30s overlap between movements */
  var movementActive = [false, false, false, false];
  var movementGains  = [null,  null,  null,  null];

  /* ── Utilities ─────────────────────────────────────────────── */
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function rndInt(a, b) { return Math.floor(rnd(a, b + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function at(sec, fn) {
    var id = setTimeout(function () { if (audioCtx && masterGain) fn(); }, sec * 1000);
    timeouts.push(id);
    return id;
  }

  function sched(fn, minS, maxS) {
    var id = setTimeout(fn, rnd(minS, maxS) * 1000);
    timeouts.push(id);
    return id;
  }

  function makeGain(v) {
    var g = audioCtx.createGain();
    g.gain.value = (v !== undefined) ? v : 1;
    allGains.push(g);
    return g;
  }

  function makeFilter(type, freq, q) {
    var f = audioCtx.createBiquadFilter();
    f.type = type; f.frequency.value = freq;
    if (q !== undefined) f.Q.value = q;
    return f;
  }

  function makeOsc(type, freq) {
    var o = audioCtx.createOscillator();
    o.type = type; o.frequency.value = freq;
    allSources.push(o);
    return o;
  }

  function makeNoiseBuffer(sec) {
    var frames = Math.floor(audioCtx.sampleRate * (sec || 2));
    var buf = audioCtx.createBuffer(1, frames, audioCtx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < frames; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function oneshotNoise(sec) {
    var src = audioCtx.createBufferSource();
    src.buffer = makeNoiseBuffer(sec);
    return src;
  }

  function loopNoise(sec) {
    var src = audioCtx.createBufferSource();
    src.buffer = makeNoiseBuffer(sec || 2);
    src.loop = true;
    allSources.push(src);
    return src;
  }

  /* Pluck - harp/lute string. out = destination node */
  function pluck(freq, startAt, gainVal, out) {
    [1, 2, 3].forEach(function (h) {
      var osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * h;
      allSources.push(osc);
      var g = audioCtx.createGain();
      var hg = gainVal / (h * h);
      g.gain.setValueAtTime(hg, startAt);
      g.gain.exponentialRampToValueAtTime(0.0001, startAt + 2.5 / h);
      osc.connect(g); g.connect(out);
      osc.start(startAt); osc.stop(startAt + 3.0 / h);
    });
  }

  /* ════════════════════════════════════════════════════════════
     MOVEMENT 1 - WHIMSY WOODS (MORNING)
     D major / pentatonic. Harp, bright flute, warm strings,
     birds, distant horse. Safe, golden, whimsical.
  ════════════════════════════════════════════════════════════ */
  var D2=73, A2=110, D3=147, G3=196, A3=220, B3=247,
      D4=293, E4=329, Fs4=370, G4=392, A4=440, B4=494,
      D5=587, E5=659, G5=784;

  function startWhimsyWoods(out) {
    var idx = 0;
    movementActive[idx] = true;

    /* Warm string pad - D major chord, slow fade in */
    [{f:D3,g:0.009},{f:A3,g:0.007},{f:Fs4,g:0.006},{f:D4,g:0.007}].forEach(function (v) {
      [-4, 0, 4].forEach(function (c) {
        var osc = makeOsc('sawtooth', v.f * Math.pow(2, c / 1200));
        var lpf = makeFilter('lowpass', 520, 0.5);
        var g = makeGain(0);
        var now = audioCtx.currentTime;
        g.gain.linearRampToValueAtTime(v.g / 3, now + 6);
        var lfo = makeOsc('sine', 1 / rnd(38, 58));
        var ld = makeGain(v.g / 3 * 0.22);
        lfo.connect(ld); ld.connect(g.gain); lfo.start();
        osc.connect(lpf); lpf.connect(g); g.connect(out);
        osc.start();
      });
    });

    /* Harp arpeggios */
    function doHarp() {
      if (!movementActive[idx]) return;
      var now = audioCtx.currentTime;
      var chords = [
        [D3, G3, D4, G4, B4, D5],
        [A3, D4, Fs4, A4, D5],
        [G3, B3, D4, G4, B4],
        [D3, A3, D4, Fs4, A4],
      ];
      var notes = pick(chords).slice(0, rndInt(4, 6));
      var cursor = now;
      notes.forEach(function (f) {
        pluck(f, cursor, rnd(0.028, 0.042), out);
        cursor += rnd(0.16, 0.30);
      });
      sched(doHarp, 7, 18);
    }
    sched(doHarp, 1, 4);

    /* Bright flute melody - D major, stepwise, lilting */
    var WHIMSY_PHRASES = [
      [{f:D5,d:0.55},{f:B4,d:0.45},{f:A4,d:0.45},{f:G4,d:0.85}],
      [{f:A4,d:0.45},{f:B4,d:0.40},{f:D5,d:0.95}],
      [{f:G4,d:0.50},{f:A4,d:0.40},{f:B4,d:0.40},{f:A4,d:0.50},{f:G4,d:0.75}],
      [{f:E4,d:0.55},{f:G4,d:0.50},{f:A4,d:0.85}],
      [{f:D5,d:0.40},{f:E5,d:0.45},{f:D5,d:0.40},{f:B4,d:0.60},{f:G4,d:0.95}],
      [{f:B4,d:0.60},{f:A4,d:0.45},{f:G4,d:0.50},{f:Fs4,d:0.40},{f:E4,d:1.10}],
    ];
    function doFlute() {
      if (!movementActive[idx]) return;
      var phrase = pick(WHIMSY_PHRASES);
      var cursor = audioCtx.currentTime + rnd(0.5, 1.5);
      phrase.forEach(function (n) {
        (function (t, freq, dur) {
          var osc = audioCtx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq * Math.pow(2, -10 / 1200), t);
          osc.frequency.linearRampToValueAtTime(freq, t + 0.10);
          allSources.push(osc);
          var vib = audioCtx.createOscillator();
          vib.frequency.value = rnd(4.8, 5.8);
          allSources.push(vib);
          var vd = makeGain(0);
          vd.gain.setValueAtTime(0, t);
          vd.gain.linearRampToValueAtTime(rnd(2.2, 3.8), t + dur * 0.48);
          vib.connect(vd); vd.connect(osc.frequency);
          var g = makeGain(0);
          var pk = rnd(0.013, 0.020);
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(pk, t + 0.12);
          g.gain.setValueAtTime(pk, t + dur - 0.10);
          g.gain.linearRampToValueAtTime(0, t + dur + 0.18);
          osc.connect(g); g.connect(out);
          vib.start(t); vib.stop(t + dur + 0.25);
          osc.start(t); osc.stop(t + dur + 0.30);
        })(cursor, n.f, n.d);
        cursor += n.d + rnd(0.04, 0.14);
      });
      sched(doFlute, 10, 24);
    }
    sched(doFlute, 3, 8);

    /* Morning bird calls - bright short chirps */
    function doBird() {
      if (!movementActive[idx]) return;
      var now = audioCtx.currentTime;
      var base = rnd(2200, 3600);
      var count = rndInt(2, 4);
      var cursor = now;
      for (var i = 0; i < count; i++) {
        (function (t, f) {
          var osc = audioCtx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, t);
          osc.frequency.linearRampToValueAtTime(f * rnd(0.88, 1.12), t + 0.06);
          allSources.push(osc);
          var g = makeGain(0);
          var pk = rnd(0.005, 0.008);
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(pk, t + 0.014);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
          osc.connect(g); g.connect(out);
          osc.start(t); osc.stop(t + 0.08);
        })(cursor, base * rnd(0.92, 1.08));
        cursor += rnd(0.08, 0.18);
      }
      sched(doBird, 3, 10);
    }
    sched(doBird, 0.5, 3);

    /* Distant horse - muffled hoofbeats */
    function doHorse() {
      if (!movementActive[idx]) return;
      var now = audioCtx.currentTime;
      var steps = rndInt(6, 12);
      for (var i = 0; i < steps; i++) {
        (function (t) {
          var src = oneshotNoise(0.10);
          var lpf = makeFilter('lowpass', rnd(160, 240));
          var g = makeGain(0);
          g.gain.setValueAtTime(rnd(0.055, 0.090), t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
          src.connect(lpf); lpf.connect(g); g.connect(out);
          src.start(t);
        })(now + i * rnd(0.20, 0.32));
      }
      sched(doHorse, 28, 65);
    }
    sched(doHorse, 8, 22);

    /* Gentle choir swell - D major */
    function doChoir() {
      if (!movementActive[idx]) return;
      var now = audioCtx.currentTime;
      var dur = rnd(5, 9);
      [D4, Fs4, A4].forEach(function (f) {
        [-5, 0, 5].forEach(function (c) {
          var osc = makeOsc('sine', f * Math.pow(2, c / 1200));
          var g = makeGain(0);
          var pk = rnd(0.005, 0.009);
          g.gain.setValueAtTime(0, now);
          g.gain.linearRampToValueAtTime(pk, now + dur * 0.30);
          g.gain.setValueAtTime(pk * 0.85, now + dur * 0.68);
          g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
          osc.connect(g); g.connect(out);
          osc.start(now); osc.stop(now + dur + 0.1);
        });
      });
      sched(doChoir, 22, 48);
    }
    sched(doChoir, 14, 28);
  }

  /* ════════════════════════════════════════════════════════════
     MOVEMENT 2 - EMERALD GROVE
     C major / G pentatonic. Forest flute melody, pizzicato strings,
     xylophone sparkles, soft choir. Ancient, mysterious, magical.
     Zelda BOTW/OOT inspired - forest spirits, old trees, wonder.
  ════════════════════════════════════════════════════════════ */
  var C3k=131, G3k=196, C4k=261, D4k=293, E4k=329, G4k=392,
      A4k=440, C5k=523, D5k=587, E5k=659, G5k=784;
  var SPARKLE_PENT = [C4k, D4k, E4k, G4k, A4k, C5k, D5k, E5k];

  function startEmeraldGrove(out) {
    var idx = 1;
    movementActive[idx] = true;

    /* Ancient forest pad - C major, very soft, slightly hollow */
    [{f:C3k,g:0.007},{f:G3k,g:0.006},{f:C4k,g:0.007},{f:E4k,g:0.005}].forEach(function (v) {
      [-3, 0, 3].forEach(function (c) {
        var osc = makeOsc('sine', v.f * Math.pow(2, c / 1200));
        var lpf = makeFilter('lowpass', 900, 0.6);
        var g = makeGain(0);
        var now = audioCtx.currentTime;
        g.gain.linearRampToValueAtTime(v.g / 3, now + 7);
        var lfo = makeOsc('sine', 1 / rnd(28, 48));
        var ld = makeGain(v.g / 3 * 0.20);
        lfo.connect(ld); ld.connect(g.gain); lfo.start();
        osc.connect(lpf); lpf.connect(g); g.connect(out);
        osc.start();
      });
    });

    /* Forest flute melody - stepwise C major phrases */
    var FLUTE_PHRASES = [
      [{f:E4k,d:0.35},{f:D4k,d:0.30},{f:E4k,d:0.35},{f:G4k,d:0.65}],
      [{f:G4k,d:0.40},{f:A4k,d:0.35},{f:G4k,d:0.35},{f:E4k,d:0.55},{f:C4k,d:0.80}],
      [{f:C5k,d:0.40},{f:A4k,d:0.35},{f:G4k,d:0.35},{f:E4k,d:0.70}],
      [{f:D4k,d:0.35},{f:E4k,d:0.30},{f:G4k,d:0.35},{f:A4k,d:0.35},{f:G4k,d:0.60}],
      [{f:E4k,d:0.45},{f:G4k,d:0.40},{f:A4k,d:0.40},{f:G4k,d:0.35},{f:E4k,d:0.35},{f:D4k,d:0.75}],
      [{f:G4k,d:0.55},{f:E4k,d:0.45},{f:D4k,d:0.40},{f:C4k,d:0.90}],
    ];
    function doFlute() {
      if (!movementActive[idx]) return;
      var phrase = pick(FLUTE_PHRASES);
      var cursor = audioCtx.currentTime + rnd(0.4, 1.2);
      phrase.forEach(function (n) {
        (function (t, freq, dur) {
          var osc = audioCtx.createOscillator();
          osc.type = 'sine';
          /* Flute attack - slight flat then settle */
          osc.frequency.setValueAtTime(freq * Math.pow(2, -6 / 1200), t);
          osc.frequency.linearRampToValueAtTime(freq, t + 0.06);
          allSources.push(osc);
          /* Gentle vibrato - enters late */
          var vib = audioCtx.createOscillator();
          vib.frequency.value = rnd(5.2, 6.2);
          allSources.push(vib);
          var vd = makeGain(0);
          vd.gain.setValueAtTime(0, t);
          vd.gain.linearRampToValueAtTime(rnd(1.8, 3.0), t + dur * 0.55);
          vib.connect(vd); vd.connect(osc.frequency);
          /* Breath layer - gives flute its hollow character */
          var breath = oneshotNoise(dur + 0.1);
          var bbpf = makeFilter('bandpass', freq * 1.4, 2.5);
          var bg = makeGain(0.0004);
          breath.connect(bbpf); bbpf.connect(bg); bg.connect(out);
          breath.start(t);
          var g = makeGain(0);
          var pk = rnd(0.014, 0.022);
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(pk, t + 0.08);
          g.gain.setValueAtTime(pk, t + dur - 0.08);
          g.gain.linearRampToValueAtTime(0, t + dur + 0.12);
          osc.connect(g); g.connect(out);
          vib.start(t); vib.stop(t + dur + 0.18);
          osc.start(t); osc.stop(t + dur + 0.20);
        })(cursor, n.f, n.d);
        cursor += n.d + rnd(0.03, 0.10);
      });
      sched(doFlute, 8, 20);
    }
    sched(doFlute, 2, 6);

    /* Pizzicato strings - light plucks, orchestral style */
    function doPizz() {
      if (!movementActive[idx]) return;
      var now = audioCtx.currentTime;
      var chords = [
        [C3k, G3k, C4k, E4k],
        [G3k, D4k, G4k],
        [C3k, E4k, G4k, C5k],
        [G3k, C4k, E4k, A4k],
      ];
      var notes = pick(chords);
      var cursor = now;
      notes.forEach(function (f) {
        pluck(f, cursor, rnd(0.018, 0.028), out);
        cursor += rnd(0.14, 0.26);
      });
      sched(doPizz, 9, 22);
    }
    sched(doPizz, 1, 4);

    /* Magic sparkle - inharmonic bell pings */
    function doSparkle() {
      if (!movementActive[idx]) return;
      var now = audioCtx.currentTime;
      var count = rndInt(2, 5);
      for (var i = 0; i < count; i++) {
        (function (t) {
          var freq = pick(KOR_PENT) * rnd(1.5, 3.0);
          [1, 2.4, 4.1].forEach(function (h, j) {
            var osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq * h;
            allSources.push(osc);
            var g = makeGain(0);
            var pk = [rnd(0.006,0.010), rnd(0.002,0.004), rnd(0.001,0.002)][j];
            var dec = [rnd(0.6,1.2), rnd(0.3,0.6), rnd(0.15,0.3)][j];
            g.gain.setValueAtTime(pk, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
            osc.connect(g); g.connect(out);
            osc.start(t); osc.stop(t + dec + 0.05);
          });
        })(now + i * rnd(0.08, 0.22));
      }
      sched(doSparkle, 6, 18);
    }
    sched(doSparkle, 1, 4);

    /* Soft ancient choir - "ooh" vowel, very gentle */
    function doKorChoir() {
      if (!movementActive[idx]) return;
      var now = audioCtx.currentTime;
      var root = pick([C4k, G3k, E4k, G4k]);
      var dur = rnd(5, 9);
      [1, 1.5, 2].forEach(function (h) {
        [-4, 0, 4].forEach(function (c) {
          var osc = makeOsc('sine', root * h * Math.pow(2, c / 1200));
          var g = makeGain(0);
          var pk = rnd(0.004, 0.007) / h;
          g.gain.setValueAtTime(0, now);
          g.gain.linearRampToValueAtTime(pk, now + dur * 0.32);
          g.gain.setValueAtTime(pk * 0.80, now + dur * 0.70);
          g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
          osc.connect(g); g.connect(out);
          osc.start(now); osc.stop(now + dur + 0.1);
        });
      });
      sched(doKorChoir, 20, 45);
    }
    sched(doKorChoir, 10, 22);

    /* Distant hollow log percussion - like Deku drums, very soft */
    function doDrum() {
      if (!movementActive[idx]) return;
      var now = audioCtx.currentTime;
      var hits = rndInt(2, 4);
      for (var i = 0; i < hits; i++) {
        (function (t) {
          var src = oneshotNoise(0.12);
          var bpf = makeFilter('bandpass', rnd(280, 480), 3.5);
          var g = makeGain(0);
          g.gain.setValueAtTime(rnd(0.022, 0.038), t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.10);
          src.connect(bpf); bpf.connect(g); g.connect(out);
          src.start(t);
        })(now + i * rnd(0.35, 0.65));
      }
      sched(doDrum, 18, 45);
    }
    sched(doDrum, 6, 14);
  }

  /* ════════════════════════════════════════════════════════════
     MOVEMENT 3 - CRYSTALLINE WOODS (MIDDAY)
     A major / Lydian shimmer. Bell tones, ethereal choir,
     floating pads. Water drops, crystal hum. Otherworldly.
  ════════════════════════════════════════════════════════════ */
  var A2m=110, E3m=165, A3m=220, Cs4=277, E4m=329, Gs4=415,
      A4m=440, Cs5=554, E5m=659;
  var MAC_NOTES = [A3m, Cs4, E4m, Gs4, A4m, Cs5, E5m];

  function startCrystallineWoods(out) {
    var idx = 2;
    movementActive[idx] = true;

    /* Floating ethereal pad - A major, slow swell LFO */
    [{f:A2m,g:0.007},{f:E3m,g:0.006},{f:A3m,g:0.008},{f:Cs4,g:0.006},{f:E4m,g:0.005}].forEach(function (v) {
      [-3, 0, 3].forEach(function (c) {
        var osc = makeOsc('sine', v.f * Math.pow(2, c / 1200));
        var lpf = makeFilter('lowpass', 1800, 0.7);
        var g = makeGain(0);
        var now = audioCtx.currentTime;
        g.gain.linearRampToValueAtTime(v.g / 3, now + 9);
        var lfo = makeOsc('sine', 1 / rnd(14, 22));
        var ld = makeGain(v.g / 3 * 0.28);
        lfo.connect(ld); ld.connect(g.gain); lfo.start();
        osc.connect(lpf); lpf.connect(g); g.connect(out);
        osc.start();
      });
    });

    /* Crystal bell tones - inharmonic partials for metallic ring */
    function doBell() {
      if (!movementActive[idx]) return;
      var now = audioCtx.currentTime;
      var freq = pick(MAC_NOTES) * (Math.random() < 0.4 ? 2 : 1);
      /* Inharmonic partial ratios give bell timbre */
      [1, 2.756, 5.404, 8.933].forEach(function (h, i) {
        var osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq * h;
        allSources.push(osc);
        var g = makeGain(0);
        var pk = [rnd(0.010,0.016), rnd(0.004,0.007), rnd(0.002,0.004), rnd(0.001,0.002)][i];
        var dec = [rnd(2.0,3.8), rnd(0.9,1.8), rnd(0.4,0.9), rnd(0.2,0.5)][i];
        g.gain.setValueAtTime(pk, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dec);
        osc.connect(g); g.connect(out);
        osc.start(now); osc.stop(now + dec + 0.1);
      });
      sched(doBell, 3, 11);
    }
    sched(doBell, 0.5, 2);

    /* Water droplets - pitch drops on impact */
    function doDrop() {
      if (!movementActive[idx]) return;
      var now = audioCtx.currentTime;
      var freq = rnd(700, 2000);
      var osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.55, now + 0.14);
      allSources.push(osc);
      var g = makeGain(0);
      g.gain.setValueAtTime(rnd(0.005, 0.010), now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      osc.connect(g); g.connect(out);
      osc.start(now); osc.stop(now + 0.18);
      sched(doDrop, 2, 9);
    }
    sched(doDrop, 0.5, 2);

    /* Ethereal choir shimmer */
    function doChoir() {
      if (!movementActive[idx]) return;
      var now = audioCtx.currentTime;
      var root = pick([A3m, Cs4, E4m, A4m]);
      var dur = rnd(7, 12);
      [1, 1.5, 2, 3].forEach(function (h) {
        [-6, 0, 6].forEach(function (c) {
          var osc = makeOsc('sine', root * h * Math.pow(2, c / 1200));
          var g = makeGain(0);
          var pk = rnd(0.003, 0.006) / Math.sqrt(h);
          g.gain.setValueAtTime(0, now);
          g.gain.linearRampToValueAtTime(pk, now + dur * 0.28);
          g.gain.setValueAtTime(pk * 0.82, now + dur * 0.72);
          g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
          osc.connect(g); g.connect(out);
          osc.start(now); osc.stop(now + dur + 0.1);
        });
      });
      sched(doChoir, 14, 30);
    }
    sched(doChoir, 5, 12);

    /* Floating melodic line - gentle A major */
    var MAC_PHRASES = [
      [{f:A4m,d:1.2},{f:Cs5,d:1.0},{f:E5m,d:2.0}],
      [{f:E4m,d:0.9},{f:Gs4,d:1.1},{f:A4m,d:1.8}],
      [{f:Cs5,d:1.0},{f:A4m,d:0.9},{f:Gs4,d:0.8},{f:E4m,d:2.0}],
      [{f:A4m,d:2.2},{f:Cs5,d:1.8}],
      [{f:Gs4,d:1.0},{f:A4m,d:0.8},{f:Cs5,d:1.2},{f:A4m,d:2.5}],
    ];
    function doMelody() {
      if (!movementActive[idx]) return;
      var phrase = pick(MAC_PHRASES);
      var cursor = audioCtx.currentTime + rnd(1, 2.5);
      phrase.forEach(function (n) {
        (function (t, freq, dur) {
          var osc = makeOsc('sine', freq);
          var lpf = makeFilter('lowpass', 2800);
          var g = makeGain(0);
          var pk = rnd(0.009, 0.014);
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(pk, t + 0.35);
          g.gain.setValueAtTime(pk * 0.78, t + dur - 0.3);
          g.gain.linearRampToValueAtTime(0, t + dur + 0.55);
          osc.connect(lpf); lpf.connect(g); g.connect(out);
          osc.start(t); osc.stop(t + dur + 0.65);
        })(cursor, n.f, n.d);
        cursor += n.d + rnd(0.1, 0.5);
      });
      sched(doMelody, 16, 32);
    }
    sched(doMelody, 6, 14);

    /* Soft shimmer texture - mid bandpass noise */
    function doShimmer() {
      if (!movementActive[idx]) return;
      var now = audioCtx.currentTime;
      var src = oneshotNoise(rnd(0.9, 1.6));
      var bpf = makeFilter('bandpass', rnd(1200, 2400), 1.0);
      var g = makeGain(0);
      var dur = rnd(0.9, 1.5);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(rnd(0.005, 0.009), now + dur * 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      src.connect(bpf); bpf.connect(g); g.connect(out);
      src.start(now);
      sched(doShimmer, 9, 22);
    }
    sched(doShimmer, 2, 7);
  }

  /* ════════════════════════════════════════════════════════════
     MOVEMENT 4 - NORTHERN VALE (DUSK)
     D minor / Dorian. Low strings, lute plucks, Nordic drone.
     Wind, ravens, rustling. Melancholic, brooding, earthy.
  ════════════════════════════════════════════════════════════ */
  var D2s=73, A2s=110, D3s=147, F3s=175, G3s=196, A3s=220,
      Bb3=233, C4s=261, D4s=293, F4s=349;
  var SKY_NOTES = [D3s, F3s, G3s, A3s, C4s, D4s];

  function startNorthernVale(out) {
    var idx = 3;
    movementActive[idx] = true;

    /* Low Nordic drone - open fifth D-A */
    [D2s, A2s, D3s, A3s].forEach(function (f) {
      [-3, 0, 3].forEach(function (c) {
        var osc = makeOsc('sawtooth', f * Math.pow(2, c / 1200));
        var lpf = makeFilter('lowpass', 340, 0.4);
        var g = makeGain(0);
        var now = audioCtx.currentTime;
        g.gain.linearRampToValueAtTime(rnd(0.005, 0.008) / 3, now + 9);
        osc.connect(lpf); lpf.connect(g); g.connect(out);
        osc.start();
      });
    });

    /* Slow mournful string melody - Dorian */
    var SKY_PHRASES = [
      [{f:D4s,d:2.0},{f:C4s,d:1.6},{f:A3s,d:1.4},{f:G3s,d:2.8}],
      [{f:F3s,d:1.8},{f:G3s,d:1.4},{f:A3s,d:1.6},{f:F3s,d:3.0}],
      [{f:A3s,d:2.2},{f:G3s,d:1.8},{f:F3s,d:1.4},{f:D3s,d:3.8}],
      [{f:C4s,d:1.6},{f:D4s,d:2.0},{f:C4s,d:1.4},{f:Bb3,d:1.2},{f:A3s,d:3.2}],
      [{f:G3s,d:2.0},{f:A3s,d:1.8},{f:Bb3,d:1.4},{f:A3s,d:1.2},{f:G3s,d:2.5}],
    ];
    function doStrings() {
      if (!movementActive[idx]) return;
      var phrase = pick(SKY_PHRASES);
      var cursor = audioCtx.currentTime + rnd(0.5, 2.0);
      phrase.forEach(function (n) {
        (function (t, freq, dur) {
          [-6, -2, 0, 2, 6].forEach(function (c) {
            var osc = makeOsc('sawtooth', freq * Math.pow(2, c / 1200));
            var lpf = makeFilter('lowpass', rnd(900, 1500));
            var g = makeGain(0);
            var pk = rnd(0.009, 0.015) / 5;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(pk, t + Math.min(dur * 0.35, 1.1));
            g.gain.setValueAtTime(pk, t + dur * 0.72);
            g.gain.linearRampToValueAtTime(0, t + dur + 0.45);
            osc.connect(lpf); lpf.connect(g); g.connect(out);
            osc.start(t); osc.stop(t + dur + 0.6);
          });
        })(cursor, n.f, n.d);
        cursor += n.d;
      });
      sched(doStrings, 20, 45);
    }
    sched(doStrings, 2, 6);

    /* Lute plucks - sparse, melancholic */
    function doLute() {
      if (!movementActive[idx]) return;
      var now = audioCtx.currentTime;
      var chords = [
        [D3s, A3s, D4s], [F3s, A3s, C4s], [G3s, D4s], [A3s, C4s, A3s],
        [D3s, F3s, A3s], [Bb3, F3s, D3s],
      ];
      var notes = pick(chords);
      var cursor = now;
      notes.forEach(function (f) {
        pluck(f, cursor, rnd(0.020, 0.032), out);
        cursor += rnd(0.22, 0.40);
      });
      sched(doLute, 9, 22);
    }
    sched(doLute, 1, 5);

    /* Wind - low rumble, slow swell */
    var windSrc = loopNoise(3);
    var windLpf = makeFilter('lowpass', 200, 0.4);
    var windG   = makeGain(0);
    var wlfo    = makeOsc('sine', 0.04);
    var wlfoD   = makeGain(0.003);
    wlfo.connect(wlfoD); wlfoD.connect(windG.gain);
    windSrc.connect(windLpf); windLpf.connect(windG); windG.connect(out);
    (function () {
      var now = audioCtx.currentTime;
      windG.gain.linearRampToValueAtTime(0.007, now + 14);
    })();
    windSrc.start(); wlfo.start();

    /* Raven calls - hard caw, fast attack, harsh and raspy */
    function doRaven() {
      if (!movementActive[idx]) return;
      var now = audioCtx.currentTime;
      var caws = rndInt(1, 3);
      for (var c = 0; c < caws; c++) {
        (function (t) {
          /* Layer 1: main body - high bandpass, punchy */
          var s1 = oneshotNoise(0.22);
          var b1 = makeFilter('bandpass', rnd(1800, 2600), rnd(8, 14));
          var g1 = makeGain(0);
          g1.gain.setValueAtTime(rnd(0.10, 0.16), t);
          g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
          s1.connect(b1); b1.connect(g1); g1.connect(out);
          s1.start(t);
          /* Layer 2: rasp texture - slightly different freq */
          var s2 = oneshotNoise(0.16);
          var b2 = makeFilter('bandpass', rnd(3000, 4500), rnd(5, 10));
          var g2 = makeGain(0);
          g2.gain.setValueAtTime(rnd(0.055, 0.085), t + 0.01);
          g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
          s2.connect(b2); b2.connect(g2); g2.connect(out);
          s2.start(t + 0.01);
          /* Layer 3: low chest thump under the caw */
          var s3 = oneshotNoise(0.10);
          var b3 = makeFilter('lowpass', rnd(300, 500));
          var g3 = makeGain(0);
          g3.gain.setValueAtTime(rnd(0.045, 0.070), t);
          g3.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
          s3.connect(b3); b3.connect(g3); g3.connect(out);
          s3.start(t);
        })(now + c * rnd(0.40, 0.80));
      }
      sched(doRaven, 18, 50);
    }
    sched(doRaven, 8, 20);

    /* Low horn drone swell - distant horn of the Companions */
    function doHorn() {
      if (!movementActive[idx]) return;
      var now = audioCtx.currentTime;
      var freq = pick([D2s, A2s, D3s]);
      var dur = rnd(4, 7);
      [1, 2, 3].forEach(function (h) {
        var osc = makeOsc('sawtooth', freq * h * Math.pow(2, rnd(-3,3)/1200));
        var lpf = makeFilter('lowpass', 600);
        var g = makeGain(0);
        var pk = rnd(0.012, 0.020) / h;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(pk, now + dur * 0.28);
        g.gain.setValueAtTime(pk * 0.88, now + dur * 0.68);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        osc.connect(lpf); lpf.connect(g); g.connect(out);
        osc.start(now); osc.stop(now + dur + 0.1);
      });
      sched(doHorn, 30, 70);
    }
    sched(doHorn, 12, 25);
  }

  /* ════════════════════════════════════════════════════════════
     MOVEMENT SEQUENCER
     Launches each movement in order, schedules crossfade,
     then launches next. Cycles forever.
  ════════════════════════════════════════════════════════════ */
  var MOVEMENTS = [startWhimsyWoods, startEmeraldGrove, startCrystallineWoods, startNorthernVale];

  function launchMovement(idx) {
    /* Create this movement's gain node */
    var mg = audioCtx.createGain();
    mg.gain.value = 0;
    mg.connect(masterGain);
    movementGains[idx] = mg;
    allGains.push(mg);

    /* Fade in over 15s */
    var now = audioCtx.currentTime;
    mg.gain.setValueAtTime(0, now);
    mg.gain.linearRampToValueAtTime(1.0, now + 15);

    /* Start music and ambience */
    MOVEMENTS[idx](mg);

    /* At MOVEMENT_DUR - CROSSFADE_DUR, fade out and launch next */
    at(MOVEMENT_DUR - CROSSFADE_DUR, function () {
      var n = audioCtx.currentTime;
      mg.gain.setValueAtTime(mg.gain.value, n);
      mg.gain.linearRampToValueAtTime(0, n + CROSSFADE_DUR);
      /* Kill schedulers after fade completes */
      setTimeout(function () { movementActive[idx] = false; }, (CROSSFADE_DUR + 0.5) * 1000);
      /* Launch next movement */
      launchMovement((idx + 1) % 4);
    });
  }

  /* ════════════════════════════════════════════════════════════
     AUDIO ENGINE
  ════════════════════════════════════════════════════════════ */
  function startAudio() {
    if (audioStarted) return;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { return; }

    keepAliveId = setInterval(function () {
      if (!audioCtx) { clearInterval(keepAliveId); keepAliveId = null; return; }
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(function () {});
    }, 1000);

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 1.4;
    masterGain.connect(audioCtx.destination);
    allGains.push(masterGain);

    audioStarted = true;

    var doSchedule = function() { launchMovement(0); };
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(doSchedule).catch(doSchedule);
    } else {
      doSchedule();
    }
  }

  function stopAudio() {
    if (!audioStarted) return;
    timeouts.forEach(function (id) { clearTimeout(id); });
    timeouts = [];
    if (keepAliveId) { clearInterval(keepAliveId); keepAliveId = null; }
    movementActive = [false, false, false, false];

    if (masterGain && audioCtx) {
      var now = audioCtx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(0, now + 0.5);
    }

    var ctx = audioCtx;
    var srcSnap  = allSources.slice();
    var gainSnap = allGains.slice();
    setTimeout(function () {
      srcSnap.forEach(function (s)  { try { s.stop(); } catch(e){} try { s.disconnect(); } catch(e){} });
      gainSnap.forEach(function (g) { try { g.disconnect(); } catch(e){} });
      if (ctx) { try { ctx.close(); } catch(e){} }
    }, 600);

    audioCtx = null; masterGain = null; audioStarted = false;
    allSources = []; allGains = [];
    movementGains = [null, null, null, null];
  }

  var interactionHandlerAdded = false;
  var themeActive = false;

  function onUserInteraction() {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
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

  function start() { themeActive = true;  addInteractionListeners(); }
  function stop()  { themeActive = false; removeInteractionListeners(); stopAudio(); }

  window.veilwoodTheme = { start: start, stop: stop, get _ctx() { return audioCtx; } };
})();
