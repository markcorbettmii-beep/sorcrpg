const BASE = "assets/";

// --- BODY OPTIONS: mass (functional), thin (placeholder), musc (placeholder) ---
const bodyOptions = [
  // Thin placeholder
  { src: null, thumb: `${BASE}fbody-thin-drk-tmb.png`, skin: "drk", type: "thin", enabled: false },
  // Muscular placeholder
  { src: null, thumb: `${BASE}fbody-musc-drk-tmb.png`, skin: "drk", type: "muscular", enabled: false },
  // Massive functional bodies
  { src: `${BASE}fbody-mass-drk.png`, thumb: `${BASE}fbody-mass-drk-tmb.png`, skin: "drk", type: "massive", enabled: true },
  { src: `${BASE}fbody-mass-med.png`, thumb: `${BASE}fbody-mass-med-tmb.png`, skin: "med", type: "massive", enabled: true },
  { src: `${BASE}fbody-mass-pale.png`, thumb: `${BASE}fbody-mass-pale-tmb.png`, skin: "pale", type: "massive", enabled: true },
  // Thin placeholder
  { src: null, thumb: `${BASE}fbody-thin-med-tmb.png`, skin: "med", type: "thin", enabled: false },
  // Muscular placeholder
  { src: null, thumb: `${BASE}fbody-musc-med-tmb.png`, skin: "med", type: "muscular", enabled: false },
  // Thin placeholder
  { src: null, thumb: `${BASE}fbody-thin-pale-tmb.png`, skin: "pale", type: "thin", enabled: false },
  // Muscular placeholder
  { src: null, thumb: `${BASE}fbody-musc-pale-tmb.png`, skin: "pale", type: "muscular", enabled: false },
];

// --- FACE OPTIONS (with specified removals) ---
const faceOptions = [
  // Dark
  { src: `${BASE}femface1-dark-blu.png`, thumb: `${BASE}femface1-dark-blu-tmb.png`, skin: "drk", eyes: "blu" },
  { src: `${BASE}femface1-dark-hzl.png`, thumb: `${BASE}femface1-dark-hzl-tmb.png`, skin: "drk", eyes: "hzl" },
  { src: `${BASE}femface2-dark-brn.png`, thumb: `${BASE}femface2-dark-brn-tmb.png`, skin: "drk", eyes: "brn" },
  { src: `${BASE}femface2-dark-blu.png`, thumb: `${BASE}femface2-dark-blu-tmb.png`, skin: "drk", eyes: "blu" },
  // Medium (REMOVED index 5, i.e. 6th med face!)
  { src: `${BASE}femface1-med-brn.png`, thumb: `${BASE}femface1-med-brn-tmb.png`, skin: "med", eyes: "brn" },
  { src: `${BASE}femface1-med-hzl.png`, thumb: `${BASE}femface1-med-hzl-tmb.png`, skin: "med", eyes: "hzl" },
  { src: `${BASE}femface1-med-grn.png`, thumb: `${BASE}femface1-med-grn-tmb.png`, skin: "med", eyes: "grn" },
  { src: `${BASE}femface2-med-brn.png`, thumb: `${BASE}femface2-med-brn-tmb.png`, skin: "med", eyes: "brn" },
  { src: `${BASE}femface2-med-blu.png`, thumb: `${BASE}femface2-med-blu-tmb.png`, skin: "med", eyes: "blu" },
  // (REMOVED) { src: `${BASE}femface2-med-grn.png`, thumb: `${BASE}femface2-med-grn-tmb.png`, skin: "med", eyes: "grn" },
  { src: `${BASE}femface3-med-brn.png`, thumb: `${BASE}femface3-med-brn-tmb.png`, skin: "med", eyes: "brn" },
  // Pale (REMOVED index 4, i.e. 5th pale face!)
  { src: `${BASE}femface1-pale-hzl.png`, thumb: `${BASE}femface1-pale-hzl-tmb.png`, skin: "pale", eyes: "hzl" },
  { src: `${BASE}femface1-pale-brn.png`, thumb: `${BASE}femface1-pale-brn-tmb.png`, skin: "pale", eyes: "brn" },
  { src: `${BASE}femface1-pale-vio.png`, thumb: `${BASE}femface1-pale-vio-tmb.png`, skin: "pale", eyes: "vio" },
  { src: `${BASE}femface2-pale-brn.png`, thumb: `${BASE}femface2-pale-brn-tmb.png`, skin: "pale", eyes: "brn" },
  { src: `${BASE}femface2-pale-blu.png`, thumb: `${BASE}femface2-pale-blu-tmb.png`, skin: "pale", eyes: "blu" },
  // (REMOVED) { src: `${BASE}femface2-pale-grn.png`, thumb: `${BASE}femface2-pale-grn-tmb.png`, skin: "pale", eyes: "grn" },
];

