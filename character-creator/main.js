const BASE = "assets/";

// --- BODY OPTIONS (with skin tone property for matching) ---
const bodyOptions = [
  { src: `${BASE}fbody-mass-drk.png`, thumb: `${BASE}fbody-mass-drk-tmb.png`, skin: "dark", type: "massive" },
  { src: `${BASE}fbody-mass-med.png`, thumb: `${BASE}fbody-mass-med-tmb.png`, skin: "med", type: "massive" },
  { src: `${BASE}fbody-mass-pale.png`, thumb: `${BASE}fbody-mass-pale-tmb.png`, skin: "pale", type: "massive" },
  { src: `${BASE}fbody-musc-drk.png`, thumb: `${BASE}fbody-musc-drk-tmb.png`, skin: "dark", type: "muscular" },
  { src: `${BASE}fbody-musc-med.png`, thumb: `${BASE}fbody-musc-med-tmb.png`, skin: "med", type: "muscular" },
  { src: `${BASE}fbody-musc-pale.png`, thumb: `${BASE}fbody-musc-pale-tmb.png`, skin: "pale", type: "muscular" },
  { src: `${BASE}fbody-thin-drk.png`, thumb: `${BASE}fbody-thin-drk-tmb.png`, skin: "dark", type: "thin" },
  { src: `${BASE}fbody-thin-med.png`, thumb: `${BASE}fbody-thin-med-tmb.png`, skin: "med", type: "thin" },
  { src: `${BASE}fbody-thin-pale.png`, thumb: `${BASE}fbody-thin-pale-tmb.png`, skin: "pale", type: "thin" }
];

// --- FACE OPTIONS (with skin tone property for matching) ---
const faceOptions = [
  // Dark
  { src: `${BASE}femface1-dark-blu.png`, thumb: `${BASE}femface1-dark-blu-tmb.png`, skin: "dark", eyes: "blu" },
  { src: `${BASE}femface1-dark-hzl.png`, thumb: `${BASE}femface1-dark-hzl-tmb.png`, skin: "dark", eyes: "hzl" },
  { src: `${BASE}femface2-dark-brn.png`, thumb: `${BASE}femface2-dark-brn-tmb.png`, skin: "dark", eyes: "brn" },
  { src: `${BASE}femface2-dark-blu.png`, thumb: `${BASE}femface2-dark-blu-tmb.png`, skin: "dark", eyes: "blu" },

  // Medium
  { src: `${BASE}femface1-med-brn.png`, thumb: `${BASE}femface1-med-brn-tmb.png`, skin: "med", eyes: "brn" },
  { src: `${BASE}femface1-med-hzl.png`, thumb: `${BASE}femface1-med-hzl-tmb.png`, skin: "med", eyes: "hzl" },
  { src: `${BASE}femface1-med-grn.png`, thumb: `${BASE}femface1-med-grn-tmb.png`, skin: "med", eyes: "grn" },
  { src: `${BASE}femface2-med-brn.png`, thumb: `${BASE}femface2-med-brn-tmb.png`, skin: "med", eyes: "brn" },
  { src: `${BASE}femface2-med-blu.png`, thumb: `${BASE}femface2-med-blu-tmb.png`, skin: "med", eyes: "blu" },
  { src: `${BASE}femface2-med-grn.png`, thumb: `${BASE}femface2-med-grn-tmb.png`, skin: "med", eyes: "grn" },
  { src: `${BASE}femface3-med-brn.png`, thumb: `${BASE}femface3-med-brn-tmb.png`, skin: "med", eyes: "brn" },

  // Pale
  { src: `${BASE}femface1-pale-hzl.png`, thumb: `${BASE}femface1-pale-hzl-tmb.png`, skin: "pale", eyes: "hzl" },
  { src: `${BASE}femface1-pale-brn.png`, thumb: `${BASE}femface1-pale-brn-tmb.png`, skin: "pale", eyes: "brn" },
  { src: `${BASE}femface1-pale-vio.png`, thumb: `${BASE}femface1-pale-vio-tmb.png`, skin: "pale", eyes: "vio" },
  { src: `${BASE}femface2-pale-brn.png`, thumb: `${BASE}femface2-pale-brn-tmb.png`, skin: "pale", eyes: "brn" },
  { src: `${BASE}femface2-pale-blu.png`, thumb: `${BASE}femface2-pale-blu-tmb.png`, skin: "pale", eyes: "blu" },
  { src: `${BASE}femface2-pale-grn.png`, thumb: `${BASE}femface2-pale-grn-tmb.png`, skin: "pale", eyes: "grn" },
  { src: `${BASE}femface4-pale-brn-mkup.png`, thumb: `${BASE}femface4-pale-brn-mkup-tmb.png`, skin: "pale", eyes: "brn" },
  { src: `${BASE}femface5-pale-blu-mkup.png`, thumb: `${BASE}femface5-pale-blu-mkup-tmb.png`, skin: "pale", eyes: "blu" }
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

// --- PHYSIQUE SCORE FILTERING ---
function getAvailableBodyIndexes(score) {
  if (score <= 1) return bodyOptions.filter(b => b.type === "thin");
  if (score <= 4) return bodyOptions.filter(b => b.type === "thin");
  if (score <= 20) return bodyOptions.filter(b => b.type === "muscular");
  return bodyOptions.filter(b => b.type === "massive");
}

// --- PICKER RENDERING, SKIN MATCHING ---
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
    img.onerror = function() {
      img.src = `${BASE}placeholder.png`;
      img.style.opacity = "0.4";
      img.title = "Image not found";
    };
    img.style.pointerEvents = "auto";
    img.style.opacity = "1";
    img.addEventListener('click', function () {
      selectFeature(pickerId, idx, featureKey, skinMatch);
    });
    picker.appendChild(img);
  });
}

