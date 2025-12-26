<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Body & Hair Picker Demo (All Thumbs)</title>
  <style>
    .thumb { width:90px; height:90px; border-radius:12px; border:3px solid #ddd; margin:4px; background:#fafafa; box-shadow:0 2px 12px #ccc9; cursor:pointer; }
    .thumb.selected { border:4px solid #ffbb00; background:#fffbe8; box-shadow:0 0 24px #ffbc6c88; }
    .thumb.disabled { opacity:0.3; cursor:default; }
    .row { display:flex; gap:10px; margin-bottom:8px;}
    .hr-label { font-size:0.95em;font-weight:bold;color:#a22;margin-bottom:2px; text-align:center;}
  </style>
</head>
<body>
<h3>Body Picker</h3>
<div id="body-pickers" class="row"></div>
<h3>Hair Picker</h3>
<div id="hair-pickers" class="row"></div>
<script>
const BASE = "character-creator/assets/";

const bodyThumbs = [
  // Massive
  { thumb: `${BASE}fbody-mass-drk-tmb.png`, enabled: true },
  { thumb: `${BASE}fbody-mass-med-tmb.png`, enabled: true },
  { thumb: `${BASE}fbody-mass-pale-tmb.png`, enabled: true },
  // Muscular
  { thumb: `${BASE}placeholder-pale.png`, enabled: false },
  { thumb: `${BASE}fbody-musc-drk-tmb.png`, enabled: true, hrDemo:true },
  { thumb: `${BASE}placeholder-drk.png`, enabled: false },
  // Thin
  { thumb: `${BASE}placeholder-pale.png`, enabled: false },
  { thumb: `${BASE}placeholder-med.png`, enabled: false },
  { thumb: `${BASE}placeholder-drk.png`, enabled: false }
];

const hairThumbs = [
  { thumb: `${BASE}femhair1-tmb.png`, enabled: true },
  { thumb: `${BASE}femhair2-tmb.png`, enabled: true },
  { thumb: `${BASE}femhair3-tmb.png`, enabled: true },
  { thumb: `${BASE}femhair4-tmb.png`, enabled: true },
  { thumb: `${BASE}femhair5-tmb.png`, enabled: true },
  { thumb: `${BASE}femhair6-tmb.png`, enabled: true },
  { thumb: `${BASE}femhair7-tmb.png`, enabled: true },
  { thumb: `${BASE}femhair8-tmb.png`, enabled: true },
  { thumb: `${BASE}femhair9-tmb.png`, enabled: true },
  { thumb: `${BASE}femhair10-tmb.png`, enabled: true },
  { thumb: `${BASE}femhair11-tmb.png`, enabled: true },
  { thumb: `${BASE}femhair12-tmb.png`, enabled: true }
];

// Default: last massive body, last hair
let selectedBody = 2;
let selectedHair = 11;

function renderPicker(arr, elId, selectedIdx, setSelected) {
  const el = document.getElementById(elId);
  el.innerHTML = "";
  arr.forEach((opt, idx) => {
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
    img.className = "thumb" + (idx === selectedIdx ? " selected" : "") + (!opt.enabled ? " disabled" : "");
    img.onclick = () => {
      if (opt.enabled) {
        setSelected(idx);
      }
    };
    wrap.appendChild(img);
    el.appendChild(wrap);
  });
}

function setBody(idx) {
  selectedBody = idx;
  renderPicker(bodyThumbs, "body-pickers", selectedBody, setBody);
}

function setHair(idx) {
  selectedHair = idx;
  renderPicker(hairThumbs, "hair-pickers", selectedHair, setHair);
}

renderPicker(bodyThumbs, "body-pickers", selectedBody, setBody);
renderPicker(hairThumbs, "hair-pickers", selectedHair, setHair);
</script>
</body>
</html>
