/* ============================================================
   OMNE TERMINAL THEME — theme-terminal.js
   Space station soundscape with droids, metal grid footsteps,
   ship traffic, machinery, and ambient drones.
   Exposes: window.terminalTheme = { start, stop }
   ============================================================ */
(function () {
  'use strict';

  var audioCtx      = null;
  var audioStarted  = false;
  var masterGain    = null;
  var timeouts      = [];
  var allGains      = [];
  var allSources    = [];
  var keepAliveId   = null;

  /* ── Utilities ─────────────────────────────────────────── */
  function rnd(a, b)    { return a + Math.random() * (b - a); }
  function rndInt(a, b) { return Math.floor(rnd(a, b + 1)); }
  function pick(arr)    { return arr[Math.floor(Math.random() * arr.length)]; }

  function sched(fn, minS, maxS) {
    var id = setTimeout(fn, rnd(minS, maxS) * 1000);
    timeouts.push(id);
    return id;
  }

  function makeNoiseBuf(dur) {
    var n   = Math.max(1, Math.floor(audioCtx.sampleRate * (dur || 2)));
    var buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
    var d   = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function makeOsc(type, freq) {
    var o = audioCtx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq || 440;
    allSources.push(o);
    return o;
  }

  function makeGain(v) {
    var g = audioCtx.createGain();
    g.gain.value = (v !== undefined) ? v : 1;
    allGains.push(g);
    return g;
  }

  function makeFilt(type, freq, q) {
    var f = audioCtx.createBiquadFilter();
    f.type = type || 'lowpass';
    f.frequency.value = freq || 1000;
    if (q !== undefined) f.Q.value = q;
    return f;
  }

  /* Early-reflection reverb — no feedback loops, clean teardown */
  function makeReverb(wet) {
    var w   = wet !== undefined ? wet : 0.42;
    var inp = audioCtx.createGain();
    var out = audioCtx.createGain();
    allGains.push(inp); allGains.push(out);
    [0.019, 0.031, 0.047, 0.063, 0.081, 0.107, 0.139].forEach(function (dt, i) {
      var d  = audioCtx.createDelay(0.2);
      d.delayTime.value = dt;
      var g  = audioCtx.createGain();
      g.gain.value = w * Math.pow(0.65, i + 1);
      allGains.push(g);
      inp.connect(d); d.connect(g); g.connect(out);
    });
    inp.connect(out);   /* dry pass */
    return { input: inp, output: out };
  }

  /* ── Scale — E natural minor ──────────────────────────── */
  var E1=41.20, B1=61.74;
  var E2=82.41, Fs2=92.50, G2=98.00, A2=110.00, B2=123.47, C3=130.81;
  var D3=146.83, E3=164.81, Fs3=185.00, G3=196.00, A3=220.00, B3=246.94;
  var C4=261.63, D4=293.66, E4=329.63, G4=392.00, B4=493.88;

  /* ── AMBIENT 1: Sub-bass space drone ─────────────────── */
  function startSpaceDrone() {
    var rev = makeReverb(0.55);
    rev.output.connect(masterGain);

    /* E1 / B1 power chord sub-bass */
    [[E1, 0.032],[B1, 0.018],[E2, 0.018],[B2, 0.010]].forEach(function (p) {
      var osc = makeOsc('sawtooth', p[0]);
      var lpf = makeFilt('lowpass', 140, 0.6);
      var g   = makeGain(p[1]);
      var dLfo = makeOsc('sine', rnd(0.005, 0.011));
      var dDep = makeGain(0.4);
      dLfo.connect(dDep); dDep.connect(osc.frequency);
      dLfo.start();
      osc.connect(lpf); lpf.connect(g); g.connect(rev.input);
      osc.start();
    });

    /* Detuned mid cluster — E3 / G3 / B3 */
    [
      [E3,       0.009], [E3*1.004, 0.007], [E3*0.996, 0.007],
      [G3,       0.006], [B3,       0.005],
    ].forEach(function (p) {
      var osc = makeOsc('sawtooth', p[0]);
      var lpf = makeFilt('lowpass', 700, 0.8);
      var g   = makeGain(p[1]);
      /* Imperceptibly slow tremolo */
      var tLfo = makeOsc('sine', rnd(0.014, 0.022));
      var tDep = makeGain(0.0025);
      tLfo.connect(tDep); tDep.connect(g.gain);
      tLfo.start();
      osc.connect(lpf); lpf.connect(g); g.connect(rev.input);
      osc.start();
    });
  }

  /* ── AMBIENT 2: Station machinery hum ────────────────── */
  function startMachineryHum() {
    [[55,0.025],[110,0.010],[165,0.005],[60,0.004],[120,0.003]].forEach(function(p) {
      var osc = makeOsc('sine', p[0]);
      var g   = makeGain(p[1]);
      var dLfo = makeOsc('sine', rnd(0.007, 0.016));
      var dDep = makeGain(0.2);
      dLfo.connect(dDep); dDep.connect(osc.frequency);
      dLfo.start();
      osc.connect(g); g.connect(masterGain);
      osc.start();
    });
  }

  /* ── AMBIENT 3: Air recycling ─────────────────────────── */
  function startAirRecycling() {
    var src = audioCtx.createBufferSource();
    src.buffer = makeNoiseBuf(2); src.loop = true;
    allSources.push(src);
    var lpf = makeFilt('lowpass', 200, 0.7);
    var g   = makeGain(0.009);
    src.connect(lpf); lpf.connect(g); g.connect(masterGain);
    src.start();
  }

  /* ── MUSIC 1: Slow dark pad swells ───────────────────── */
  var PAD_CHORDS = [
    [E2, G3, B3, E4],
    [A2, E3, A3, C4],
    [C3, G3, C4, E4],
    [B2, Fs3, B3, D4],
    [D3, A3, D4, Fs3],
    [E2, B2, G3, B3],
    [G2, D3, G3, B3],
  ];

  function schedulePadSwell() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now     = audioCtx.currentTime;
      var chord   = pick(PAD_CHORDS);
      var attack  = rnd(5, 9);
      var hold    = rnd(10, 20);
      var release = rnd(6, 10);
      var peak    = rnd(0.020, 0.030);
      var rev     = makeReverb(0.50);
      rev.output.connect(masterGain);

      chord.forEach(function (freq, vi) {
        var detunes = vi === 0 ? [0, -3] : [0, -4, 4];
        detunes.forEach(function (cents) {
          var osc = audioCtx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.value = freq * Math.pow(2, cents / 1200);
          var lpf = audioCtx.createBiquadFilter();
          lpf.type = 'lowpass';
          lpf.frequency.value = vi === 0 ? 350 : 1100;
          var g  = audioCtx.createGain();
          var v  = peak * [1.0, 0.65, 0.45, 0.35][vi] * (cents === 0 ? 1 : 0.45);
          g.gain.setValueAtTime(0, now);
          g.gain.linearRampToValueAtTime(v, now + attack);
          g.gain.setValueAtTime(v, now + attack + hold);
          g.gain.linearRampToValueAtTime(0, now + attack + hold + release);
          osc.connect(lpf); lpf.connect(g); g.connect(rev.input);
          osc.start(now); osc.stop(now + attack + hold + release + 0.2);
        });
      });
      schedulePadSwell();
    }, 20, 42);
  }

  /* ── MUSIC 2: Sparse melodic motifs ──────────────────── */
  var MOTIFS = [
    [{f:E3,d:0.7},{f:G3,d:0.5},{f:A3,d:0.5},{f:B3,d:0.9},{f:E4,d:1.4}],
    [{f:E4,d:0.5},{f:D4,d:0.5},{f:B3,d:0.7},{f:G3,d:0.9},{f:E3,d:1.8}],
    [{f:A3,d:0.5},{f:B3,d:0.4},{f:A3,d:0.3},{f:G3,d:0.7},{f:E3,d:1.2}],
    [{f:B3,d:0.8},{f:E4,d:2.0}],
    [{f:G3,d:0.6},{f:E3,d:1.5}],
    [{f:E3,d:0.4},{f:Fs3,d:0.4},{f:G3,d:0.5},{f:A3,d:0.5},{f:B3,d:0.4},{f:A3,d:1.0}],
  ];

  function scheduleMotif() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now    = audioCtx.currentTime;
      var motif  = pick(MOTIFS);
      var cursor = now;
      var rev    = makeReverb(0.55);
      rev.output.connect(masterGain);

      motif.forEach(function (note) {
        (function (startAt, freq, dur) {
          [0, 5, -5].forEach(function (cents) {
            var osc = audioCtx.createOscillator();
            osc.type = cents === 0 ? 'triangle' : 'sawtooth';
            osc.frequency.value = freq * Math.pow(2, cents / 1200);
            var lpf = audioCtx.createBiquadFilter();
            lpf.type = 'lowpass'; lpf.frequency.value = 2000;
            /* Delayed vibrato */
            var vib = audioCtx.createOscillator();
            vib.frequency.value = 5.0;
            var vDep = audioCtx.createGain();
            vDep.gain.setValueAtTime(0, startAt);
            vDep.gain.linearRampToValueAtTime(cents === 0 ? 3.5 : 1.5, startAt + 0.35);
            vib.connect(vDep); vDep.connect(osc.frequency);
            vib.start(startAt); vib.stop(startAt + dur + 0.4);
            var g   = audioCtx.createGain();
            var vol = cents === 0 ? 0.026 : 0.010;
            g.gain.setValueAtTime(0, startAt);
            g.gain.linearRampToValueAtTime(vol, startAt + 0.2);
            g.gain.setValueAtTime(vol, startAt + dur - 0.15);
            g.gain.linearRampToValueAtTime(0, startAt + dur + 0.25);
            osc.connect(lpf); lpf.connect(g); g.connect(rev.input);
            osc.start(startAt); osc.stop(startAt + dur + 0.45);
          });
        })(cursor, note.f, note.d);
        cursor += note.d + rnd(0.06, 0.20);
      });
      scheduleMotif();
    }, 50, 110);
  }

  /* ── MUSIC 3: Brass / horn accent ────────────────────── */
  function scheduleBrassAccent() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      if (Math.random() > 0.50) { scheduleBrassAccent(); return; }
      var now  = audioCtx.currentTime;
      var note = pick([E3, G3, B3, E2, A2, D3]);
      var dur  = rnd(1.8, 3.8);
      var rev  = makeReverb(0.48);
      rev.output.connect(masterGain);
      [1, 2, 3].forEach(function (h) {
        var osc = audioCtx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = note * h * rnd(0.997, 1.003);
        var lpf = audioCtx.createBiquadFilter();
        lpf.type = 'lowpass';
        lpf.frequency.setValueAtTime(h === 1 ? 500 : 350, now);
        lpf.frequency.linearRampToValueAtTime(h === 1 ? 1800 : 700, now + dur * 0.25);
        lpf.frequency.linearRampToValueAtTime(h === 1 ? 380 : 220, now + dur);
        var g   = audioCtx.createGain();
        var vol = [0.028, 0.016, 0.008][h - 1];
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(vol, now + 0.14);
        g.gain.setValueAtTime(vol, now + dur - 0.35);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        osc.connect(lpf); lpf.connect(g); g.connect(rev.input);
        osc.start(now); osc.stop(now + dur + 0.1);
      });
      scheduleBrassAccent();
    }, 60, 140);
  }

  /* ── SHIPS: Small fighter / shuttle swoosh ────────────── */
  function scheduleSmallShipFlyby() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now      = audioCtx.currentTime;
      var dur      = rnd(1.4, 2.8);
      var hiFreq   = rnd(4000, 6500);
      var loFreq   = rnd(600, 1200);
      var peak     = rnd(0.055, 0.085);

      /* Engine tone — thin whine that Doppler-shifts */
      var toneSrc = audioCtx.createOscillator();
      toneSrc.type = 'sawtooth';
      toneSrc.frequency.setValueAtTime(rnd(280, 420), now);
      toneSrc.frequency.exponentialRampToValueAtTime(rnd(160, 240), now + dur);
      var toneLpf = audioCtx.createBiquadFilter();
      toneLpf.type = 'lowpass'; toneLpf.frequency.value = 900;
      var toneG = audioCtx.createGain();
      toneG.gain.setValueAtTime(0, now);
      toneG.gain.linearRampToValueAtTime(0.020, now + dur * 0.3);
      toneG.gain.setValueAtTime(0.020, now + dur * 0.55);
      toneG.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      toneSrc.connect(toneLpf); toneLpf.connect(toneG); toneG.connect(masterGain);
      toneSrc.start(now); toneSrc.stop(now + dur + 0.1);

      /* Noise whoosh layer */
      var nSrc = audioCtx.createBufferSource();
      nSrc.buffer = makeNoiseBuf(dur + 0.4);
      var bpf = audioCtx.createBiquadFilter();
      bpf.type = 'bandpass';
      bpf.frequency.setValueAtTime(hiFreq, now);
      bpf.frequency.exponentialRampToValueAtTime(loFreq, now + dur);
      bpf.Q.value = 2.5;
      var nG = audioCtx.createGain();
      nG.gain.setValueAtTime(0.001, now);
      nG.gain.exponentialRampToValueAtTime(peak, now + dur * 0.25);
      nG.gain.setValueAtTime(peak, now + dur * 0.50);
      nG.gain.exponentialRampToValueAtTime(0.001, now + dur);
      nSrc.connect(bpf); bpf.connect(nG); nG.connect(masterGain);
      nSrc.start(now);
      scheduleSmallShipFlyby();
    }, 18, 50);
  }

  /* ── SHIPS: Large freighter slow pass ────────────────── */
  function scheduleLargeShipFlyby() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now  = audioCtx.currentTime;
      var dur  = rnd(7, 13);
      var peak = rnd(0.10, 0.15);

      /* Deep engine throb */
      var baseFreq = rnd(55, 90);
      [1, 2, 3, 4].forEach(function (h) {
        var osc = audioCtx.createOscillator();
        osc.type = h <= 2 ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(baseFreq * h, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * h * rnd(0.72, 0.78), now + dur);
        var lpf = audioCtx.createBiquadFilter();
        lpf.type = 'lowpass';
        lpf.frequency.value = h === 1 ? 400 : h === 2 ? 260 : 180;
        var g  = audioCtx.createGain();
        var v  = (peak * 0.5) / h;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(v, now + dur * 0.18);
        g.gain.setValueAtTime(v, now + dur * 0.72);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        osc.connect(lpf); lpf.connect(g); g.connect(masterGain);
        osc.start(now); osc.stop(now + dur + 0.2);
      });

      /* Sub-bass rumble */
      var subSrc = audioCtx.createBufferSource();
      subSrc.buffer = makeNoiseBuf(dur + 0.5);
      var subLpf = audioCtx.createBiquadFilter();
      subLpf.type = 'lowpass'; subLpf.frequency.value = 90;
      var subG = audioCtx.createGain();
      subG.gain.setValueAtTime(0, now);
      subG.gain.linearRampToValueAtTime(peak * 0.7, now + dur * 0.2);
      subG.gain.setValueAtTime(peak * 0.7, now + dur * 0.7);
      subG.gain.exponentialRampToValueAtTime(0.001, now + dur);
      subSrc.connect(subLpf); subLpf.connect(subG); subG.connect(masterGain);
      subSrc.start(now);

      /* Hull vibration — low bandpass noise sweep */
      var hullSrc = audioCtx.createBufferSource();
      hullSrc.buffer = makeNoiseBuf(dur + 0.5);
      var hullBpf = audioCtx.createBiquadFilter();
      hullBpf.type = 'bandpass';
      hullBpf.frequency.setValueAtTime(rnd(800, 1400), now);
      hullBpf.frequency.exponentialRampToValueAtTime(rnd(200, 450), now + dur);
      hullBpf.Q.value = 1.2;
      var hullG = audioCtx.createGain();
      hullG.gain.setValueAtTime(0, now);
      hullG.gain.linearRampToValueAtTime(peak * 0.45, now + dur * 0.22);
      hullG.gain.setValueAtTime(peak * 0.45, now + dur * 0.68);
      hullG.gain.exponentialRampToValueAtTime(0.001, now + dur);
      hullSrc.connect(hullBpf); hullBpf.connect(hullG); hullG.connect(masterGain);
      hullSrc.start(now);

      scheduleLargeShipFlyby();
    }, 55, 140);
  }

  /* ── SHIPS: Docking approach + landing sequence ────────
     Slow thruster hum builds → retro-fire burst → bay clunk → hiss
  ───────────────────────────────────────────────────────── */
  function scheduleLanding() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now      = audioCtx.currentTime;
      var approach = rnd(5, 10);   /* time to approach close */
      var retro    = approach + rnd(0.4, 0.8);
      var clunk    = retro + 0.25;
      var hiss     = clunk + 0.1;

      /* Approach thruster build — low rumble growing closer */
      var thrustFreq = rnd(70, 110);
      [1, 2].forEach(function (h) {
        var osc = audioCtx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = thrustFreq * h * rnd(0.98, 1.02);
        var lpf = audioCtx.createBiquadFilter();
        lpf.type = 'lowpass'; lpf.frequency.value = h === 1 ? 380 : 220;
        var g  = audioCtx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.055 / h, now + approach * 0.6);
        g.gain.linearRampToValueAtTime(0.085 / h, now + approach);
        g.gain.exponentialRampToValueAtTime(0.0001, now + retro + 0.05);
        osc.connect(lpf); lpf.connect(g); g.connect(masterGain);
        osc.start(now); osc.stop(now + retro + 0.15);
      });

      /* Retro-fire burst — short sharp noise blast */
      var retroSrc = audioCtx.createBufferSource();
      retroSrc.buffer = makeNoiseBuf(0.45);
      var retroBpf = audioCtx.createBiquadFilter();
      retroBpf.type = 'bandpass'; retroBpf.frequency.value = rnd(600, 1000); retroBpf.Q.value = 1.0;
      var retroG = audioCtx.createGain();
      retroG.gain.setValueAtTime(0.001, now + retro);
      retroG.gain.exponentialRampToValueAtTime(0.18, now + retro + 0.04);
      retroG.gain.exponentialRampToValueAtTime(0.0001, now + retro + 0.42);
      retroSrc.connect(retroBpf); retroBpf.connect(retroG); retroG.connect(masterGain);
      retroSrc.start(now + retro);

      /* Landing clunk — thud + metallic ring */
      var clunkOsc = audioCtx.createOscillator();
      clunkOsc.type = 'sine';
      clunkOsc.frequency.setValueAtTime(rnd(95, 130), now + clunk);
      clunkOsc.frequency.exponentialRampToValueAtTime(rnd(28, 45), now + clunk + 0.35);
      var clunkG = audioCtx.createGain();
      clunkG.gain.setValueAtTime(0.22, now + clunk);
      clunkG.gain.exponentialRampToValueAtTime(0.0001, now + clunk + 0.4);
      clunkOsc.connect(clunkG); clunkG.connect(masterGain);
      clunkOsc.start(now + clunk); clunkOsc.stop(now + clunk + 0.45);

      /* Metallic ring on clunk */
      [rnd(420, 480), rnd(860, 920)].forEach(function (rf) {
        var ro = audioCtx.createOscillator();
        ro.type = 'sine'; ro.frequency.value = rf;
        var rg = audioCtx.createGain();
        rg.gain.setValueAtTime(0.030, now + clunk + 0.01);
        rg.gain.exponentialRampToValueAtTime(0.0001, now + clunk + 0.55);
        ro.connect(rg); rg.connect(masterGain);
        ro.start(now + clunk + 0.01); ro.stop(now + clunk + 0.6);
      });

      /* Pressure equalisation hiss */
      var hissSrc = audioCtx.createBufferSource();
      hissSrc.buffer = makeNoiseBuf(0.9);
      var hissHpf = audioCtx.createBiquadFilter();
      hissHpf.type = 'highpass'; hissHpf.frequency.value = rnd(1800, 2600);
      var hissG = audioCtx.createGain();
      hissG.gain.setValueAtTime(0, now + hiss);
      hissG.gain.linearRampToValueAtTime(0.055, now + hiss + 0.06);
      hissG.gain.exponentialRampToValueAtTime(0.0001, now + hiss + 0.85);
      hissSrc.connect(hissHpf); hissHpf.connect(hissG); hissG.connect(masterGain);
      hissSrc.start(now + hiss);

      scheduleLanding();
    }, 45, 120);
  }

  /* ── STATION: Pressure door ───────────────────────────── */
  function schedulePressureDoor() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;
      var osc = audioCtx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = rnd(75, 105);
      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0.14, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
      osc.connect(g); g.connect(masterGain);
      osc.start(now); osc.stop(now + 0.42);
      var nSrc = audioCtx.createBufferSource();
      nSrc.buffer = makeNoiseBuf(0.32);
      var bpf = audioCtx.createBiquadFilter();
      bpf.type = 'bandpass'; bpf.frequency.value = rnd(1000, 1400); bpf.Q.value = 4;
      var hg = audioCtx.createGain();
      hg.gain.setValueAtTime(0.042, now + 0.06);
      hg.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
      nSrc.connect(bpf); bpf.connect(hg); hg.connect(masterGain);
      nSrc.start(now + 0.06);
      schedulePressureDoor();
    }, 30, 75);
  }

  /* ── STATION: Hydraulic clank ─────────────────────────── */
  function scheduleHydraulicClank() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;
      function clank(t) {
        var osc = audioCtx.createOscillator();
        osc.type = 'sine'; osc.frequency.value = rnd(220, 380);
        var g = audioCtx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.085, t + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        var d = audioCtx.createDelay(0.3); d.delayTime.value = 0.04;
        var dg = audioCtx.createGain(); dg.gain.value = 0.18;
        osc.connect(g); g.connect(masterGain); g.connect(d);
        d.connect(dg); dg.connect(masterGain);
        osc.start(t); osc.stop(t + 0.22);
      }
      clank(now); clank(now + rnd(0.09, 0.18));
      scheduleHydraulicClank();
    }, 35, 80);
  }

  /* ── STATION: Hull creak ──────────────────────────────── */
  function scheduleHullCreak() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;
      var dur = rnd(0.5, 0.8);
      var osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(rnd(160, 240), now);
      osc.frequency.exponentialRampToValueAtTime(rnd(50, 90), now + dur);
      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0.026 * rnd(0.85, 1.15), now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.06);
      osc.connect(g); g.connect(masterGain);
      osc.start(now); osc.stop(now + dur + 0.1);
      scheduleHullCreak();
    }, 65, 160);
  }

  /* ── STATION: Distant structural impact ──────────────── */
  function scheduleDistantImpact() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;
      var osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(38, now);
      osc.frequency.linearRampToValueAtTime(18, now + 0.85);
      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0.018, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
      osc.connect(g); g.connect(masterGain);
      osc.start(now); osc.stop(now + 0.95);
      scheduleDistantImpact();
    }, 90, 230);
  }

  /* ── DROIDS: Common — small chirp sequence (R2-style) ── */
  function scheduleDroidChirp() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;
      var count = rndInt(2, 5);
      var cursor = now;
      for (var i = 0; i < count; i++) {
        (function (t) {
          var freq = rnd(1200, 3800);
          var dur  = rnd(0.04, 0.14);
          var osc  = audioCtx.createOscillator();
          osc.type = Math.random() > 0.5 ? 'sine' : 'square';
          osc.frequency.setValueAtTime(freq, t);
          osc.frequency.linearRampToValueAtTime(freq * rnd(0.78, 1.28), t + dur);
          var g = audioCtx.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(rnd(0.028, 0.048), t + 0.008);
          g.gain.setValueAtTime(rnd(0.028, 0.048), t + dur - 0.01);
          g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
          osc.connect(g); g.connect(masterGain);
          osc.start(t); osc.stop(t + dur + 0.04);
        })(cursor);
        cursor += rnd(0.08, 0.28);
      }
      scheduleDroidChirp();
    }, 12, 35);
  }

  /* ── DROIDS: Common — servo motor whine ─────────────── */
  function scheduleDroidServo() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now  = audioCtx.currentTime;
      var dur  = rnd(0.3, 1.1);
      var rise = Math.random() > 0.5;
      var f0   = rnd(600, 1100);
      var f1   = rise ? f0 * rnd(1.4, 2.2) : f0 * rnd(0.4, 0.75);
      var osc  = audioCtx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f0, now);
      osc.frequency.exponentialRampToValueAtTime(f1, now + dur);
      var lpf = audioCtx.createBiquadFilter();
      lpf.type = 'lowpass'; lpf.frequency.value = 2200; lpf.Q.value = 1.5;
      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.022, now + 0.04);
      g.gain.setValueAtTime(0.022, now + dur - 0.06);
      g.gain.linearRampToValueAtTime(0, now + dur + 0.04);
      /* slight vibrato */
      var vib = audioCtx.createOscillator();
      vib.frequency.value = rnd(18, 32);
      var vDep = audioCtx.createGain(); vDep.gain.value = rnd(6, 16);
      vib.connect(vDep); vDep.connect(osc.frequency);
      vib.start(now); vib.stop(now + dur + 0.1);
      osc.connect(lpf); lpf.connect(g); g.connect(masterGain);
      osc.start(now); osc.stop(now + dur + 0.1);
      scheduleDroidServo();
    }, 18, 45);
  }

  /* ── DROIDS: Common — electronic warble/scan ─────────── */
  function scheduleDroidWarble() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now     = audioCtx.currentTime;
      var dur     = rnd(0.4, 1.4);
      var carrier = rnd(400, 900);
      var modFreq = rnd(20, 60);
      var modDepth = rnd(80, 280);
      /* FM: modulator modulates carrier frequency */
      var mod = audioCtx.createOscillator();
      mod.frequency.value = modFreq;
      var modGain = audioCtx.createGain(); modGain.gain.value = modDepth;
      var osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = carrier;
      mod.connect(modGain); modGain.connect(osc.frequency);
      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.032, now + 0.06);
      g.gain.setValueAtTime(0.032, now + dur - 0.08);
      g.gain.linearRampToValueAtTime(0, now + dur + 0.05);
      osc.connect(g); g.connect(masterGain);
      mod.start(now); mod.stop(now + dur + 0.1);
      osc.start(now); osc.stop(now + dur + 0.1);
      scheduleDroidWarble();
    }, 22, 55);
  }

  /* ── DROIDS: Rare — power-up / boot sequence ─────────── */
  function scheduleDroidPowerUp() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      if (Math.random() > 0.45) { scheduleDroidPowerUp(); return; }
      var now    = audioCtx.currentTime;
      var up     = Math.random() > 0.5;
      var notes  = up ? [320, 480, 640, 920, 1280] : [1280, 920, 640, 480, 320];
      var cursor = now;
      notes.forEach(function (freq, i) {
        var dur = up ? rnd(0.06, 0.10) + i * 0.012 : rnd(0.10, 0.15) - i * 0.008;
        var osc = audioCtx.createOscillator();
        osc.type = i % 2 === 0 ? 'square' : 'sine';
        osc.frequency.value = freq;
        var g = audioCtx.createGain();
        g.gain.setValueAtTime(0, cursor);
        g.gain.linearRampToValueAtTime(0.038, cursor + 0.01);
        g.gain.setValueAtTime(0.038, cursor + dur - 0.01);
        g.gain.linearRampToValueAtTime(0, cursor + dur + 0.02);
        osc.connect(g); g.connect(masterGain);
        osc.start(cursor); osc.stop(cursor + dur + 0.04);
        cursor += dur + rnd(0.03, 0.07);
      });
      /* final long tone */
      var finalOsc = audioCtx.createOscillator();
      finalOsc.type = 'sine';
      finalOsc.frequency.value = up ? 1800 : 180;
      var fg = audioCtx.createGain();
      fg.gain.setValueAtTime(0, cursor);
      fg.gain.linearRampToValueAtTime(0.030, cursor + 0.04);
      fg.gain.exponentialRampToValueAtTime(0.0001, cursor + 0.55);
      finalOsc.connect(fg); fg.connect(masterGain);
      finalOsc.start(cursor); finalOsc.stop(cursor + 0.6);
      scheduleDroidPowerUp();
    }, 90, 220);
  }

  /* ── DROIDS: Rare — heavy droid walking on metal ─────── */
  function scheduleDroidHeavyWalk() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      if (Math.random() > 0.38) { scheduleDroidHeavyWalk(); return; }
      var now    = audioCtx.currentTime;
      var steps  = rndInt(4, 8);
      var pace   = rnd(0.38, 0.62);
      var cursor = now;
      for (var i = 0; i < steps; i++) {
        (function (t, stepIdx) {
          /* heavy thud */
          var osc = audioCtx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(rnd(55, 85), t);
          osc.frequency.exponentialRampToValueAtTime(rnd(22, 38), t + 0.12);
          var g = audioCtx.createGain();
          g.gain.setValueAtTime(0.14, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
          osc.connect(g); g.connect(masterGain);
          osc.start(t); osc.stop(t + 0.22);
          /* metallic grid clang */
          var clangFreq = rnd(280, 480);
          var cOsc = audioCtx.createOscillator();
          cOsc.type = 'sine'; cOsc.frequency.value = clangFreq;
          var cg = audioCtx.createGain();
          cg.gain.setValueAtTime(0.045, t + 0.01);
          cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
          cOsc.connect(cg); cg.connect(masterGain);
          cOsc.start(t + 0.01); cOsc.stop(t + 0.26);
          /* servo squeak between steps */
          if (stepIdx < steps - 1) {
            var sOsc = audioCtx.createOscillator();
            sOsc.type = 'sawtooth';
            sOsc.frequency.setValueAtTime(rnd(700, 1100), t + 0.08);
            sOsc.frequency.exponentialRampToValueAtTime(rnd(400, 700), t + 0.22);
            var sg = audioCtx.createGain();
            sg.gain.setValueAtTime(0, t + 0.08);
            sg.gain.linearRampToValueAtTime(0.015, t + 0.12);
            sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
            sOsc.connect(sg); sg.connect(masterGain);
            sOsc.start(t + 0.08); sOsc.stop(t + 0.28);
          }
        })(cursor, i);
        cursor += pace + rnd(-0.04, 0.04);
      }
      scheduleDroidHeavyWalk();
    }, 80, 200);
  }

  /* ── FOOTSTEPS: Metal grid — single person ───────────── */
  function scheduleGridFootsteps() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now    = audioCtx.currentTime;
      var steps  = rndInt(14, 22);    /* full bridge crossing */
      var pace   = rnd(0.52, 0.70);   /* deliberate, heavy pace */
      var vol    = rnd(0.10, 0.16);   /* heavy boot on metal grid */
      var cursor = now;
      var rev    = makeReverb(0.22);  /* subtle large-room tail */
      rev.output.connect(masterGain);
      for (var i = 0; i < steps; i++) {
        (function (t) {
          /* low-mid boot impact — dry direct + reverb send */
          var nSrc = audioCtx.createBufferSource();
          nSrc.buffer = makeNoiseBuf(0.12);
          var bpf = audioCtx.createBiquadFilter();
          bpf.type = 'bandpass';
          bpf.frequency.value = rnd(2200, 4500); bpf.Q.value = 2.2;
          var ng = audioCtx.createGain();
          ng.gain.setValueAtTime(vol, t);
          ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.10);
          nSrc.connect(bpf); bpf.connect(ng);
          ng.connect(masterGain);
          ng.connect(rev.input);
          nSrc.start(t);
          /* high-freq heel click on grating */
          var cSrc = audioCtx.createBufferSource();
          cSrc.buffer = makeNoiseBuf(0.03);
          var hpf = audioCtx.createBiquadFilter();
          hpf.type = 'highpass'; hpf.frequency.value = 3500;
          var cg = audioCtx.createGain();
          cg.gain.setValueAtTime(vol * 0.55, t);
          cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
          cSrc.connect(hpf); hpf.connect(cg); cg.connect(masterGain);
          cSrc.start(t);
        })(cursor);
        cursor += pace + rnd(-0.04, 0.06);
      }
      scheduleGridFootsteps();
    }, 4, 12);
  }

  /* ── FOOTSTEPS: Metal grid — group passing by (rare) ─── */
  function scheduleGroupFootsteps() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      if (Math.random() > 0.40) { scheduleGroupFootsteps(); return; }
      var now    = audioCtx.currentTime;
      var people = rndInt(2, 4);
      var rev    = makeReverb(0.24);
      rev.output.connect(masterGain);
      for (var p = 0; p < people; p++) {
        (function (offset) {
          var steps  = rndInt(6, 12);
          var pace   = rnd(0.40, 0.60);
          var vol    = rnd(0.028, 0.048);
          var cursor = now + offset;
          for (var i = 0; i < steps; i++) {
            (function (t) {
              var nSrc = audioCtx.createBufferSource();
              nSrc.buffer = makeNoiseBuf(0.10);
              var bpf = audioCtx.createBiquadFilter();
              bpf.type = 'bandpass';
              bpf.frequency.value = rnd(260, 480); bpf.Q.value = 1.6;
              var ng = audioCtx.createGain();
              ng.gain.setValueAtTime(vol, t);
              ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
              nSrc.connect(bpf); bpf.connect(ng);
              ng.connect(masterGain);
              ng.connect(rev.input);
              nSrc.start(t);
              var rOsc = audioCtx.createOscillator();
              rOsc.type = 'sine'; rOsc.frequency.value = rnd(360, 520);
              var rg = audioCtx.createGain();
              rg.gain.setValueAtTime(vol * 0.45, t + 0.004);
              rg.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
              rOsc.connect(rg); rg.connect(rev.input);
              rOsc.start(t + 0.004); rOsc.stop(t + 0.36);
            })(cursor);
            cursor += pace + rnd(-0.04, 0.05);
          }
        })(p * rnd(0.05, 0.18));
      }
      scheduleGroupFootsteps();
    }, 25, 60);
  }

  /* ── DROIDS: C-3PO style — short electronic beep chatter ── */
  function scheduleDroidProtocol() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      if (Math.random() > 0.85) { scheduleDroidProtocol(); return; }
      var now    = audioCtx.currentTime;
      var cursor = now;
      var beeps  = rndInt(3, 8);
      for (var s = 0; s < beeps; s++) {
        (function (t) {
          var freq = rnd(1800, 3600);
          var dur  = rnd(0.03, 0.09);
          var osc  = audioCtx.createOscillator();
          osc.type = 'square';
          osc.frequency.value = freq;
          var lpf = audioCtx.createBiquadFilter();
          lpf.type = 'lowpass'; lpf.frequency.value = freq * 1.4;
          var g = audioCtx.createGain();
          g.gain.setValueAtTime(0.042, t);
          g.gain.setValueAtTime(0.042, t + dur - 0.006);
          g.gain.linearRampToValueAtTime(0, t + dur + 0.008);
          osc.connect(lpf); lpf.connect(g); g.connect(masterGain);
          osc.start(t); osc.stop(t + dur + 0.012);
        })(cursor);
        cursor += rnd(0.06, 0.18);
      }
      scheduleDroidProtocol();
    }, 6, 18);
  }

  /* ── DOORS: Halo-style sliding blast doors ───────────── */
  function scheduleSciFiDoor() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now  = audioCtx.currentTime;
      var type = Math.floor(Math.random() * 3); /* 0=small, 1=large blast, 2=energy */

      if (type === 0) {
        /* Small sliding panel — pneumatic hiss + light clunk */
        var hSrc = audioCtx.createBufferSource();
        hSrc.buffer = makeNoiseBuf(0.35);
        var hBpf = audioCtx.createBiquadFilter();
        hBpf.type = 'bandpass'; hBpf.frequency.value = 3800; hBpf.Q.value = 0.8;
        var hg = audioCtx.createGain();
        hg.gain.setValueAtTime(0, now);
        hg.gain.linearRampToValueAtTime(0.055, now + 0.02);
        hg.gain.setValueAtTime(0.055, now + 0.22);
        hg.gain.linearRampToValueAtTime(0, now + 0.35);
        hSrc.connect(hBpf); hBpf.connect(hg); hg.connect(masterGain);
        hSrc.start(now);
        /* clunk at end of travel */
        var ck = audioCtx.createOscillator();
        ck.type = 'sine'; ck.frequency.setValueAtTime(180, now + 0.30);
        ck.frequency.exponentialRampToValueAtTime(55, now + 0.42);
        var ckg = audioCtx.createGain();
        ckg.gain.setValueAtTime(0.10, now + 0.30);
        ckg.gain.exponentialRampToValueAtTime(0.0001, now + 0.44);
        ck.connect(ckg); ckg.connect(masterGain);
        ck.start(now + 0.30); ck.stop(now + 0.46);

      } else if (type === 1) {
        /* Large blast door — deep whoosh, heavy double-clank */
        var rev = makeReverb(0.38); rev.output.connect(masterGain);
        var wSrc = audioCtx.createBufferSource();
        wSrc.buffer = makeNoiseBuf(1.1);
        var wLpf = audioCtx.createBiquadFilter();
        wLpf.type = 'lowpass'; wLpf.frequency.value = 900;
        var wg = audioCtx.createGain();
        wg.gain.setValueAtTime(0, now);
        wg.gain.linearRampToValueAtTime(0.18, now + 0.08);
        wg.gain.setValueAtTime(0.18, now + 0.65);
        wg.gain.linearRampToValueAtTime(0, now + 1.1);
        wSrc.connect(wLpf); wLpf.connect(wg); wg.connect(rev.input);
        wSrc.start(now);
        /* mechanical grind layer */
        var mOsc = audioCtx.createOscillator();
        mOsc.type = 'sawtooth'; mOsc.frequency.value = 62;
        var mLpf = audioCtx.createBiquadFilter();
        mLpf.type = 'lowpass'; mLpf.frequency.value = 320;
        var mg = audioCtx.createGain();
        mg.gain.setValueAtTime(0.09, now + 0.04);
        mg.gain.setValueAtTime(0.09, now + 0.72);
        mg.gain.linearRampToValueAtTime(0, now + 0.95);
        mOsc.connect(mLpf); mLpf.connect(mg); mg.connect(rev.input);
        mOsc.start(now + 0.04); mOsc.stop(now + 0.97);
        /* double-clank impact */
        [0.85, 0.96].forEach(function(dt) {
          var imp = audioCtx.createOscillator();
          imp.type = 'sine';
          imp.frequency.setValueAtTime(95, now + dt);
          imp.frequency.exponentialRampToValueAtTime(28, now + dt + 0.28);
          var ig = audioCtx.createGain();
          ig.gain.setValueAtTime(0.22, now + dt);
          ig.gain.exponentialRampToValueAtTime(0.0001, now + dt + 0.32);
          imp.connect(ig); ig.connect(rev.input);
          imp.start(now + dt); imp.stop(now + dt + 0.35);
        });

      } else {
        /* Energy field door — electric crackle + hum that cuts off */
        var eHum = audioCtx.createOscillator();
        eHum.type = 'sawtooth'; eHum.frequency.value = 120;
        var eHpf = audioCtx.createBiquadFilter();
        eHpf.type = 'highpass'; eHpf.frequency.value = 800;
        var eg = audioCtx.createGain();
        eg.gain.setValueAtTime(0, now);
        eg.gain.linearRampToValueAtTime(0.028, now + 0.06);
        eg.gain.setValueAtTime(0.028, now + 0.55);
        eg.gain.linearRampToValueAtTime(0, now + 0.62);
        eHum.connect(eHpf); eHpf.connect(eg); eg.connect(masterGain);
        eHum.start(now); eHum.stop(now + 0.65);
        /* crackle bursts */
        for (var c = 0; c < 4; c++) {
          (function(ct) {
            var cr = audioCtx.createBufferSource();
            cr.buffer = makeNoiseBuf(0.04);
            var crHpf = audioCtx.createBiquadFilter();
            crHpf.type = 'highpass'; crHpf.frequency.value = 5000;
            var crg = audioCtx.createGain();
            crg.gain.setValueAtTime(0.065, ct);
            crg.gain.exponentialRampToValueAtTime(0.0001, ct + 0.04);
            cr.connect(crHpf); crHpf.connect(crg); crg.connect(masterGain);
            cr.start(ct);
          })(now + c * rnd(0.12, 0.18));
        }
        /* sharp off-click */
        var offCk = audioCtx.createOscillator();
        offCk.type = 'square'; offCk.frequency.value = 2200;
        var oCkg = audioCtx.createGain();
        oCkg.gain.setValueAtTime(0.035, now + 0.60);
        oCkg.gain.exponentialRampToValueAtTime(0.0001, now + 0.66);
        offCk.connect(oCkg); oCkg.connect(masterGain);
        offCk.start(now + 0.60); offCk.stop(now + 0.68);
      }

      scheduleSciFiDoor();
    }, 12, 35);
  }

  /* ── TRANSPORTER: Star Trek shimmer ─────────────────── */
  function scheduleTransporter() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      if (Math.random() > 0.70) { scheduleTransporter(); return; }
      var now  = audioCtx.currentTime;
      var dur  = rnd(2.2, 3.8);
      var rev  = makeReverb(0.45); rev.output.connect(masterGain);
      /* rising carrier sweep */
      var carrier = rnd(600, 900);
      var sweepOsc = audioCtx.createOscillator();
      sweepOsc.type = 'sine';
      sweepOsc.frequency.setValueAtTime(carrier, now);
      sweepOsc.frequency.exponentialRampToValueAtTime(carrier * 2.8, now + dur * 0.7);
      sweepOsc.frequency.exponentialRampToValueAtTime(carrier * 0.9, now + dur);
      var sweepG = audioCtx.createGain();
      sweepG.gain.setValueAtTime(0, now);
      sweepG.gain.linearRampToValueAtTime(0.018, now + 0.15);
      sweepG.gain.setValueAtTime(0.018, now + dur - 0.3);
      sweepG.gain.linearRampToValueAtTime(0, now + dur);
      sweepOsc.connect(sweepG); sweepG.connect(rev.input);
      sweepOsc.start(now); sweepOsc.stop(now + dur + 0.1);
      /* shimmer — many fast LFO-modulated tones */
      var shimmerCount = 8;
      for (var i = 0; i < shimmerCount; i++) {
        (function(idx) {
          var baseFreq = carrier * (1 + idx * 0.18) * rnd(0.95, 1.05);
          var sOsc = audioCtx.createOscillator();
          sOsc.type = 'sine';
          sOsc.frequency.value = baseFreq;
          /* each shimmer tone gets its own LFO for that rippling quality */
          var lfo = audioCtx.createOscillator();
          lfo.frequency.value = rnd(6, 18);
          var lfoG = audioCtx.createGain(); lfoG.gain.value = baseFreq * 0.012;
          lfo.connect(lfoG); lfoG.connect(sOsc.frequency);
          var sG = audioCtx.createGain();
          var startAt = now + idx * 0.04;
          sG.gain.setValueAtTime(0, startAt);
          sG.gain.linearRampToValueAtTime(0.012, startAt + 0.20);
          sG.gain.setValueAtTime(0.012, now + dur - 0.35);
          sG.gain.linearRampToValueAtTime(0, now + dur + idx * 0.03);
          sOsc.connect(sG); sG.connect(rev.input);
          lfo.start(startAt); lfo.stop(now + dur + 0.2);
          sOsc.start(startAt); sOsc.stop(now + dur + 0.2);
        })(i);
      }
      /* sparkle — short high noise bursts scattered throughout */
      var sparkCount = rndInt(10, 20);
      for (var k = 0; k < sparkCount; k++) {
        (function(kt) {
          var spk = audioCtx.createBufferSource();
          spk.buffer = makeNoiseBuf(0.025);
          var spkHpf = audioCtx.createBiquadFilter();
          spkHpf.type = 'highpass'; spkHpf.frequency.value = rnd(4000, 9000);
          var spkG = audioCtx.createGain();
          spkG.gain.setValueAtTime(rnd(0.04, 0.09), kt);
          spkG.gain.exponentialRampToValueAtTime(0.0001, kt + 0.025);
          spk.connect(spkHpf); spkHpf.connect(spkG); spkG.connect(rev.input);
          spk.start(kt);
        })(now + Math.random() * dur);
      }
      scheduleTransporter();
    }, 30, 70);
  }

  /* ── START ────────────────────────────────────────────── */
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

    /* Ambient beds */
    startSpaceDrone();
    startMachineryHum();
    startAirRecycling();

    /* Musical elements */
    schedulePadSwell();
    scheduleMotif();
    scheduleBrassAccent();

    /* Ship traffic */
    scheduleSmallShipFlyby();
    scheduleLargeShipFlyby();
    scheduleLanding();

    /* Station events */
    schedulePressureDoor();
    scheduleHydraulicClank();
    scheduleHullCreak();
    scheduleDistantImpact();

    /* Droids — common */
    scheduleDroidChirp();
    scheduleDroidServo();
    scheduleDroidWarble();
    scheduleDroidProtocol();
    /* Droids — rare */
    scheduleDroidPowerUp();
    scheduleDroidHeavyWalk();

    /* Doors & teleporter */
    scheduleSciFiDoor();
    scheduleSciFiDoor();
    scheduleTransporter();
    scheduleTransporter();

    /* Footsteps on metal grid — multiple independent walkers */
    scheduleGridFootsteps();
    scheduleGridFootsteps();
    scheduleGridFootsteps();
    scheduleGroupFootsteps();
    scheduleGroupFootsteps();

    audioStarted = true;
  }

  /* ── STOP ─────────────────────────────────────────────── */
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

    var ctx = audioCtx;
    var srcSnap = allSources.slice();
    var gainSnap = allGains.slice();
    setTimeout(function () {
      srcSnap.forEach(function (s) {
        try { s.stop(); } catch (e) {}
        try { s.disconnect(); } catch (e) {}
      });
      gainSnap.forEach(function (g) { try { g.disconnect(); } catch (e) {} });
      if (ctx) { try { ctx.close(); } catch (e) {} }
    }, 550);

    audioCtx = null; masterGain = null; audioStarted = false;
    allSources = []; allGains = [];
  }

  /* ── Interaction bootstrap ────────────────────────────── */
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

  function start() {
    themeActive = true;
    addInteractionListeners();
  }

  function stop() {
    themeActive = false;
    removeInteractionListeners();
    stopAudio();
  }

  window.terminalTheme = { start: start, stop: stop, get _ctx() { return audioCtx; } };
})();
