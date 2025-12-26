/* ==========================================================
 * FULL main.js  (drop-in replacement)
 * ==========================================================
 */

const BASE      = "assets/";
const CC_BASE   = "character-creator/assets/";   // sub-folder that holds your new images

/* ----------------------------------------------------------
   1.  PERMANENT CANVAS BACKGROUND  (always bottom layer)
---------------------------------------------------------- */
const BG_LAYER = { src: `${CC_BASE}highres-canvas-bg.png` };

/* ----------------------------------------------------------
   2.  BODY OPTIONS  (3 MASS + 1 new HR demo)
---------------------------------------------------------- */
const bodyOptions = [
  { src: `${BASE}fbody-mass-drk.png`,  thumb: `${BASE}fbody-mass-drk-tmb.png`,  skin: "drk",  type: "massive",  enabled: true },
  { src: `${BASE}fbody-mass-med.png`,  thumb: `${BASE}fbody-mass-med-tmb.png`,  skin: "med",  type: "massive",  enabled: true },
  { src: `${BASE}fbody-mass-pale.png`, thumb: `${BASE}fbody-mass-pale-tmb.png`, skin: "pale", type: "massive",  enabled: true },
  {
    src  : `${BASE}hr-fbody-muscular.png`,                 // <-- high-res body used on canvas
    thumb: `${CC_BASE}fbody-musc-drk-tmb.png`,             // <-- thumb you requested
    skin : "hr",
    type : "muscular_hr",
    enabled : true,
    isHighRes: true
  }
];

/* ----------------------------------------------------------
   3.  FACE OPTIONS  (exact original list, unchanged)
---------------------------------------------------------- */
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
  { src: `${BASE}femface1-pale-hzl.png`, thumb: `${BASE}femface1-pale-hzl-tmb.png`, skin: "pale", eyes: "hzl", enabled: true },
  { src: `${BASE}femface1-pale-brn.png`, thumb: `${BASE}femface1-pale-brn-tmb.png`, skin: "pale", eyes: "brn", enabled: false },
  { src: `${BASE}femface1-pale-vio.png`, thumb: `${BASE}femface1-pale-vio-tmb.png`, skin: "pale", eyes: "vio", enabled: false },
  { src: `${BASE}femface2-pale-brn.png`, thumb: `${BASE}femface2-pale-brn-tmb.png`, skin: "pale", eyes: "brn", enabled: false },
  { src: `${BASE}femface2-pale-blu.png`, thumb: `${BASE}femface2-pale-blu-tmb.png`, skin: "pale", eyes: "blu", enabled: false }
];

/* ----------------------------------------------------------
   4.  HAIR OPTIONS  (exact original list, unchanged)
---------------------------------------------------------- */
const hairOptions = [
  { src: `${BASE}femhair1.png`,  thumb: `${BASE}femhair1-tmb.png`,  enabled: true },
  { src: `${BASE}femhair2.png`,  thumb: `${BASE}femhair2-tmb.png`,  enabled: true },
  { src: `${BASE}femhair3.png`,  thumb: `${BASE}femhair3-tmb.png`,  enabled: true },
  { src: `${BASE}femhair4.png`,  thumb: `${BASE}femhair4-tmb.png`,  enabled: true },
  { src: `${BASE}femhair5.png`,  thumb: `${BASE}femhair5-tmb.png`,  enabled: true },
  { src: `${BASE}femhair6.png`,  thumb: `${BASE}femhair6-tmb.png`,  enabled: true }, // <- only one allowed for HR
  { src: `${BASE}femhair7.png`,  thumb: `${BASE}femhair7-tmb.png`,  enabled: true },
  { src: `${BASE}femhair8.png`,  thumb: `${BASE}femhair8-tmb.png`,  enabled: true },
  { src: `${BASE}femhair9.png`,  thumb: `${BASE}femhair9-tmb.png`,  enabled: true },
  { src: `${BASE}femhair10.png`, thumb: `${BASE}femhair10-tmb.png`, enabled: true },
  { src: `${BASE}femhair11.png`, thumb: `${BASE}femhair11-tmb.png`, enabled: true },
  { src: `${BASE}femhair12.png`, thumb: `${BASE}femhair12-tmb.png`, enabled: true }
];

/* ----------------------------------------------------------
   5.  EQUIPMENT ART  (unchanged)
---------------------------------------------------------- */
const WEAPONS_IMG = BASE + "kaidas-great-bow.png";
const ARMOR_IMG   = BASE + "set-epic-fur-mantle.png";
const HELMET_IMG  = BASE + "bear-skn-helmet.png";

/* ----------------------------------------------------------
   6.  DEFAULT SELECTIONS – show HR body on first load
---------------------------------------------------------- */
let selected = {
  body : bodyOptions.findIndex(b => b.isHighRes),   // HR body index
  face : 0,    // ignored for HR, but needs a value
  hair : 5     // hair #6  (index 5)
};

let showWeapons = false;
let showArmor   = false;
let showHelmet  = false;

