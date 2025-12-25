const BASE = "https://sorcrpg.com/character-creator/assets/";

/* ---------- IMAGE LISTS ---------- */
const bodyOptions = [
  { src: `${BASE}fbody-type-massive.png`,  thumb: `${BASE}fbody-type-massive.png` },
  { src: `${BASE}fbody-type-muscular.png`, thumb: `${BASE}fbody-type-muscular.png` },
  { src: `${BASE}fbody-type-lean.png`,     thumb: `${BASE}fbody-type-lean.png` },
  { src: `${BASE}fbody-type-thin.png`,     thumb: `${BASE}fbody-type-thin.png` }
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

/* ---------- STATE ---------- */
let selected = { body: 0, hair: 0, eyes: 0, face: 0 };
let physiqueScore = null;

/* ---------- INIT ---------- */
document.addEventListener("DOMContentLoaded", () => {
  initPickers();
  setPickersEnabled(false);
  markDefaults();
  renderCharacter();
});

/* ---------- Physique Score Handling ---------- */
document.getElementById("physiqueForm").addEventListener("submit", e => {
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
});

/* ---------- Picker Creation with Hold-to-Zoom ---------- */
function initPickers() {
  createPickerImages(bodyOptions, "body-pickers", "body");
  createPickerImages(hairOptions, "hair-pickers", "hair");
  createPickerImages(eyesOptions, "eyes-pickers", "eyes");
  createPickerImages(faceOptions, "face-pickers", "face");
}

function createPickerImages(options, pickerId, featureKey) {
  const picker = document.getElementById(pickerId);
  picker.innerHTML = "";

  options.forEach((option, idx) => {
    const img = document.createElement('img');
    img.src = option.thumb;
    img.alt = `${featureKey} ${idx + 1}`;
    img.style.pointerEvents = "none";
    img.style.opacity = "0.5";
    img.addEventListener('click', function () {
      if (img.style.pointerEvents === "auto") selectFeature(pickerId, idx, featureKey);
    });

    // --- Hold-to-zoom logic ---
    let zoomTimer = null;
    let zoomed = false;

    const zoomIn = () => {
      zoomed = true;
      img.classList.add("thumb-zoomed");
    };
    const zoomOut = () => {
      zoomed = false;
      img.classList.remove("thumb-zoomed");
      if (zoomTimer) clearTimeout(zoomTimer);
      zoomTimer = null;
    };

    img.addEventListener('mousedown', (e) => {
      if (img.style.pointerEvents !== "auto") return;
      zoomTimer = setTimeout(zoomIn, 1500);
    });
    img.addEventListener('touchstart', (e) => {
      if (img.style.pointerEvents !== "auto") return;
      zoomTimer = setTimeout(zoomIn, 1500);
    });

    ["mouseup", "mouseleave", "touchend", "touchcancel", "mousemove"].forEach(ev => {
      img.addEventListener(ev, zoomOut);
    });

    picker.appendChild(img);
  });
}

/* ---------- Enable / Disable ---------- */
function setPickersEnabled(flag) {
  ["body-pickers","hair-pickers","eyes-pickers","face-pickers"].forEach(id=>{
    const picker=document.getElementById(id);
    [...picker.children].forEach(img=>{
      img.style.pointerEvents= flag?"auto":"none";
      img.style.opacity      = flag?"1":"0.5";
    });
  });
  document.getElementById("showJpegBtn").disabled = !flag;
  document.getElementById("randomBtn").disabled   = !flag;
}

/* ---------- Selection ---------- */
function selectFeature(pickerId, idx, featureKey) {
  const picker=document.getElementById(pickerId);
  [...picker.children].forEach(img=>img.classList.remove("selected"));
  if (picker.children[idx]) {
    picker.children[idx].classList.add("selected");
    selected[featureKey] = idx;
    renderCharacter();
  }
}

/* ---------- Rendering ---------- */
function renderCharacter() {
  const canvas = document.getElementById("charCanvas");
  const ctx    = canvas.getContext("2d");
  ctx.clearRect(0,0,canvas.width,canvas.height);

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
    im.onerror = ()=>{ if(++loaded===layers.length) draw(); };
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
  if (!physiqueScore) return;

  selected.body = rand(bodyOptions.length);
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
document.getElementById("showJpegBtn").addEventListener("click",()=>{
  const canvas=document.getElementById("charCanvas");
  const jpg=document.getElementById("jpegPreview");
  jpg.src = canvas.toDataURL("image/jpeg");

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