// --- FEATURE SELECTION WITH SKIN TONE LOCK ---
let selected = { body: 0, face: 0, hair: 0 };
let physiqueScore = null;

function selectFeature(pickerId, idx, featureKey, skinMatch=null) {
  const picker = document.getElementById(pickerId);
  Array.from(picker.children).forEach(img => img.classList.remove("selected"));
  if (picker.children[idx]) {
    picker.children[idx].classList.add("selected");
    if (featureKey === "body") {
      selected.body = idx;
      // When body changes, reset face picker to matching skin tone
      const skin = getCurrentBodySkin();
      createPickerImages(faceOptions, "face-pickers", "face", skin);
      selected.face = 0; // Default to first matching face
    } else if (featureKey === "face") {
      selected.face = idx;
    } else if (featureKey === "hair") {
      selected.hair = idx;
    }
    renderCharacter();
  }
}

function getCurrentBodySkin() {
  // Find skin from currently selected body option (filtered by Physique Score)
  let bodyOpts = getAvailableBodyIndexes(physiqueScore);
  return bodyOpts[selected.body]?.skin || "med";
}

// --- CHARACTER RENDERING ---
function renderCharacter() {
  const canvas = document.getElementById("charCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let bodyOpts = getAvailableBodyIndexes(physiqueScore);
  let body = bodyOpts[selected.body];
  let skin = body?.skin || "med";
  let faceOpts = faceOptions.filter(f => f.skin === skin);
  let face = faceOpts[selected.face];
  let hair = hairOptions[selected.hair];

  // If body image failed, nothing else should be drawn
  if (!body) return;

  const layers = [body, face, hair];

  let loaded = 0, imgs = [];
  layers.forEach((opt, i) => {
    if (!opt) { loaded++; return; }
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

// --- RANDOMIZER (matching skin tone!) ---
document.getElementById("randomBtn").addEventListener("click", function () {
  if (!physiqueScore) return;
  let bodyOpts = getAvailableBodyIndexes(physiqueScore);
  selected.body = Math.floor(Math.random() * bodyOpts.length);
  let skin = bodyOpts[selected.body].skin;
  let faceOpts = faceOptions.filter(f => f.skin === skin);
  selected.face = Math.floor(Math.random() * faceOpts.length);
  selected.hair = Math.floor(Math.random() * hairOptions.length);

  createPickerImages(bodyOpts, "body-pickers", "body");
  createPickerImages(faceOpts, "face-pickers", "face", skin);
  createPickerImages(hairOptions, "hair-pickers", "hair");

  // Mark selection
  document.getElementById("body-pickers").children[selected.body].classList.add("selected");
  document.getElementById("face-pickers").children[selected.face].classList.add("selected");
  document.getElementById("hair-pickers").children[selected.hair].classList.add("selected");

  renderCharacter();
});

// --- PHYSIQUE FORM SUBMIT ---
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
  setPickersEnabled(true);

  // Rebuild pickers to show only allowed bodies and matched faces
  let bodyOpts = getAvailableBodyIndexes(physiqueScore);
  createPickerImages(bodyOpts, "body-pickers", "body");
  let skin = bodyOpts[0].skin;
  createPickerImages(faceOptions.filter(f => f.skin === skin), "face-pickers", "face", skin);
  createPickerImages(hairOptions, "hair-pickers", "hair");

  // Mark defaults
  document.getElementById("body-pickers").children[0].classList.add("selected");
  document.getElementById("face-pickers").children[0].classList.add("selected");
  document.getElementById("hair-pickers").children[0].classList.add("selected");
  selected = { body: 0, face: 0, hair: 0 };
  renderCharacter();
});

// --- INITIALIZE ---
document.addEventListener("DOMContentLoaded", () => {
  let bodyOpts = getAvailableBodyIndexes(99); // default to all massive
  createPickerImages(bodyOpts, "body-pickers", "body");
  let skin = bodyOpts[0].skin;
  createPickerImages(faceOptions.filter(f => f.skin === skin), "face-pickers", "face", skin);
  createPickerImages(hairOptions, "hair-pickers", "hair");
  setPickersEnabled(false);
  document.getElementById("body-pickers").children[0].classList.add("selected");
  document.getElementById("face-pickers").children[0].classList.add("selected");
  document.getElementById("hair-pickers").children[0].classList.add("selected");
  renderCharacter();
});

// --- ENABLE/DISABLE LOGIC ---
function setPickersEnabled(flag) {
  ["body-pickers", "face-pickers", "hair-pickers"].forEach(id => {
    const picker = document.getElementById(id);
    Array.from(picker.children).forEach(img => {
      img.style.pointerEvents = flag ? "auto" : "none";
      img.style.opacity = flag ? "1" : "0.5";
    });
  });
  document.getElementById("showJpegBtn").disabled = !flag;
  document.getElementById("randomBtn").disabled = !flag;
  document.getElementById("equipArmorBtn").disabled = !flag;
  document.getElementById("showHelmetChk").disabled = !flag;
  document.getElementById("showWeaponsChk").disabled = !flag;
}
