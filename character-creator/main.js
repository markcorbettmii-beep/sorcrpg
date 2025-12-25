const BASE = "assets/";

// --- MASSIVE BODY OPTIONS ONLY ---
const bodyOptions = [
  { src: `${BASE}fbody-mass-drk.png`, thumb: `${BASE}fbody-mass-drk-tmb.png`, skin: "drk", label: "Dark" },
  { src: `${BASE}fbody-mass-med.png`, thumb: `${BASE}fbody-mass-med-tmb.png`, skin: "med", label: "Medium" },
  { src: `${BASE}fbody-mass-pale.png`, thumb: `${BASE}fbody-mass-pale-tmb.png`, skin: "pale", label: "Pale" }
];

// --- FACE OPTIONS: ALL COLORS, ONLY FOR MASSIVE BODIES, GROUPED BY SKIN TONE ---
const faceOptions = [
  // Dark
  { src: `${BASE}femface1-dark-blu.png`, thumb: `${BASE}femface1-dark-blu-tmb.png`, skin: "drk", eyes: "blu" },
  { src: `${BASE}femface1-dark-hzl.png`, thumb: `${BASE}femface1-dark-hzl-tmb.png`, skin: "drk", eyes: "hzl" },
  { src: `${BASE}femface2-dark-brn.png`, thumb: `${BASE}femface2-dark-brn-tmb.png`, skin: "drk", eyes: "brn" },
  { src: `${BASE}femface2-dark-blu.png`, thumb: `${BASE}femface2-dark-blu-tmb.png`, skin: "drk", eyes: "blu" },
  // Add every DRK face here!

  // Medium
  { src: `${BASE}femface1-med-brn.png`, thumb: `${BASE}femface1-med-brn-tmb.png`, skin: "med", eyes: "brn" },
  { src: `${BASE}femface1-med-hzl.png`, thumb: `${BASE}femface1-med-hzl-tmb.png`, skin: "med", eyes: "hzl" },
  { src: `${BASE}femface1-med-grn.png`, thumb: `${BASE}femface1-med-grn-tmb.png`, skin: "med", eyes: "grn" },
  { src: `${BASE}femface2-med-brn.png`, thumb: `${BASE}femface2-med-brn-tmb.png`, skin: "med", eyes: "brn" },
  { src: `${BASE}femface2-med-blu.png`, thumb: `${BASE}femface2-med-blu-tmb.png`, skin: "med", eyes: "blu" },
  { src: `${BASE}femface2-med-grn.png`, thumb: `${BASE}femface2-med-grn-tmb.png`, skin: "med", eyes: "grn" },
  { src: `${BASE}femface3-med-brn.png`, thumb: `${BASE}femface3-med-brn-tmb.png`, skin: "med", eyes: "brn" },
  // Add every MED face here!

  // Pale
  { src: `${BASE}femface1-pale-hzl.png`, thumb: `${BASE}femface1-pale-hzl-tmb.png`, skin: "pale", eyes: "hzl" },
  { src: `${BASE}femface1-pale-brn.png`, thumb: `${BASE}femface1-pale-brn-tmb.png`, skin: "pale", eyes: "brn" },
  { src: `${BASE}femface1-pale-vio.png`, thumb: `${BASE}femface1-pale-vio-tmb.png`, skin: "pale", eyes: "vio" },
  { src: `${BASE}femface2-pale-brn.png`, thumb: `${BASE}femface2-pale-brn-tmb.png`, skin: "pale", eyes: "brn" },
  { src: `${BASE}femface2-pale-blu.png`, thumb: `${BASE}femface2-pale-blu-tmb.png`, skin: "pale", eyes: "blu" },
  { src: `${BASE}femface2-pale-grn.png`, thumb: `${BASE}femface2-pale-grn-tmb.png`, skin: "pale", eyes: "grn" },
  { src: `${BASE}femface4-pale-brn-mkup.png`, thumb: `${BASE}femface4-pale-brn-mkup-tmb.png`, skin: "pale", eyes: "brn" },
  { src: `${BASE}femface5-pale-blu-mkup.png`, thumb: `${BASE}femface5-pale-blu-mkup-tmb.png`, skin: "pale", eyes: "blu" }
  // Add every PALE face here!
];

// --- HAIR OPTIONS: ALL AVAILABLE ---
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

let selected = { body: 0, face: 0, hair: 0 };
let creationEnabled = false;

// Picker rendering
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
    img.style.pointerEvents = creationEnabled ? "auto" : "none";
    img.style.opacity = creationEnabled ? "1" : "0.5";
    img.addEventListener('click', function () {
      if (!creationEnabled) return;
      selectFeature(pickerId, idx, featureKey, skinMatch);
    });
    picker.appendChild(img);
  });
}

// On picker click
function selectFeature(pickerId, idx, featureKey, skinMatch=null) {
  if (!creationEnabled) return;
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
  } else if (featureKey === "face") {
    selected.face = idx;
  } else if (featureKey === "hair") {
    selected.hair = idx;
  }
  renderCharacter();
}

function getCurrentBodySkin() {
  return bodyOptions[selected.body]?.skin || "drk";
}

// Character rendering
function renderCharacter() {
  const canvas = document.getElementById("charCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let body = bodyOptions[selected.body];
  let skin = body?.skin || "drk";
  let faceOpts = faceOptions.filter(f => f.skin === skin);
  let face = faceOpts[selected.face];
  let hair = hairOptions[selected.hair];

  const layers = [body, face, hair];

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

// Physique form submit
document.getElementById("physiqueForm").addEventListener("submit", function(e) {
  e.preventDefault();
  document.getElementById("physiqueError").style.display = "none";
  document.getElementById("physiqueForm").style.display = "none";
  document.getElementById("physiqueApprovedMsg").style.display = "block";
  creationEnabled = true;

  // Show all picker options—only mass bodies
  createPickerImages(bodyOptions, "body-pickers", "body");
  let skin = getCurrentBodySkin();
  createPickerImages(faceOptions, "face-pickers", "face", skin);
  createPickerImages(hairOptions, "hair-pickers", "hair");

  document.getElementById("body-pickers").children[0].classList.add("selected");
  document.getElementById("face-pickers").children[0].classList.add("selected");
  document.getElementById("hair-pickers").children[0].classList.add("selected");
  selected = { body: 0, face: 0, hair: 0 };
  renderCharacter();
});

// Page initialize
document.addEventListener("DOMContentLoaded", () => {
  createPickerImages(bodyOptions, "body-pickers", "body");
  let skin = getCurrentBodySkin();
  createPickerImages(faceOptions, "face-pickers", "face", skin);
  createPickerImages(hairOptions, "hair-pickers", "hair");
  document.getElementById("body-pickers").children[0].classList.add("selected");
  document.getElementById("face-pickers").children[0].classList.add("selected");
  document.getElementById("hair-pickers").children[0].classList.add("selected");
  renderCharacter();
});
