<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Character Creator</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; }
    .creator-wrap { max-width: 850px; margin: 0 auto; background: #fff; padding: 24px 24px 48px 24px; border-radius: 18px; box-shadow: 0 4px 32px #0002;}
    .picker-section { margin-bottom: 24px; }
    .picker-label { font-size: 1.1em; font-weight: bold; margin: 12px 0 4px 0;}
    .thumb-list { display: flex; gap: 12px; margin-bottom: 8px;}
    .thumb { width: 90px; height: 90px; border-radius: 12px; border: 3px solid #ddd; background: #fafafa; box-shadow: 0 2px 12px #ccc9; opacity: 1; cursor: pointer; }
    .thumb.selected { border: 4px solid #ffbb00; background: #fffbe8; box-shadow: 0 0 24px #ffbc6c88; }
    .thumb.disabled { opacity: 0.3; cursor: default; }
    .hr-label { font-size:0.95em;font-weight:bold;color:#a22;margin-bottom:2px;}
  </style>
</head>
<body>
<div class="creator-wrap">
  <h2>Character Creator</h2>
  <canvas id="charCanvas" width="640" height="1280" style="background:#eee; border-radius:16px; display:block; margin-bottom:24px;"></canvas>
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
const BASE = "character-creator/assets/";

const bodyTypeRows = [
  {
    label: "Body Type (massive)",
    bodies: [
      { src: `${BASE}fbody-mass-drk.png`, thumb: `${BASE}fbody-mass-drk-tmb.png`, skin: "drk", type: "massive", enabled: true },
      { src: `${BASE}fbody-mass-med.png`, thumb: `${BASE}fbody-mass-med-tmb.png`, skin: "med", type: "massive", enabled: true },
      { src: `${BASE}fbody-mass-pale.png`, thumb: `${BASE}fbody-mass-pale-tmb.png`, skin: "pale", type: "massive", enabled: true }
    ]
  },
  {
    label: "Body Type (muscular)",
    bodies: [
      { src: "", thumb: `${BASE}placeholder-pale.png`, skin: "pale", type: "muscular", enabled: false, isPlaceholder: true },
      { src: `${BASE}hr-fbody-muscular.png`, thumb: `${BASE}fbody-musc-drk-tmb.png`, skin: "hr", type: "muscular_hr", enabled: true, isHighRes: true },
      { src: "", thumb: `${BASE}placeholder-drk.png`, skin: "drk", type: "muscular", enabled: false, isPlaceholder: true }
    ]
  },
  {
    label: "Body Type (thin)",
    bodies: [
      { src: "", thumb: `${BASE}placeholder-pale.png`, skin: "pale", type: "thin", enabled: false, isPlaceholder: true },
      { src: "", thumb: `${BASE}placeholder-med.png`, skin: "med", type: "thin", enabled: false, isPlaceholder: true },
      { src: "", thumb: `${BASE}placeholder-drk.png`, skin: "drk", type: "thin", enabled: false, isPlaceholder: true }
    ]
  }
];
const bodyOptions = bodyTypeRows.flatMap(row => row.bodies);

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

const hairOptions = [
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

let selected = {
  body: 2, // fbody-mass-pale
  face: faceOptions.findIndex(f => f.skin === "pale" && f.enabled),
  hair: 5 // hair #6
};

function renderBodyPickers() {
  const container = document.getElementById("body-pickers");
  container.innerHTML = "";
  let idx = 0;
  bodyTypeRows.forEach(row => {
    const rowDiv = document.createElement("div");
    rowDiv.className = "thumb-list";
    row.bodies.forEach((body, i) => {
      const wrap = document.createElement("div");
      wrap.style.display = "flex";
      wrap.style.flexDirection = "column";
      wrap.style.alignItems = "center";
      if (body.isHighRes) {
        const label = document.createElement("div");
        label.textContent = "Muscular HR demo";
        label.className = "hr-label";
        wrap.appendChild(label);
      }
      const img = document.createElement("img");
      img.src = body.thumb;
      img.className = "thumb" +
        (selected.body === idx ? " selected" : "") +
        (!body.enabled ? " disabled" : "");
      img.onclick = function() {
        if (body.enabled) {
          selected.body = idx;
          let skin = body.skin;
          let firstEnabledFace = faceOptions.findIndex(f => f.skin === skin && f.enabled);
          selected.face = firstEnabledFace >= 0 ? firstEnabledFace : 0;
          renderAllPickers();
          renderCharacter();
        }
      };
      wrap.appendChild(img);
      rowDiv.appendChild(wrap);
      idx++;
    });
    container.appendChild(rowDiv);
  });
}

function renderFacePickers() {
  const container = document.getElementById("face-pickers");
  container.innerHTML = "";
  let body = bodyOptions[selected.body];
  let skin = body.skin;
  let filtered = faceOptions.filter(f => f.skin === skin);

  filtered.forEach((face, idx) => {
    const img = document.createElement("img");
    img.src = face.thumb;
    img.className = "thumb" +
      (face.enabled ? "" : " disabled") +
      (selected.face === idx ? " selected" : "");
    img.onclick = function() {
      if (face.enabled) {
        selected.face = idx;
        renderFacePickers();
        renderCharacter();
      }
    };
    container.appendChild(img);
  });
}

function renderHairPickers() {
  const container = document.getElementById("hair-pickers");
  container.innerHTML = "";
  hairOptions.forEach((hair, idx) => {
    const img = document.createElement("img");
    img.src = hair.thumb;
    img.className = "thumb" +
      (!hair.enabled ? " disabled" : "") +
      (selected.hair === idx ? " selected" : "");
    img.onclick = function() {
      if (hair.enabled) {
        selected.hair = idx;
        renderHairPickers();
        renderCharacter();
      }
    };
    container.appendChild(img);
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

  let bgImg = new window.Image();
  bgImg.src = BASE + "highres-canvas-bg.png";
  bgImg.onload = function() {
    ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
    drawLayers();
  };
  bgImg.onerror = drawLayers;

  function drawLayers() {
    let body = bodyOptions[selected.body];
    let skin = body?.skin || "pale";
    let faceOpts = faceOptions.filter(f => f.skin === skin);
    let face = faceOpts[selected.face];
    let hair = hairOptions[selected.hair];

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
}

renderAllPickers();
renderCharacter();
</script>
</body>
</html>
