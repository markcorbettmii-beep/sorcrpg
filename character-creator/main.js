const BASE = "assets/";

// --- BODY OPTIONS: mass (functional), thin/musc (placeholder) ---
const bodyOptions = [
  { src: null, thumb: `${BASE}fbody-thin-drk-tmb.png`, skin: "drk", type: "thin", enabled: false },
  { src: null, thumb: `${BASE}fbody-musc-drk-tmb.png`, skin: "drk", type: "muscular", enabled: false },
  { src: `${BASE}fbody-mass-drk.png`, thumb: `${BASE}fbody-mass-drk-tmb.png`, skin: "drk", type: "massive", enabled: true },
  { src: `${BASE}fbody-mass-med.png`, thumb: `${BASE}fbody-mass-med-tmb.png`, skin: "med", type: "massive", enabled: true },
  { src: `${BASE}fbody-mass-pale.png`, thumb: `${BASE}fbody-mass-pale-tmb.png`, skin: "pale", type: "massive", enabled: true },
  { src: null, thumb: `${BASE}fbody-thin-med-tmb.png`, skin: "med", type: "thin", enabled: false },
  { src: null, thumb: `${BASE}fbody-musc-med-tmb.png`, skin: "med", type: "muscular", enabled: false },
  { src: null, thumb: `${BASE}fbody-thin-pale-tmb.png`, skin: "pale", type: "thin", enabled: false },
  { src: null, thumb: `${BASE}fbody-musc-pale-tmb.png`, skin: "pale", type: "muscular", enabled: false },
];

// --- FACE OPTIONS (with functional/faded logic) ---
const faceOptions = [
  // Dark
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
  { src: `${BASE}femface3-med-brn.png`, thumb: `${BASE}femface3-med-brn-tmb.png`, skin: "med", eyes: "brn", enabled: false }, // LAST MED FACE: not functional
  // Pale
  { src: `${BASE}femface1-pale-hzl.png`, thumb: `${BASE}femface1-pale-hzl-tmb.png`, skin: "pale", eyes: "hzl", enabled: true }, // ONLY THIS PALE FACE IS FUNCTIONAL
  { src: `${BASE}femface1-pale-brn.png`, thumb: `${BASE}femface1-pale-brn-tmb.png`, skin: "pale", eyes: "brn", enabled: false },
  { src: `${BASE}femface1-pale-vio.png`, thumb: `${BASE}femface1-pale-vio-tmb.png`, skin: "pale", eyes: "vio", enabled: false },
  { src: `${BASE}femface2-pale-brn.png`, thumb: `${BASE}femface2-pale-brn-tmb.png`, skin: "pale", eyes: "brn", enabled: false },
  { src: `${BASE}femface2-pale-blu.png`, thumb: `${BASE}femface2-pale-blu-tmb.png`, skin: "pale", eyes: "blu", enabled: false }
];

// --- HAIR OPTIONS (all functional) ---
const hairOptions = [
  { src: `${BASE}femhair1.png`, thumb: `${BASE}femhair1-tmb.png` },
  { src: `${BASE}femhair2.png`, thumb: `${BASE}femhair2-tmb.png` },
  { src: `${BASE}femhair3.png`, thumb: `${BASE}femhair3-tmb.png` },
  { src: `${BASE}femhair4.png`, thumb: `${BASE}femhair4-tmb.png` },
  { src: `${BASE}femhair5.png`, thumb: `${BASE}femhair5-tmb.png` },
  { src: `${BASE}femhair6.png`, thumb: `${BASE}femhair6-tmb.png` },
  { src: `${BASE}femhair7.png`, thumb: `${BASE}femhair7-tmb.png` },
  { src: `${BASE}femhair8.png`, thumb: `${BASE}femhair8-tmb.png` },
  { src: `${BASE}femhair9.png`, thumb: `${BASE}femhair9-tmb.png` },
  { src: `${BASE}femhair10.png`, thumb: `${BASE}femhair10-tmb.png` },
  { src: `${BASE}femhair11.png`, thumb: `${BASE}femhair11-tmb.png` },
  { src: `${BASE}femhair12.png`, thumb: `${BASE}femhair12-tmb.png` }
];

// --- Equipment images ---
const BOW_IMG    = BASE + "kaidas-great-bow.png";
const ARMOR_IMG  = BASE + "set-epic-fur-mantle.png";
const HELMET_IMG = BASE + "bear-skn-helmet.png";