/* ==========================================================
   PICKER RENDERING
========================================================== */
function createPickerImages(options, pickerId, featureKey, skinMatch = null)
{
  const picker = document.getElementById(pickerId);
  picker.innerHTML = "";

  // Filter faces by skin if needed
  let opts = options;
  if (featureKey === "face" && skinMatch) {
    opts = options.filter(o => o.skin === skinMatch);
  }

  // Restrictors when HR body is selected
  const HR = bodyOptions[selected.body]?.isHighRes;
  if (HR) {
    if (featureKey === "hair") {
      // Only hair #6 enabled for HR
      opts = hairOptions.map((opt, idx) => ({ ...opt, enabled: idx === 5 }));
    }
    if (featureKey === "face") {
      picker.style.display = "none";  // faces not allowed for HR
      return;
    }
  } else if (featureKey === "face") {
    picker.style.display = "block";
  }

  opts.forEach((opt, idx) => {
    const wrap = document.createElement("div");
    wrap.style.display = "inline-block";
    wrap.style.textAlign = "center";
    wrap.style.margin = "0 4px";

    // Add "high res demo" text above HR body thumb
    if (featureKey === "body" && opt.isHighRes) {
      const txt = document.createElement("div");
      txt.textContent = "high res demo";
      txt.style.font = "bold 1em sans-serif";
      txt.style.color = "#447";
      txt.style.marginBottom = "4px";
      wrap.appendChild(txt);
    }

    const img = document.createElement("img");
    img.src = opt.thumb;
    img.alt = `${featureKey} ${idx + 1}`;

    const isSelected = idx === selected[featureKey];
    const isEnabled  = opt.enabled !== false;

    img.style.pointerEvents = isEnabled ? "auto" : "none";
    img.style.opacity       = isEnabled ? "1" : "0.25";
    img.style.border        = isSelected ? "4px solid #ffb700" : "3px solid #ddd";
    img.style.boxShadow     = isSelected ? "0 0 24px #ffbf5eaa" : "0 2px 12px #ccc8";
    img.style.background    = isSelected ? "#fffbe8" : "#fafafa";
    img.style.width         = (featureKey === "body" && isSelected) ? "140px" : "90px";
    img.style.height        = img.style.width;
    img.style.borderRadius  = "12px";
    img.style.cursor        = isEnabled ? "pointer" : "default";

    // Click to select
    if (isEnabled) {
      img.addEventListener("click", () => selectFeature(idx, featureKey));
    }

    // Hold for preview (all except body)
    if (featureKey !== "body") {
      img.addEventListener("mousedown", e => { if (e.button === 0) showPreview(opt); });
      img.addEventListener("touchstart", () => showPreview(opt));
      img.addEventListener("mouseup", hidePreview);
      img.addEventListener("mouseleave", hidePreview);
      img.addEventListener("touchend", hidePreview);
    }

    wrap.appendChild(img);
    picker.appendChild(wrap);
  });
}

/* ----------------------------------------------------------
   QUICK PREVIEW (hold thumb)
---------------------------------------------------------- */
let previewTimer;
function showPreview(opt) {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    const ov = document.getElementById("previewOverlay");
    ov.innerHTML = "";
    const big = document.createElement("img");
    big.src = opt.src || opt.thumb;
    big.style.maxWidth  = "90vw";
    big.style.maxHeight = "90vh";
    big.style.border    = "6px solid #ffb700";
    big.style.background= "#fffbe8";
    big.style.boxShadow = "0 0 40px #ffbd6caa";
    ov.appendChild(big);
    ov.style.display = "block";
  }, 400);
}
function hidePreview() {
  clearTimeout(previewTimer);
  document.getElementById("previewOverlay").style.display = "none";
}

/* ----------------------------------------------------------
   FEATURE SELECT HANDLER
---------------------------------------------------------- */
function selectFeature(idx, featureKey)
{
  selected[featureKey] = idx;

  // If body changed we must sync face list / HR restrictions
  if (featureKey === "body") {
    const HR = bodyOptions[idx].isHighRes;
    if (HR) {
      selected.hair = 5;   // force hair #6
    } else {
      // ensure a valid face index for new skin
      const skin = getCurrentBodySkin();
      const faceList = faceOptions.filter(f => f.skin === skin && f.enabled);
      selected.face = faceList.length ? faceOptions.indexOf(faceList[0]) : 0;
    }
  }

  renderAll();
}

