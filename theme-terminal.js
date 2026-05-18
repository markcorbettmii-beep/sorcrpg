/* ============================================================
   ORBITAL TERMINAL THEME — theme-terminal.js
   Space station interior canvas background for sorcrpg.com
   Exposes: window.terminalTheme = { start, stop }
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

  /* ── AUDIO ── */
  var audioCtx = null;
  var droneNode = null;
  var droneGain = null;
  var noiseNode = null;
  var noiseGain = null;
  var pingTimer = null;
  var audioStarted = false;
  var pendingAudioStart = false;

  /* ── STARS (generated once, reused) ── */
  var STARS = [];
  var STARS_INIT = false;

  /* ── DOCKING SHIP STATE ── */
  var ship = {
    active: false,
    phase: 'idle',   // idle | approaching | docked | departing
    x: 0, y: 0,
    tx: 0, ty: 0,    // target
    angle: 0,
    timer: 0,
    nextSpawn: 0
  };

  /* ── SCANLINE CANVAS (static, drawn once) ── */
  var scanCanvas = null;

  /* ──────────────────────────────────────────
     AUDIO HELPERS
  ────────────────────────────────────────── */
  function ensureAudioCtx() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) { audioCtx = null; }
    }
    return audioCtx;
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

    /* Low drone ~60 Hz */
    droneGain = ac.createGain();
    droneGain.gain.setValueAtTime(0, ac.currentTime);
    droneGain.gain.linearRampToValueAtTime(0.04, ac.currentTime + 2.5);
    droneGain.connect(ac.destination);

    droneNode = ac.createOscillator();
    droneNode.type = 'sine';
    droneNode.frequency.value = 60;
    droneNode.connect(droneGain);
    droneNode.start();

    /* White-noise hiss via script processor polyfill with AudioWorklet fallback */
    startNoise(ac);

    /* Schedule first ping */
    schedulePing();
  }

  function startNoise(ac) {
    try {
      var bufferSize = 4096;
      /* Use ScriptProcessorNode (deprecated but universally supported) */
      var noiseProc = ac.createScriptProcessor(bufferSize, 0, 1);
      noiseProc.onaudioprocess = function (e) {
        var out = e.outputBuffer.getChannelData(0);
        for (var i = 0; i < out.length; i++) {
          out[i] = Math.random() * 2 - 1;
        }
      };

      var filter = ac.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      filter.Q.value = 0.7;

      noiseGain = ac.createGain();
      noiseGain.gain.setValueAtTime(0, ac.currentTime);
      noiseGain.gain.linearRampToValueAtTime(0.015, ac.currentTime + 3);

      noiseProc.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ac.destination);

      noiseNode = noiseProc;
    } catch (e) { /* silently skip noise if not supported */ }
  }

  function schedulePing() {
    if (!running) return;
    var delay = 8000 + Math.random() * 7000;
    pingTimer = setTimeout(function () {
      if (running && audioCtx && audioCtx.state === 'running') {
        playPing();
      }
      schedulePing();
    }, delay);
  }

  function playPing() {
    var ac = audioCtx;
    if (!ac) return;
    var now = ac.currentTime;
    var g = ac.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.06, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    g.connect(ac.destination);
    var osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 880;
    osc.connect(g);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  function stopAudio() {
    if (pingTimer) { clearTimeout(pingTimer); pingTimer = null; }
    if (audioCtx) {
      try {
        if (droneGain) {
          droneGain.gain.cancelScheduledValues(audioCtx.currentTime);
          droneGain.gain.setValueAtTime(droneGain.gain.value, audioCtx.currentTime);
          droneGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.2);
        }
        if (noiseGain) {
          noiseGain.gain.cancelScheduledValues(audioCtx.currentTime);
          noiseGain.gain.setValueAtTime(noiseGain.gain.value, audioCtx.currentTime);
          noiseGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.2);
        }
      } catch (e) {}
    }
    audioStarted = false;
  }

  /* ──────────────────────────────────────────
     CANVAS SETUP
  ────────────────────────────────────────── */
  function initCanvas() {
    canvas = document.createElement('canvas');
    canvas.id = 'terminalBg';
    Object.assign(canvas.style, {
      position: 'fixed', top: '0', left: '0',
      width: '100%', height: '100%',
      zIndex: '-1', pointerEvents: 'none', display: 'block'
    });
    document.body.insertBefore(canvas, document.body.firstChild);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    if (!canvas) return;
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    buildScanlines();
  }

  /* ──────────────────────────────────────────
     SCANLINE OVERLAY (built once per resize)
  ────────────────────────────────────────── */
  function buildScanlines() {
    scanCanvas = document.createElement('canvas');
    scanCanvas.width = 4;
    scanCanvas.height = 4;
    var sc = scanCanvas.getContext('2d');
    sc.fillStyle = 'rgba(0,200,255,0.03)';
    sc.fillRect(0, 0, 4, 1);
  }

  /* ──────────────────────────────────────────
     STARS
  ────────────────────────────────────────── */
  function initStars() {
    if (STARS_INIT) return;
    STARS_INIT = true;
    for (var i = 0; i < 180; i++) {
      STARS.push({
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 1.2 + 0.2,
        a: Math.random() * 0.6 + 0.2,
        hue: Math.random() < 0.3 ? 200 : 0   /* 30% blue tint */
      });
    }
  }

  function drawStars() {
    for (var i = 0; i < STARS.length; i++) {
      var s = STARS[i];
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fillStyle = s.hue ? 'rgba(160,220,255,' + s.a + ')' : 'rgba(255,255,255,' + s.a + ')';
      ctx.fill();
    }
  }

  /* ──────────────────────────────────────────
     NEBULA / GAS CLOUD BACKGROUND
  ────────────────────────────────────────── */
  function drawNebula() {
    /* Cyan-green soft cloud, off to the upper-right */
    var cx = W * 0.72, cy = H * 0.28;
    var r = Math.min(W, H) * 0.38;
    var grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grd.addColorStop(0,   'rgba(0,180,140,0.07)');
    grd.addColorStop(0.4, 'rgba(0,120,100,0.04)');
    grd.addColorStop(1,   'transparent');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    /* second smaller blob */
    var cx2 = W * 0.18, cy2 = H * 0.68;
    var r2 = Math.min(W, H) * 0.22;
    var grd2 = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, r2);
    grd2.addColorStop(0,   'rgba(0,100,180,0.06)');
    grd2.addColorStop(1,   'transparent');
    ctx.fillStyle = grd2;
    ctx.beginPath();
    ctx.arc(cx2, cy2, r2, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ──────────────────────────────────────────
     SPACE STATION — toroidal ring structure
  ────────────────────────────────────────── */
  function drawStation(t) {
    var cx = W * 0.5;
    var cy = H * 0.5;
    var baseR = Math.min(W, H) * 0.30;     /* outer ring radius */
    var tiltY = 0.38;                       /* y-compression for 3D tilt */

    /* Full 30-second orbit rotation */
    var orbitAngle = (t / 30) * Math.PI * 2;

    ctx.save();
    ctx.translate(cx, cy);

    /* ── Outer structural ring ── */
    var ringCount = 3;
    var ringRadii = [baseR, baseR * 0.72, baseR * 0.45];
    var ringAlphas = [1, 0.8, 0.65];

    for (var ri = 0; ri < ringCount; ri++) {
      var rr = ringRadii[ri];
      var alpha = ringAlphas[ri];

      /* Back half of ellipse (behind center) */
      ctx.beginPath();
      ctx.ellipse(0, 0, rr, rr * tiltY, orbitAngle, Math.PI, Math.PI * 2);
      ctx.strokeStyle = 'rgba(26,58,90,' + alpha + ')';
      ctx.lineWidth = ri === 0 ? 8 : 5;
      ctx.stroke();

      /* Back half inner glow */
      ctx.beginPath();
      ctx.ellipse(0, 0, rr, rr * tiltY, orbitAngle, Math.PI, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,229,255,' + (alpha * 0.25) + ')';
      ctx.lineWidth = ri === 0 ? 2 : 1.5;
      ctx.stroke();
    }

    /* ── Spokes (8 structural spokes) ── */
    var spokeCount = 8;
    for (var si = 0; si < spokeCount; si++) {
      var spokeA = orbitAngle + (si / spokeCount) * Math.PI * 2;
      var outerX = Math.cos(spokeA) * ringRadii[0];
      var outerY = Math.sin(spokeA) * ringRadii[0] * tiltY;
      var innerX = Math.cos(spokeA) * ringRadii[2];
      var innerY = Math.sin(spokeA) * ringRadii[2] * tiltY;

      /* depth-based alpha: spokes on far side are dimmer */
      var depth = Math.sin(spokeA - orbitAngle);
      var spokeAlpha = 0.3 + (depth < 0 ? 0 : depth) * 0.4;

      ctx.beginPath();
      ctx.moveTo(outerX, outerY);
      ctx.lineTo(innerX, innerY);
      ctx.strokeStyle = 'rgba(10,32,64,' + spokeAlpha + ')';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(outerX, outerY);
      ctx.lineTo(innerX, innerY);
      ctx.strokeStyle = 'rgba(0,180,220,' + (spokeAlpha * 0.35) + ')';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    /* ── Central hub ── */
    var hubR = baseR * 0.12;
    var hubGrd = ctx.createRadialGradient(-hubR * 0.2, -hubR * 0.2, 0, 0, 0, hubR);
    hubGrd.addColorStop(0, '#2a6a8a');
    hubGrd.addColorStop(0.6, '#0a2040');
    hubGrd.addColorStop(1, '#030d1a');
    ctx.beginPath();
    ctx.arc(0, 0, hubR, 0, Math.PI * 2);
    ctx.fillStyle = hubGrd;
    ctx.fill();
    /* hub glow */
    ctx.beginPath();
    ctx.arc(0, 0, hubR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,229,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    /* ── Grid lines on outer ring (cross-hatch texture) ── */
    drawRingGrid(ringRadii[0], tiltY, orbitAngle);

    /* ── Front half of rings (drawn over spokes for depth) ── */
    for (var ri2 = 0; ri2 < ringCount; ri2++) {
      var rr2 = ringRadii[ri2];
      var alpha2 = ringAlphas[ri2];

      ctx.beginPath();
      ctx.ellipse(0, 0, rr2, rr2 * tiltY, orbitAngle, 0, Math.PI);
      ctx.strokeStyle = 'rgba(26,58,90,' + alpha2 + ')';
      ctx.lineWidth = ri2 === 0 ? 8 : 5;
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(0, 0, rr2, rr2 * tiltY, orbitAngle, 0, Math.PI);
      ctx.strokeStyle = 'rgba(0,229,255,' + (alpha2 * 0.35) + ')';
      ctx.lineWidth = ri2 === 0 ? 2.5 : 1.5;
      ctx.stroke();
    }

    /* ── Viewport windows on the outer ring ── */
    drawViewports(ringRadii[0], tiltY, orbitAngle, t);

    /* ── Antenna arrays ── */
    drawAntennas(ringRadii[0], tiltY, orbitAngle, t);

    ctx.restore();
  }

  function drawRingGrid(outerR, tiltY, orbitAngle) {
    /* draw subtle grid lines around the ring circumference */
    var segments = 24;
    for (var i = 0; i < segments; i++) {
      var a1 = orbitAngle + (i / segments) * Math.PI * 2;
      var a2 = orbitAngle + ((i + 0.5) / segments) * Math.PI * 2;
      var depth = Math.sin(a1);
      if (depth > -0.15) continue; /* only draw on the back side for performance */
      var x1 = Math.cos(a1) * outerR;
      var y1 = Math.sin(a1) * outerR * tiltY;
      var x2 = Math.cos(a2) * outerR;
      var y2 = Math.sin(a2) * outerR * tiltY;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = 'rgba(0,120,160,0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawViewports(outerR, tiltY, orbitAngle, t) {
    var windowCount = 16;
    for (var i = 0; i < windowCount; i++) {
      var a = orbitAngle + (i / windowCount) * Math.PI * 2;
      var wx = Math.cos(a) * outerR;
      var wy = Math.sin(a) * outerR * tiltY;
      var depth = Math.sin(a);

      /* Only draw windows on near-facing side */
      if (depth < -0.3) continue;

      /* Perspective scale: windows appear smaller on far side */
      var perspScale = 0.5 + (depth + 1) * 0.35;
      var ww = 7 * perspScale;
      var wh = 4 * perspScale;

      /* Pulsing glow on some windows */
      var pulse = 0.6 + 0.4 * Math.sin(t * 0.8 + i * 1.3);
      var alpha = 0.4 + depth * 0.4;

      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(a + Math.PI * 0.5);

      /* window frame */
      ctx.fillStyle = 'rgba(10,32,64,' + alpha + ')';
      ctx.fillRect(-ww * 0.5, -wh * 0.5, ww, wh);

      /* window glow */
      ctx.fillStyle = 'rgba(0,229,255,' + (alpha * pulse * 0.85) + ')';
      ctx.fillRect(-ww * 0.5 + 1, -wh * 0.5 + 1, ww - 2, wh - 2);

      ctx.restore();
    }
  }

  function drawAntennas(outerR, tiltY, orbitAngle, t) {
    /* 4 antenna arrays at 90-degree intervals */
    for (var i = 0; i < 4; i++) {
      var a = orbitAngle + (i / 4) * Math.PI * 2;
      var depth = Math.sin(a);
      if (depth < 0) continue; /* only front-facing */

      var bx = Math.cos(a) * outerR;
      var by = Math.sin(a) * outerR * tiltY;
      var len = 22 * (0.5 + (depth + 1) * 0.35);

      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(a);

      /* main mast */
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(len, 0);
      ctx.strokeStyle = 'rgba(0,150,200,0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      /* cross-bar */
      ctx.beginPath();
      ctx.moveTo(len * 0.6, -len * 0.25);
      ctx.lineTo(len * 0.6, len * 0.25);
      ctx.stroke();

      /* blink light at tip */
      var blinkAlpha = 0.5 + 0.5 * Math.sin(t * 2.5 + i * 1.7);
      ctx.beginPath();
      ctx.arc(len, 0, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,255,200,' + blinkAlpha + ')';
      ctx.fill();

      ctx.restore();
    }
  }

  /* ──────────────────────────────────────────
     DOCKING SHIP
  ────────────────────────────────────────── */
  function updateShip(t, dt) {
    var cx = W * 0.5, cy = H * 0.5;
    var stationR = Math.min(W, H) * 0.30;

    if (!ship.active) {
      ship.nextSpawn -= dt;
      if (ship.nextSpawn <= 0) {
        /* spawn from a random edge */
        var side = Math.floor(Math.random() * 4);
        if (side === 0) { ship.x = -40; ship.y = Math.random() * H; }
        else if (side === 1) { ship.x = W + 40; ship.y = Math.random() * H; }
        else if (side === 2) { ship.x = Math.random() * W; ship.y = -40; }
        else { ship.x = Math.random() * W; ship.y = H + 40; }

        /* target: dock at a point on the outer ring */
        var dockA = Math.random() * Math.PI * 2;
        ship.tx = cx + Math.cos(dockA) * stationR;
        ship.ty = cy + Math.sin(dockA) * stationR * 0.38;
        ship.angle = Math.atan2(ship.ty - ship.y, ship.tx - ship.x);
        ship.phase = 'approaching';
        ship.timer = 0;
        ship.active = true;
      }
      return;
    }

    ship.timer += dt;

    if (ship.phase === 'approaching') {
      var dx = ship.tx - ship.x;
      var dy = ship.ty - ship.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 2) {
        ship.phase = 'docked';
        ship.timer = 0;
      } else {
        var speed = Math.min(dist * 0.04, 2.5);
        ship.x += (dx / dist) * speed;
        ship.y += (dy / dist) * speed;
      }
    } else if (ship.phase === 'docked') {
      if (ship.timer > 4000) {
        /* depart back out */
        var side2 = Math.floor(Math.random() * 4);
        if (side2 === 0) { ship.tx = -60; ship.ty = Math.random() * H; }
        else if (side2 === 1) { ship.tx = W + 60; ship.ty = Math.random() * H; }
        else if (side2 === 2) { ship.tx = Math.random() * W; ship.ty = -60; }
        else { ship.tx = Math.random() * W; ship.ty = H + 60; }
        ship.angle = Math.atan2(ship.ty - ship.y, ship.tx - ship.x);
        ship.phase = 'departing';
        ship.timer = 0;
      }
    } else if (ship.phase === 'departing') {
      var dx2 = ship.tx - ship.x;
      var dy2 = ship.ty - ship.y;
      var dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      if (dist2 < 5 || ship.timer > 8000) {
        ship.active = false;
        ship.phase = 'idle';
        ship.nextSpawn = 6000 + Math.random() * 8000;
      } else {
        var spd2 = Math.min(dist2 * 0.035, 2.2);
        ship.x += (dx2 / dist2) * spd2;
        ship.y += (dy2 / dist2) * spd2;
      }
    }
  }

  function drawShip() {
    if (!ship.active) return;
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);

    var size = 12;
    /* engine glow */
    var grd = ctx.createRadialGradient(-size, 0, 0, -size, 0, size * 1.4);
    grd.addColorStop(0, 'rgba(0,200,255,0.45)');
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(-size, 0, size * 1.4, 0, Math.PI * 2);
    ctx.fill();

    /* hull triangle */
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.6, -size * 0.45);
    ctx.lineTo(-size * 0.6, size * 0.45);
    ctx.closePath();
    ctx.fillStyle = '#1a3a5a';
    ctx.fill();
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1;
    ctx.stroke();

    /* cockpit window */
    ctx.beginPath();
    ctx.arc(size * 0.3, 0, size * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,229,255,0.8)';
    ctx.fill();

    ctx.restore();
  }

  /* ──────────────────────────────────────────
     SCANLINE OVERLAY
  ────────────────────────────────────────── */
  function drawScanlines() {
    if (!scanCanvas) return;
    var pat = ctx.createPattern(scanCanvas, 'repeat');
    if (!pat) return;
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W, H);
  }

  /* ──────────────────────────────────────────
     MAIN RENDER LOOP
  ────────────────────────────────────────── */
  var lastRafTime = 0;

  function render(now) {
    if (!running) return;
    var dt = now - (lastRafTime || now);
    lastRafTime = now;

    var t = (now - startTime) / 1000;   /* seconds since start */

    /* Background */
    ctx.fillStyle = '#030d1a';
    ctx.fillRect(0, 0, W, H);

    drawNebula();
    drawStars();

    updateShip(t, dt);
    drawStation(t);
    drawShip();
    drawScanlines();

    /* Dark overlay for UI legibility */
    ctx.fillStyle = 'rgba(3,13,26,0.55)';
    ctx.fillRect(0, 0, W, H);

    rafId = requestAnimationFrame(render);
  }

  /* ──────────────────────────────────────────
     USER INTERACTION → resume AudioContext
  ────────────────────────────────────────── */
  function onUserInteraction() {
    if (pendingAudioStart) {
      pendingAudioStart = false;
      startAudio();
    }
  }

  /* ──────────────────────────────────────────
     PUBLIC API
  ────────────────────────────────────────── */
  window.terminalTheme = {
    start: function () {
      if (running) return;
      running = true;

      initCanvas();
      initStars();
      ship.active = false;
      ship.phase = 'idle';
      ship.nextSpawn = 3000 + Math.random() * 5000;

      startTime = performance.now();
      lastRafTime = 0;
      rafId = requestAnimationFrame(render);

      /* Audio: start immediately if context already running, otherwise wait for interaction */
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

      window.removeEventListener('resize', resize);
      document.removeEventListener('click', onUserInteraction);
      document.removeEventListener('touchstart', onUserInteraction);
      document.removeEventListener('keydown', onUserInteraction);
    }
  };

})();
