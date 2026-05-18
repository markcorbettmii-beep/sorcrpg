/* Essentia Solar System Background — SORC RPG
   Artistic screen layout matching the reference image.
   Planets wobble in tilted ellipses around their home positions → 3D orbital effect.
   Tawdry Dwarf: upper-right, top of nebula. Adoria: lower-left. */
(function () {
  'use strict';

  const canvas = document.createElement('canvas');
  canvas.id = 'solarBg';
  Object.assign(canvas.style, {
    position: 'fixed', top: '0', left: '0',
    width: '100%', height: '100%',
    zIndex: '-1', pointerEvents: 'none', display: 'block'
  });
  document.body.insertBefore(canvas, document.body.firstChild);

  const ctx = canvas.getContext('2d');
  let W, H;
  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  /* ── STARS ── */
  const STARS = Array.from({ length: 240 }, () => ({
    x: Math.random(), y: Math.random(),
    r: Math.random() * 1.4 + 0.25,
    a: Math.random() * 0.55 + 0.15,
    tw: Math.random() * Math.PI * 2
  }));

  /* ── NEBULA — purple/blue cloud on the right side, with Tawdry at its top ── */
  const NEBULA = Array.from({ length: 70 }, () => ({
    x: 0.60 + Math.random() * 0.32,
    y: 0.05 + Math.random() * 0.72,
    rx: Math.random() * 130 + 40,
    ry: Math.random() * 70 + 22,
    ang: Math.random() * Math.PI,
    a: Math.random() * 0.07 + 0.018,
    hue: 238 + Math.random() * 52
  }));

  /* ── PLANET / BODY DATA ──
     hx, hy  : home position as fraction of W, H  (from reference image)
     r       : visual radius px at 1080p (scaled by min(H/1080,1))
     wR      : wobble radius px  — inner planets wobble more (faster orbit = more apparent motion)
     wS      : wobble speed multiplier (Zailister=1.0 reference)
     φ       : starting phase so planets are spread out on load
  ── */
  const PLANETS = [
    /* Large red gas giant — upper left */
    { name:'Quintus Elementum', hx:0.118, hy:0.290, r:20, col:'#c85828', dark:'#7a3010',
      wR:30, wS:0.65, φ:0.8 },

    /* Blue-purple gas giant — top left */
    { name:'Angeligla',         hx:0.115, hy:0.082, r:16, col:'#5050b8', dark:'#303080',
      wR:18, wS:0.12, φ:2.1, gas:true },

    /* Zailister — ringed, center-bottom-left */
    { name:'Zailister',         hx:0.333, hy:0.725, r:14, col:'#8090a0', dark:'#506070',
      wR:24, wS:1.00, φ:1.6, ring:true, ringCol:'#e0a0b8' },

    /* Pale blue small — top center */
    { name:'Tenue',             hx:0.440, hy:0.098, r:7,  col:'#80c0d8', dark:'#409098',
      wR:42, wS:5.50, φ:4.0 },

    /* Pink / pastel — center bottom, with 3 moons */
    { name:'Citrine Candenti',  hx:0.557, hy:0.718, r:13, col:'#d8b8c0', dark:'#a08090',
      wR:16, wS:0.28, φ:3.3, moons:['#c8b0c8','#c06040','#60a0c8'] },

    /* Blue planet — upper right area */
    { name:'Corpus Caeleste',   hx:0.783, hy:0.136, r:12, col:'#3888c8', dark:'#205880',
      wR:10, wS:0.07, φ:1.0 },

    /* Purple-striped — far top right */
    { name:'Omne Malum',        hx:0.958, hy:0.070, r:10, col:'#7868b8', dark:'#403870',
      wR:6,  wS:0.030, φ:5.2 },

    /* Large icy blue — far bottom right */
    { name:'Tredici',           hx:0.972, hy:0.725, r:15, col:'#90c0e0', dark:'#5090b8',
      wR:5,  wS:0.020, φ:0.5 },

    /* Undecimus — mid right */
    { name:'Undecimus',         hx:0.700, hy:0.500, r:9,  col:'#78a868', dark:'#486040',
      wR:8,  wS:0.045, φ:3.7 },
  ];

  /* Tawdry Dwarf — dying red star, top of nebula, upper right */
  const TAWDRY = { hx:0.858, hy:0.142, r:13, wR:7, wS:0.09, φ:2.5 };

  /* Omnè survival structure — just below Tawdry, near the nebula */
  const OMNE = { hx:0.880, hy:0.225, r:9,  wR:7, wS:0.085, φ:2.8 };

  /* ── HELPERS ── */
  function sc() { return Math.min(H / 1080, 1); }   /* size scale for retina/small screens */

  function adj(hex, d) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    const c = v => Math.max(0, Math.min(255, v + d));
    return `rgb(${c(r)},${c(g)},${c(b)})`;
  }

  /* Compute wobble position for a body at time t.
     The wobble ellipse is tilted: vertical axis compressed to give 3D orbital tilt.
     Returns {x, y, depth} where depth ∈ [-1,1] (1=foreground, -1=background) */
  function wobble(body, t) {
    const phase = body.wS * t + body.φ;
    const s = sc();
    const wR = body.wR * s;
    const tiltY = 0.38;   /* vertical compression factor — orbital tilt illusion */
    return {
      x: body.hx * W + Math.cos(phase) * wR,
      y: body.hy * H + Math.sin(phase) * wR * tiltY,
      depth: Math.sin(phase)   /* +1 = in front of orbital plane, -1 = behind */
    };
  }

  /* ── DRAW: stars ── */
  function drawStars(t) {
    for (const s of STARS) {
      const pulse = 0.85 + 0.15 * Math.sin(t * 1.1 + s.tw);
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${s.a * pulse})`;
      ctx.fill();
    }
  }

  /* ── DRAW: nebula ── */
  function drawNebula() {
    for (const n of NEBULA) {
      const grd = ctx.createRadialGradient(n.x*W, n.y*H, 0, n.x*W, n.y*H, n.rx);
      grd.addColorStop(0,   `hsla(${n.hue},78%,52%,${n.a})`);
      grd.addColorStop(0.5, `hsla(${n.hue},65%,40%,${n.a*0.5})`);
      grd.addColorStop(1,   'transparent');
      ctx.save();
      ctx.translate(n.x*W, n.y*H);
      ctx.rotate(n.ang);
      ctx.scale(1, n.ry / n.rx);
      ctx.beginPath();
      ctx.arc(0, 0, n.rx, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
      ctx.restore();
    }
  }

  /* ── DRAW: Adoria (sun) — lower-left, partially off-screen ── */
  function drawAdoria() {
    const cx = W * -0.02;
    const cy = H * 0.82;
    const r  = H * 0.32;
    /* outer corona */
    const corona = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.6);
    corona.addColorStop(0,    'rgba(255,210,55,0.55)');
    corona.addColorStop(0.28, 'rgba(230,95,15,0.30)');
    corona.addColorStop(0.65, 'rgba(160,25,0,0.10)');
    corona.addColorStop(1,    'transparent');
    ctx.fillStyle = corona;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.6, 0, Math.PI * 2);
    ctx.fill();
    /* body */
    const body = ctx.createRadialGradient(cx - r*0.2, cy - r*0.2, 0, cx, cy, r);
    body.addColorStop(0,    '#fffad0');
    body.addColorStop(0.30, '#ffcc30');
    body.addColorStop(0.72, '#e07010');
    body.addColorStop(1,    '#b03000');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ── DRAW: planet body ── */
  function drawPlanet(p, pos) {
    const r = p.r * sc();
    const { x, y, depth } = pos;

    /* glow */
    const glo = ctx.createRadialGradient(x, y, r*0.3, x, y, r*3.0);
    glo.addColorStop(0, p.col + '55');
    glo.addColorStop(1, 'transparent');
    ctx.fillStyle = glo;
    ctx.beginPath(); ctx.arc(x, y, r*3.0, 0, Math.PI*2); ctx.fill();

    /* ring back half */
    if (p.ring) drawRing(x, y, r, p.ringCol, Math.PI, Math.PI*2);

    /* moons behind */
    if (p.moons) drawMoons(p.moons, x, y, r, p.wS * currentT + p.φ, -1);

    /* body */
    const body = ctx.createRadialGradient(x - r*0.3, y - r*0.3, 0, x, y, r);
    body.addColorStop(0,    adj(p.col, 55));
    body.addColorStop(0.55, p.col);
    body.addColorStop(1,    p.dark);
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();

    /* gas bands for Angeligla */
    if (p.gas) {
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.clip();
      [[0.10,'rgba(120,110,220,0.18)'],[-0.40,'rgba(80,70,180,0.14)'],[0.55,'rgba(140,120,240,0.10)']].forEach(([by,bc]) => {
        ctx.fillStyle = bc;
        ctx.fillRect(x - r, y + by*r*2 - r*0.18, r*2, r*0.34);
      });
      ctx.restore();
    }

    /* ring front half */
    if (p.ring) drawRing(x, y, r, p.ringCol, 0, Math.PI);

    /* moons in front */
    if (p.moons) drawMoons(p.moons, x, y, r, p.wS * currentT + p.φ, 1);
  }

  function drawRing(x, y, r, col, startA, endA) {
    ctx.beginPath();
    ctx.ellipse(x, y, r*2.3, r*0.50, 0.08, startA, endA);
    ctx.strokeStyle = col + 'cc';
    ctx.lineWidth = Math.max(2, r * 0.27);
    ctx.stroke();
  }

  function drawMoons(cols, px, py, pr, phase, side) {
    cols.forEach((col, i) => {
      const ma = phase * (2.4 + i*0.7) + i * (Math.PI*2 / cols.length);
      const mz = Math.sin(ma);
      if ((side < 0 && mz < 0) || (side > 0 && mz >= 0)) {
        const md = pr * (1.9 + i * 0.65);
        ctx.beginPath();
        ctx.arc(px + Math.cos(ma)*md, py + Math.sin(ma)*md*0.42, pr*0.24, 0, Math.PI*2);
        ctx.fillStyle = col; ctx.fill();
      }
    });
  }

  /* ── DRAW: Tawdry Dwarf ── */
  function drawTawdry(pos) {
    const { x, y } = pos;
    const r = TAWDRY.r * sc();

    /* dying-star glow */
    const glo = ctx.createRadialGradient(x, y, 0, x, y, r * 6);
    glo.addColorStop(0,    'rgba(255,90,20,0.72)');
    glo.addColorStop(0.28, 'rgba(190,30,0,0.38)');
    glo.addColorStop(0.60, 'rgba(110,10,0,0.14)');
    glo.addColorStop(1,    'transparent');
    ctx.fillStyle = glo;
    ctx.beginPath(); ctx.arc(x, y, r * 6, 0, Math.PI*2); ctx.fill();

    /* core */
    const core = ctx.createRadialGradient(x, y, 0, x, y, r);
    core.addColorStop(0,    '#ffbb80');
    core.addColorStop(0.45, '#e04010');
    core.addColorStop(1,    '#7a0f00');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();

    /* cross flare spikes */
    ctx.save(); ctx.globalAlpha = 0.38;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI * 0.5;
      const gf = ctx.createLinearGradient(x, y, x + Math.cos(a)*r*5, y + Math.sin(a)*r*5);
      gf.addColorStop(0, '#ff6020'); gf.addColorStop(1, 'transparent');
      ctx.fillStyle = gf;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a-0.09)*r*5, y + Math.sin(a-0.09)*r*5);
      ctx.lineTo(x + Math.cos(a+0.09)*r*5, y + Math.sin(a+0.09)*r*5);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  /* ── DRAW: Omnè survival structure ── */
  function drawOmne(pos, t) {
    const { x, y } = pos;
    const r = OMNE.r * sc();

    /* energy glow */
    const glo = ctx.createRadialGradient(x, y, 0, x, y, r*3.5);
    glo.addColorStop(0,   'rgba(90,90,220,0.45)');
    glo.addColorStop(0.5, 'rgba(50,50,160,0.18)');
    glo.addColorStop(1,   'transparent');
    ctx.fillStyle = glo; ctx.beginPath(); ctx.arc(x, y, r*3.5, 0, Math.PI*2); ctx.fill();

    /* dark metallic sphere */
    const body = ctx.createRadialGradient(x-r*0.28, y-r*0.28, 0, x, y, r);
    body.addColorStop(0,    '#6870a8');
    body.addColorStop(0.55, '#2a2a50');
    body.addColorStop(1,    '#0a0a18');
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();

    /* tech grid */
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.clip();
    ctx.strokeStyle = 'rgba(110,130,230,0.28)'; ctx.lineWidth = 0.7;
    for (let gx = -r; gx <= r; gx += r*0.45) {
      ctx.beginPath(); ctx.moveTo(x+gx, y-r); ctx.lineTo(x+gx, y+r); ctx.stroke();
    }
    for (let gy = -r; gy <= r; gy += r*0.45) {
      ctx.beginPath(); ctx.moveTo(x-r, y+gy); ctx.lineTo(x+r, y+gy); ctx.stroke();
    }
    ctx.restore();

    /* mith3r energy halos — rotating rings at different tilts */
    [0, Math.PI/3, Math.PI*2/3].forEach((ha, i) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ha + t * 0.28 * (i % 2 === 0 ? 1 : -1));
      ctx.beginPath();
      ctx.ellipse(0, 0, r*2.1, r*0.42, 0, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(100,120,255,${0.55 - i*0.13})`;
      ctx.lineWidth = 1.6; ctx.stroke();
      ctx.restore();
    });
  }

  /* ── RENDER LOOP ── */
  let currentT = 0;

  function render() {
    currentT += 0.0032;
    const t = currentT;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#01020a';
    ctx.fillRect(0, 0, W, H);

    drawStars(t);
    drawNebula();
    drawAdoria();

    /* collect all bodies with depth, sort back→front */
    const bodies = [];

    for (const p of PLANETS) {
      const pos = wobble(p, t);
      bodies.push({ z: pos.depth, draw: () => drawPlanet(p, pos) });
    }

    const tPos = wobble(TAWDRY, t);
    bodies.push({ z: tPos.depth, draw: () => drawTawdry(tPos) });

    const oPos = wobble(OMNE, t);
    bodies.push({ z: oPos.depth, draw: () => drawOmne(oPos, t) });

    bodies.sort((a, b) => a.z - b.z);
    for (const b of bodies) b.draw();

    /* semi-transparent overlay — keeps page content legible */
    ctx.fillStyle = 'rgba(1,2,10,0.58)';
    ctx.fillRect(0, 0, W, H);

    requestAnimationFrame(render);
  }

  render();
})();
