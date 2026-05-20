/* ============================================================
   THE VEILWOOD — theme-veilwood.js
   Fable-inspired enchanted forest soundscape.
   Warm string pad + slow orchestral melody + Celtic flute (sine, reverb)
   + harp arpeggios + choir swells + birds + wind + gallop + owl.
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

  function rnd(min, max) { return min + Math.random() * (max - min); }
  function rndInt(min, max) { return Math.floor(rnd(min, max + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function at(sec, fn) {
    var id = setTimeout(function () { if (audioCtx && masterGain) fn(); }, sec * 1000);
    timeouts.push(id);
  }

  function sched(fn, minS, maxS) {
    var id = setTimeout(fn, rnd(minS, maxS) * 1000);
    timeouts.push(id);
    return id;
  }

  function makeOsc(type, freq) {
    var o = audioCtx.createOscillator();
    o.type = type; o.frequency.value = freq;
    allSources.push(o); return o;
  }

  function makeGain(v) {
    var g = audioCtx.createGain();
    g.gain.value = (v !== undefined) ? v : 1;
    allGains.push(g); return g;
  }

  function makeFilter(type, freq, q) {
    var f = audioCtx.createBiquadFilter();
    f.type = type; f.frequency.value = freq;
    if (q !== undefined) f.Q.value = q;
    return f;
  }

  function makeNoiseBuffer(sec) {
    var frames = Math.floor(audioCtx.sampleRate * (sec || 2));
    var buf = audioCtx.createBuffer(1, frames, audioCtx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < frames; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function loopNoise(sec) {
    var src = audioCtx.createBufferSource();
    src.buffer = makeNoiseBuffer(sec || 2);
    src.loop = true; allSources.push(src); return src;
  }

  function oneshotNoise(sec) {
    var src = audioCtx.createBufferSource();
    src.buffer = makeNoiseBuffer(sec); return src;
  }

  /* ─── Deep forest reverb for flute (4.5s tail) ───────────── */
  var fluteReverb = null;
  function getFluteReverb() {
    if (fluteReverb) return fluteReverb;
    var len = Math.floor(audioCtx.sampleRate * 4.5);
    var buf = audioCtx.createBuffer(2, len, audioCtx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      for (var i = 0; i < len; i++)
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.0);
    }
    var conv = audioCtx.createConvolver();
    conv.buffer = buf;
    var wet = makeGain(0.52);
    conv.connect(wet); wet.connect(masterGain);
    fluteReverb = conv;
    return fluteReverb;
  }

  /* ─── D DORIAN scale frequencies ─────────────────────────── */
  var D3=147, E3=165, F3=175, G3=196, A3=220, B3=247, C4=261,
      D4=293, E4=329, F4=349, G4=392, A4=440, B4=494, C5=523, D5=587;

  /* Dm pentatonic for harp */
  var HARP_NOTES = [D3, F3, G3, A3, C4, D4, F4, G4, A4, C5, D5];

  /* ─── Shakuhachi / ocarina phrases — 2-3 long notes only ───
     Zelda BOTW/TOTK style: each note breathes for 2.5-4.5s,
     long rests between notes, very sparse appearances.         */
  var FLUTE_PHRASES = [
    [{f:A4, d:3.2}, {f:G4, d:2.8}, {f:D4, d:4.5}],
    [{f:D4, d:2.8}, {f:F4, d:4.0}],
    [{f:G4, d:3.0}, {f:A4, d:2.5}, {f:F4, d:4.2}],
    [{f:E4, d:3.5}, {f:D4, d:4.8}],
    [{f:A4, d:3.2}, {f:D5, d:2.5}, {f:A4, d:4.0}],
    [{f:F4, d:3.5}, {f:G4, d:4.2}],
    [{f:D4, d:4.0}, {f:A4, d:3.0}, {f:G4, d:4.5}],
    [{f:G4, d:2.8}, {f:F4, d:4.0}],
  ];

  /* ─── Slow Fable-style string melody phrases ────────────────
     Long note durations, mournful D-minor motion               */
  var STRING_PHRASES = [
    [{f:A4,d:2.2},{f:G4,d:1.8},{f:F4,d:1.8},{f:E4,d:1.4},{f:D4,d:3.8}],
    [{f:D4,d:2.0},{f:F4,d:1.8},{f:A4,d:2.4},{f:G4,d:1.6},{f:F4,d:1.8},{f:D4,d:3.2}],
    [{f:F4,d:2.2},{f:G4,d:1.8},{f:A4,d:2.0},{f:G4,d:1.4},{f:F4,d:1.6},{f:E4,d:1.4},{f:D4,d:3.0}],
    [{f:D4,d:2.8},{f:C4,d:2.2},{f:D4,d:2.0},{f:F4,d:4.5}],
    [{f:A3,d:2.2},{f:C4,d:2.0},{f:E4,d:2.4},{f:D4,d:1.8},{f:C4,d:1.8},{f:A3,d:3.5}],
    [{f:G4,d:2.0},{f:F4,d:1.6},{f:E4,d:1.6},{f:D4,d:2.0},{f:E4,d:1.4},{f:F4,d:1.8},{f:G4,d:3.0}],
  ];

  /* ─── AMBIENT BED: Warm string pad (very quiet, background only) */
  function startStringPad() {
    /* Four quiet drone voices tuned to Dm — pad is barely audible
       warmth underneath; the real melody comes from scheduleStringMelody */
    var voices = [
      {freq: D3, gain: 0.010},
      {freq: A3, gain: 0.008},
      {freq: F3, gain: 0.007},
      {freq: D4, gain: 0.006},
    ];
    voices.forEach(function (v) {
      [-5, 0, 5].forEach(function (cents) {
        var osc = makeOsc('sawtooth', v.freq * Math.pow(2, cents / 1200));
        var lpf = makeFilter('lowpass', 480, 0.4);
        var g = makeGain(0);
        var now = audioCtx.currentTime;
        g.gain.linearRampToValueAtTime(v.gain / 3, now + 6.0);

        /* Slow swell LFO — pad breathes imperceptibly */
        var swellLfo = makeOsc('sine', 1 / rnd(40, 60));
        var swellDepth = makeGain(v.gain / 3 * 0.25);
        swellLfo.connect(swellDepth); swellDepth.connect(g.gain);
        swellLfo.start();

        osc.connect(lpf); lpf.connect(g); g.connect(masterGain);
        osc.start();
      });
    });

    /* Slow bass harmonic shift every 30-50s */
    function schedulePadShift() {
      sched(function () {
        if (!audioCtx || !masterGain) return;
        var now = audioCtx.currentTime;
        [{freq: pick([F3, G3, A3]), gain: rnd(0.004, 0.007)},
         {freq: pick([A3, C4, D4]), gain: rnd(0.003, 0.006)}].forEach(function (v) {
          [-4, 0, 4].forEach(function (cents) {
            var osc = audioCtx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = v.freq * Math.pow(2, cents / 1200);
            var lpf = audioCtx.createBiquadFilter();
            lpf.type = 'lowpass'; lpf.frequency.value = 460;
            var g = audioCtx.createGain();
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(v.gain / 3, now + 10);
            g.gain.setValueAtTime(v.gain / 3, now + 18);
            g.gain.linearRampToValueAtTime(0, now + 28);
            osc.connect(lpf); lpf.connect(g); g.connect(masterGain);
            osc.start(now); osc.stop(now + 30);
          });
        });
        schedulePadShift();
      }, 30, 50);
    }
    schedulePadShift();
  }

  /* ─── ORCHESTRAL STRING MELODY ──────────────────────────────
     Slow Fable-style bowed string phrase — this IS the music,
     not just a drone. Sounds like the Guild Hall theme.        */
  function playStringMelody(phrase) {
    var now = audioCtx.currentTime;
    var cursor = now + rnd(0.8, 2.0);
    phrase.forEach(function (n) {
      (function (startAt, freq, dur) {
        /* Ensemble: 5 detuned sawtooth voices like a string section */
        [-7, -2, 0, 2, 7].forEach(function (cents) {
          var osc = audioCtx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.value = freq * Math.pow(2, cents / 1200);
          allSources.push(osc);

          var lpf = audioCtx.createBiquadFilter();
          lpf.type = 'lowpass'; lpf.frequency.value = rnd(1100, 1600);

          var g = makeGain(0);
          var peak = rnd(0.011, 0.018) / 5;
          g.gain.setValueAtTime(0, startAt);
          /* Slow bow attack — the hallmark of real strings */
          g.gain.linearRampToValueAtTime(peak, startAt + Math.min(dur * 0.38, 1.2));
          g.gain.setValueAtTime(peak, startAt + dur * 0.72);
          g.gain.linearRampToValueAtTime(0, startAt + dur + 0.35);

          osc.connect(lpf); lpf.connect(g); g.connect(masterGain);
          osc.start(startAt); osc.stop(startAt + dur + 0.5);
        });
      })(cursor, n.f, n.d);
      cursor += n.d;
    });
  }

  function scheduleStringMelody() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      playStringMelody(pick(STRING_PHRASES));
      scheduleStringMelody();
    }, 48, 95);
  }

  /* ─── WIND ──────────────────────────────────────────────────  */
  function startWind() {
    var src = loopNoise(3);
    var lpf = makeFilter('lowpass', 280, 0.5);
    var g = makeGain(0.010);
    var lfo = makeOsc('sine', 0.007);
    var lfoDepth = makeGain(0.003);
    lfo.connect(lfoDepth); lfoDepth.connect(g.gain);
    src.connect(lpf); lpf.connect(g); g.connect(masterGain);
    src.start(); lfo.start();
  }

  /* ─── HARP ──────────────────────────────────────────────────  */
  function pluck(freq, startAt, gainVal) {
    [1, 2, 3].forEach(function (harmonic) {
      var osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * harmonic;
      var g = audioCtx.createGain();
      var hGain = gainVal / (harmonic * harmonic);
      g.gain.setValueAtTime(hGain, startAt);
      g.gain.exponentialRampToValueAtTime(0.0001, startAt + 2.2 / harmonic);
      osc.connect(g); g.connect(masterGain);
      osc.start(startAt); osc.stop(startAt + 2.5 / harmonic);
    });
  }

  function playHarp() {
    var now = audioCtx.currentTime;
    var chords = [
      [D3, F3, A3, D4, F4],
      [A3, C4, E4, A4],
      [G3, B3, D4, G4],
      [F3, A3, C4, F4],
      [D3, A3, D4, F4, A4],
    ];
    var chord = pick(chords);
    var noteCount = chord.length + rndInt(0, 2);
    var cursor = now;
    for (var i = 0; i < noteCount; i++) {
      var note = chord[Math.min(i, chord.length - 1)];
      if (i === noteCount - 1 && Math.random() < 0.5) note *= 2;
      pluck(note, cursor, rnd(0.026, 0.040));
      cursor += rnd(0.18, 0.32);
    }
    if (Math.random() < 0.45) {
      var chord2 = pick(chords);
      cursor += rnd(0.4, 1.0);
      for (var j = 0; j < chord2.length; j++) {
        pluck(chord2[j], cursor, rnd(0.016, 0.028));
        cursor += rnd(0.14, 0.26);
      }
    }
  }

  function scheduleHarp() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      playHarp();
      scheduleHarp();
    }, 8, 22);
  }

  /* ─── SHAKUHACHI FLUTE ──────────────────────────────────────
     Zelda BOTW/TOTK style: 2-3 long notes, each 2.5-4.8s,
     long breath rests between notes, deep forest reverb.
     Very sparse — appears once every 65-110s.               */
  function playFlute(phrase) {
    var rev = getFluteReverb();
    var cursor = audioCtx.currentTime + rnd(0.8, 2.0);
    phrase.forEach(function (note) {
      (function (startAt, freq, dur) {
        /* Shakuhachi: sine fundamental with embouchure pitch slide */
        var osc = audioCtx.createOscillator();
        osc.type = 'sine';
        /* Real shakuhachi dips ~15 cents flat on attack then settles */
        var flatStart = freq * Math.pow(2, -15/1200);
        osc.frequency.setValueAtTime(flatStart, startAt);
        osc.frequency.linearRampToValueAtTime(freq, startAt + 0.35);
        /* Slight pitch sway mid-note — player naturally drifts ±3 cents */
        var midDrift = freq * Math.pow(2, rnd(-3, 3) / 1200);
        osc.frequency.linearRampToValueAtTime(midDrift, startAt + dur * 0.5);
        osc.frequency.linearRampToValueAtTime(freq, startAt + dur * 0.8);
        allSources.push(osc);

        /* 2nd harmonic — 12% of main, gives body */
        var harm2 = audioCtx.createOscillator();
        harm2.type = 'sine';
        harm2.frequency.value = freq * 2;
        allSources.push(harm2);

        /* 3rd harmonic — 4%, adds subtle warmth */
        var harm3 = audioCtx.createOscillator();
        harm3.type = 'sine';
        harm3.frequency.value = freq * 3;
        allSources.push(harm3);

        /* Vibrato — enters after 40% of note, accelerates gently */
        var vib = audioCtx.createOscillator();
        vib.type = 'sine';
        vib.frequency.value = rnd(4.0, 5.2);
        allSources.push(vib);
        var vibDepth = makeGain(0);
        vibDepth.gain.setValueAtTime(0, startAt);
        vibDepth.gain.linearRampToValueAtTime(0, startAt + dur * 0.40);
        vibDepth.gain.linearRampToValueAtTime(rnd(2.0, 3.5), startAt + dur * 0.72);
        vib.connect(vibDepth); vibDepth.connect(osc.frequency);

        /* Barely-audible breath — just organic texture */
        var breathSrc = oneshotNoise(dur + 0.4);
        var breathBpf = audioCtx.createBiquadFilter();
        breathBpf.type = 'bandpass';
        breathBpf.frequency.value = freq * 1.3;
        breathBpf.Q.value = 1.8;
        var breathG = makeGain(0.0005);
        breathSrc.connect(breathBpf); breathBpf.connect(breathG); breathG.connect(masterGain);
        breathSrc.start(startAt);

        /* Main gain — slow attack, then a dynamic swell at 55% of note
           so it feels like the player drawing a deeper breath mid-phrase */
        var peak = rnd(0.007, 0.011);
        var swell = peak * rnd(1.12, 1.28);
        var g = makeGain(0);
        g.gain.setValueAtTime(0, startAt);
        g.gain.linearRampToValueAtTime(peak * 0.22, startAt + 0.10);
        g.gain.linearRampToValueAtTime(peak, startAt + 0.50);
        g.gain.linearRampToValueAtTime(peak * 0.80, startAt + dur * 0.42);
        g.gain.linearRampToValueAtTime(swell, startAt + dur * 0.62);
        g.gain.linearRampToValueAtTime(peak * 0.55, startAt + dur - 0.4);
        g.gain.linearRampToValueAtTime(0, startAt + dur + 0.7);

        var g2 = makeGain(0);
        g2.gain.setValueAtTime(0, startAt);
        g2.gain.linearRampToValueAtTime(peak * 0.12, startAt + 0.4);
        g2.gain.linearRampToValueAtTime(0, startAt + dur + 0.3);

        var g3 = makeGain(0);
        g3.gain.setValueAtTime(0, startAt);
        g3.gain.linearRampToValueAtTime(peak * 0.04, startAt + 0.4);
        g3.gain.linearRampToValueAtTime(0, startAt + dur + 0.2);

        var lpf = audioCtx.createBiquadFilter();
        lpf.type = 'lowpass'; lpf.frequency.value = rnd(3600, 4800);

        osc.connect(lpf); lpf.connect(g);
        g.connect(masterGain);
        g.connect(rev);
        harm2.connect(g2); g2.connect(masterGain); g2.connect(rev);
        harm3.connect(g3); g3.connect(masterGain);

        vib.start(startAt);
        osc.start(startAt); harm2.start(startAt); harm3.start(startAt);
        var stopAt = startAt + dur + 0.8;
        osc.stop(stopAt); harm2.stop(stopAt); harm3.stop(stopAt); vib.stop(stopAt);
      })(cursor, note.f, note.d);
      /* Long breath rest between notes */
      cursor += note.d + rnd(1.2, 2.5);
    });
  }

  function scheduleFlute() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      playFlute(pick(FLUTE_PHRASES));
      scheduleFlute();
    }, 65, 110);
  }

  /* ─── CHOIR SWELL ───────────────────────────────────────────  */
  function playChoirSwell() {
    var now = audioCtx.currentTime;
    var chordNotes = [D3 * 2, F3 * 2, A3 * 2];
    var dur = rnd(7, 11);
    chordNotes.forEach(function (baseFreq) {
      [-8, -3, 0, 3, 8].forEach(function (cents) {
        var osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = baseFreq * Math.pow(2, cents / 1200);
        allSources.push(osc);
        var lpf = audioCtx.createBiquadFilter();
        lpf.type = 'lowpass'; lpf.frequency.value = 1800;
        var g = makeGain(0);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(rnd(0.007, 0.011), now + dur * 0.35);
        g.gain.setValueAtTime(rnd(0.007, 0.011), now + dur * 0.6);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        osc.connect(lpf); lpf.connect(g); g.connect(masterGain);
        osc.start(now); osc.stop(now + dur + 0.1);
      });
    });
  }

  function scheduleChoirSwell() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      playChoirSwell();
      scheduleChoirSwell();
    }, 60, 130);
  }

  /* ─── BIRDS ─────────────────────────────────────────────────  */
  function chirpBird(baseFreq, pattern, gain) {
    var now = audioCtx.currentTime;
    var cursor = now;
    pattern.forEach(function (n) {
      (function (startAt, freq, dur) {
        var osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startAt);
        osc.frequency.linearRampToValueAtTime(freq * rnd(0.97, 1.05), startAt + dur);
        var g = audioCtx.createGain();
        g.gain.setValueAtTime(0, startAt);
        g.gain.linearRampToValueAtTime(gain, startAt + 0.012);
        g.gain.setValueAtTime(gain, startAt + dur - 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, startAt + dur + 0.015);
        osc.connect(g); g.connect(masterGain);
        osc.start(startAt); osc.stop(startAt + dur + 0.02);
      })(cursor, baseFreq * n.m, n.d);
      cursor += n.d + rnd(0.02, 0.06);
    });
  }

  /* Blackbird-style melodic phrase */
  function scheduleBirdC() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var base = rnd(1600, 2200);
      var mults = [1, 1.12, 1.25, 1.18, 1.05, 0.94, 1.0];
      var phrase = mults.slice(0, rndInt(4, 7)).map(function (m) {
        return {m: m * rnd(0.97, 1.03), d: rnd(0.12, 0.22)};
      });
      chirpBird(base, phrase, rnd(0.022, 0.034));
      scheduleBirdC();
    }, 12, 32);
  }

  /* Distant high chirps — the "whistles" the user likes */
  function scheduleBirdD() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var base = rnd(3000, 5000);
      chirpBird(base, [{m:1, d:rnd(0.04,0.08)}, {m:rnd(0.9,1.1), d:rnd(0.04,0.07)}], rnd(0.009, 0.016));
      scheduleBirdD();
    }, 4, 13);
  }

  /* ─── OWL ───────────────────────────────────────────────────  */
  function hootOwl(startAt, freq, peakGain, dur) {
    var osc = audioCtx.createOscillator();
    osc.type = 'sine'; allSources.push(osc);
    osc.frequency.setValueAtTime(freq * 1.04, startAt);
    osc.frequency.linearRampToValueAtTime(freq * 0.96, startAt + dur * 0.7);
    var trem = audioCtx.createOscillator();
    trem.frequency.value = rnd(5.5, 7.0);
    var tremDepth = makeGain(peakGain * 0.08);
    trem.connect(tremDepth);
    var g = makeGain(0);
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(peakGain, startAt + dur * 0.12);
    g.gain.setValueAtTime(peakGain, startAt + dur * 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
    tremDepth.connect(g.gain);
    trem.start(startAt); trem.stop(startAt + dur + 0.1);
    osc.connect(g); g.connect(masterGain);
    osc.start(startAt); osc.stop(startAt + dur + 0.05);
  }

  function scheduleOwl() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;
      var isClose = Math.random() < 0.45;
      var freq = isClose ? rnd(200, 250) : rnd(160, 210);
      var gain = isClose ? rnd(0.07, 0.10) : rnd(0.025, 0.042);
      var hoots = rndInt(1, isClose ? 3 : 2);
      var hootDur = isClose ? 0.60 : 0.50;
      if (!isClose) {
        var lpf = audioCtx.createBiquadFilter();
        lpf.type = 'lowpass'; lpf.frequency.value = rnd(600, 900);
        for (var h = 0; h < hoots; h++) {
          (function (startAt) {
            var osc = audioCtx.createOscillator();
            osc.type = 'sine'; allSources.push(osc);
            osc.frequency.setValueAtTime(freq * 1.03, startAt);
            osc.frequency.linearRampToValueAtTime(freq * 0.96, startAt + hootDur * 0.7);
            var g = makeGain(0);
            g.gain.setValueAtTime(0, startAt);
            g.gain.linearRampToValueAtTime(gain, startAt + 0.10);
            g.gain.setValueAtTime(gain, startAt + hootDur * 0.72);
            g.gain.exponentialRampToValueAtTime(0.0001, startAt + hootDur);
            osc.connect(lpf); lpf.connect(g); g.connect(masterGain);
            osc.start(startAt); osc.stop(startAt + hootDur + 0.05);
          })(now + h * rnd(1.0, 1.6));
        }
      } else {
        for (var h = 0; h < hoots; h++) {
          hootOwl(now + h * rnd(0.85, 1.3), freq, gain, hootDur);
        }
      }
      scheduleOwl();
    }, 15, 38);
  }

  /* ─── GALLOP ─────────────────────────────────────────────────  */
  var GALLOP_VARIANTS = [
    { name:'walk',   beats:[4,6],   interval:[0.55,0.70], lpf:[200,320], gain:[0.44,0.60], clickGain:0.20, clickHz:[600,900]  },
    { name:'trot',   beats:[8,12],  interval:[0.28,0.36], lpf:[280,420], gain:[0.36,0.50], clickGain:0.16, clickHz:[700,1100] },
    { name:'canter', beats:[12,16], interval:[0.17,0.24], lpf:[320,480], gain:[0.34,0.48], clickGain:0.14, clickHz:[800,1200] },
    { name:'gallop', beats:[14,20], interval:[0.11,0.16], lpf:[340,520], gain:[0.32,0.46], clickGain:0.13, clickHz:[900,1400] },
  ];

  function playGallopVariant(variant) {
    var now = audioCtx.currentTime;
    var beats = rndInt(variant.beats[0], variant.beats[1]);
    var baseInterval = rnd(variant.interval[0], variant.interval[1]);
    var cursor = now;
    for (var i = 0; i < beats; i++) {
      var p = i / beats;
      var env = p < 0.5 ? (0.8 + p * 0.4) : Math.max(0.7, 1.2 - (p - 0.5) * 1.2);
      var offsets = variant.name === 'walk' ? [0, rnd(0.10, 0.20)] : [0, rnd(0.04, 0.10)];
      (function (startAt, envMul) {
        offsets.forEach(function (offset) {
          var src = audioCtx.createBufferSource();
          src.buffer = makeNoiseBuffer(0.12);
          var lpf = audioCtx.createBiquadFilter();
          lpf.type = 'lowpass';
          lpf.frequency.value = rnd(variant.lpf[0], variant.lpf[1]);
          var g = audioCtx.createGain();
          var thudk = rnd(variant.gain[0], variant.gain[1]) * envMul * (offset > 0 ? 0.75 : 1);
          g.gain.setValueAtTime(thudk, startAt + offset);
          g.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + 0.10);
          src.connect(lpf); lpf.connect(g); g.connect(masterGain);
          src.start(startAt + offset);
          var click = audioCtx.createBufferSource();
          click.buffer = makeNoiseBuffer(0.045);
          var bpf = audioCtx.createBiquadFilter();
          bpf.type = 'bandpass';
          bpf.frequency.value = rnd(variant.clickHz[0], variant.clickHz[1]);
          bpf.Q.value = rnd(2.5, 4.5);
          var cg = audioCtx.createGain();
          var clickk = variant.clickGain * envMul * (offset > 0 ? 0.7 : 1);
          cg.gain.setValueAtTime(clickk, startAt + offset);
          cg.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + 0.038);
          click.connect(bpf); bpf.connect(cg); cg.connect(masterGain);
          click.start(startAt + offset);
        });
        if (variant.name === 'walk' && Math.random() < 0.65) {
          var sub = audioCtx.createBufferSource();
          sub.buffer = makeNoiseBuffer(0.06);
          var subLpf = audioCtx.createBiquadFilter();
          subLpf.type = 'lowpass'; subLpf.frequency.value = rnd(100, 160);
          var sg = audioCtx.createGain();
          sg.gain.setValueAtTime(envMul * 0.35, startAt + 0.018);
          sg.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.065);
          sub.connect(subLpf); subLpf.connect(sg); sg.connect(masterGain);
          sub.start(startAt + 0.018);
        }
      })(cursor, env);
      cursor += baseInterval + rnd(-0.012, 0.012);
    }
  }

  function scheduleGallop() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var weights = [0.12, 0.28, 0.38, 0.22];
      var r = Math.random(), cumulative = 0, chosen = GALLOP_VARIANTS[2];
      for (var i = 0; i < weights.length; i++) {
        cumulative += weights[i];
        if (r < cumulative) { chosen = GALLOP_VARIANTS[i]; break; }
      }
      playGallopVariant(chosen);
      scheduleGallop();
    }, 7, 22);
  }

  /* ─── FOREST FOOTSTEPS ──────────────────────────────────────
     Slow hooves on soft forest floor — earthy, muffled thuds
     with subtle leaf/soil texture. Clearly slower and softer
     than the gallop variants above.                            */
  function playForestFootstep() {
    var now = audioCtx.currentTime;
    var stepCount = rndInt(2, 4);
    var stepInterval = rnd(0.38, 0.72);
    var cursor = now;
    for (var i = 0; i < stepCount; i++) {
      (function (startAt) {
        /* Muffled hoof thud — very low LPF, soft forest floor */
        var thud = oneshotNoise(0.18);
        var lpf = audioCtx.createBiquadFilter();
        lpf.type = 'lowpass'; lpf.frequency.value = rnd(110, 190);
        var g = audioCtx.createGain();
        g.gain.setValueAtTime(rnd(0.30, 0.44), startAt);
        g.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.16);
        thud.connect(lpf); lpf.connect(g); g.connect(masterGain);
        thud.start(startAt);
        /* Earth/leaf crunch texture */
        var crunch = oneshotNoise(0.22);
        var bpf = audioCtx.createBiquadFilter();
        bpf.type = 'bandpass'; bpf.frequency.value = rnd(320, 560); bpf.Q.value = 0.9;
        var cg = audioCtx.createGain();
        cg.gain.setValueAtTime(rnd(0.012, 0.022), startAt + 0.01);
        cg.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.20);
        crunch.connect(bpf); bpf.connect(cg); cg.connect(masterGain);
        crunch.start(startAt + 0.01);
      })(cursor);
      cursor += stepInterval + rnd(-0.06, 0.06);
    }
  }

  function scheduleForestFootstep() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      playForestFootstep();
      scheduleForestFootstep();
    }, 14, 40);
  }

  /* ─── BOW DRAW ───────────────────────────────────────────────
     Subtle creak of a bowstring drawing back — rising filtered
     noise with a faint wood-flex tone at full draw.            */
  function playBowDraw() {
    var now = audioCtx.currentTime;
    var dur = rnd(0.9, 1.5);
    /* String tension — slowly rising bandpass noise */
    var src = oneshotNoise(dur + 0.15);
    var bpf = audioCtx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.setValueAtTime(rnd(700, 1000), now);
    bpf.frequency.linearRampToValueAtTime(rnd(1400, 2000), now + dur);
    bpf.Q.value = rnd(5, 9);
    var g = audioCtx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(rnd(0.007, 0.013), now + dur * 0.55);
    g.gain.linearRampToValueAtTime(rnd(0.010, 0.016), now + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.08);
    src.connect(bpf); bpf.connect(g); g.connect(masterGain);
    src.start(now);
    /* Wood flex at full draw */
    var flex = audioCtx.createOscillator();
    flex.type = 'sine';
    flex.frequency.setValueAtTime(rnd(200, 300), now + dur * 0.72);
    flex.frequency.linearRampToValueAtTime(rnd(140, 190), now + dur);
    allSources.push(flex);
    var fg = makeGain(0);
    fg.gain.setValueAtTime(0, now + dur * 0.68);
    fg.gain.linearRampToValueAtTime(rnd(0.004, 0.007), now + dur * 0.85);
    fg.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.1);
    flex.connect(fg); fg.connect(masterGain);
    flex.start(now + dur * 0.68); flex.stop(now + dur + 0.15);
  }

  function scheduleBowDraw() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      playBowDraw();
      scheduleBowDraw();
    }, 28, 65);
  }

  /* ─── SPELL SOUNDS (Lineage 2 inspired) ─────────────────────
     Arcane whoosh, dark ritual, heal shimmer, lightning crack.
     All kept quiet — atmosphere only, not game sound effects.  */
  function playSpell(type) {
    var now = audioCtx.currentTime;
    if (type === 'arcane') {
      /* Rising arcane whoosh with high shimmer at peak */
      var dur = rnd(1.1, 1.9);
      var src = oneshotNoise(dur);
      var bpf = audioCtx.createBiquadFilter();
      bpf.type = 'bandpass';
      bpf.frequency.setValueAtTime(rnd(350, 550), now);
      bpf.frequency.exponentialRampToValueAtTime(rnd(2200, 3800), now + dur * 0.75);
      bpf.Q.value = rnd(1.5, 3.0);
      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(rnd(0.016, 0.024), now + dur * 0.45);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      src.connect(bpf); bpf.connect(g); g.connect(masterGain);
      src.start(now);
      /* Shimmer tones at the peak */
      [rnd(2900, 3600), rnd(3600, 4400)].forEach(function (freq) {
        var osc = audioCtx.createOscillator();
        osc.type = 'sine'; osc.frequency.value = freq;
        allSources.push(osc);
        var sg = makeGain(0);
        sg.gain.setValueAtTime(0, now + dur * 0.38);
        sg.gain.linearRampToValueAtTime(rnd(0.005, 0.009), now + dur * 0.62);
        sg.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.25);
        osc.connect(sg); sg.connect(masterGain);
        osc.start(now + dur * 0.38); osc.stop(now + dur + 0.3);
      });
    } else if (type === 'dark') {
      /* Dark ritual — descending overtones, eerie fall */
      var dur = rnd(1.4, 2.2);
      var base = rnd(60, 95);
      [1, 1.5, 2.5].forEach(function (mult) {
        var osc = audioCtx.createOscillator();
        osc.type = mult === 1 ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(base * mult, now);
        osc.frequency.linearRampToValueAtTime(base * mult * rnd(0.72, 0.85), now + dur);
        allSources.push(osc);
        var lpf = audioCtx.createBiquadFilter();
        lpf.type = 'lowpass'; lpf.frequency.value = mult === 1 ? 280 : 700;
        var g = makeGain(0);
        var peak = rnd(0.012, 0.020) / mult;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(peak, now + 0.18);
        g.gain.setValueAtTime(peak, now + dur * 0.68);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        osc.connect(lpf); lpf.connect(g); g.connect(masterGain);
        osc.start(now); osc.stop(now + dur + 0.1);
      });
      /* Eerie descending whistle */
      var whistle = audioCtx.createOscillator();
      whistle.type = 'sine';
      whistle.frequency.setValueAtTime(rnd(650, 950), now + 0.12);
      whistle.frequency.linearRampToValueAtTime(rnd(280, 420), now + dur);
      allSources.push(whistle);
      var wg = makeGain(0);
      wg.gain.setValueAtTime(0, now + 0.12);
      wg.gain.linearRampToValueAtTime(rnd(0.005, 0.009), now + 0.42);
      wg.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.15);
      whistle.connect(wg); wg.connect(masterGain);
      whistle.start(now + 0.12); whistle.stop(now + dur + 0.2);
    } else if (type === 'heal') {
      /* Heal — three ascending bell-shimmer tones */
      [D4 * 2, G4 * 2, A4 * 2].forEach(function (freq, i) {
        var startAt = now + i * rnd(0.18, 0.26);
        var dur = rnd(0.85, 1.3);
        [1, 2].forEach(function (h) {
          var osc = audioCtx.createOscillator();
          osc.type = 'sine'; osc.frequency.value = freq * h;
          allSources.push(osc);
          var g = makeGain(0);
          var peak = rnd(0.007, 0.012) / (h * h);
          g.gain.setValueAtTime(peak, startAt);
          g.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
          osc.connect(g); g.connect(masterGain);
          osc.start(startAt); osc.stop(startAt + dur + 0.1);
        });
      });
    } else if (type === 'lightning') {
      /* Lightning crack — sharp burst with electric hum tail */
      var crack = oneshotNoise(0.22);
      var hpf = audioCtx.createBiquadFilter();
      hpf.type = 'highpass'; hpf.frequency.value = rnd(2200, 3200);
      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(rnd(0.045, 0.070), now + 0.007);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.20);
      crack.connect(hpf); hpf.connect(g); g.connect(masterGain);
      crack.start(now);
      /* Electric hum decay */
      var hum = audioCtx.createOscillator();
      hum.type = 'sawtooth';
      hum.frequency.setValueAtTime(rnd(85, 130), now + 0.01);
      allSources.push(hum);
      var lpf2 = audioCtx.createBiquadFilter();
      lpf2.type = 'lowpass'; lpf2.frequency.value = 380;
      var hg = makeGain(0);
      hg.gain.setValueAtTime(0, now + 0.01);
      hg.gain.linearRampToValueAtTime(rnd(0.015, 0.024), now + 0.04);
      hg.gain.exponentialRampToValueAtTime(0.0001, now + 0.50);
      hum.connect(lpf2); lpf2.connect(hg); hg.connect(masterGain);
      hum.start(now + 0.01); hum.stop(now + 0.55);
    } else if (type === 'fire') {
      /* Fire — roaring whoosh with crackling texture */
      var dur = rnd(1.0, 1.8);
      var src = oneshotNoise(dur + 0.2);
      var lpf = audioCtx.createBiquadFilter();
      lpf.type = 'lowpass'; lpf.frequency.value = rnd(320, 560);
      var g = makeGain(0);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(rnd(0.055, 0.090), now + 0.08);
      g.gain.setValueAtTime(rnd(0.040, 0.070), now + dur * 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.15);
      src.connect(lpf); lpf.connect(g); g.connect(masterGain);
      src.start(now);
      /* Crackle layer - high bandpass burst */
      var crk = oneshotNoise(dur * 0.6);
      var bpf = audioCtx.createBiquadFilter();
      bpf.type = 'bandpass'; bpf.frequency.value = rnd(1800, 2800); bpf.Q.value = 0.6;
      var cg = makeGain(0);
      cg.gain.setValueAtTime(0, now + 0.05);
      cg.gain.linearRampToValueAtTime(rnd(0.018, 0.030), now + 0.18);
      cg.gain.exponentialRampToValueAtTime(0.0001, now + dur * 0.7);
      crk.connect(bpf); bpf.connect(cg); cg.connect(masterGain);
      crk.start(now + 0.05);
      /* Rising harmonic — hot air shimmer */
      var hiss = audioCtx.createOscillator();
      hiss.type = 'sawtooth';
      hiss.frequency.setValueAtTime(rnd(140, 200), now);
      hiss.frequency.linearRampToValueAtTime(rnd(320, 440), now + dur * 0.6);
      allSources.push(hiss);
      var hlpf = audioCtx.createBiquadFilter();
      hlpf.type = 'lowpass'; hlpf.frequency.value = 320;
      var hg = makeGain(0);
      hg.gain.setValueAtTime(0, now);
      hg.gain.linearRampToValueAtTime(rnd(0.008, 0.014), now + 0.12);
      hg.gain.exponentialRampToValueAtTime(0.0001, now + dur * 0.75);
      hiss.connect(hlpf); hlpf.connect(hg); hg.connect(masterGain);
      hiss.start(now); hiss.stop(now + dur);
    } else if (type === 'ice') {
      /* Ice — high crystalline shimmer with cold resonance */
      var dur = rnd(0.8, 1.4);
      [rnd(2400, 3200), rnd(3200, 4200), rnd(4200, 5600)].forEach(function (freq, i) {
        var o = audioCtx.createOscillator();
        o.type = 'sine'; o.frequency.value = freq;
        allSources.push(o);
        var g = makeGain(0);
        var peak = rnd(0.008, 0.014) / (i + 1);
        g.gain.setValueAtTime(peak * 0.8, now + i * 0.04);
        g.gain.linearRampToValueAtTime(peak, now + i * 0.04 + 0.06);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur + i * 0.06);
        o.connect(g); g.connect(masterGain);
        o.start(now + i * 0.04); o.stop(now + dur + i * 0.08 + 0.1);
      });
      /* Shatter noise burst */
      var shard = oneshotNoise(0.18);
      var hpf = audioCtx.createBiquadFilter();
      hpf.type = 'highpass'; hpf.frequency.value = rnd(3500, 5000);
      var sg = makeGain(0);
      sg.gain.setValueAtTime(rnd(0.018, 0.030), now);
      sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      shard.connect(hpf); hpf.connect(sg); sg.connect(masterGain);
      shard.start(now);
    } else if (type === 'wind') {
      /* Wind spell — rushing bandpass noise swells */
      var dur = rnd(1.2, 2.0);
      var src = oneshotNoise(dur + 0.3);
      var bpf = audioCtx.createBiquadFilter();
      bpf.type = 'bandpass'; bpf.frequency.value = rnd(600, 1200); bpf.Q.value = rnd(0.5, 1.0);
      var g = makeGain(0);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(rnd(0.035, 0.060), now + dur * 0.25);
      g.gain.setValueAtTime(rnd(0.030, 0.052), now + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.2);
      src.connect(bpf); bpf.connect(g); g.connect(masterGain);
      src.start(now);
      /* Whistling overtone */
      var whistle = audioCtx.createOscillator();
      whistle.type = 'sine';
      var wBase = rnd(420, 680);
      whistle.frequency.setValueAtTime(wBase, now);
      whistle.frequency.linearRampToValueAtTime(wBase * rnd(1.12, 1.28), now + dur * 0.55);
      whistle.frequency.linearRampToValueAtTime(wBase * rnd(0.88, 0.96), now + dur + 0.1);
      allSources.push(whistle);
      var wg = makeGain(0);
      wg.gain.setValueAtTime(0, now);
      wg.gain.linearRampToValueAtTime(rnd(0.007, 0.013), now + dur * 0.3);
      wg.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.15);
      whistle.connect(wg); wg.connect(masterGain);
      whistle.start(now); whistle.stop(now + dur + 0.2);
    } else if (type === 'earth') {
      /* Earth — deep rumble with stone crack */
      var dur = rnd(0.8, 1.4);
      var rumble = oneshotNoise(dur + 0.2);
      var lpf = audioCtx.createBiquadFilter();
      lpf.type = 'lowpass'; lpf.frequency.value = rnd(120, 220);
      var g = makeGain(0);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(rnd(0.065, 0.100), now + 0.06);
      g.gain.setValueAtTime(rnd(0.050, 0.080), now + dur * 0.45);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.15);
      rumble.connect(lpf); lpf.connect(g); g.connect(masterGain);
      rumble.start(now);
      /* Low sub thud */
      var sub = audioCtx.createOscillator();
      sub.type = 'sine'; sub.frequency.value = rnd(48, 72);
      allSources.push(sub);
      var sg = makeGain(0);
      sg.gain.setValueAtTime(0, now);
      sg.gain.linearRampToValueAtTime(rnd(0.035, 0.055), now + 0.04);
      sg.gain.exponentialRampToValueAtTime(0.0001, now + dur * 0.7);
      sub.connect(sg); sg.connect(masterGain);
      sub.start(now); sub.stop(now + dur);
      /* Stone crack — mid bandpass snap */
      var crack = oneshotNoise(0.14);
      var bpf = audioCtx.createBiquadFilter();
      bpf.type = 'bandpass'; bpf.frequency.value = rnd(380, 620); bpf.Q.value = 1.5;
      var cg = makeGain(0);
      cg.gain.setValueAtTime(rnd(0.025, 0.040), now + 0.02);
      cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      crack.connect(bpf); bpf.connect(cg); cg.connect(masterGain);
      crack.start(now + 0.02);
    }
  }

  var SPELL_TYPES = ['arcane', 'dark', 'lightning', 'fire', 'wind', 'earth'];
  function scheduleSpell() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      playSpell(pick(SPELL_TYPES));
      scheduleSpell();
    }, 30, 75);
  }

  /* ─── LEAF RUSTLE ────────────────────────────────────────────  */
  function scheduleLeafRustle() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;
      var dur = rnd(0.3, 0.8);
      var src = oneshotNoise(dur + 0.1);
      var bpf = audioCtx.createBiquadFilter();
      bpf.type = 'bandpass'; bpf.frequency.value = rnd(900, 1400); bpf.Q.value = rnd(0.8, 1.4);
      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(rnd(0.016, 0.030), now + dur * 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.04);
      src.connect(bpf); bpf.connect(g); g.connect(masterGain);
      src.start(now);
      scheduleLeafRustle();
    }, 8, 20);
  }

  /* ─── WOODPECKER ─────────────────────────────────────────────
     Rapid staccato drumming — real woodpeckers hit 18-25 taps/sec.
     Bandpass noise at 2800-4200Hz, each tap ~18-22ms.            */
  function playWoodpecker() {
    var now = audioCtx.currentTime;
    var tapRate = rnd(18, 25);
    var tapCount = rndInt(12, 28);
    var tapDur = 0.020;
    var tapGain = rnd(0.028, 0.048);
    var tapFreq = rnd(2800, 4200);
    /* Two short bursts with a small pause — more realistic */
    var burstSplit = Math.floor(tapCount * rnd(0.4, 0.6));
    var pauseGap = rnd(0.18, 0.45);
    for (var i = 0; i < tapCount; i++) {
      (function (idx) {
        var offset = idx < burstSplit
          ? idx / tapRate
          : burstSplit / tapRate + pauseGap + (idx - burstSplit) / tapRate;
        var src = oneshotNoise(tapDur + 0.01);
        var bpf = audioCtx.createBiquadFilter();
        bpf.type = 'bandpass';
        bpf.frequency.value = tapFreq * rnd(0.94, 1.06);
        bpf.Q.value = rnd(4.0, 7.0);
        var g = audioCtx.createGain();
        var v = tapGain * rnd(0.82, 1.18);
        g.gain.setValueAtTime(v, now + offset);
        g.gain.exponentialRampToValueAtTime(0.0001, now + offset + tapDur);
        src.connect(bpf); bpf.connect(g); g.connect(masterGain);
        src.start(now + offset);
      })(i);
    }
  }

  function scheduleWoodpecker() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      playWoodpecker();
      scheduleWoodpecker();
    }, 18, 55);
  }

  /* ─── WOLF HOWL ──────────────────────────────────────────────
     Rising frequency with vibrato, sustained then fall. Eerie.  */
  function playWolfHowl() {
    var now = audioCtx.currentTime;
    var dur = rnd(2.5, 4.5);
    var baseFreq = rnd(320, 420);
    var peakFreq = baseFreq * rnd(2.2, 2.8);
    /* Fundamental */
    var osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.linearRampToValueAtTime(peakFreq, now + dur * 0.35);
    osc.frequency.setValueAtTime(peakFreq, now + dur * 0.65);
    osc.frequency.linearRampToValueAtTime(peakFreq * rnd(0.72, 0.82), now + dur);
    allSources.push(osc);
    /* Vibrato LFO */
    var lfo = audioCtx.createOscillator();
    lfo.frequency.value = rnd(4.5, 6.5);
    var lfoDepth = makeGain(peakFreq * 0.018);
    lfo.connect(lfoDepth); lfoDepth.connect(osc.frequency);
    lfo.start(now + dur * 0.28); lfo.stop(now + dur + 0.1);
    allSources.push(lfo);
    /* Gain envelope */
    var g = makeGain(0);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(rnd(0.032, 0.052), now + dur * 0.18);
    g.gain.setValueAtTime(rnd(0.030, 0.048), now + dur * 0.72);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.3);
    osc.connect(g); g.connect(masterGain);
    osc.start(now); osc.stop(now + dur + 0.4);
    /* Harmonic 2 — adds body */
    var osc2 = audioCtx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(baseFreq * 2, now);
    osc2.frequency.linearRampToValueAtTime(peakFreq * 2, now + dur * 0.35);
    osc2.frequency.setValueAtTime(peakFreq * 2, now + dur * 0.65);
    osc2.frequency.linearRampToValueAtTime(peakFreq * 1.55, now + dur);
    allSources.push(osc2);
    var g2 = makeGain(0);
    g2.gain.setValueAtTime(0, now);
    g2.gain.linearRampToValueAtTime(rnd(0.010, 0.018), now + dur * 0.22);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.1);
    osc2.connect(g2); g2.connect(masterGain);
    osc2.start(now); osc2.stop(now + dur + 0.2);
    /* Breathiness — narrow bandpass noise */
    var breath = oneshotNoise(dur * 0.7);
    var bpf = audioCtx.createBiquadFilter();
    bpf.type = 'bandpass'; bpf.frequency.value = peakFreq * 0.8; bpf.Q.value = 1.8;
    var bg = makeGain(0);
    bg.gain.setValueAtTime(0, now + dur * 0.15);
    bg.gain.linearRampToValueAtTime(rnd(0.006, 0.010), now + dur * 0.4);
    bg.gain.exponentialRampToValueAtTime(0.0001, now + dur * 0.85);
    breath.connect(bpf); bpf.connect(bg); bg.connect(masterGain);
    breath.start(now + dur * 0.15);
  }

  function scheduleWolfHowl() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      playWolfHowl();
      scheduleWolfHowl();
    }, 45, 120);
  }

  /* ─── BEAR ROAR ──────────────────────────────────────────────
     Deep sawtooth + noise, very low base freq, rough growl.     */
  function playBearRoar() {
    var now = audioCtx.currentTime;
    var dur = rnd(1.2, 2.2);
    var baseFreq = rnd(65, 100);
    /* Sawtooth core — raw growl */
    [1, 1.52, 2.1].forEach(function (mult, i) {
      var osc = audioCtx.createOscillator();
      osc.type = i === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(baseFreq * mult * rnd(0.97, 1.03), now);
      osc.frequency.linearRampToValueAtTime(baseFreq * mult * rnd(0.82, 0.92), now + dur);
      allSources.push(osc);
      var lpf = audioCtx.createBiquadFilter();
      lpf.type = 'lowpass'; lpf.frequency.value = i === 0 ? 320 : 560;
      var g = makeGain(0);
      var peak = (rnd(0.045, 0.075) / (i + 1));
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(peak, now + 0.06);
      g.gain.setValueAtTime(peak * rnd(0.85, 1.0), now + dur * 0.55);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.15);
      osc.connect(lpf); lpf.connect(g); g.connect(masterGain);
      osc.start(now); osc.stop(now + dur + 0.2);
    });
    /* Noise texture — chest cavity roughness */
    var src = oneshotNoise(dur + 0.2);
    var bpf = audioCtx.createBiquadFilter();
    bpf.type = 'bandpass'; bpf.frequency.value = rnd(180, 320); bpf.Q.value = rnd(0.6, 1.2);
    var ng = makeGain(0);
    ng.gain.setValueAtTime(0, now);
    ng.gain.linearRampToValueAtTime(rnd(0.020, 0.036), now + 0.08);
    ng.gain.setValueAtTime(rnd(0.016, 0.028), now + dur * 0.5);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.1);
    src.connect(bpf); bpf.connect(ng); ng.connect(masterGain);
    src.start(now);
  }

  function scheduleBearRoar() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      playBearRoar();
      scheduleBearRoar();
    }, 60, 150);
  }

  /* ─── START ──────────────────────────────────────────────────
     Two-minute intro: every sound appears at least once in the
     first 120 seconds — like a scene-setting song. After each
     guaranteed hit the recursive scheduler takes over for random
     ongoing spacing. Beds (wind, pad) run continuously.        */
  function startAudio() {
    if (audioStarted) return;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { return; }
    if (audioCtx.state === 'suspended') audioCtx.resume();

    /* Keep the context alive — mobile browsers re-suspend after ~1s without this */
    keepAliveId = setInterval(function() {
      if (!audioCtx) { clearInterval(keepAliveId); keepAliveId = null; return; }
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(function(){});
    }, 1000);

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.88;
    masterGain.connect(audioCtx.destination);
    allGains.push(masterGain);

    /* Always-on beds */
    startStringPad();
    startWind();

    /* ── 0-30s: Open the scene ───────────────────────────────── */

    /* Birds + rustles + footsteps: short schedulers naturally cover the window */
    scheduleBirdD();                /* chirps: ~4-13s          */
    scheduleBirdC();                /* song:   ~12-32s         */
    scheduleLeafRustle();           /* rustle: ~8-20s          */
    scheduleForestFootstep();       /* soft hoof: ~14-40s      */
    scheduleWoodpecker();           /* tapping: ~18-55s        */

    /* Harp — first pluck very early, like the scene fading in */
    at(rnd(4, 8), function () { playHarp(); });

    /* FLUTE — early, present right away so it's not withheld */
    at(rnd(10, 16), function () { playFlute(pick(FLUTE_PHRASES)); });

    /* String melody — first full phrase around 18-28s */
    at(rnd(18, 28), function () { playStringMelody(pick(STRING_PHRASES)); });

    /* ── 30-70s: Build the world ────────────────────────────── */

    /* Gallop — first pass mid-intro */
    at(rnd(30, 45), function () { playGallopVariant(pick(GALLOP_VARIANTS)); });

    /* Bow draw — first hint of danger */
    at(rnd(32, 48), function () { playBowDraw(); scheduleBowDraw(); });

    /* Harp second hit */
    at(rnd(35, 50), function () { playHarp(); });

    /* Spell — first arcane presence */
    at(rnd(38, 55), function () { playSpell(pick(SPELL_TYPES)); scheduleSpell(); });

    /* Owl — first hoot comes in around 40-55s */
    at(rnd(40, 55), function () { scheduleOwl(); });

    /* Choir swell — appears once, atmospheric layer */
    at(rnd(48, 68), function () { playChoirSwell(); scheduleChoirSwell(); });

    /* Flute second phrase — mid-intro breath */
    at(rnd(55, 78), function () { playFlute(pick(FLUTE_PHRASES)); });

    /* ── 70-120s: Fill out, then hand off to schedulers ──────  */

    /* Second string melody */
    at(rnd(70, 92), function () { playStringMelody(pick(STRING_PHRASES)); scheduleStringMelody(); });

    /* Second gallop pass — then ongoing */
    at(rnd(78, 100), function () { playGallopVariant(pick(GALLOP_VARIANTS)); scheduleGallop(); });

    /* Harp third hit — then ongoing */
    at(rnd(88, 108), function () { playHarp(); scheduleHarp(); });

    /* Flute third phrase — then ongoing random */
    at(rnd(100, 118), function () { playFlute(pick(FLUTE_PHRASES)); scheduleFlute(); });

    /* Wolf howl — distant, rare, first heard after a minute */
    at(rnd(65, 110), function () { playWolfHowl(); scheduleWolfHowl(); });

    /* Bear roar — very rare, deep in the forest */
    at(rnd(80, 140), function () { playBearRoar(); scheduleBearRoar(); });

    audioStarted = true;
  }

  /* ─── STOP ───────────────────────────────────────────────────  */
  function stopAudio() {
    if (!audioStarted) return;
    timeouts.forEach(function (id) { clearTimeout(id); });
    timeouts = [];
    if (keepAliveId) { clearInterval(keepAliveId); keepAliveId = null; }

    if (masterGain && audioCtx) {
      var now = audioCtx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(0, now + 0.5);
    }

    fluteReverb = null;
    var ctx = audioCtx;
    var srcSnap = allSources.slice();
    var gainSnap = allGains.slice();
    setTimeout(function () {
      srcSnap.forEach(function (s) { try { s.stop(); } catch(e){} try { s.disconnect(); } catch(e){} });
      gainSnap.forEach(function (g) { try { g.disconnect(); } catch(e){} });
      if (ctx) { try { ctx.close(); } catch(e){} }
    }, 600);

    audioCtx = null; masterGain = null; audioStarted = false;
    allSources = []; allGains = [];
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
    ['click','keydown','touchstart','pointerdown'].forEach(function (e) {
      document.addEventListener(e, onUserInteraction, { once: false, passive: true });
    });
  }

  function removeInteractionListeners() {
    ['click','keydown','touchstart','pointerdown'].forEach(function (e) {
      document.removeEventListener(e, onUserInteraction);
    });
    interactionHandlerAdded = false;
  }

  function start() { themeActive = true; addInteractionListeners(); }
  function stop()  { themeActive = false; removeInteractionListeners(); stopAudio(); }

  window.veilwoodTheme = { start: start, stop: stop, get _ctx() { return audioCtx; } };
})();
