/* ============================================================
   THE VEILWOOD THEME — theme-veilwood.js
   Enchanted fae forest soundscape for sorcrpg.com
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

  function makeOneShotNoise(dur) {
    var frames = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
    var buf = audioCtx.createBuffer(1, frames, audioCtx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function makeLoopingNoise() {
    var frames = audioCtx.sampleRate * 2;
    var buf = audioCtx.createBuffer(1, frames, audioCtx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
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

  /* ── AMBIENT BED: Night cricket texture — constant, no pitch drift ── */
  function startCrickets() {
    /* Narrow bandpass noise for cricket chirp texture. No gain LFO — no pitch-change feel. */
    var src = makeLoopingNoise();
    var bpf = makeFilter('bandpass', 4600, 18);
    var g = makeGain(0.009);
    src.connect(bpf); bpf.connect(g); g.connect(masterGain);
    src.start();
  }

  /* ── AMBIENT BED: Distant faint flute — haunting single sustained tones ── */
  function startDistantFlute() {
    /* Pentatonic: C4 D4 E4 G4 A4 C5 */
    var scale = [261, 293, 329, 392, 440, 523];
    var noteIdx = rndInt(0, scale.length - 1);

    function playNote() {
      if (!audioCtx || !masterGain) return;
      var freq = scale[noteIdx];
      var dur  = rnd(3.5, 6.0);

      var osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      allSources.push(osc);

      /* Very gentle vibrato */
      var vib = audioCtx.createOscillator();
      vib.type = 'sine';
      vib.frequency.value = rnd(4.5, 6.5);
      allSources.push(vib);
      var vibDepth = makeGain(rnd(3, 6));
      vib.connect(vibDepth); vibDepth.connect(osc.frequency);

      var g = makeGain(0);
      osc.connect(g); g.connect(masterGain);

      var now = audioCtx.currentTime;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.0065, now + 0.8);
      g.gain.setValueAtTime(0.0065, now + dur - 0.6);
      g.gain.linearRampToValueAtTime(0, now + dur);

      vib.start(now); osc.start(now);
      osc.stop(now + dur + 0.05); vib.stop(now + dur + 0.05);

      /* Advance scale step (skip or hold occasionally) */
      if (Math.random() < 0.7) noteIdx = (noteIdx + pick([1, 2])) % scale.length;

      var id = setTimeout(playNote, (dur + rnd(1.5, 4.0)) * 1000);
      timeouts.push(id);
    }

    var id = setTimeout(playNote, rnd(2, 5) * 1000);
    timeouts.push(id);
  }

  /* ── EVENT: Owl hoot ── */
  function scheduleOwl() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;
      var freq = 215 + rnd(-20, 20);
      var gain = 0.065 * rnd(0.85, 1.15);

      function hoot(startAt) {
        var osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        allSources.push(osc);

        var amOsc = audioCtx.createOscillator();
        amOsc.type = 'sine';
        amOsc.frequency.value = 2.4;
        allSources.push(amOsc);
        var amDepth = makeGain(gain * 0.28);
        amOsc.connect(amDepth);

        var g = makeGain(0);
        amDepth.connect(g.gain);
        osc.connect(g); g.connect(masterGain);

        g.gain.setValueAtTime(0, startAt);
        g.gain.linearRampToValueAtTime(gain, startAt + 0.07);
        g.gain.setValueAtTime(gain, startAt + 0.42);
        g.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.52);

        amOsc.start(startAt); osc.start(startAt);
        osc.stop(startAt + 0.56); amOsc.stop(startAt + 0.56);
      }

      hoot(now);
      if (Math.random() < 0.7) hoot(now + rnd(0.7, 1.1));

      scheduleOwl();
    }, 55, 140);
  }

  /* ── EVENT: Fae giggle / cackle ── */
  function scheduleFaeGiggle() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;

      var count = rndInt(4, 8);
      var ascending = Math.random() < 0.5;
      var baseFreq = rnd(380, 560);
      var cursor = now;

      for (var i = 0; i < count; i++) {
        (function (startAt, idx) {
          var freqMult = ascending ? 1 + idx * rnd(0.06, 0.12) : 1 - idx * rnd(0.04, 0.09);
          var freq = baseFreq * freqMult * rnd(0.96, 1.04);
          var dur  = rnd(0.04, 0.09);
          var gain = rnd(0.055, 0.085) * (1 - idx * 0.05);

          var osc = audioCtx.createOscillator();
          osc.type = Math.random() < 0.5 ? 'triangle' : 'sawtooth';
          osc.frequency.value = freq;
          allSources.push(osc);

          var bpf = audioCtx.createBiquadFilter();
          bpf.type = 'bandpass'; bpf.frequency.value = freq * 1.5; bpf.Q.value = 2;

          var g = audioCtx.createGain();
          g.gain.setValueAtTime(0, startAt);
          g.gain.linearRampToValueAtTime(gain, startAt + 0.012);
          g.gain.setValueAtTime(gain, startAt + dur - 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, startAt + dur + 0.015);
          allGains.push(g);

          /* Slight delay for cave-giggle reverb feel */
          var delay = audioCtx.createDelay(0.2);
          delay.delayTime.value = 0.06;
          var delayG = audioCtx.createGain(); delayG.gain.value = 0.18;
          allGains.push(delayG);

          osc.connect(bpf); bpf.connect(g); g.connect(masterGain);
          g.connect(delay); delay.connect(delayG); delayG.connect(masterGain);
          osc.start(startAt); osc.stop(startAt + dur + 0.05);
        })(cursor, i);

        cursor += rnd(0.05, 0.13);
      }

      scheduleFaeGiggle();
    }, 50, 130);
  }

  /* ── EVENT: Gnome bard — pentatonic flute phrase ── */
  function scheduleGnomeFlute() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;

      /* Pentatonic — bard plays 4–6 notes as a phrase */
      var scale = [261, 293, 329, 392, 440, 523, 587];
      var count = rndInt(4, 6);
      var cursor = now;
      var startNote = rndInt(0, scale.length - count);

      /* Optional second voice (humming harmony at a fifth above) */
      var addHumming = Math.random() < 0.45;

      for (var i = 0; i < count; i++) {
        (function (startAt, noteFreq) {
          var dur  = rnd(0.22, 0.45);
          var gain = rnd(0.025, 0.042);

          /* Flute: triangle wave, slight vibrato */
          var osc = audioCtx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = noteFreq;
          allSources.push(osc);

          var vib = audioCtx.createOscillator();
          vib.type = 'sine'; vib.frequency.value = rnd(5, 7);
          allSources.push(vib);
          var vibDepth = audioCtx.createGain(); vibDepth.gain.value = rnd(6, 14);
          vib.connect(vibDepth); vibDepth.connect(osc.frequency);

          var g = makeGain(0);
          osc.connect(g); g.connect(masterGain);
          g.gain.setValueAtTime(0, startAt);
          g.gain.linearRampToValueAtTime(gain, startAt + 0.04);
          g.gain.setValueAtTime(gain, startAt + dur - 0.04);
          g.gain.exponentialRampToValueAtTime(0.0001, startAt + dur + 0.02);

          vib.start(startAt); osc.start(startAt);
          osc.stop(startAt + dur + 0.05); vib.stop(startAt + dur + 0.05);

          /* Humming harmony */
          if (addHumming) {
            var harmFreq = noteFreq * 1.498; /* perfect fifth */
            var harmOsc = audioCtx.createOscillator();
            harmOsc.type = 'sine'; harmOsc.frequency.value = harmFreq;
            allSources.push(harmOsc);
            var harmG = makeGain(0);
            harmOsc.connect(harmG); harmG.connect(masterGain);
            harmG.gain.setValueAtTime(0, startAt);
            harmG.gain.linearRampToValueAtTime(gain * 0.55, startAt + 0.06);
            harmG.gain.setValueAtTime(gain * 0.55, startAt + dur - 0.04);
            harmG.gain.exponentialRampToValueAtTime(0.0001, startAt + dur + 0.02);
            harmOsc.start(startAt); harmOsc.stop(startAt + dur + 0.05);
          }
        })(cursor, scale[startNote + i] || scale[scale.length - 1]);

        cursor += rnd(0.28, 0.55);
      }

      scheduleGnomeFlute();
    }, 35, 100);
  }

  /* ── EVENT: Hooved animal gallop — slow approach, fast past, fading ── */
  function scheduleGallop() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;

      var totalBeats = rndInt(10, 16);
      var cursor = now;

      /* Build timing: slow start, accelerate through middle, fade end */
      for (var i = 0; i < totalBeats; i++) {
        var progress = i / totalBeats; /* 0 → 1 */
        /* Interval: starts ~0.55s, dips to 0.18s at peak, eases back to 0.45s */
        var interval;
        if (progress < 0.35)      interval = 0.55 - progress * 1.0;
        else if (progress < 0.65) interval = 0.18 + (progress - 0.35) * 0.2;
        else                       interval = 0.24 + (progress - 0.65) * 0.9;

        /* Two hooves per beat (front pair, back pair) */
        var beatGain = progress < 0.5
          ? 0.04 + progress * 0.14         /* approaching: gets louder */
          : 0.11 - (progress - 0.5) * 0.18; /* receding: fades out */
        beatGain = Math.max(0.005, beatGain);

        (function (startAt, gain) {
          /* Front hoof */
          (function () {
            var src = audioCtx.createBufferSource();
            src.buffer = makeOneShotNoise(0.035);
            var lpf = audioCtx.createBiquadFilter();
            lpf.type = 'lowpass'; lpf.frequency.value = rnd(350, 500);
            var g = audioCtx.createGain();
            g.gain.setValueAtTime(gain, startAt);
            g.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.03);
            src.connect(lpf); lpf.connect(g); g.connect(masterGain);
            src.start(startAt);
          })();
          /* Back hoof (slight delay) */
          (function () {
            var offset = rnd(0.05, 0.10);
            var src = audioCtx.createBufferSource();
            src.buffer = makeOneShotNoise(0.032);
            var lpf = audioCtx.createBiquadFilter();
            lpf.type = 'lowpass'; lpf.frequency.value = rnd(300, 450);
            var g = audioCtx.createGain();
            g.gain.setValueAtTime(gain * 0.85, startAt + offset);
            g.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + 0.028);
            src.connect(lpf); lpf.connect(g); g.connect(masterGain);
            src.start(startAt + offset);
          })();
        })(cursor, beatGain);

        cursor += Math.max(0.12, interval);
      }

      scheduleGallop();
    }, 70, 200);
  }

  /* ── EVENT: Bear roar (rare) ── */
  function scheduleBearRoar() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      if (Math.random() < 0.5) {
        var now = audioCtx.currentTime;
        var fundamental = rnd(85, 120);
        var dur = rnd(1.4, 2.2);
        var gain = rnd(0.11, 0.16);

        /* Fundamental */
        (function () {
          var osc = audioCtx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(fundamental, now);
          osc.frequency.linearRampToValueAtTime(fundamental * 0.7, now + dur);
          allSources.push(osc);

          var lpf = audioCtx.createBiquadFilter();
          lpf.type = 'lowpass'; lpf.frequency.value = 800;

          var g = makeGain(0);
          osc.connect(lpf); lpf.connect(g); g.connect(masterGain);
          g.gain.setValueAtTime(0, now);
          g.gain.linearRampToValueAtTime(gain, now + 0.35);
          g.gain.setValueAtTime(gain, now + dur * 0.55);
          g.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.15);
          osc.start(now); osc.stop(now + dur + 0.2);
        })();

        /* Growl noise layer */
        (function () {
          var src = audioCtx.createBufferSource();
          src.buffer = makeOneShotNoise(dur + 0.3);
          var bpf = audioCtx.createBiquadFilter();
          bpf.type = 'bandpass'; bpf.frequency.value = 280; bpf.Q.value = 1.5;
          var g = audioCtx.createGain();
          g.gain.setValueAtTime(0, now);
          g.gain.linearRampToValueAtTime(gain * 0.55, now + 0.3);
          g.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.1);
          allGains.push(g);
          src.connect(bpf); bpf.connect(g); g.connect(masterGain);
          src.start(now);
        })();
      }

      scheduleBearRoar();
    }, 120, 300);
  }

  /* ── EVENT: Leaf rustle gust ── */
  function scheduleLeafRustle() {
    sched(function () {
      if (!audioCtx || !masterGain) return;
      var now = audioCtx.currentTime;
      var dur = rnd(0.35, 0.9);

      var src = audioCtx.createBufferSource();
      src.buffer = makeOneShotNoise(dur + 0.1);
      var bpf = makeFilter('bandpass', rnd(1000, 1500), rnd(1.1, 1.7));
      var g = makeGain(0);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(rnd(0.025, 0.045), now + dur * 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.04);
      src.connect(bpf); bpf.connect(g); g.connect(masterGain);
      src.start(now);

      scheduleLeafRustle();
    }, 10, 25);
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

    startCrickets();
    startDistantFlute();

    scheduleOwl();
    scheduleFaeGiggle();
    scheduleGnomeFlute();
    scheduleGallop();
    scheduleBearRoar();
    scheduleLeafRustle();

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

  window.veilwoodTheme = { start: start, stop: stop };
})();