// Default: Select pale mass body and first face/hair
let selected = {
  body: bodyOptions.findIndex(b => b.type === "massive" && b.skin === "pale"),
  face: faceOptions.findIndex(f => f.skin === "pale" && f.enabled),
  hair: 0
};
let physiqueScore = null;
let showBow = false;
let showArmor = false;
let showHelmet = false;

// --- Utility: Only massive bodies are functional ---
function getAvailableBodyIndexes() {
  return bodyOptions;
}

// --- Picker rendering, including faded placeholders and yellow border for selected ---
// For body: selected gets border and size, non-selected get border only
// For face/hair: selected gets border (no size change)
function createPickerImages(options, pickerId, featureKey, skinMatch = null) {
  const picker = document.getElementById(pickerId);
  picker.innerHTML = "";

  let opts = options;
  if (featureKey === "face" && skinMatch) {
    opts = options.filter(opt => opt.skin === skinMatch);
  }
  opts.forEach((option, idx) => {
    const img = document.createElement('img');
    img.src = option.thumb;
    img.alt = `${featureKey} ${idx + 1}`;
    img.title = option.label ? option.label : '';

    let selectedIndex = selected[featureKey];
    let isSelected = (idx === selectedIndex);

    // --- Enable/disable logic ---
    let isFunctional = true;
    if (featureKey === "body" && !option.enabled) isFunctional = false;
    if (featureKey === "face" && option.enabled === false) isFunctional = false;

    img.style.pointerEvents = isFunctional ? "auto" : "none";
    img.style.opacity = isFunctional ? "1" : "0.3";

    // --- Selection border logic ---
    if (isSelected) {
      img.style.border = "4px solid #ffbb00";
      img.style.boxShadow = "0 0 24px #ffbc6c88";
      img.style.zIndex = "2";
      img.style.background = "#fffbe8";
    } else {
      img.style.border = "3px solid #ddd";
      img.style.boxShadow = "0 2px 12px #ccc9";
      img.style.zIndex = "1";
      img.style.background = "#fafafa";
    }
    // --- Size effect for selected mass body only ---
    if (featureKey === "body" && option.enabled && isSelected) {
      img.style.width = "140px";
      img.style.height = "140px";
    } else {
      img.style.width = "90px";
      img.style.height = "90px";
    }

    // --- Click handler for functional ---
    if (isFunctional) {
      img.addEventListener('click', function () {
        selectFeature(pickerId, idx, featureKey, skinMatch);
      });
    }
    picker.appendChild(img);
  });
}

// --- Picker logic ---
function selectFeature(pickerId, idx, featureKey, skinMatch = null) {
  const picker = document.getElementById(pickerId);
  Array.from(picker.children).forEach(img => img.classList.remove("selected"));
  picker.children[idx].classList.add("selected");

  if (featureKey === "body") {
    selected.body = idx;
    // When body changes, show only faces for that skin
    const skin = getCurrentBodySkin();
    createPickerImages(faceOptions, "face-pickers", "face", skin);
    selected.face = faceOptions.findIndex(f => f.skin === skin && f.enabled);
    document.getElementById("face-pickers").children[selected.face].classList.add("selected");
    // Re-render body picker for zoom effect and highlight
    createPickerImages(bodyOptions, "body-pickers", "body");
  } else if (featureKey === "face") {
    selected.face = idx;
  } else if (featureKey === "hair") {
    selected.hair = idx;
  }
  renderCharacter();
}

function getCurrentBodySkin() {
  return bodyOptions[selected.body]?.skin || "pale";
}

