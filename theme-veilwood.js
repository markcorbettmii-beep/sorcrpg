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
      chirpBird(base, phrase, rnd(0.044, 0.062));
      scheduleBirdC();
    }, 12, 32);
  }

  /* Distant high chirps — the "whistles" the user likes */
  function scheduleBirdD() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var base = rnd(3000, 5000);
      chirpBird(base, [{m:1, d:rnd(0.04,0.08)}, {m:rnd(0.9,1.1), d:rnd(0.04,0.07)}], rnd(0.018, 0.032));
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
    { name:'walk',   beats:[4,6],   interval:[0.55,0.70], lpf:[200,320], gain:[0.44,0.60], clickGain:0.38, clickHz:[600,900]   },
    { name:'trot',   beats:[8,12],  interval:[0.28,0.36], lpf:[280,420], gain:[0.36,0.50], clickGain:0.30, clickHz:[700,1100]  },
    { name:'canter', beats:[12,16], interval:[0.17,0.24], lpf:[320,480], gain:[0.34,0.48], clickGain:0.28, clickHz:[800,1200]  },
    { name:'gallop', beats:[14,20], interval:[0.11,0.16], lpf:[340,520], gain:[0.32,0.46], clickGain:0.26, clickHz:[900,1400]  },
    { name:'panic',  beats:[8,10],  interval:[0.07,0.10], lpf:[380,560], gain:[0.38,0.54], clickGain:0.32, clickHz:[1000,1600] },
  ];

  function playGallopVariant(variant) {
    var now = audioCtx.currentTime;
    var beats = rndInt(variant.beats[0], variant.beats[1]);
    var baseInterval = rnd(variant.interval[0], variant.interval[1]);
    var cursor = now;
    for (var i = 0; i < beats; i++) {
      var p = i / beats;
      var env = variant.name === 'panic'
        ? Math.max(0.7, 1.0 - Math.max(0, p - 0.25) * 1.2)
        : (p < 0.5 ? (0.8 + p * 0.4) : Math.max(0.7, 1.2 - (p - 0.5) * 1.2));
      var offsets = variant.name === 'walk' ? [0, rnd(0.10, 0.20)] :
                    variant.name === 'panic' ? [0] : [0, rnd(0.04, 0.10)];
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
      var weights = [0.10, 0.25, 0.35, 0.22, 0.08];
      var r = Math.random(), cumulative = 0, chosen = GALLOP_VARIANTS[2];
      for (var i = 0; i < weights.length; i++) {
        cumulative += weights[i];
        if (r < cumulative) { chosen = GALLOP_VARIANTS[i]; break; }
      }
      playGallopVariant(chosen);
      scheduleGallop();
    }, 7, 22);
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

  /* ─── START ──────────────────────────────────────────────────
     All sound types guaranteed within first 60 seconds,
     then the recursive schedulers keep them going at natural
     spacing. First minute is dense; thereafter it breathes.    */
  function startAudio() {
    if (audioStarted) return;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { return; }

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.88;
    masterGain.connect(audioCtx.destination);
    allGains.push(masterGain);

    /* Always-on beds */
    startStringPad();
    startWind();

    /* ── First-minute burst: everything heard within 60 seconds ── */

    /* Birds fire almost immediately — short interval schedulers handle it */
    scheduleBirdD();               /* ~4-13s first fire */
    scheduleBirdC();               /* ~12-32s first fire */
    scheduleLeafRustle();          /* ~8-20s first fire */

    /* Harp: two early hits then ongoing */
    at(rnd(3, 7), function () { playHarp(); });
    at(rnd(18, 28), function () { playHarp(); scheduleHarp(); });

    /* Gallop: first hit at 12-20s then ongoing */
    at(rnd(12, 20), function () { playGallopVariant(pick(GALLOP_VARIANTS)); scheduleGallop(); });

    /* String melody: first phrase at 8-16s — this IS the music */
    at(rnd(8, 16), function () { playStringMelody(pick(STRING_PHRASES)); scheduleStringMelody(); });

    /* Owl: first hoot at 22-35s */
    at(rnd(22, 35), function () {
      scheduleOwl(); /* let the scheduler fire it with its own randomness */
    });
    scheduleOwl(); /* also start the loop so second owl isn't too far */

    /* Flute: first breath at 12-22s — sparse but present early */
    at(rnd(12, 22), function () { playFlute(pick(FLUTE_PHRASES)); scheduleFlute(); });

    /* Choir swell: first occurrence at 40-58s */
    at(rnd(40, 58), function () { playChoirSwell(); scheduleChoirSwell(); });

    /* Second string melody at ~38-55s so the first minute has two passes */
    at(rnd(38, 55), function () { playStringMelody(pick(STRING_PHRASES)); });

    audioStarted = true;
  }

  /* ─── STOP ───────────────────────────────────────────────────  */
  function stopAudio() {
    if (!audioStarted) return;
    timeouts.forEach(function (id) { clearTimeout(id); });
    timeouts = [];

    if (masterGain && audioCtx) {
      var now = audioCtx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(0, now + 0.5);
    }

    fluteReverb = null;
    var ctx = audioCtx;
    setTimeout(function () {
      allSources.forEach(function (s) { try { s.stop(); } catch(e){} try { s.disconnect(); } catch(e){} });
      allGains.forEach(function (g) { try { g.disconnect(); } catch(e){} });
      if (ctx) { try { ctx.close(); } catch(e){} }
    }, 600);

    audioCtx = null; masterGain = null; audioStarted = false;
    allSources = []; allGains = [];
  }

  var interactionHandlerAdded = false;
  var themeActive = false;

  function onUserInteraction() { if (themeActive && !audioStarted) startAudio(); }

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

  function start() { themeActive = true; addInteractionListeners(); if (!audioStarted) startAudio(); }
  function stop()  { themeActive = false; removeInteractionListeners(); stopAudio(); }

  window.veilwoodTheme = { start: start, stop: stop };
})();
