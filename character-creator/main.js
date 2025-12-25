const BASE = "assets/";

// --- BODY OPTIONS (only massive, others are placeholders) ---
const bodyOptions = [
  // Massive - functional
  { src: `${BASE}fbody-mass-drk.png`, thumb: `${BASE}fbody-mass-drk-tmb.png`, skin: "drk", type: "massive", enabled: true },
  { src: `${BASE}fbody-mass-med.png`, thumb: `${BASE}fbody-mass-med-tmb.png`, skin: "med", type: "massive", enabled: true },
  { src: `${BASE}fbody-mass-pale.png`, thumb: `${BASE}fbody-mass-pale-tmb.png`, skin: "pale", type: "massive", enabled: true },
  // Thin & muscular placeholders (not selectable)
  { src: null, thumb: `${BASE}fbody-thin-drk-tmb.png`, skin: "drk", type: "thin", enabled: false },
  { src: null, thumb: `${BASE}fbody-thin-med-tmb.png`, skin: "med", type: "thin", enabled: false },
  { src: null, thumb: `${BASE}fbody-thin-pale-tmb.png`, skin: "pale", type: "thin", enabled: false },
  { src: null, thumb: `${BASE}fbody-musc-drk-tmb.png`, skin: "drk", type: "muscular", enabled: false },
  { src: null, thumb: `${BASE}fbody-musc-med-tmb.png`, skin: "med", type: "muscular", enabled: false },
  { src: null, thumb: `${BASE}fbody-musc-pale-tmb.png`, skin: "pale", type: "muscular", enabled: false }
];

// --- FACE OPTIONS (all faces, but only show faces matching selected body tone) ---
const faceOptions = [
  // Dark mass faces (add all you have!)
  { src: `${BASE}femface1-dark-blu.png`, thumb: `${BASE}femface1-dark-blu-tmb.png`, skin: "drk" },
  { src: `${BASE}femface1-dark-hzl.png`, thumb: `${BASE}femface1-dark-hzl-tmb.png`, skin: "drk" },
  { src: `${BASE}femface2-dark-brn.png`, thumb: `${BASE}femface2-dark-brn-tmb.png`, skin: "drk" },
  { src: `${BASE}femface2-dark-blu.png`, thumb: `${BASE}femface2-dark-blu-tmb.png`, skin: "drk" },
  // Add more for drk...
  // Medium mass faces
  { src: `${BASE}femface1-med-brn.png`, thumb: `${BASE}femface1-med-brn-tmb.png`, skin: "med" },
  { src: `${BASE}femface1-med-hzl.png`, thumb: `${BASE}femface1-med-hzl-tmb.png`, skin: "med" },
  { src: `${BASE}femface1-med-grn.png`, thumb: `${BASE}femface1-med-grn-tmb.png`, skin: "med" },
  { src: `${BASE}femface2-med-brn.png`, thumb: `${BASE}femface2-med-brn-tmb.png`, skin: "med" },
  { src: `${BASE}femface2-med-blu.png`, thumb: `${BASE}femface2-med-blu-tmb.png`, skin: "med" },
  { src: `${BASE}femface2-med-grn.png`, thumb: `${BASE}femface2-med-grn-tmb.png`, skin: "med" },
  { src: `${BASE}femface3-med-brn.png`, thumb: `${BASE}femface3-med-brn-tmb.png`, skin: "med" },
  // Add more for med...
  // Pale mass faces
  { src: `${BASE}femface1-pale-hzl.png`, thumb: `${BASE}femface1-pale-hzl-tmb.png`, skin: "pale" },
  { src: `${BASE}femface1-pale-brn.png`, thumb: `${BASE}femface1-pale-brn-tmb.png`, skin: "pale" },
  { src: `${BASE}femface1-pale-vio.png`, thumb: `${BASE}femface1-pale-vio-tmb.png`, skin: "pale" },
  { src: `${BASE}femface2-pale-brn.png`, thumb: `${BASE}femface2-pale-brn-tmb.png`, skin: "pale" },
  { src: `${BASE}femface2-pale-blu.png`, thumb: `${BASE}femface2-pale-blu-tmb.png`, skin: "pale" },
  { src: `${BASE}femface2-pale-grn.png`, thumb: `${BASE}femface2-pale-grn-tmb.png`, skin: "pale" },
  { src: `${BASE}femface4-pale-brn-mkup.png`, thumb: `${BASE}femface4-pale-brn-mkup-tmb.png`, skin: "pale" },
  { src: `${BASE}femface5-pale-blu-mkup.png`, thumb: `${BASE}femface5-pale-blu-mkup-tmb.png`, skin: "pale" }
  // Add more for pale...
];

// --- HAIR OPTIONS (all functional!) ---
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

// Only show the real "massive" body types as selectable
function getAvailableBodyIndexes() {
  return bodyOptions.filter(b => b.type === "massive" && b.enabled);
}

