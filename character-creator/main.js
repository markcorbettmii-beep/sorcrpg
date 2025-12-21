const BASE = "https://sorcrpg.com/character-creator/assets/";

const bodyOptions = [
  { src: `${BASE}fbody-type-massive.png`,  thumb: `${BASE}fbody-type-massive.png`,  label: "Massive"  },
  { src: `${BASE}fbody-type-muscular.png`, thumb: `${BASE}fbody-type-muscular.png`, label: "Muscular" },
  { src: `${BASE}fbody-type-lean.png`,     thumb: `${BASE}fbody-type-lean.png`,     label: "Lean"     },
  { src: `${BASE}fbody-type-thin.png`,     thumb: `${BASE}fbody-type-thin.png`,     label: "Thin"     }
];

const hairOptions = [
  { src: `${BASE}hair1-blck.png`, thumb: `${BASE}hair1-blck-tmb.png` },
  { src: `${BASE}hair1-red.png`,  thumb: `${BASE}hair1-red-tmb.png`  },
  { src: `${BASE}hair2-red.png`,  thumb: `${BASE}hair2-red-tmb.png`  },
  { src: `${BASE}hair3-blnd.png`, thumb: `${BASE}hair3-bond-tmb.png` },
  { src: `${BASE}hair4-blnd.png`, thumb: `${BASE}hair4-bond-tmb.png` }
];

const eyesOptions = [
  { src: `${BASE}eyes1-blu.png`,    thumb: `${BASE}eyes1-blu-tmb.png`   },
  { src: `${BASE}eyes1-brown.png`,  thumb: `${BASE}eyes1-brn-tmb.png`   },
  { src: `${BASE}eyes1-green.png`,  thumb: `${BASE}eyes1-green-tmb.png` },
  { src: `${BASE}eyes2-redbrn.png`, thumb: `${BASE}eyes2-redbrn-tmb.png`}
];

const faceOptions = [
  { src: `${BASE}femface-full.png`,  thumb: `${BASE}femface-full-tmb.png` },
  { src: `${BASE}femface-norm.png`,  thumb: `${BASE}femface-norm-tmb.png` },
  { src: `${BASE}placeholder-face1.png`, thumb: `${BASE}placeholder-face1.png` },
  { src: `${BASE}placeholder-face2.png`, thumb: `${BASE}placeholder-face2.png` }
];

let selected = { body: 0, hair: 0, eyes: 0, face: 0 };
let physiqueScore = null;
let allowedBodyIndices = [3]; // default to Thin

document.addEventListener("DOMContentLoaded", () => {
  initPickers();
  setBodyPickerEnabled(false);
  setOtherPickersEnabled(true);
  markDefaults();
  renderCharacter();
  setupFeatureZoom();
});

/* ---------- Physique Score Handling ---------- */
document.getElementById("physiqueForm").addEventListener("submit", e => {
  e.preventDefault();
  const val = parseInt(document.getElementById("physiqueInput").value, 10);
  if (isNaN(val)) {
    document.getElementById("physiqueError").style.display = "inline";
    return;
  }
  physiqueScore = val;
  document.getElementById("physiqueError").style.display = "none";
  document.getElementById("physiqueForm").style.display = "none";
  document.getElementById("physiqueApprovedMsg").style.display = "block";
  allowedBodyIndices = getAllowedBodyIndices(physiqueScore);
  setBodyPickerEnabled(true);
  updateBodyPickerDisabled();
});

function getAllowedBodyIndices(score) {
  if (score <= 1) return [3];                // Thin (index 3)
  if (score >= 2 && score <= 4) return [2];  // Lean (index 2)
  if (score >= 5 && score <= 20) return [1]; // Muscular (index 1)
  if (score > 20) return [0];                // Massive (index 0)
  return [3]; // fallback to Thin
}

