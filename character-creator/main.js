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

// --- FACE OPTIONS ---
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
  { src: `${BASE}femface3-med-brn.png`, thumb: `${BASE}femface3-med-brn-tmb.png`, skin: "med", eyes: "brn", enabled: false }, // NOT FUNCTIONAL
  // Pale
  { src: `${BASE}femface1-pale-hzl.png`, thumb: `${BASE}femface1-pale-hzl-tmb.png`, skin: "pale", eyes: "hzl", enabled: true }, // ONLY THIS PALE FACE IS FUNCTIONAL
  { src: `${BASE}femface1-pale-brn.png`, thumb: `${BASE}femface1-pale-brn-tmb.png`, skin: "pale", eyes: "brn", enabled: false },
  { src: `${BASE}femface1-pale-vio.png`, thumb: `${BASE}femface1-pale-vio-tmb.png`, skin: "pale", eyes: "vio", enabled: false },
  { src: `${BASE}femface2-pale-brn.png`, thumb: `${BASE}femface2-pale-brn-tmb.png`, skin: "pale", eyes: "brn", enabled: false },
  { src: `${BASE}femface2-pale-blu.png`, thumb: `${BASE}femface2-pale-blu-tmb.png`, skin: "pale", eyes: "blu", enabled: false }
];

// --- HAIR OPTIONS: ALL FUNCTIONAL ---
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

// --- Equipment images ---
const WEAPONS_IMG = BASE + "kaidas-great-bow.png"; // Use this for "Show Weapons"
const ARMOR_IMG   = BASE + "set-epic-fur-mantle.png";
const HELMET_IMG  = BASE + "bear-skn-helmet.png";

let selected = {
  body: bodyOptions.findIndex(b => b.type === "massive" && b.skin === "pale"),
  face: faceOptions.findIndex(f => f.skin === "pale" && f.enabled),
  hair: 0
};
let physiqueScore = null;
let showWeapons = false;
let showArmor = false;
let showHelmet = false;

// --- Picker rendering, faded/functional, yellow border for all selected, zoom for selected body only ---
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

    let isFunctional = true;
    if (featureKey === "body" && !option.enabled) isFunctional = false;
    if (featureKey === "face" && option.enabled === false) isFunctional = false;
    if (featureKey === "hair" && option.enabled === false) isFunctional = false;

    img.style.pointerEvents = isFunctional ? "auto" : "none";
    img.style.opacity = isFunctional ? "1" : "0.3";

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
    if (featureKey === "body" && option.enabled && isSelected) {
      img.style.width = "140px";
      img.style.height = "140px";
    } else {
      img.style.width = "90px";
      img.style.height = "90px";
    }

    if (isFunctional) {
      img.addEventListener('click', function () {
        selectFeature(pickerId, idx, featureKey, skinMatch);
      });
    }

    // --- Hold for preview ---
    img.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      showPreview(featureKey, option);
    });
    img.addEventListener('touchstart', function (e) {
      showPreview(featureKey, option);
    });
    img.addEventListener('mouseup', hidePreview);
    img.addEventListener('mouseleave', hidePreview);
    img.addEventListener('touchend', hidePreview);

    picker.appendChild(img);
  });
}

// --- Preview logic ---
let previewTimeout, previewActive = false;
function showPreview(featureKey, option) {
  clearTimeout(previewTimeout);
  previewTimeout = setTimeout(() => {
    previewActive = true;
    const overlay = document.getElementById("previewOverlay");
    let img = document.createElement("img");
    img.src = option.src || option.thumb;
    img.style.maxWidth = "90vw";
    img.style.maxHeight = "90vh";
    img.style.border = "6px solid #ffbc6c";
    img.style.background = "#fffbe8";
    img.style.boxShadow = "0 0 40px #ffbc6c88";
    overlay.innerHTML = "";
    overlay.appendChild(img);
    overlay.style.display = "block";
  }, 400); // 400ms hold
}
function hidePreview() {
  clearTimeout(previewTimeout);
  previewActive = false;
  document.getElementById("previewOverlay").style.display = "none";
}

// --- Picker logic ---
function selectFeature(pickerId, idx, featureKey, skinMatch = null) {
  selected[featureKey] = idx;

  if (featureKey === "body") {
    const skin = getCurrentBodySkin();
    createPickerImages(faceOptions, "face-pickers", "face", skin);
    let faceOpts = faceOptions.filter(f => f.skin === skin);
    let firstEnabledFace = faceOpts.findIndex(f => f.enabled);
    selected.face = firstEnabledFace >= 0 ? firstEnabledFace : 0;
    document.getElementById("face-pickers").children[selected.face].classList.add("selected");
    createPickerImages(bodyOptions, "body-pickers", "body");
  }
  createPickerImages(bodyOptions, "body-pickers", "body");
  createPickerImages(faceOptions.filter(f => f.skin === getCurrentBodySkin()), "face-pickers", "face", getCurrentBodySkin());
  createPickerImages(hairOptions, "hair-pickers", "hair");
  document.getElementById("body-pickers").children[selected.body].classList.add("selected");
  document.getElementById("face-pickers").children[selected.face].classList.add("selected");
  document.getElementById("hair-pickers").children[selected.hair].classList.add("selected");

  renderCharacter();
}

function getCurrentBodySkin() {
  return bodyOptions[selected.body]?.skin || "pale";
}

// --- Character rendering (with equipment support and dynamic canvas size) ---
function renderCharacter() {
  const canvas = document.getElementById("charCanvas");
  const ctx = canvas.getContext("2d");
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

  const layers = [];
  if (showWeapons) layers.push({src: WEAPONS_IMG});
  if (body && body.src) layers.push(body);
  if (showArmor) layers.push({src: ARMOR_IMG});
  if (face && face.src && face.enabled !== false) layers.push(face);
  if (hair && hair.src && hair.enabled !== false) layers.push(hair);
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
document.getElementById("equipWeaponsChk").addEventListener('change', function() {
  showWeapons = this.checked;
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

// --- Dead links for card buttons ---
document.getElementById("cardWeaponsBtn").addEventListener("click", function(e) {
  alert("Show Linked Card (coming soon)");
});
document.getElementById("cardArmorBtn").addEventListener("click", function(e) {
  alert("Show Linked Card (coming soon)");
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
  createPickerImages(bodyOptions, "body-pickers", "body");
  let skin = getCurrentBodySkin();
  createPickerImages(faceOptions.filter(f => f.skin === skin), "face-pickers", "face", skin);
  createPickerImages(hairOptions, "hair-pickers", "hair");
  document.getElementById("body-pickers").children[selected.body].classList.add("selected");
  document.getElementById("face-pickers").children[selected.face].classList.add("selected");
  document.getElementById("hair-pickers").children[selected.hair].classList.add("selected");
  renderCharacter();
});

// --- Randomizer, only functional faces/bodies/hair ---
document.getElementById("randomBtn").addEventListener("click", function () {
  let massBodyIndexes = bodyOptions.map((b, i) => b.enabled ? i : null).filter(i => i !== null);
  selected.body = massBodyIndexes[Math.floor(Math.random() * massBodyIndexes.length)];
  let skin = getCurrentBodySkin();
  let faceOpts = faceOptions.filter(f => f.skin === skin && f.enabled !== false);
  selected.face = faceOpts.length > 1 ? Math.floor(Math.random() * faceOpts.length) : 0;
  let enabledHairIndexes = hairOptions.map((h, i) => h.enabled ? i : null).filter(i => i !== null);
  selected.hair = enabledHairIndexes.length ? enabledHairIndexes[Math.floor(Math.random() * enabledHairIndexes.length)] : 0;
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