/* ----------------------------------------------------------
   RENDERS ENTIRE UI  (pickers + canvas)
---------------------------------------------------------- */
function renderAll() {
  // Pickers
  createPickerImages(bodyOptions, "body-pickers", "body");
  createPickerImages(
    faceOptions.filter(f => f.skin === getCurrentBodySkin()),
    "face-pickers",
    "face",
    getCurrentBodySkin()
  );
  createPickerImages(hairOptions, "hair-pickers", "hair");

  // Highlight current selections
  document.getElementById("body-pickers").children[selected.body].classList.add("selected");
  if (!bodyOptions[selected.body].isHighRes) {
    document.getElementById("face-row").style.display = "block";
    document.getElementById("face-pickers").children[
      faceOptions.filter(f => f.skin === getCurrentBodySkin()).indexOf(
        faceOptions[selected.face]
      )
    ].classList.add("selected");
  } else {
    document.getElementById("face-row").style.display = "none";
  }
  document.getElementById("hair-pickers").children[
    bodyOptions[selected.body].isHighRes ? 0 : selected.hair
  ].classList.add("selected");

  // Canvas
  renderCanvas();
}

/* ----------------------------------------------------------
   CANVAS RENDER  (layers in proper order)
---------------------------------------------------------- */
function renderCanvas() {
  const cvs = document.getElementById("charCanvas");
  const ctx = cvs.getContext("2d");

  cvs.width  = 640;
  cvs.height = 1280;
  ctx.clearRect(0, 0, cvs.width, cvs.height);

  const body = bodyOptions[selected.body];
  const skin = body.skin;
  const face = faceOptions[selected.face];
  const hair = hairOptions[selected.hair];

  // Build draw order
  const layers = [
    BG_LAYER,          // permanent bg
    body,              // body (HR or mass)
  ];
  if (!body.isHighRes && face?.enabled) layers.push(face);
  if (body.isHighRes) {
    if (hair && selected.hair === 5) layers.push(hair);
  } else if (hair?.enabled) {
    layers.push(hair);
  }
  if (showWeapons) layers.push({ src: WEAPONS_IMG });
  if (showArmor)   layers.push({ src: ARMOR_IMG   });
  if (showHelmet)  layers.push({ src: HELMET_IMG  });

  // Load & draw synchronously in order
  let loaded = 0,
      need   = layers.length,
      imgs   = new Array(need);

  layers.forEach((layer, i) => {
    const img = new Image();
    img.onload = () => { imgs[i] = img; if (++loaded === need) drawAll(); };
    img.onerror = () => { imgs[i] = null; if (++loaded === need) drawAll(); };
    img.src = layer.src;
  });

  function drawAll() {
    imgs.forEach(im => { if (im) ctx.drawImage(im, 0, 0, cvs.width, cvs.height); });
  }
}

/* ----------------------------------------------------------
   HELPERS
---------------------------------------------------------- */
function getCurrentBodySkin() {
  return bodyOptions[selected.body].skin;
}

/* ----------------------------------------------------------
   EQUIPMENT CHECKBOXES
---------------------------------------------------------- */
document.getElementById("equipWeaponsChk").addEventListener("change", e => {
  showWeapons = e.target.checked;
  renderCanvas();
});
document.getElementById("equipArmorChk").addEventListener("change", e => {
  showArmor = e.target.checked;
  renderCanvas();
});
document.getElementById("equipHelmetChk").addEventListener("change", e => {
  showHelmet = e.target.checked;
  renderCanvas();
});

/* ----------------------------------------------------------
   RANDOM BUTTON  (keeps HR restrictions when HR chosen)
---------------------------------------------------------- */
document.getElementById("randomBtn").addEventListener("click", () => {
  const enabledBodies = bodyOptions
    .map((b, i) => (b.enabled ? i : null))
    .filter(i => i !== null);
  selected.body = enabledBodies[Math.floor(Math.random() * enabledBodies.length)];

  const HR = bodyOptions[selected.body].isHighRes;
  if (HR) {
    selected.hair = 5;
  } else {
    const skin = getCurrentBodySkin();
    const faces = faceOptions.filter(f => f.skin === skin && f.enabled);
    selected.face = faceOptions.indexOf(faces[Math.floor(Math.random() * faces.length)]);
    const enabledHair = hairOptions
      .map((h, i) => (h.enabled ? i : null))
      .filter(i => i !== null);
    selected.hair = enabledHair[Math.floor(Math.random() * enabledHair.length)];
  }
  renderAll();
});

/* ----------------------------------------------------------
   PHYSIQUE FORM  (unchanged except renderAll on accept)
---------------------------------------------------------- */
document.getElementById("physiqueForm").addEventListener("submit", e => {
  e.preventDefault();
  const val = parseInt(document.getElementById("physiqueInput").value, 10);
  if (isNaN(val) || val < 1) {
    document.getElementById("physiqueError").style.display = "inline";
    return;
  }
  document.getElementById("physiqueError").style.display = "none";
  document.getElementById("physiqueForm").style.display    = "none";
  document.getElementById("physiqueApprovedMsg").style.display = "block";
  renderAll();
});

/* ----------------------------------------------------------
   HOLD-PREVIEW (HIDE on mouse-up / touch-end)
---------------------------------------------------------- */
document.addEventListener("mouseup", hidePreview);
document.addEventListener("touchend", hidePreview);

/* ----------------------------------------------------------
   INIT on DOMContentLoaded
---------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  renderAll();
});