// --- HAIR OPTIONS ---
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

let selected = { body: 2, face: 0, hair: 0 }; // Default: first mass body
let physiqueScore = null;
let showBow = false;
let showArmor = false;
let showHelmet = false;

// --- Utility: Only massive bodies are functional ---
function getAvailableBodyIndexes() {
  return bodyOptions;
}

// --- Picker rendering, including faded placeholders and zoom for selected mass body ---
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
    if (featureKey === "body" && !option.enabled) {
      img.style.pointerEvents = "none";
      img.style.opacity = "0.3";
    } else {
      img.style.pointerEvents = "auto";
      img.style.opacity = "1";
      img.addEventListener('click', function () {
        if (featureKey === "body" && !option.enabled) return;
        selectFeature(pickerId, idx, featureKey, skinMatch);
      });
    }
    // Zoom/size effect for selected mass body
    if (featureKey === "body" && option.enabled && idx === selected.body) {
      img.style.width = "140px";
      img.style.height = "140px";
      img.style.border = "4px solid #ff8800";
      img.style.boxShadow = "0 0 24px #ffbc6c88";
      img.style.zIndex = "2";
      img.style.background = "#fffbe8";
    } else {
      img.style.width = "90px";
      img.style.height = "90px";
      img.style.border = "3px solid #ddd";
      img.style.boxShadow = "0 2px 12px #ccc9";
      img.style.zIndex = "1";
      img.style.background = "#fafafa";
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
    selected.face = 0;
    document.getElementById("face-pickers").children[0].classList.add("selected");
    // Re-render body picker for zoom effect
    createPickerImages(bodyOptions, "body-pickers", "body");
  } else if (featureKey === "face") {
    selected.face = idx;
  } else if (featureKey === "hair") {
    selected.hair = idx;
  }
  renderCharacter();
}

function getCurrentBodySkin() {
  return bodyOptions[selected.body]?.skin || "med";
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
  let skin = body?.skin || "med";
  let faceOpts = faceOptions.filter(f => f.skin === skin);
  let face = faceOpts[selected.face];
  let hair = hairOptions[selected.hair];

  // Layer order: bow, body, armor, face, hair, helmet
  const layers = [];
  if (showBow) layers.push({src: BOW_IMG});
  if (body && body.src) layers.push(body);
  if (showArmor) layers.push({src: ARMOR_IMG});
  if (face && face.src) layers.push(face);
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
  // Mark defaults
  document.getElementById("body-pickers").children[selected.body].classList.add("selected");
  document.getElementById("face-pickers").children[selected.face].classList.add("selected");
  document.getElementById("hair-pickers").children[selected.hair].classList.add("selected");
  renderCharacter();
});

// --- Randomizer ---
document.getElementById("randomBtn").addEventListener("click", function () {
  let massBodyIndexes = bodyOptions.map((b, i) => b.enabled ? i : null).filter(i => i !== null);
  selected.body = massBodyIndexes[Math.floor(Math.random() * massBodyIndexes.length)];
  let skin = getCurrentBodySkin();
  let faceOpts = faceOptions.filter(f => f.skin === skin);
  selected.face = Math.floor(Math.random() * faceOpts.length);
  selected.hair = Math.floor(Math.random() * hairOptions.length);
  createPickerImages(bodyOptions, "body-pickers", "body");
  createPickerImages(faceOpts, "face-pickers", "face", skin);
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
