/* ============================================================
   VEILWOOD THEME — theme-veilwood.js
   Mythical forest day/night cycle canvas background for sorcrpg.com
   Exposes: window.veilwoodTheme = { start, stop }
   ============================================================ */
(function () {
  'use strict';

  /* ── STATE ── */
  var canvas = null;
  var ctx = null;
  var W = 0, H = 0;
  var rafId = null;
  var running = false;
  var startTime = 0;
  var lastRafTime = 0;

  /* ── AUDIO STATE ── */
  var audioCtx = null;
  var audioStarted = false;
  var pendingAudioStart = false;
  var birdTimer = null;
  var allNodes = [];        /* every node created, for cleanup */
  var allOscillators = []; /* started oscillators to stop on cleanup */
  var allIntervals = [];   /* setInterval ids for LFOs */

  /* ── SCENE OBJECTS (generated once) ── */
  var STARS = [];
  var FIREFLIES = [];
  var PARTICLES = [];
  var TREES_BACK = [];
  var TREES_MID = [];
  var TREES_FRONT = [];
  var SCENE_INIT = false;

  /* ── DAY/NIGHT CYCLE ── */
  var CYCLE_DURATION = 120; /* seconds for a full cycle */

  /* Returns a value 0..1 representing progress through the cycle.
     0=dawn, 0.25=midday, 0.5=dusk, 0.75=midnight */
  function getCyclePhase(t) {
    return (t % CYCLE_DURATION) / CYCLE_DURATION;
  }

  /* Returns nightness 0..1 (0=full day, 1=full night) */
  function getNightness(phase) {
    /* Use a smooth wave: night peaks at 0.75, day at 0.25 */
    return 0.5 - 0.5 * Math.cos((phase - 0.25) * Math.PI * 2);
  }

  /* ── INIT SCENE OBJECTS ── */
  function initScene() {
    if (SCENE_INIT) return;
    SCENE_INIT = true;

    /* Stars */
    for (var i = 0; i < 120; i++) {
      STARS.push({
        x: Math.random(),
        y: Math.random() * 0.65,
        r: Math.random() * 1.3 + 0.2,
        a: Math.random() * 0.7 + 0.3,
        tw: Math.random() * Math.PI * 2
      });
    }

    /* Fireflies */
    for (var j = 0; j < 25; j++) {
      FIREFLIES.push({
        x: Math.random(),
        y: 0.5 + Math.random() * 0.4,
        vx: (Math.random() - 0.5) * 0.0003,
        vy: (Math.random() - 0.5) * 0.00015,
        phase: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 0.8,
        bright: Math.random()
      });
    }

    /* Magical particles */
    for (var k = 0; k < 18; k++) {
      PARTICLES.push({
        x: Math.random(),
        y: 0.3 + Math.random() * 0.65,
        vy: -0.00008 - Math.random() * 0.00006,
        vx: (Math.random() - 0.5) * 0.00004,
        phase: Math.random() * Math.PI * 2,
        col: Math.random() > 0.5 ? 'purple' : 'gold',
        size: 1.5 + Math.random() * 2
      });
    }

    /* Tree layers — each tree: x (fraction), height, width, tilt, swayAmp */
    generateTrees(TREES_BACK, 14, 0.55);
    generateTrees(TREES_MID, 12, 0.68);
    generateTrees(TREES_FRONT, 10, 0.82);
  }

  function generateTrees(arr, count, groundY) {
    for (var i = 0; i < count; i++) {
      arr.push({
        x: (i + 0.3 + Math.random() * 0.4) / count,
        groundY: groundY,
        height: 0.18 + Math.random() * 0.12,
        width: 0.04 + Math.random() * 0.03,
        swayAmp: 0.004 + Math.random() * 0.003,
        swaySpeed: 0.3 + Math.random() * 0.4,
        swayPhase: Math.random() * Math.PI * 2,
        branchSeed: Math.random()
      });
    }
  }

  /* ── SKY COLOR ── */
  function getSkyColors(phase) {
    /* phase 0=dawn 0.25=day 0.5=dusk 0.75=night */
    /* Interpolate between key sky states */
    var states = [
      /* phase  top-color                       horizon-color */
      { p: 0.00, top: [15, 10, 35],   hor: [200, 90, 50]  },  /* dawn */
      { p: 0.12, top: [20, 40, 100],  hor: [220, 150, 80] },  /* mid-dawn */
      { p: 0.25, top: [10, 30, 90],   hor: [80, 130, 200] },  /* day */
      { p: 0.38, top: [15, 20, 70],   hor: [200, 100, 60] },  /* pre-dusk */
      { p: 0.50, top: [60, 20, 80],   hor: [220, 80, 40]  },  /* dusk */
      { p: 0.62, top: [10, 5, 30],    hor: [80, 30, 60]   },  /* twilight */
      { p: 0.75, top: [2, 4, 10],     hor: [5, 8, 20]     },  /* night */
      { p: 0.88, top: [5, 3, 20],     hor: [10, 5, 30]    },  /* late night */
      { p: 1.00, top: [15, 10, 35],   hor: [200, 90, 50]  },  /* back to dawn */
    ];

    /* Find surrounding states */
    var a = states[0], b = states[states.length - 1];
    for (var i = 0; i < states.length - 1; i++) {
      if (phase >= states[i].p && phase <= states[i + 1].p) {
        a = states[i]; b = states[i + 1]; break;
      }
    }
    var t = a.p === b.p ? 0 : (phase - a.p) / (b.p - a.p);
    t = smoothstep(t);

    return {
      top: lerp3(a.top, b.top, t),
      hor: lerp3(a.hor, b.hor, t)
    };
  }

  function lerp3(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t)
    ];
  }

  function smoothstep(t) {
    return t * t * (3 - 2 * t);
  }

  /* ── DRAW SKY ── */
  function drawSky(phase) {
    var colors = getSkyColors(phase);
    var grd = ctx.createLinearGradient(0, 0, 0, H * 0.82);
    grd.addColorStop(0, 'rgb(' + colors.top[0] + ',' + colors.top[1] + ',' + colors.top[2] + ')');
    grd.addColorStop(1, 'rgb(' + colors.hor[0] + ',' + colors.hor[1] + ',' + colors.hor[2] + ')');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
  }

  /* ── DRAW STARS ── */
  function drawStars(nightness, t) {
    if (nightness < 0.05) return;
    for (var i = 0; i < STARS.length; i++) {
      var s = STARS[i];
      var twinkle = 0.7 + 0.3 * Math.sin(t * 1.2 + s.tw);
      var alpha = nightness * s.a * twinkle;
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
      ctx.fill();
    }
  }

  /* ── SUN / MOON ARC ── */
  /* Both arc across the sky: y = sin(arcFrac * PI) for height */
  function getCelestialPos(phase, offset) {
    /* arcFrac 0=rising, 0.5=zenith, 1=setting */
    var arcFrac = ((phase + offset) % 1.0);
    var x = arcFrac;
    var y = 0.75 - 0.65 * Math.max(0, Math.sin(arcFrac * Math.PI));
    return { x: x, y: y };
  }

  function drawSun(phase, nightness, t) {
    if (nightness > 0.85) return;
    var pos = getCelestialPos(phase, 0);
    if (pos.y > 0.75) return; /* below horizon */

    var alpha = 1 - nightness;
    var sx = pos.x * W;
    var sy = pos.y * H;
    var r = Math.min(W, H) * 0.055;

    /* Corona */
    var pulse = 1 + 0.06 * Math.sin(t * 1.5);
    var corona = ctx.createRadialGradient(sx, sy, r * 0.5, sx, sy, r * 3.5 * pulse);
    corona.addColorStop(0, 'rgba(255,235,100,' + (alpha * 0.55) + ')');
    corona.addColorStop(0.3, 'rgba(255,180,40,' + (alpha * 0.25) + ')');
    corona.addColorStop(1, 'transparent');
    ctx.fillStyle = corona;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 3.5 * pulse, 0, Math.PI * 2);
    ctx.fill();

    /* Body */
    var body = ctx.createRadialGradient(sx - r * 0.2, sy - r * 0.2, 0, sx, sy, r);
    body.addColorStop(0, 'rgba(255,255,220,' + alpha + ')');
    body.addColorStop(0.5, 'rgba(255,220,60,' + alpha + ')');
    body.addColorStop(1, 'rgba(240,160,20,' + alpha + ')');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMoons(phase, nightness, t) {
    if (nightness < 0.1) return;

    /* Large silver moon */
    var pos1 = getCelestialPos(phase, 0.5);
    if (pos1.y <= 0.75) {
      var mx = pos1.x * W;
      var my = pos1.y * H;
      var mr = Math.min(W, H) * 0.04;
      var alpha1 = nightness;

      /* Moon glow */
      var mglow = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 3);
      mglow.addColorStop(0, 'rgba(220,230,255,' + (alpha1 * 0.3) + ')');
      mglow.addColorStop(1, 'transparent');
      ctx.fillStyle = mglow;
      ctx.beginPath();
      ctx.arc(mx, my, mr * 3, 0, Math.PI * 2);
      ctx.fill();

      /* Moon body */
      var mbody = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, 0, mx, my, mr);
      mbody.addColorStop(0, 'rgba(240,245,255,' + alpha1 + ')');
      mbody.addColorStop(0.6, 'rgba(200,215,240,' + alpha1 + ')');
      mbody.addColorStop(1, 'rgba(160,175,210,' + alpha1 + ')');
      ctx.fillStyle = mbody;
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();

      /* Mare shadows */
      ctx.save();
      ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = 'rgba(100,110,140,' + (alpha1 * 0.25) + ')';
      ctx.beginPath(); ctx.arc(mx + mr * 0.25, my - mr * 0.2, mr * 0.35, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(mx - mr * 0.3, my + mr * 0.3, mr * 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    /* Smaller purple moon */
    var pos2 = getCelestialPos(phase, 0.58);
    if (pos2.y <= 0.75) {
      var mx2 = pos2.x * W;
      var my2 = pos2.y * H;
      var mr2 = Math.min(W, H) * 0.022;
      var alpha2 = nightness * 0.9;

      var mglow2 = ctx.createRadialGradient(mx2, my2, 0, mx2, my2, mr2 * 2.5);
      mglow2.addColorStop(0, 'rgba(180,100,255,' + (alpha2 * 0.35) + ')');
      mglow2.addColorStop(1, 'transparent');
      ctx.fillStyle = mglow2;
      ctx.beginPath();
      ctx.arc(mx2, my2, mr2 * 2.5, 0, Math.PI * 2);
      ctx.fill();

      var mbody2 = ctx.createRadialGradient(mx2 - mr2 * 0.3, my2 - mr2 * 0.3, 0, mx2, my2, mr2);
      mbody2.addColorStop(0, 'rgba(220,170,255,' + alpha2 + ')');
      mbody2.addColorStop(0.7, 'rgba(160,80,220,' + alpha2 + ')');
      mbody2.addColorStop(1, 'rgba(100,40,180,' + alpha2 + ')');
      ctx.fillStyle = mbody2;
      ctx.beginPath();
      ctx.arc(mx2, my2, mr2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ── DRAW TREES ── */
  function drawTreeLayer(trees, colR, colG, colB, t, swayMult) {
    for (var i = 0; i < trees.length; i++) {
      var tree = trees[i];
      var sway = Math.sin(t * tree.swaySpeed + tree.swayPhase) * tree.swayAmp * swayMult;
      var tx = tree.x * W;
      var ty = tree.groundY * H;
      var th = tree.height * H;
      var tw = tree.width * W;

      ctx.save();
      ctx.translate(tx, ty);

      /* Trunk */
      var trunkW = tw * 0.12;
      ctx.beginPath();
      ctx.moveTo(-trunkW * 0.5, 0);
      ctx.lineTo(-trunkW * 0.5 + sway * th * 0.15, -th * 0.35);
      ctx.lineTo(trunkW * 0.5 + sway * th * 0.15, -th * 0.35);
      ctx.lineTo(trunkW * 0.5, 0);
      ctx.closePath();
      ctx.fillStyle = 'rgb(' + colR + ',' + colG + ',' + colB + ')';
      ctx.fill();

      /* Crown — layered ovals for a stylized silhouette */
      var trunkTopX = sway * th * 0.15;
      var trunkTopY = -th * 0.35;

      /* Bottom crown layer */
      ctx.save();
      ctx.translate(trunkTopX, trunkTopY);
      ctx.rotate(sway * 0.08);
      ctx.beginPath();
      ctx.ellipse(0, -th * 0.18, tw * 0.5, th * 0.22, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgb(' + colR + ',' + colG + ',' + colB + ')';
      ctx.fill();

      /* Middle crown layer */
      ctx.beginPath();
      ctx.ellipse(tw * 0.1 * tree.branchSeed, -th * 0.32, tw * 0.38, th * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();

      /* Top tuft */
      ctx.beginPath();
      ctx.ellipse(-tw * 0.05 * tree.branchSeed, -th * 0.44, tw * 0.22, th * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      ctx.restore();
    }
  }

  function drawTrees(t) {
    /* Back layer — darkest, barely visible */
    drawTreeLayer(TREES_BACK, 4, 6, 10, t, 0.6);
    /* Mid layer */
    drawTreeLayer(TREES_MID, 3, 5, 8, t, 0.8);
    /* Front layer — most contrast, most sway */
    drawTreeLayer(TREES_FRONT, 2, 3, 5, t, 1.2);
  }

  /* ── GROUND MIST ── */
  function drawMist(phase, t) {
    var nightness = getNightness(phase);
    var mistAlpha = 0.06 + nightness * 0.06 + 0.03 * Math.sin(t * 0.4);
    var mistY = H * 0.78;
    var mistH = H * 0.18;

    var grd = ctx.createLinearGradient(0, mistY, 0, mistY + mistH);
    grd.addColorStop(0, 'rgba(200,220,255,' + mistAlpha + ')');
    grd.addColorStop(0.4, 'rgba(160,190,230,' + (mistAlpha * 0.6) + ')');
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.fillRect(0, mistY, W, mistH);
  }

  /* ── FIREFLIES ── */
  function updateFireflies(dt) {
    for (var i = 0; i < FIREFLIES.length; i++) {
      var f = FIREFLIES[i];
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      /* Drift back in bounds */
      if (f.x < 0) f.x += 1;
      if (f.x > 1) f.x -= 1;
      if (f.y < 0.45) f.vy += 0.000002;
      if (f.y > 0.95) f.vy -= 0.000002;
      f.phase += f.speed * dt * 0.003;
    }
  }

  function drawFireflies(nightness, t) {
    if (nightness < 0.3) return;
    var globalAlpha = Math.max(0, (nightness - 0.3) / 0.7);
    for (var i = 0; i < FIREFLIES.length; i++) {
      var f = FIREFLIES[i];
      var blink = 0.5 + 0.5 * Math.sin(f.phase);
      var alpha = globalAlpha * blink;
      if (alpha < 0.05) continue;
      var fx = f.x * W;
      var fy = f.y * H;

      /* Glow */
      var grd = ctx.createRadialGradient(fx, fy, 0, fx, fy, 8);
      grd.addColorStop(0, 'rgba(180,255,80,' + alpha + ')');
      grd.addColorStop(0.4, 'rgba(120,220,40,' + (alpha * 0.5) + ')');
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(fx, fy, 8, 0, Math.PI * 2);
      ctx.fill();

      /* Core dot */
      ctx.beginPath();
      ctx.arc(fx, fy, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(220,255,120,' + alpha + ')';
      ctx.fill();
    }
  }

  /* ── MAGICAL PARTICLES ── */
  function updateParticles(dt) {
    for (var i = 0; i < PARTICLES.length; i++) {
      var p = PARTICLES[i];
      p.y += p.vy * dt;
      p.x += p.vx * dt;
      p.phase += 0.002 * dt;
      /* Reset when off screen */
      if (p.y < 0.1) {
        p.y = 0.7 + Math.random() * 0.25;
        p.x = Math.random();
      }
      if (p.x < 0) p.x += 1;
      if (p.x > 1) p.x -= 1;
    }
  }

  function drawParticles(t) {
    for (var i = 0; i < PARTICLES.length; i++) {
      var p = PARTICLES[i];
      var alpha = 0.35 + 0.35 * Math.sin(p.phase);
      var px = p.x * W;
      var py = p.y * H;
      var col = p.col === 'purple' ? '160,80,255' : '255,200,60';

      var grd = ctx.createRadialGradient(px, py, 0, px, py, p.size * 2.5);
      grd.addColorStop(0, 'rgba(' + col + ',' + alpha + ')');
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(px, py, p.size * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ── DARK OVERLAY ── */
  function drawOverlay(nightness) {
    var nightA = 0.45, dayA = 0.35;
    var alpha = dayA + (nightA - dayA) * nightness;
    var r = Math.round(2 + nightness * 0);
    var g = Math.round(4 + nightness * 0);
    var b = Math.round(10 + nightness * 0);
    ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    ctx.fillRect(0, 0, W, H);
  }

  /* ──────────────────────────────────────────
     MAIN RENDER LOOP
  ────────────────────────────────────────── */
  function render(now) {
    if (!running) return;
    var dt = now - (lastRafTime || now);
    lastRafTime = now;

    var t = (now - startTime) / 1000;
    var phase = getCyclePhase(t);
    var nightness = getNightness(phase);

    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;

    /* Sky */
    drawSky(phase);

    /* Stars */
    drawStars(nightness, t);

    /* Celestial bodies */
    drawSun(phase, nightness, t);
    drawMoons(phase, nightness, t);

    /* Trees */
    drawTrees(t);

    /* Mist */
    drawMist(phase, t);

    /* Fireflies */
    updateFireflies(dt);
    drawFireflies(nightness, t);

    /* Magical particles */
    updateParticles(dt);
    drawParticles(t);

    /* Dark overlay */
    drawOverlay(nightness);

    rafId = requestAnimationFrame(render);
  }

  /* ──────────────────────────────────────────
     AUDIO
  ────────────────────────────────────────── */
  function ensureAudioCtx() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) { audioCtx = null; }
    }
    return audioCtx;
  }

  /* Build a ConvolverNode with exponential-decay white-noise impulse (~2s) */
  function makeReverb(ac, duration) {
    var sampleRate = ac.sampleRate;
    var length = Math.floor(sampleRate * duration);
    var impulse = ac.createBuffer(2, length, sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var data = impulse.getChannelData(ch);
      for (var i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
      }
    }
    var conv = ac.createConvolver();
    conv.buffer = impulse;
    return conv;
  }

  /* Create a looping white-noise BufferSource */
  function makeNoiseSource(ac) {
    var bufLen = Math.ceil(ac.sampleRate * 0.5);
    var buf = ac.createBuffer(1, bufLen, ac.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < bufLen; i++) { d[i] = Math.random() * 2 - 1; }
    var src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    return src;
  }

  function startAudio() {
    if (audioStarted) return;
    var ac = ensureAudioCtx();
    if (!ac) return;
    if (ac.state === 'suspended') {
      ac.resume().then(startAudio);
      return;
    }
    audioStarted = true;
    allNodes = [];
    allOscillators = [];
    allIntervals = [];

    var now = ac.currentTime;

    /* ── Shared reverb ── */
    var reverb = makeReverb(ac, 2.0);
    var reverbGain = ac.createGain();
    reverbGain.gain.value = 0.28;
    reverb.connect(reverbGain);
    reverbGain.connect(ac.destination);
    allNodes.push(reverb, reverbGain);

    /* ──────────────────────────────────────
       FLUTE MELODY (bard)
    ────────────────────────────────────── */
    /* Breath noise: highpass-filtered white noise, gain 0.006 */
    var breathNoise = makeNoiseSource(ac);
    var breathHp = ac.createBiquadFilter();
    breathHp.type = 'highpass';
    breathHp.frequency.value = 2000;
    var breathGain = ac.createGain();
    breathGain.gain.value = 0.006;
    breathNoise.connect(breathHp);
    breathHp.connect(breathGain);
    breathGain.connect(ac.destination);
    breathNoise.start(now);
    allNodes.push(breathNoise, breathHp, breathGain);
    allOscillators.push(breathNoise);

    /* Flute oscillator with vibrato */
    var fluteOsc = ac.createOscillator();
    fluteOsc.type = 'sine';
    fluteOsc.frequency.value = 293; /* D4 starting note */

    var fluteVibratoLfo = ac.createOscillator();
    fluteVibratoLfo.type = 'sine';
    fluteVibratoLfo.frequency.value = 5.5;
    var fluteVibratoGain = ac.createGain();
    fluteVibratoGain.gain.value = 4; /* ±4 cents depth */
    fluteVibratoLfo.connect(fluteVibratoGain);
    fluteVibratoGain.connect(fluteOsc.detune);

    var fluteGain = ac.createGain();
    fluteGain.gain.setValueAtTime(0, now);

    fluteOsc.connect(fluteGain);
    fluteGain.connect(ac.destination);
    fluteGain.connect(reverb);

    fluteOsc.start(now);
    fluteVibratoLfo.start(now);
    allNodes.push(fluteOsc, fluteVibratoLfo, fluteVibratoGain, fluteGain);
    allOscillators.push(fluteOsc, fluteVibratoLfo);

    /* D minor pentatonic: D4 F4 G4 A4 C5 D5 F5 G5 */
    var pentatonic = [293, 349, 392, 440, 523, 587, 698, 784];
    var noteIdx = 0;
    var noteDur = 0.6;
    var noteGap = 0.1;

    function scheduleNextNote() {
      if (!audioStarted) return;
      var freq = pentatonic[noteIdx % pentatonic.length];
      noteIdx++;
      var t = ac.currentTime;
      fluteOsc.frequency.setValueAtTime(freq, t);
      fluteGain.gain.cancelScheduledValues(t);
      fluteGain.gain.setValueAtTime(0, t);
      fluteGain.gain.linearRampToValueAtTime(0.045, t + 0.04);
      fluteGain.gain.setValueAtTime(0.045, t + noteDur - 0.08);
      fluteGain.gain.linearRampToValueAtTime(0, t + noteDur);
      var interval = (noteDur + noteGap) * 1000;
      var tid = setTimeout(scheduleNextNote, interval);
      allIntervals.push(tid);
    }
    scheduleNextNote();

    /* ──────────────────────────────────────
       CHOIR / ELF CHANT — D3 cluster (146Hz)
    ────────────────────────────────────── */
    /* Slow amplitude swell LFO at 0.05Hz */
    var choirSwellLfo = ac.createOscillator();
    choirSwellLfo.type = 'sine';
    choirSwellLfo.frequency.value = 0.05;
    var choirSwellGain = ac.createGain();
    choirSwellGain.gain.value = 0.007;   /* swell depth around base 0.018 */
    choirSwellLfo.connect(choirSwellGain);
    choirSwellLfo.start(now);
    allNodes.push(choirSwellLfo, choirSwellGain);
    allOscillators.push(choirSwellLfo);

    /* Slow vibrato LFO at 0.3Hz for all choir voices */
    var choirVibratoLfo = ac.createOscillator();
    choirVibratoLfo.type = 'sine';
    choirVibratoLfo.frequency.value = 0.3;
    var choirVibratoGain = ac.createGain();
    choirVibratoGain.gain.value = 6;   /* ±6 cents */
    choirVibratoLfo.connect(choirVibratoGain);
    choirVibratoLfo.start(now);
    allNodes.push(choirVibratoLfo, choirVibratoGain);
    allOscillators.push(choirVibratoLfo);

    /* D3 cluster: 5 voices, offsets [0, +7, -5, +12, -9] cents */
    var d3Offsets = [0, 7, -5, 12, -9];
    for (var ci = 0; ci < d3Offsets.length; ci++) {
      var cOsc = ac.createOscillator();
      cOsc.type = 'sine';
      cOsc.frequency.value = 146;
      cOsc.detune.value = d3Offsets[ci];
      choirVibratoGain.connect(cOsc.detune);

      var cGain = ac.createGain();
      cGain.gain.setValueAtTime(0, now);
      cGain.gain.linearRampToValueAtTime(0.018, now + 5);
      choirSwellGain.connect(cGain.gain);

      cOsc.connect(cGain);
      cGain.connect(ac.destination);
      cGain.connect(reverb);
      cOsc.start(now);
      allNodes.push(cOsc, cGain);
      allOscillators.push(cOsc);
    }

    /* A3 cluster (220Hz): same treatment, gain 0.012 */
    var a3Offsets = [0, 7, -5, 12, -9];
    var a3SwellGain = ac.createGain();
    a3SwellGain.gain.value = 0.005;
    choirSwellLfo.connect(a3SwellGain);
    allNodes.push(a3SwellGain);

    for (var ai = 0; ai < a3Offsets.length; ai++) {
      var aOsc = ac.createOscillator();
      aOsc.type = 'sine';
      aOsc.frequency.value = 220;
      aOsc.detune.value = a3Offsets[ai];
      choirVibratoGain.connect(aOsc.detune);

      var aGain = ac.createGain();
      aGain.gain.setValueAtTime(0, now);
      aGain.gain.linearRampToValueAtTime(0.012, now + 5);
      a3SwellGain.connect(aGain.gain);

      aOsc.connect(aGain);
      aGain.connect(ac.destination);
      aGain.connect(reverb);
      aOsc.start(now);
      allNodes.push(aOsc, aGain);
      allOscillators.push(aOsc);
    }

    /* ──────────────────────────────────────
       FOREST AMBIENCE
    ────────────────────────────────────── */

    /* Wind: white noise → lowpass 400Hz → gain with slow LFO (0.07Hz) */
    var windNoise = makeNoiseSource(ac);
    var windLp = ac.createBiquadFilter();
    windLp.type = 'lowpass';
    windLp.frequency.value = 400;
    windLp.Q.value = 1.5;

    var windGainNode = ac.createGain();
    windGainNode.gain.setValueAtTime(0, now);
    windGainNode.gain.linearRampToValueAtTime(0.022, now + 4);

    /* Wind LFO — use setInterval to avoid AudioWorklet dependency */
    var windLfoPhase = 0;
    var windIntervalId = setInterval(function () {
      if (!audioStarted || !windGainNode) return;
      windLfoPhase += 0.07 * 0.2 * Math.PI * 2;   /* 0.07Hz * 200ms step */
      var val = 0.022 + 0.011 * Math.sin(windLfoPhase);   /* base 0.022, depth 0.5 */
      try { windGainNode.gain.setTargetAtTime(val, ac.currentTime, 0.3); } catch (e) {}
    }, 200);
    allIntervals.push(windIntervalId);

    windNoise.connect(windLp);
    windLp.connect(windGainNode);
    windGainNode.connect(ac.destination);
    windNoise.start(now);
    allNodes.push(windNoise, windLp, windGainNode);
    allOscillators.push(windNoise);

    /* Crickets: white noise → bandpass 4200Hz Q12 → AM at 18Hz → gain 0.018 */
    var cricketNoise = makeNoiseSource(ac);
    var cricketBp = ac.createBiquadFilter();
    cricketBp.type = 'bandpass';
    cricketBp.frequency.value = 4200;
    cricketBp.Q.value = 12;

    /* AM envelope via gain node modulated by oscillator */
    var cricketAmNode = ac.createGain();
    cricketAmNode.gain.value = 0;   /* controlled by AM osc */

    var cricketAmOsc = ac.createOscillator();
    cricketAmOsc.type = 'sine';
    cricketAmOsc.frequency.value = 18;
    var cricketAmGain = ac.createGain();
    cricketAmGain.gain.value = 0.009;   /* half of 0.018 so peak = 0.018 */
    cricketAmOsc.connect(cricketAmGain);
    cricketAmGain.connect(cricketAmNode.gain);
    /* DC offset so gain doesn't go negative: base 0.009, oscillates ±0.009 */
    var cricketDcGain = ac.createConstantSource
      ? ac.createConstantSource()
      : null;
    if (cricketDcGain) {
      cricketDcGain.offset.value = 0.009;
      cricketDcGain.connect(cricketAmNode.gain);
      cricketDcGain.start(now);
      allNodes.push(cricketDcGain);
      allOscillators.push(cricketDcGain);
    } else {
      /* Fallback: fixed gain */
      cricketAmNode.gain.setValueAtTime(0.018, now);
    }

    cricketNoise.connect(cricketBp);
    cricketBp.connect(cricketAmNode);
    cricketAmNode.connect(ac.destination);
    cricketNoise.start(now);
    cricketAmOsc.start(now);
    allNodes.push(cricketNoise, cricketBp, cricketAmNode, cricketAmOsc, cricketAmGain);
    allOscillators.push(cricketNoise, cricketAmOsc);

    /* Schedule bird calls */
    scheduleBird();
  }

  function scheduleBird() {
    if (!running) return;
    var delay = 15000 + Math.random() * 20000;   /* 15–35 seconds */
    birdTimer = setTimeout(function () {
      if (running && audioCtx && audioCtx.state === 'running' && audioStarted) {
        playBirdCall();
      }
      scheduleBird();
    }, delay);
  }

  function playBirdCall() {
    var ac = audioCtx;
    if (!ac) return;
    var now = ac.currentTime;

    /* Sine sweep: 1400Hz → 2200Hz → 1600Hz over 0.8s */
    var osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.linearRampToValueAtTime(2200, now + 0.35);
    osc.frequency.linearRampToValueAtTime(1600, now + 0.8);

    /* Gain envelope: attack 0.05 / sustain 0.5 / release 0.25 */
    var g = ac.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.055, now + 0.05);
    g.gain.setValueAtTime(0.055, now + 0.05 + 0.5);
    g.gain.linearRampToValueAtTime(0, now + 0.05 + 0.5 + 0.25);

    osc.connect(g);
    g.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.85);
  }

  function stopAudio() {
    audioStarted = false;

    if (birdTimer) { clearTimeout(birdTimer); birdTimer = null; }

    /* Clear all intervals (LFOs, note schedulers) */
    for (var ii = 0; ii < allIntervals.length; ii++) {
      try { clearTimeout(allIntervals[ii]); } catch (e) {}
      try { clearInterval(allIntervals[ii]); } catch (e) {}
    }
    allIntervals = [];

    if (audioCtx) {
      var now = audioCtx.currentTime;
      /* Ramp down all gain nodes */
      for (var i = 0; i < allNodes.length; i++) {
        var n = allNodes[i];
        if (n && n.gain) {
          try {
            n.gain.cancelScheduledValues(now);
            n.gain.setValueAtTime(n.gain.value, now);
            n.gain.linearRampToValueAtTime(0, now + 1.5);
          } catch (e) {}
        }
      }
      /* Stop all oscillators/sources after fade */
      (function (oscs) {
        setTimeout(function () {
          for (var j = 0; j < oscs.length; j++) {
            try { oscs[j].stop(); } catch (e) {}
          }
        }, 1600);
      })(allOscillators.slice());
    }

    allNodes = [];
    allOscillators = [];
  }

  /* ──────────────────────────────────────────
     USER INTERACTION → resume AudioContext
  ────────────────────────────────────────── */
  function onUserInteraction() {
    if (pendingAudioStart) {
      pendingAudioStart = false;
      startAudio();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  /* ──────────────────────────────────────────
     PUBLIC API
  ────────────────────────────────────────── */
  window.veilwoodTheme = {
    start: function () {
      if (running) return;
      running = true;

      canvas = document.createElement('canvas');
      canvas.id = 'veilwoodBg';
      Object.assign(canvas.style, {
        position: 'fixed', top: '0', left: '0',
        width: '100%', height: '100%',
        zIndex: '-1', pointerEvents: 'none', display: 'block'
      });
      document.body.insertBefore(canvas, document.body.firstChild);
      ctx = canvas.getContext('2d');

      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;

      initScene();

      startTime = performance.now();
      lastRafTime = 0;
      rafId = requestAnimationFrame(render);

      /* Audio: start if context running, else wait for user gesture */
      if (audioCtx && audioCtx.state === 'running') {
        startAudio();
      } else {
        pendingAudioStart = true;
        document.addEventListener('click', onUserInteraction, { once: true });
        document.addEventListener('touchstart', onUserInteraction, { once: true });
        document.addEventListener('keydown', onUserInteraction, { once: true });
      }
    },

    stop: function () {
      if (!running) return;
      running = false;
      pendingAudioStart = false;

      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

      stopAudio();

      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      canvas = null;
      ctx = null;

      document.removeEventListener('click', onUserInteraction);
      document.removeEventListener('touchstart', onUserInteraction);
      document.removeEventListener('keydown', onUserInteraction);
    }
  };

})();
