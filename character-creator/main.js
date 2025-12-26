const BASE = "assets/";
const CHARACTER_CREATOR_BASE = "character-creator/assets/";

// --- BODY TYPE ROWS --- //
const bodyTypeRows = [
  {
    label: "Body Type (massive)",
    bodies: [
      { src: `${BASE}fbody-mass-pale.png`, thumb: `${BASE}fbody-mass-pale-tmb.png`, skin: "pale", type: "massive", enabled: true },
      { src: `${BASE}fbody-mass-med.png`,  thumb: `${BASE}fbody-mass-med-tmb.png`,  skin: "med",  type: "massive", enabled: true },
      { src: `${BASE}fbody-mass-drk.png`,  thumb: `${BASE}fbody-mass-drk-tmb.png`,  skin: "drk",  type: "massive", enabled: true }
    ]
  },
  {
    label: "Body Type (muscular)",
    bodies: [
      { src: "", thumb: `${BASE}placeholder-pale.png`, skin: "pale", type: "muscular", enabled: false, isPlaceholder: true },
      { src: `${BASE}hr-fbody-muscular.png`, thumb: `${CHARACTER_CREATOR_BASE}fbody-musc-drk-tmb.png`, skin: "med", type: "muscular_hr", enabled: true, isHighRes: true },
      { src: "", thumb: `${BASE}placeholder-drk.png`, skin: "drk", type: "muscular", enabled: false, isPlaceholder: true }
    ]
  },
  {
    label: "Body Type (thin)",
    bodies: [
      { src: "", thumb: `${BASE}placeholder-pale.png`, skin: "pale", type: "thin", enabled: false, isPlaceholder: true },
      { src: "", thumb: `${BASE}placeholder-med.png`,  skin: "med",  type: "thin", enabled: false, isPlaceholder: true },
      { src: "", thumb: `${BASE}placeholder-drk.png`,  skin: "drk",  type: "thin", enabled: false, isPlaceholder: true }
    ]
  }
];

const bodyOptions = bodyTypeRows.flatMap(row => row.bodies);

// --- FACE OPTIONS (unchanged from your original) ---
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

// --- HAIR OPTIONS ---
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
const WEAPONS_IMG = BASE + "kaidas-great-bow.png";
const ARMOR_IMG   = BASE + "set-epic-fur-mantle.png";
const HELMET_IMG  = BASE + "bear-skn-helmet.png";

// --- Default: pale mass body, first pale face, RANDOM hair style
let selected = {
  body: 0,
  face: faceOptions.findIndex(f => f.skin === "pale" && f.enabled),
  hair: Math.floor(Math.random() * hairOptions.length)
};
let physiqueScore = null;
let showWeapons = false;
let showArmor = false;
let showHelmet = false;

// --- BODY PICKER RENDERING, replaces use of createPickerImages for "body" --- //
function createBodyPickers() {
  const picker = document.getElementById("body-pickers");
  picker.innerHTML = "";
  let idxOffset = 0;
  bodyTypeRows.forEach(row => {
    // Section label
    const label = document.createElement("div");
    label.textContent = row.label;
    label.style.fontSize = "1.1em";
    label.style.fontWeight = "bold";
    label.style.margin = "12px 0 4px 0";
    picker.appendChild(label);

    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.gap = "12px";
    wrap.style.marginBottom = "6px";

    row.bodies.forEach((body, i) => {
      const outer = document.createElement("div");
      outer.style.display = "flex";
      outer.style.flexDirection = "column";
      outer.style.alignItems = "center";

      const img = document.createElement("img");
      img.src = body.thumb;
      img.style.width = "90px";
      img.style.height = "90px";
      img.style.border = (idxOffset + i === selected.body)
        ? "4px solid #ffbb00"
        : "3px solid #ddd";
      img.style.borderRadius = "12px";
      img.style.background = (idxOffset + i === selected.body)
        ? "#fffbe8"
        : "#fafafa";
      img.style.boxShadow = (idxOffset + i === selected.body)
        ? "0 0 24px #ffbc6c88"
        : "0 2px 12px #ccc9";
      img.style.opacity = body.enabled ? "1" : "0.3";
      img.style.cursor = body.enabled ? "pointer" : "default";
      img.addEventListener("click", function () {
        if (body.enabled) selectBody(idxOffset + i);
      });

      outer.appendChild(img);
      wrap.appendChild(outer);
    });

    picker.appendChild(wrap);
    idxOffset += row.bodies.length;
  });
}

function selectBody(idx) {
  selected.body = idx;
  let body = bodyOptions[selected.body];
  if (body.isHighRes) {
    selected.hair = 5;
    document.getElementById("face-row").style.display = "none";
  } else {
    let skin = body.skin;
    let faceOpts = faceOptions.filter(f => f.skin === skin);
    let firstEnabledFace = faceOpts.findIndex(f => f.enabled);
    selected.face = firstEnabledFace >= 0 ? faceOptions.indexOf(faceOpts[firstEnabledFace]) : 0;
    document.getElementById("face-row").style.display = "block";
  }
  createBodyPickers();
  createPickerImages(faceOptions, "face-pickers", "face", body.skin);
  createPickerImages(hairOptions, "hair-pickers", "hair");
  renderCharacter();
}

// --- Picker rendering (unchanged for face/hair) ---
function createPickerImages(options, pickerId, featureKey, skinMatch = null) {
  if (featureKey === "body") {
    createBodyPickers();
    return;
  }
  // ...rest unchanged...
  // (Paste your existing createPickerImages function here, minus the body block)
  // For brevity, not repeated here -- you already have it.
}

// --- Preview logic (unchanged) ---
// ... (same as your post) ...

// --- Picker logic (unchanged for face/hair) ---
// ... (same as your post) ...

// --- Character rendering (unchanged) ---
// ... (same as your post) ...

// --- Equipment checkbox logic ---
// ... (same as your post) ...

// --- DOMContentLoaded ---
// Replace this block:
document.addEventListener("DOMContentLoaded", () => {
  createBodyPickers();
  let skin = bodyOptions[selected.body].skin;
  createPickerImages(faceOptions.filter(f => f.skin === skin), "face-pickers", "face", skin);
  createPickerImages(hairOptions, "hair-pickers", "hair");
  document.getElementById("body-pickers").children[selected.body].classList.add("selected");
  if (!bodyOptions[selected.body]?.isHighRes) {
    document.getElementById("face-pickers").children[selected.face].classList.add("selected");
    document.getElementById("hair-pickers").children[selected.hair].classList.add("selected");
  } else {
    document.getElementById("hair-pickers").children[0].classList.add("selected");
    document.getElementById("face-row").style.display = "none";
  }
  renderCharacter();
});

// All other logic unchanged from your original post!
