<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Character Creator Picker Demo (All Thumbs)</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; }
    .creator-wrap { max-width: 900px; margin: 0 auto; background: #fff; padding: 24px; border-radius: 16px; box-shadow: 0 4px 32px #0002;}
    .picker-section { margin-bottom: 20px; }
    .picker-label { font-size: 1.1em; font-weight: bold; margin: 12px 0 8px 0;}
    .thumb-list { display: flex; gap: 12px; margin-bottom: 8px;}
    .thumb { width: 90px; height: 90px; border-radius: 12px; border: 3px solid #ddd; background: #fafafa; box-shadow: 0 2px 12px #ccc9; opacity: 1; cursor: pointer; transition: border .2s, background .2s;}
    .thumb.selected { border: 4px solid #ffbb00; background: #fffbe8; box-shadow: 0 0 24px #ffbc6c88; }
    .thumb.disabled { opacity: 0.3; cursor: default; }
    .hr-label { font-size:0.95em;font-weight:bold;color:#a22;margin-bottom:2px; text-align:center;}
    #charCanvas { display:block; margin:24px auto 24px auto; border-radius:16px; background:#eee; box-shadow: 0 2px 12px #ccc9; }
  </style>
</head>
<body>
<div class="creator-wrap">
  <h2>Character Creator Picker Demo</h2>
  <canvas id="charCanvas" width="640" height="1280"></canvas>
  <div class="picker-section">
    <div class="picker-label">Body Type</div>
    <div id="body-pickers"></div>
  </div>
  <div class="picker-section">
    <div class="picker-label">Face</div>
    <div id="face-pickers"></div>
  </div>
  <div class="picker-section">
    <div class="picker-label">Hair</div>
    <div id="hair-pickers"></div>
  </div>
</div>
<script>
const BASE = "assets/";

// All 9 bodies: 3 massive, 3 muscular (1 enabled HR demo), 3 thin
const bodyThumbs = [
  // Massive
  { src: `${BASE}fbody-mass-drk.png`, thumb: `${BASE}fbody-mass-drk-tmb.png`, skin: "drk", enabled: true },
  { src: `${BASE}fbody-mass-med.png`, thumb: `${BASE}fbody-mass-med-tmb.png`, skin: "med", enabled: true },
  { src: `${BASE}fbody-mass-pale.png`, thumb: `${BASE}fbody-mass-pale-tmb.png`, skin: "pale", enabled: true },
  // Muscular
  { src: "", thumb: `${BASE}placeholder-pale.png`, skin: "pale", enabled: false },
  { src: `${BASE}hr-fbody-muscular.png`, thumb: `${BASE}fbody-musc-drk-tmb.png`, skin: "hr", enabled: true, hrDemo:true },
  { src: "", thumb: `${BASE}placeholder-drk.png`, skin: "drk", enabled: false },
  // Thin
  { src: "", thumb: `${BASE}placeholder-pale.png`, skin: "pale", enabled: false },
  { src: "", thumb: `${BASE}placeholder-med.png`, skin: "med", enabled: false },
  { src: "", thumb: `${BASE}placeholder-drk.png`, skin: "drk", enabled: false }
];

// All 12 hair thumbs
const hairThumbs = [
  { src: `${BASE}femhair1.png`, thumb: `${BASE}femhair1-tmb.png`, enabled: true },
  { src: `${BASE}femhair2.png`, thumb: `${BASE}femhair2-tmb.png`, enabled: true },
  { src: `${BASE}femhair3.png`, thumb: `${BASE}femhair3-tmb.png`, enabled: true },
  { src: `${BASE}femhair4.png`, thumb: `${BASE}femhair4-tmb.png`, enabled: true },
  { src: `${BASE}femhair5.png`, thumb: `${BASE}femhair5-tmb.png`, enabled: true },
  { src: `${BASE}femhair6.png`, thumb: `${BASE}femhair6-tmb.png`, enabled: true },
  { src: `${BASE}femhair7.png`, thumb: `${BASE}femhair7-tmb.png`, enabled: true },
  { src: `${BASE}femhair8.png`, thumb: `${BASE}femhair8-tmb.png`, enabled: true },
  { src: `${BASE}femhair9.png`, thumb: `${BASE}femhair9-tmb.png`, enabled: true },
  { src: `${BASE}femhair10.png`, thumb: `${BASE}femhair10-tmb.png`, enabled: true },
  { src: `${BASE}femhair11.png`, thumb: `${BASE}femhair11-tmb.png`, enabled: true },
  { src: `${BASE}femhair12.png`, thumb: `${BASE}femhair12-tmb.png`, enabled: true }
];

// Faces
const faceOptions = [
  { src: `${BASE}femface1-dark-blu.png`, thumb: `${BASE}femface1-dark-blu-tmb.png`, skin: "drk", eyes: "blu", enabled: true },
  { src: `${BASE}femface1-dark-hzl.png`, thumb: `${BASE}femface1-dark-hzl-tmb.png`, skin: "drk", eyes: "hzl", enabled: true },
  { src: `${BASE}femface2-dark-brn.png`, thumb: `${BASE}femface2-dark-brn-tmb.png`, skin: "drk", eyes: "brn", enabled: true },
  { src: `${BASE}femface2-dark-blu.png`, thumb: `${BASE}femface2-dark-blu-tmb.png`, skin: "drk", eyes: "blu", enabled: true },
  // Medium
  { src: `${BASE}femface1-med-brn.png`, thumb: `${BASE}femface1-med-brn-tmb.png`, skin: "med", eyes: "brn", enabled: true },
  { src: `${BASE}femface1-med-hzl.png`, thumb: `${BASE}femface1-med-hzl-tmb.png`, skin: "med", eyes: "hzl", enabled: true },
  { src: `${BASE}femface1-med-grn.png`, thumb: `${BASE}femface1-med-grn-tmb.png`, skin: "med", eyes: "grn", enabled: true },
  { src: `${BASE}femface2-med-brn.png`, thumb: `${BASE}femface2-med-brn-tmb.png`, skin: "med", eyes: "brn", enabled: true },
  { src: `${BASE}femface2-med-blu.png`, thumb: `${BASE}femface2-med-blu-tmb.png`, skin: "med", eyes: "blu", enabled: true },
  { src: `${BASE}femface3-med-brn.png`, thumb: `${BASE}femface3-med-brn-tmb.png`, skin: "med", eyes: "brn", enabled: false },
  // Pale
  { src: `${BASE}femface1-pale-hzl.png`, thumb: `${BASE}femface1-pale-hzl-tmb.png`, skin: "pale", eyes: "hzl", enabled: true },
  { src: `${BASE}femface1-pale-brn.png`, thumb: `${BASE}femface1-pale-brn-tmb.png`, skin: "pale", eyes: "brn", enabled: false },
  { src: `${BASE}femface1-pale-vio.png`, thumb: `${BASE}femface1-pale-vio-tmb.png`, skin: "pale", eyes: "vio", enabled: false },
  { src: `${BASE}femface2-pale-brn.png`, thumb: `${BASE}femface2-pale-brn-tmb.png`, skin: "pale", eyes: "brn", enabled: false },
  { src: `${BASE}femface2-pale-blu.png`, thumb: `${BASE}femface2-pale-blu-tmb.png`, skin: "pale", eyes: "blu", enabled: false }
];

// Default selection: last massive body, last hair, first enabled pale face
let selectedBody = 2;
let selectedHair = 11;
let selectedFace = faceOptions.findIndex(f => f.skin === "pale" && f.enabled);

function renderBodyPickers() {
  const el = document.getElementById("body-pickers");
  el.innerHTML = "";
  bodyThumbs.forEach((opt, idx) => {
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.alignItems = "center";
    if (opt.hrDemo) {
      const label = document.createElement("div");
      label.textContent = "Muscular HR demo";
      label.className = "hr-label";
      wrap.appendChild(label);
    }
    const img = document.createElement("img");
    img.src = opt.thumb;
    img.className = "thumb" + (idx === selectedBody ? " selected" : "") + (!opt.enabled ? " disabled" : "");
    img.onclick = () => {
      if (opt.enabled) {
        selectedBody = idx;
        // When body changes, update selectedFace to first enabled matching skin
        let skin = opt.skin || "pale";
        let filtered = faceOptions.filter(f => f.skin === skin && f.enabled);
        selectedFace = filtered.length ? faceOptions.indexOf(filtered[0]) : 0;
        renderAllPickers();
        renderCharacter();
      }
    };
    wrap.appendChild(img);
    el.appendChild(wrap);
  });
}

function renderHairPickers() {
  const el = document.getElementById("hair-pickers");
  el.innerHTML = "";
  hairThumbs.forEach((opt, idx) => {
    const img = document.createElement("img");
    img.src = opt.thumb;
    img.className = "thumb" + (idx === selectedHair ? " selected" : "") + (!opt.enabled ? " disabled" : "");
    img.onclick = () => {
      if (opt.enabled) {
        selectedHair = idx;
        renderHairPickers();
        renderCharacter();
      }
    };
    el.appendChild(img);
  });
}

function renderFacePickers() {
  const el = document.getElementById("face-pickers");
  el.innerHTML = "";
  let skin = bodyThumbs[selectedBody].skin || "pale";
  let filtered = faceOptions.filter(f => f.skin === skin);
  filtered.forEach((face, idx) => {
    const img = document.createElement("img");
    img.src = face.thumb;
    img.className = "thumb" +
      (face.enabled ? "" : " disabled") +
      (faceOptions.indexOf(face) === selectedFace ? " selected" : "");
    img.onclick = function() {
      if (face.enabled) {
        selectedFace = faceOptions.indexOf(face);
        renderFacePickers();
        renderCharacter();
      }
    };
    el.appendChild(img);
  });
}

function renderAllPickers() {
  renderBodyPickers();
  renderFacePickers();
  renderHairPickers();
}

function renderCharacter() {
  const canvas = document.getElementById("charCanvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 640;
  canvas.height = 1280;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let body = bodyThumbs[selectedBody];
  let skin = body.skin || "pale";
  let face = faceOptions[selectedFace];
  let hair = hairThumbs[selectedHair];

  const layers = [];
  if (body && body.src) layers.push(body);
  if (face && face.src && face.enabled !== false) layers.push(face);
  if (hair && hair.src && hair.enabled !== false) layers.push(hair);

  let loaded = 0, imgs = [];
  if (!layers.length) return;
  layers.forEach((opt, i) => {
    if (!opt || !opt.src) { loaded++; return; }
    const im = new window.Image();
    imgs[i] = null;
    im.src = opt.src;
    im.onload = () => { imgs[i] = im; if (++loaded === layers.length) drawImgs(); };
    im.onerror = () => { if (++loaded === layers.length) drawImgs(); };
  });
  function drawImgs() {
    imgs.forEach(im => { if (im) ctx.drawImage(im, 0, 0, canvas.width, canvas.height); });
  }
}

renderAllPickers();
renderCharacter();
</script>
</body>
</html>