// --- Picker Rendering, with disabled for placeholders ---
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
    img.style.pointerEvents = option.enabled === false ? "none" : "auto";
    img.style.opacity = option.enabled === false ? "0.4" : "1";
    if (option.enabled !== false) {
      img.addEventListener('click', function () {
        selectFeature(pickerId, idx, featureKey, skinMatch);
      });
    }
    picker.appendChild(img);
  });
}

// --- FEATURE SELECTION, only for enabled options ---
let selected = { body: 0, face: 0, hair: 0 };

function selectFeature(pickerId, idx, featureKey, skinMatch=null) {
  const picker = document.getElementById(pickerId);
  const img = picker.children[idx];
  if (img.style.pointerEvents === "none") return;

  Array.from(picker.children).forEach(img => img.classList.remove("selected"));
  if (img) {
    img.classList.add("selected");
    if (featureKey === "body") {
      selected.body = idx;
      // When body changes, reset face picker to matching skin tone
      const skin = getCurrentBodySkin();
      createPickerImages(faceOptions, "face-pickers", "face", skin);
      selected.face = 0;
    } else if (featureKey === "face") {
      selected.face = idx;
    } else if (featureKey === "hair") {
      selected.hair = idx;
    }
    renderCharacter();
  }
}

function getCurrentBodySkin() {
  // Only massive, enabled bodies
  let bodyOpts = getAvailableBodyIndexes();
  return bodyOpts[selected.body]?.skin || "med";
}

// --- CHARACTER RENDERING ---
function renderCharacter() {
  const canvas = document.getElementById("charCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let bodyOpts = getAvailableBodyIndexes();
  let body = bodyOpts[selected.body];
  let skin = body?.skin || "med";
  let faceOpts = faceOptions.filter(f => f.skin === skin);
  let face = faceOpts[selected.face];
  let hair = hairOptions[selected.hair];

  // Only draw if body exists (should always be for enabled only)
  if (!body) return;

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

// --- RANDOMIZER ---
document.getElementById("randomBtn").addEventListener("click", function () {
  let bodyOpts = getAvailableBodyIndexes();
  selected.body = Math.floor(Math.random() * bodyOpts.length);
  let skin = bodyOpts[selected.body].skin;
  let faceOpts = faceOptions.filter(f => f.skin === skin);
  selected.face = Math.floor(Math.random() * faceOpts.length);
  selected.hair = Math.floor(Math.random() * hairOptions.length);

  createPickerImages(bodyOptions, "body-pickers", "body"); // Show all, only mass enabled
  createPickerImages(faceOpts, "face-pickers", "face", skin);
  createPickerImages(hairOptions, "hair-pickers", "hair");

  document.getElementById("body-pickers").children[selected.body].classList.add("selected");
  document.getElementById("face-pickers").children[selected.face].classList.add("selected");
  document.getElementById("hair-pickers").children[selected.hair].classList.add("selected");

  renderCharacter();
});

// --- PHYSIQUE FORM SUBMIT (no effect except enabling pickers) ---
document.getElementById("physiqueForm").addEventListener("submit", function(e) {
  e.preventDefault();
  document.getElementById("physiqueError").style.display = "none";
  document.getElementById("physiqueForm").style.display = "none";
  document.getElementById("physiqueApprovedMsg").style.display = "block";
  setPickersEnabled(true);

  // Build pickers
  createPickerImages(bodyOptions, "body-pickers", "body");
  let skin = getCurrentBodySkin();
  createPickerImages(faceOptions.filter(f => f.skin === skin), "face-pickers", "face", skin);
  createPickerImages(hairOptions, "hair-pickers", "hair");

  document.getElementById("body-pickers").children[0].classList.add("selected");
  document.getElementById("face-pickers").children[0].classList.add("selected");
  document.getElementById("hair-pickers").children[0].classList.add("selected");
  selected = { body: 0, face: 0, hair: 0 };
  renderCharacter();
});

// --- INITIALIZE ---
document.addEventListener("DOMContentLoaded", () => {
  createPickerImages(bodyOptions, "body-pickers", "body");
  let skin = getCurrentBodySkin();
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
    Array.from(picker.children).forEach((img, i) => {
      // Only enable if not placeholder
      const option = bodyOptions[i] || {};
      img.style.pointerEvents = (flag && option.enabled !== false) ? "auto" : "none";
      img.style.opacity = (flag && option.enabled !== false) ? "1" : "0.4";
    });
  });
  document.getElementById("showJpegBtn").disabled = !flag;
  document.getElementById("randomBtn").disabled = !flag;
  document.getElementById("equipArmorBtn").disabled = !flag;
  document.getElementById("showHelmetChk").disabled = !flag;
  document.getElementById("showWeaponsChk").disabled = !flag;
}