/* ---------- Picker Creation ---------- */
function initPickers() {
  buildPicker(bodyOptions, "body-pickers", "body", false, true);
  buildPicker(hairOptions, "hair-pickers", "hair", true, false);
  buildPicker(eyesOptions, "eyes-pickers", "eyes", true, false);
  buildPicker(faceOptions, "face-pickers", "face", true, false);
}

function buildPicker(opts, pickerId, key, enabled, isBody) {
  const picker = document.getElementById(pickerId);
  picker.innerHTML = "";
  opts.forEach((opt, idx) => {
    const img = document.createElement("img");
    img.src  = opt.thumb;
    img.alt  = `${key}-${idx+1}`;
    img.style.pointerEvents = enabled ? "auto" : "none";
    img.style.opacity = enabled ? "1" : "0.5";
    img.dataset.idx = idx;
    if (isBody) img.dataset.bodyidx = idx;
    img.addEventListener("click", () => {
      if (img.style.pointerEvents === "auto" && (!isBody || allowedBodyIndices.includes(idx)))
        choose(pickerId, idx, key);
    });
    picker.appendChild(img);
  });
}

function setBodyPickerEnabled(flag) {
  const picker = document.getElementById("body-pickers");
  [...picker.children].forEach(img => {
    img.style.pointerEvents = flag ? "auto" : "none";
    img.style.opacity = flag ? "1" : "0.5";
  });
  updateBodyPickerDisabled();
}

function setOtherPickersEnabled(flag) {
  ["hair-pickers", "eyes-pickers", "face-pickers"].forEach(id => {
    const picker = document.getElementById(id);
    [...picker.children].forEach(img => {
      img.style.pointerEvents = flag ? "auto" : "none";
      img.style.opacity = flag ? "1" : "0.5";
    });
  });
  document.getElementById("showJpegBtn").disabled = !flag;
  document.getElementById("randomBtn").disabled   = !flag;
}

/* ---------- Restrict Body Types by Physique ---------- */
function updateBodyPickerDisabled() {
  const picker = document.getElementById("body-pickers");
  [...picker.children].forEach((img, idx) => {
    if (physiqueScore === null) {
      img.style.pointerEvents = "none";
      img.style.opacity = "0.5";
    } else if (allowedBodyIndices.includes(idx)) {
      img.style.pointerEvents = "auto";
      img.style.opacity = "1";
    } else {
      img.style.pointerEvents = "none";
      img.style.opacity = "0.25";
    }
  });
}

/* ---------- Selection ---------- */
function choose(pickerId, idx, key) {
  if (key === "body" && physiqueScore === null) return;
  if (key === "body" && !allowedBodyIndices.includes(idx)) return;
  const picker = document.getElementById(pickerId);
  [...picker.children].forEach(img => img.classList.remove("selected"));
  if (picker.children[idx]) {
    picker.children[idx].classList.add("selected");
    selected[key] = idx;
    renderCharacter();
  }
}

/* ---------- Rendering ---------- */
function renderCharacter() {
  const canvas = document.getElementById("charCanvas");
  const ctx    = canvas.getContext("2d");
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // White background for eyes
  ctx.fillStyle = "#fff";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  const layers = [
    bodyOptions[selected.body],
    faceOptions[selected.face],
    eyesOptions[selected.eyes],
    hairOptions[selected.hair]
  ];

  let loaded = 0, imgs = [];
  layers.forEach((opt,i)=>{
    if (!opt) { loaded++; return; }
    const im = new Image();
    imgs[i]  = null;
    im.src   = opt.src;
    im.onload  = ()=>{ imgs[i]=im; if(++loaded===layers.length) draw(); };
    im.onerror = ()=>{ if(++loaded===layers.length) draw();              };
  });

  function draw() {
    imgs.forEach(im => { if (im) ctx.drawImage(im, 0, 0, canvas.width, canvas.height); });
  }
}