// --- Character rendering (with equipment support and dynamic canvas size) ---
function renderCharacter() {
  const canvas = document.getElementById("charCanvas");
  const ctx = canvas.getContext("2d");
  // Canvas size: larger for mass body selected
  if (bodyOptions[selected.body] && bodyOptions[selected.body].enabled) {
    canvas.width = 640;
    canvas.height = 1280;
  } else {
    canvas.width = 512;
    canvas.height = 1024;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let body = bodyOptions[selected.body];
  let skin = body?.skin || "pale";
  let faceOpts = faceOptions.filter(f => f.skin === skin);
  let face = faceOpts[selected.face];
  let hair = hairOptions[selected.hair];

  // Layer order: bow, body, armor, face, hair, helmet
  const layers = [];
  if (showBow) layers.push({src: BOW_IMG});
  if (body && body.src) layers.push(body);
  if (showArmor) layers.push({src: ARMOR_IMG});
  if (face && face.src && face.enabled !== false) layers.push(face);
  if (hair && hair.src) layers.push(hair);
  if (showHelmet) layers.push({src: HELMET_IMG});

  let loaded = 0, imgs = [];
  layers.forEach((opt, i) => {
    if (!opt || !opt.src) { loaded++; return; }
    const im = new Image();
    imgs[i] = null;
    im.src = opt.src;
    im.onload = () => { imgs[i] = im; if (++loaded === layers.length) draw(); };
    im.onerror = () => { if (++loaded === layers.length) draw(); };
  });
  function draw() {
    imgs.forEach(im => { if (im) ctx.drawImage(im, 0, 0, canvas.width, canvas.height); });
  }
}

// --- Equipment checkbox logic ---
document.getElementById("equipBowChk").addEventListener('change', function() {
  showBow = this.checked;
  renderCharacter();
});
document.getElementById("equipArmorChk").addEventListener('change', function() {
  showArmor = this.checked;
  renderCharacter();
});
document.getElementById("equipHelmetChk").addEventListener('change', function() {
  showHelmet = this.checked;
  renderCharacter();
});

// --- Physique form submit ---
document.getElementById("physiqueForm").addEventListener("submit", function(e) {
  e.preventDefault();
  const val = parseInt(document.getElementById("physiqueInput").value, 10);
  if (isNaN(val) || val < 1) {
    document.getElementById("physiqueError").style.display = "inline";
    return;
  }
  physiqueScore = val;
  document.getElementById("physiqueError").style.display = "none";
  document.getElementById("physiqueForm").style.display = "none";
  document.getElementById("physiqueApprovedMsg").style.display = "block";
  // Rebuild pickers to show only allowed bodies and matched faces
  createPickerImages(bodyOptions, "body-pickers", "body");
  let skin = getCurrentBodySkin();
  createPickerImages(faceOptions.filter(f => f.skin === skin), "face-pickers", "face", skin);
  createPickerImages(hairOptions, "hair-pickers", "hair");
  document.getElementById("body-pickers").children[selected.body].classList.add("selected");
  document.getElementById("face-pickers").children[selected.face].classList.add("selected");
  document.getElementById("hair-pickers").children[selected.hair].classList.add("selected");
  renderCharacter();
});

// --- Randomizer, only functional faces/bodies ---
document.getElementById("randomBtn").addEventListener("click", function () {
  // Only functional mass bodies
  let massBodyIndexes = bodyOptions.map((b, i) => b.enabled ? i : null).filter(i => i !== null);
  selected.body = massBodyIndexes[Math.floor(Math.random() * massBodyIndexes.length)];
  let skin = getCurrentBodySkin();
  // Only functional faces for current body/skin
  let faceOpts = faceOptions.filter(f => f.skin === skin && f.enabled !== false);
  // For pale, only first face is enabled, so always 0
  selected.face = faceOpts.length > 1 ? Math.floor(Math.random() * faceOpts.length) : 0;
  selected.hair = Math.floor(Math.random() * hairOptions.length);
  createPickerImages(bodyOptions, "body-pickers", "body");
  createPickerImages(faceOptions.filter(f => f.skin === skin), "face-pickers", "face", skin);
  createPickerImages(hairOptions, "hair-pickers", "hair");
  document.getElementById("body-pickers").children[selected.body].classList.add("selected");
  document.getElementById("face-pickers").children[selected.face].classList.add("selected");
  document.getElementById("hair-pickers").children[selected.hair].classList.add("selected");
  renderCharacter();
});

// --- Initialize ---
document.addEventListener("DOMContentLoaded", () => {
  createPickerImages(bodyOptions, "body-pickers", "body");
  let skin = getCurrentBodySkin();
  createPickerImages(faceOptions.filter(f => f.skin === skin), "face-pickers", "face", skin);
  createPickerImages(hairOptions, "hair-pickers", "hair");
  document.getElementById("body-pickers").children[selected.body].classList.add("selected");
  document.getElementById("face-pickers").children[selected.face].classList.add("selected");
  document.getElementById("hair-pickers").children[selected.hair].classList.add("selected");
  renderCharacter();
});
