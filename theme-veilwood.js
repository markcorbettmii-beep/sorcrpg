/* ============================================================
   THE VEILWOOD — theme-veilwood.js
   Fable-inspired enchanted forest soundscape.
   Orchestral string pad + harp arpeggios + Celtic flute melodies
   + choir swells + layered birds + wind + nature ambience.
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

  function sched(fn, minS, maxS) {
    var id = setTimeout(fn, rnd(minS, maxS) * 1000);
    timeouts.push(id);
    return id;
  }

  function makeOsc(type, freq) {
    var o = audioCtx.createOscillator();
    o.type = type; o.frequency.value = freq;
    allSources.push(o);
    return o;
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
    src.loop = true;
    allSources.push(src);
    return src;
  }

  function oneshotNoise(sec) {
    var src = audioCtx.createBufferSource();
    src.buffer = makeNoiseBuffer(sec);
    return src;
  }

  /* ─── D DORIAN SCALE (Hz) ─────────────────────────────── */
  /* D3  E3  F3  G3  A3  B3  C4  D4  E4  F4  G4  A4  B4  C5 D5 */
  var D3=147, E3=165, F3=175, G3=196, A3=220, B3=247, C4=261,
      D4=293, E4=329, F4=349, G4=392, A4=440, B4=494, C5=523, D5=587;

  /* Dm pentatonic for harp: D F G A C (across octaves) */
  var HARP_NOTES = [D3, F3, G3, A3, C4, D4, F4, G4, A4, C5, D5];

  /* Fable-style flute phrases in D Dorian */
  var PHRASES = [
    [{f:A4,d:0.45},{f:G4,d:0.3},{f:E4,d:0.3},{f:D4,d:0.8},{f:F4,d:0.35},{f:G4,d:0.35},{f:A4,d:0.9}],
    [{f:D4,d:0.3},{f:F4,d:0.3},{f:G4,d:0.35},{f:A4,d:0.65},{f:G4,d:0.28},{f:F4,d:0.28},{f:E4,d:0.35},{f:D4,d:0.9}],
    [{f:G4,d:0.38},{f:A4,d:0.38},{f:B4,d:0.38},{f:A4,d:0.38},{f:G4,d:0.3},{f:F4,d:0.3},{f:D4,d:1.0}],
    [{f:D4,d:0.28},{f:E4,d:0.28},{f:F4,d:0.28},{f:G4,d:0.28},{f:A4,d:0.55},{f:G4,d:0.28},{f:F4,d:0.28},{f:E4,d:0.28},{f:D4,d:1.0}],
    [{f:A3,d:0.5},{f:C4,d:0.4},{f:D4,d:0.4},{f:E4,d:0.4},{f:F4,d:0.5},{f:E4,d:0.35},{f:D4,d:0.85}],
    [{f:F4,d:0.4},{f:G4,d:0.35},{f:A4,d:0.65},{f:G4,d:0.3},{f:E4,d:0.3},{f:F4,d:0.3},{f:D4,d:1.0}],
  ];

  /* ─── AMBIENT BED 1: Orchestral string pad (Dm chord) ─── */
  function startStringPad() {
    var voices = [
      {freq: D3, gain: 0.022},
      {freq: A3, gain: 0.018},
      {freq: F4, gain: 0.013},
      {freq: D4, gain: 0.011},
    ];
    voices.forEach(function(v) {
      [-4, 0, 4].forEach(function(cents) {
        var osc = makeOsc('sawtooth', v.freq * Math.pow(2, cents / 1200));
        var lpf = makeFilter('lowpass', 700, 0.5);
        var g = makeGain(0);
        var now = audioCtx.currentTime;
        g.gain.linearRampToValueAtTime(v.gain / 3, now + 4.0);

        /* Slow evolving swell — pad breathes on a ~40s cycle so it never sounds flat */
        var swellLfo = makeOsc('sine', 1 / rnd(35, 50));
        var swellDepth = makeGain(v.gain / 3 * 0.30);
        swellLfo.connect(swellDepth); swellDepth.connect(g.gain);
        swellLfo.start();

        osc.connect(lpf); lpf.connect(g); g.connect(masterGain);
        osc.start();
      });
    });

    /* Secondary slow chord shift — every 25-45s, cross-fade to a neighbour chord */
    function schedulePadShift() {
      sched(function() {
        if (!audioCtx || !masterGain) return;
        var now = audioCtx.currentTime;
        var shiftVoices = [
          {freq: pick([F3, G3, A3, C4]), gain: rnd(0.006, 0.010)},
          {freq: pick([A3, C4, D4, F4]), gain: rnd(0.005, 0.008)},
        ];
        shiftVoices.forEach(function(v) {
          [-3, 0, 3].forEach(function(cents) {
            var osc = audioCtx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = v.freq * Math.pow(2, cents / 1200);
            var lpf = audioCtx.createBiquadFilter();
            lpf.type = 'lowpass'; lpf.frequency.value = 600;
            var g = audioCtx.createGain();
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(v.gain / 3, now + 8);
            g.gain.setValueAtTime(v.gain / 3, now + 14);
            g.gain.linearRampToValueAtTime(0, now + 22);
            osc.connect(lpf); lpf.connect(g); g.connect(masterGain);
            osc.start(now); osc.stop(now + 24);
          });
        });
        schedulePadShift();
      }, 25, 45);
    }
    schedulePadShift();
  }

  /* ─── AMBIENT BED 2: Gentle wind through canopy ────────── */
  function startWind() {
    var src = loopNoise(3);
    var lpf = makeFilter('lowpass', 320, 0.6);
    var g = makeGain(0.012);
    /* Very slow breath LFO — barely perceptible, 0.008 Hz */
    var lfo = makeOsc('sine', 0.008);
    var lfoDepth = makeGain(0.004);
    lfo.connect(lfoDepth); lfoDepth.connect(g.gain);
    src.connect(lpf); lpf.connect(g); g.connect(masterGain);
    src.start(); lfo.start();
  }

  /* ─── HARP ARPEGGIO ─────────────────────────────────────── */
  function pluck(freq, startAt, gainVal) {
    /* Plucked string: sine fundamental + 2nd harmonic, exponential decay */
    var now = startAt;
    [1, 2, 3].forEach(function(harmonic) {
      var osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * harmonic;
      var g = audioCtx.createGain();
      var hGain = gainVal / (harmonic * harmonic); /* harmonics fall off quickly */
      g.gain.setValueAtTime(hGain, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + (2.2 / harmonic));
      osc.connect(g); g.connect(masterGain);
      osc.start(now); osc.stop(now + (2.4 / harmonic));
    });
  }

  function scheduleHarp() {
    sched(function() {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;

      /* Pick a chord shape and arpeggiate upward */
      var chords = [
        [D3, F3, A3, D4, F4],      /* Dm */
        [A3, C4, E4, A4],           /* Am */
        [G3, B3, D4, G4],           /* G */
        [F3, A3, C4, F4],           /* F */
        [D3, A3, D4, F4, A4],       /* Dm spread */
      ];
      var chord = pick(chords);
      var noteCount = chord.length + rndInt(0, 2);
      var cursor = now;

      for (var i = 0; i < noteCount; i++) {
        var note = chord[Math.min(i, chord.length - 1)];
        /* Occasionally add an octave up for sparkle */
        if (i === noteCount - 1 && Math.random() < 0.5) note *= 2;
        pluck(note, cursor, rnd(0.028, 0.042));
        cursor += rnd(0.18, 0.32);
      }

      /* Occasionally a second cascading arpeggio follows */
      if (Math.random() < 0.45) {
        var chord2 = pick(chords);
        cursor += rnd(0.4, 1.0);
        for (var j = 0; j < chord2.length; j++) {
          pluck(chord2[j], cursor, rnd(0.018, 0.030));
          cursor += rnd(0.14, 0.26);
        }
      }

      scheduleHarp();
    }, 7, 20);
  }

  /* ─── CELTIC FLUTE MELODY ───────────────────────────────── */
  function playFlute(phrase) {
    var cursor = audioCtx.currentTime + rnd(0.2, 0.6);
    phrase.forEach(function(note) {
      if (!note.f) { cursor += note.d; return; } /* rest */
      (function(startAt, freq, dur) {
        /* Triangle wave — brighter than sine, flute-like */
        var osc = audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;

        /* Vibrato — starts after 30% of note, adds expression */
        var vib = audioCtx.createOscillator();
        vib.type = 'sine';
        vib.frequency.value = rnd(5.2, 6.8);
        var vibDepth = audioCtx.createGain();
        vibDepth.gain.setValueAtTime(0, startAt);
        vibDepth.gain.linearRampToValueAtTime(rnd(5, 12), startAt + dur * 0.3);
        vib.connect(vibDepth); vibDepth.connect(osc.frequency);

        /* Breath noise layer — makes it feel like a real instrument */
        var breathSrc = oneshotNoise(dur + 0.15);
        var breathHpf = audioCtx.createBiquadFilter();
        breathHpf.type = 'highpass'; breathHpf.frequency.value = 2200;
        var breathG = audioCtx.createGain();
        breathG.gain.setValueAtTime(0.006, startAt);
        breathG.gain.exponentialRampToValueAtTime(0.0001, startAt + dur + 0.1);
        breathSrc.connect(breathHpf); breathHpf.connect(breathG); breathG.connect(masterGain);
        breathSrc.start(startAt);

        /* Distant flute — quieter, rolled off high end */
        var distLpf = audioCtx.createBiquadFilter();
        distLpf.type = 'lowpass'; distLpf.frequency.value = rnd(1400, 2200);

        var g = audioCtx.createGain();
        g.gain.setValueAtTime(0, startAt);
        g.gain.linearRampToValueAtTime(rnd(0.014, 0.022), startAt + 0.04);
        g.gain.setValueAtTime(rnd(0.014, 0.022), startAt + dur - 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, startAt + dur + 0.03);

        osc.connect(distLpf); distLpf.connect(g); g.connect(masterGain);
        vib.start(startAt); osc.start(startAt);
        osc.stop(startAt + dur + 0.06); vib.stop(startAt + dur + 0.06);
      })(cursor, note.f, note.d);

      cursor += note.d + rnd(0.01, 0.04); /* tiny gap between notes */
    });
  }

  function scheduleFlute() {
    sched(function() {
      if (!audioCtx || !masterGain) return;
      playFlute(pick(PHRASES));
      scheduleFlute();
    }, 28, 75);
  }

  /* ─── CHOIR SWELL ───────────────────────────────────────── */
  function scheduleChoirSwell() {
    sched(function() {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;
      var chordNotes = [D3 * 2, F3 * 2, A3 * 2]; /* Dm voiced higher for choir */
      var dur = rnd(6, 10);

      chordNotes.forEach(function(baseFreq) {
        /* 5 detuned oscillators per voice = choir shimmer */
        [-8, -3, 0, 3, 8].forEach(function(cents) {
          var osc = audioCtx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = baseFreq * Math.pow(2, cents / 1200);
          allSources.push(osc);

          var lpf = audioCtx.createBiquadFilter();
          lpf.type = 'lowpass'; lpf.frequency.value = 1800;

          var g = audioCtx.createGain();
          allGains.push(g);
          g.gain.setValueAtTime(0, now);
          g.gain.linearRampToValueAtTime(rnd(0.007, 0.012), now + dur * 0.35);
          g.gain.setValueAtTime(rnd(0.007, 0.012), now + dur * 0.6);
          g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

          osc.connect(lpf); lpf.connect(g); g.connect(masterGain);
          osc.start(now); osc.stop(now + dur + 0.1);
        });
      });

      scheduleChoirSwell();
    }, 55, 130);
  }

  /* ─── BIRDS ─────────────────────────────────────────────── */
  /* Four independent bird voices, each with its own timing */

  function chirpBird(baseFreq, pattern, gain) {
    /* pattern: array of {freqMult, dur} — a phrase */
    var now = audioCtx.currentTime;
    var cursor = now;
    pattern.forEach(function(n) {
      (function(startAt, freq, dur) {
        var osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startAt);
        /* Slight upward or downward sweep for natural feel */
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

  /* Blackbird-style: fluting melodic phrase */
  function scheduleBirdC() {
    sched(function() {
      if (!audioCtx || !masterGain) return;
      var base = rnd(1600, 2200);
      var mults = [1, 1.12, 1.25, 1.18, 1.05, 0.94, 1.0];
      var phrase = mults.slice(0, rndInt(4, 7)).map(function(m) {
        return {m: m * rnd(0.97, 1.03), d: rnd(0.12, 0.22)};
      });
      chirpBird(base, phrase, rnd(0.045, 0.065));
      scheduleBirdC();
    }, 15, 35);
  }

  /* Distant background chirp — short, high, one note */
  function scheduleBirdD() {
    sched(function() {
      if (!audioCtx || !masterGain) return;
      var base = rnd(3000, 5000);
      chirpBird(base, [{m:1, d:rnd(0.04,0.08)}, {m:rnd(0.9,1.1), d:rnd(0.04,0.07)}], rnd(0.018, 0.032));
      scheduleBirdD();
    }, 5, 14);
  }

  /* ─── OWL ───────────────────────────────────────────────── */
  function hootOwl(startAt, freq, peakGain, dur) {
    var osc = audioCtx.createOscillator();
    osc.type = 'sine';
    allSources.push(osc);
    osc.frequency.setValueAtTime(freq * 1.04, startAt);
    osc.frequency.linearRampToValueAtTime(freq * 0.96, startAt + dur * 0.7);
    /* Tremolo — owls modulate naturally */
    var trem = audioCtx.createOscillator();
    trem.frequency.value = rnd(5.5, 7.0);
    var tremDepth = audioCtx.createGain();
    tremDepth.gain.value = peakGain * 0.08;
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
    sched(function() {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;
      var isClose = Math.random() < 0.45;
      var freq    = isClose ? rnd(200, 250) : rnd(160, 210); /* distant = slightly lower/duller */
      var gain    = isClose ? rnd(0.07, 0.10) : rnd(0.025, 0.042);
      var hoots   = rndInt(1, isClose ? 3 : 2);
      var hootDur = isClose ? 0.60 : 0.50;

      /* Distant owl: add a gentle lowpass to muffle it */
      if (!isClose) {
        var lpf = audioCtx.createBiquadFilter();
        lpf.type = 'lowpass'; lpf.frequency.value = rnd(600, 900);
        for (var h = 0; h < hoots; h++) {
          (function(startAt) {
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

  /* ─── HOOVED GALLOP — 5 distinct variants ───────────────── */
  /*
    WALK:   slow measured plods, 4-6 beats, heavy, ~0.6s apart
    TROT:   steady pace, 8-12 beats, ~0.32s apart
    CANTER: building speed, 12-16 beats, ~0.20s apart
    GALLOP: full sprint, 14-20 beats, ~0.13s apart
    PANIC:  frantic burst, 8-10 very tight beats then gone, ~0.08s
  */
  var GALLOP_VARIANTS = [
    { name:'walk',   beats:[4,6],   interval:[0.55,0.70], lpf:[200,320], gain:[0.44,0.60], clickGain:0.38, clickHz:[600,900]  },
    { name:'trot',   beats:[8,12],  interval:[0.28,0.36], lpf:[280,420], gain:[0.36,0.50], clickGain:0.30, clickHz:[700,1100] },
    { name:'canter', beats:[12,16], interval:[0.17,0.24], lpf:[320,480], gain:[0.34,0.48], clickGain:0.28, clickHz:[800,1200] },
    { name:'gallop', beats:[14,20], interval:[0.11,0.16], lpf:[340,520], gain:[0.32,0.46], clickGain:0.26, clickHz:[900,1400] },
    { name:'panic',  beats:[8,10],  interval:[0.07,0.10], lpf:[380,560], gain:[0.38,0.54], clickGain:0.32, clickHz:[1000,1600]},
  ];

  function playGallopVariant(variant) {
    var now = audioCtx.currentTime;
    var beats = rndInt(variant.beats[0], variant.beats[1]);
    var baseInterval = rnd(variant.interval[0], variant.interval[1]);
    var cursor = now;

    for (var i = 0; i < beats; i++) {
      var p = i / beats;
      /* Gentle approach/recede — starts loud, never drops below 70% */
      var env = variant.name === 'panic'
        ? Math.max(0.7, 1.0 - Math.max(0, p - 0.25) * 1.2)
        : (p < 0.5 ? (0.8 + p * 0.4) : Math.max(0.7, 1.2 - (p - 0.5) * 1.2));

      var offsets = variant.name === 'walk' ? [0, rnd(0.10,0.20)] :
                    variant.name === 'panic' ? [0] : [0, rnd(0.04, 0.10)];

      (function(startAt, envMul) {
        offsets.forEach(function(offset) {
          /* Thud layer — lowpass noise */
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

          /* Click/snap layer — bandpass gives hoof-on-earth definition */
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

        /* Extra undergrowth thump for walk — low sub-snap */
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
    sched(function() {
      if (!audioCtx || !masterGain) return;
      /* Weight toward middle variants — walk and panic are rarer */
      var weights = [0.10, 0.25, 0.35, 0.22, 0.08];
      var r = Math.random(), cumulative = 0, chosen = GALLOP_VARIANTS[2];
      for (var i = 0; i < weights.length; i++) {
        cumulative += weights[i];
        if (r < cumulative) { chosen = GALLOP_VARIANTS[i]; break; }
      }
      playGallopVariant(chosen);
      scheduleGallop();
    }, 6, 22);
  }

  /* ─── LEAF RUSTLE ───────────────────────────────────────── */
  function scheduleLeafRustle() {
    sched(function() {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;
      var dur = rnd(0.3, 0.8);
      var src = oneshotNoise(dur + 0.1);
      var bpf = audioCtx.createBiquadFilter();
      bpf.type = 'bandpass'; bpf.frequency.value = rnd(900, 1400); bpf.Q.value = rnd(0.8, 1.4);
      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(rnd(0.018, 0.034), now + dur * 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.04);
      src.connect(bpf); bpf.connect(g); g.connect(masterGain);
      src.start(now);
      scheduleLeafRustle();
    }, 8, 20);
  }

  /* ─── START ─────────────────────────────────────────────── */
  function startAudio() {
    if (audioStarted) return;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { return; }

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.9;
    masterGain.connect(audioCtx.destination);
    allGains.push(masterGain);

    /* Ambient beds — always on */
    startStringPad();
    startWind();

    /* Scheduled musical elements */
    scheduleHarp();
    scheduleFlute();
    scheduleChoirSwell();

    /* Nature sounds */
    scheduleBirdC();
    scheduleBirdD();
    scheduleOwl();
    scheduleGallop();
    scheduleLeafRustle();

    audioStarted = true;
  }

  /* ─── STOP ──────────────────────────────────────────────── */
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
    ['click','keydown','touchstart','pointerdown'].forEach(function(e) {
      document.addEventListener(e, onUserInteraction, { once: false, passive: true });
    });
  }

  function removeInteractionListeners() {
    ['click','keydown','touchstart','pointerdown'].forEach(function(e) {
      document.removeEventListener(e, onUserInteraction);
    });
    interactionHandlerAdded = false;
  }

  function start() { themeActive = true; addInteractionListeners(); if (!audioStarted) startAudio(); }
  function stop()  { themeActive = false; removeInteractionListeners(); stopAudio(); }

  window.veilwoodTheme = { start: start, stop: stop };
})();