/* ---------- Defaults ---------- */
function markDefaults() {
  ["body-pickers","hair-pickers","eyes-pickers","face-pickers"].forEach(id=>{
    const p=document.getElementById(id);
    if (p.children.length) p.children[0].classList.add("selected");
  });
}

/* ---------- Random ---------- */
document.getElementById("randomBtn").addEventListener("click", () => {
  // Body type: choose only among allowed indices
  const allowed = allowedBodyIndices;
  selected.body = allowed[Math.floor(Math.random()*allowed.length)];
  selected.hair = rand(hairOptions.length);
  selected.eyes = rand(eyesOptions.length);
  selected.face = rand(faceOptions.length);

  [
    { id:"body-pickers", i:selected.body },
    { id:"hair-pickers", i:selected.hair },
    { id:"eyes-pickers", i:selected.eyes },
    { id:"face-pickers", i:selected.face }
  ].forEach(({id,i})=>{
    const p=document.getElementById(id);
    [...p.children].forEach(img=>img.classList.remove("selected"));
    if (p.children[i]) p.children[i].classList.add("selected");
  });

  renderCharacter();
});
function rand(max){ return Math.floor(Math.random()*max); }

/* ---------- JPEG Export ---------- */
// JPEG preview uses canvas (so it shows all features), but overlays "feature coming soon" message.
document.getElementById("showJpegBtn").addEventListener("click",()=>{
  const canvas=document.getElementById("charCanvas");
  const jpg=document.getElementById("jpegPreview");
  // Create a temporary canvas for overlay
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.drawImage(canvas, 0, 0);
  // Overlay "feature coming soon"
  tempCtx.font = "bold 48px sans-serif";
  tempCtx.fillStyle = "#c55";
  tempCtx.textAlign = "center";
  tempCtx.globalAlpha = 0.8;
  tempCtx.fillText("Feature coming soon", tempCanvas.width/2, tempCanvas.height/2 + 100);

  jpg.src = tempCanvas.toDataURL("image/jpeg");
  jpg.style.display      = "block";
  document.getElementById("saveInstr").style.display = "block";
  canvas.style.display   = "none";
  document.getElementById("editingButtons").style.display = "none";
  document.getElementById("jpegButtons").style.display = "block";
});

document.getElementById("backBtn").addEventListener("click",()=>{
  document.getElementById("jpegPreview").style.display = "none";
  document.getElementById("saveInstr").style.display   = "none";
  document.getElementById("charCanvas").style.display  = "block";
  document.getElementById("editingButtons").style.display = "block";
  document.getElementById("jpegButtons").style.display = "none";
});

/* ---------- Feature Zoom Pop-Out (for pickers, not savable) ---------- */
function setupFeatureZoom() {
  const zoomPopup = document.getElementById("featureZoomPopup");
  const zoomImg   = document.getElementById("featureZoomImg");

  function showFeatureZoom(src) {
    zoomImg.src = src;
    zoomPopup.style.display = "flex";
  }
  function hideFeatureZoom() {
    zoomPopup.style.display = "none";
  }

  // For hair, eyes, face pickers: show zoom of the thumbnail held down
  ["hair-pickers","eyes-pickers","face-pickers"].forEach(id => {
    const picker = document.getElementById(id);
    // mousedown/touchstart on the actual image
    picker.addEventListener("mousedown", e => {
      if (e.target.tagName === "IMG") showFeatureZoom(e.target.src);
    });
    picker.addEventListener("touchstart", e => {
      if (e.target.tagName === "IMG") showFeatureZoom(e.target.src);
    });
    picker.addEventListener("mouseup", hideFeatureZoom);
    picker.addEventListener("mouseleave", hideFeatureZoom);
    picker.addEventListener("touchend", hideFeatureZoom);
    picker.addEventListener("touchcancel", hideFeatureZoom);
  });

  zoomPopup.addEventListener("touchmove", function(e){e.preventDefault();}, {passive:false});
}
