const BASE = "character-creator/assets/";
const CHARACTER_CREATOR_BASE = "character-creator/assets/";

// --- BODY PICKER: three labeled rows ---
const bodyTypeRows = [
  {
    label: "Body Type (massive)",
    bodies: [
      { src: `${BASE}fbody-mass-drk.png`, thumb: `${BASE}fbody-mass-drk-tmb.png`, skin: "drk", type: "massive", enabled: true },
      { src: `${BASE}fbody-mass-med.png`, thumb: `${BASE}fbody-mass-med-tmb.png`, skin: "med", type: "massive", enabled: true },
      { src: `${BASE}fbody-mass-pale.png`, thumb: `${BASE}fbody-mass-pale-tmb.png`, skin: "pale", type: "massive", enabled: true }
    ]
  },
  {
    label: "Body Type (muscular)",
    bodies: [
      { src: "", thumb: `${BASE}placeholder-pale.png`, skin: "pale", type: "muscular", enabled: false, isPlaceholder: true },
      { src: `${BASE}hr-fbody-muscular.png`, thumb: `${BASE}fbody-musc-drk-tmb.png`, skin: "hr", type: "muscular_hr", enabled: true, isHighRes: true, isHrDemo: true },
      { src: "", thumb: `${BASE}placeholder-drk.png`, skin: "drk", type: "muscular", enabled: false, isPlaceholder: true }
    ]
  },
  {
    label: "Body Type (thin)",
    bodies: [
      { src: "", thumb: `${BASE}placeholder-pale.png`, skin: "pale", type: "thin", enabled: false, isPlaceholder: true },
      { src: "", thumb: `${BASE}placeholder-med.png`, skin: "med", type: "thin", enabled: false, isPlaceholder: true },
      { src: "", thumb: `${BASE}placeholder-drk.png`, skin: "drk", type: "thin", enabled: false, isPlaceholder: true }
    ]
  }
];
const bodyOptions = bodyTypeRows.flatMap(row => row.bodies);

// --- FACE OPTIONS (unchanged) ---
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

// --- Default: pale mass body, hair 6, first enabled pale face ---
let selected = {
  body: 2, // third in flat list: fbody-mass-pale
  face: faceOptions.findIndex(f => f.skin === "pale" && f.enabled),
  hair: 5 // hair #6 (0-based, so 5)
};
let physiqueScore = null;
let showWeapons = false;
let showArmor = false;
let showHelmet = false;

// --- BODY PICKER rendering: 3 labeled rows and HR demo thumb label ---
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

      // HR demo thumb gets a label
      if (body.isHrDemo) {
        const demoLabel = document.createElement("div");
        demoLabel.textContent = "Muscular HR demo";
        demoLabel.style.fontSize = "0.95em";
        demoLabel.style.fontWeight = "bold";
        demoLabel.style.color = "#a22";
        demoLabel.style.marginBottom = "2px";
        outer.appendChild(demoLabel);
      }

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

      function selectHandler(e) {
        if (body.enabled) {
          selectBody(idxOffset + i);
          e.preventDefault();
        }
      }
      img.addEventListener("click", selectHandler, {passive:false});
      img.addEventListener("touchstart", selectHandler, {passive:false});

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
  createPickerImages(faceOptions, "face-pickers", "face", getCurrentBodySkin());
  createPickerImages(hairOptions, "hair-pickers", "hair");
  renderCharacter();
}

// --- Picker rendering (unchanged for face/hair) ---
function createPickerImages(options, pickerId, featureKey, skinMatch = null) {
  if (featureKey === "body") {
    createBodyPickers();
    return;
  }
  const picker = document.getElementById(pickerId);
  picker.innerHTML = "";

  let opts = options;
  if (featureKey === "face" && skinMatch) {
    opts = options.filter(opt => opt.skin === skinMatch);
  }

  // HR body restrictions:
  if (bodyOptions[selected.body]?.isHighRes) {
    if (featureKey === "hair") {
      opts = hairOptions.map((opt, idx) => ({...opt, enabled: idx === 5}));
    }
    if (featureKey === "face") {
      picker.style.display = "none";
      return;
    }
  } else if (featureKey === "face") {
    picker.style.display = "block";
  }

  opts.forEach((option, idx) => {
    let wrapper = document.createElement('div');
    wrapper.style.display = "inline-block";
    wrapper.style.textAlign = "center";
    wrapper.style.margin = "0 4px";

    const img = document.createElement('img');
    img.src = option.thumb;
    img.alt = `${featureKey} ${idx + 1}`;
    img.title = option.label ? option.label : '';

    let selectedIndex = selected[featureKey];
    let isSelected = (idx === selectedIndex);

    let isFunctional = true;
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
    img.style.width = "90px";
    img.style.height = "90px";

    if (isFunctional) {
      img.addEventListener('click', function (e) { selectFeature(pickerId, idx, featureKey, skinMatch); });
      img.addEventListener('touchstart', function (e) { selectFeature(pickerId, idx, featureKey, skinMatch); });
    }

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

    wrapper.appendChild(img);
    picker.appendChild(wrapper);
  });
}

// --- Preview logic (NO PREVIEW FOR BODY) ---
let previewTimeout, previewActive = false;
function showPreview(featureKey, option) {
  if (featureKey === "body") return;
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
  }, 400);
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
    selectBody(idx);
    return;
  }

  if (featureKey === "face") {
    createPickerImages(faceOptions, "face-pickers", "face", getCurrentBodySkin());
  }
  createPickerImages(hairOptions, "hair-pickers", "hair");
  renderCharacter();
}

function getCurrentBodySkin() {
  return bodyOptions[selected.body]?.skin || "pale";
}

// --- Character rendering (with equipment support and dynamic canvas size) ---
function renderCharacter() {
  const canvas = document.getElementById("charCanvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 640;
  canvas.height = 1280;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Always draw default background first
  let bgImg = new window.Image();
  bgImg.src = CHARACTER_CREATOR_BASE + "highres-canvas-bg.png";
  bgImg.onload = function() {
    ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
    drawLayers();
  };
  bgImg.onerror = function() {
    drawLayers();
  };

  function drawLayers() {
    let body = bodyOptions[selected.body];
    let skin = body?.skin || "pale";
    let faceOpts = faceOptions.filter(f => f.skin === skin);
    let face = faceOpts[selected.face];
    let hair = hairOptions[selected.hair];

    const layers = [];
    if (showWeapons) layers.push({src: WEAPONS_IMG});
    if (body && body.src) layers.push(body);
    if (showArmor) layers.push({src: ARMOR_IMG});
    if (body.isHighRes) {
      if (hair && hair.src && selected.hair === 5) layers.push(hair);
    } else {
      if (face && face.src && face.enabled !== false) layers.push(face);
      if (hair && hair.src && hair.enabled !== false) layers.push(hair);
    }
    if (showHelmet) layers.push({src: HELMET_IMG});

    let loaded = 0, imgs = [];
    if (!layers.length) return;
    layers.forEach((opt, i) => {
      if (!opt || !opt.src) { loaded++; return; }
      const im = new window.Image();
      imgs[i] = null;
      im.src = opt.src;
      im.onload = () => { imgs[i] = im; if (++loaded === layers.length) drawImgs(); };
      im.onerror = () => { if (++loaded === layers.length) drawImgs(); };
    });
    function drawImgs() {
      imgs.forEach(im => { if (im) ctx.drawImage(im, 0, 0, canvas.width, canvas.height); });
    }
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

document.getElementById("cardWeaponsBtn").addEventListener("click", function(e) {
  alert("Show Linked Card (coming soon)");
});
document.getElementById("cardArmorBtn").addEventListener("click", function(e) {
  alert("Show Linked Card (coming soon)");
});

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
  createBodyPickers();
  let skin = getCurrentBodySkin();
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

document.getElementById("randomBtn").addEventListener("click", function () {
  let enabledBodyIndexes = bodyOptions.map((b, i) => b.enabled ? i : null).filter(i => i !== null);
  selected.body = enabledBodyIndexes[Math.floor(Math.random() * enabledBodyIndexes.length)];
  let skin = getCurrentBodySkin();
  if (bodyOptions[selected.body]?.isHighRes) {
    selected.hair = 5;
    document.getElementById("face-row").style.display = "none";
  } else {
    let faceOpts = faceOptions.filter(f => f.skin === skin && f.enabled !== false);
    selected.face = faceOpts.length > 1 ? Math.floor(Math.random() * faceOpts.length) : 0;
    let enabledHairIndexes = hairOptions.map((h, i) => h.enabled ? i : null).filter(i => i !== null);
    selected.hair = enabledHairIndexes.length ? enabledHairIndexes[Math.floor(Math.random() * enabledHairIndexes.length)] : 0;
    document.getElementById("face-row").style.display = "block";
  }
  createBodyPickers();
  createPickerImages(faceOptions.filter(f => f.skin === skin), "face-pickers", "face", skin);
  createPickerImages(hairOptions, "hair-pickers", "hair");
  document.getElementById("body-pickers").children[selected.body].classList.add("selected");
  if (!bodyOptions[selected.body]?.isHighRes) {
    document.getElementById("face-pickers").children[selected.face].classList.add("selected");
    document.getElementById("hair-pickers").children[selected.hair].classList.add("selected");
  } else {
    document.getElementById("hair-pickers").children[0].classList.add("selected");
  }
  renderCharacter();
});

document.addEventListener("DOMContentLoaded", () => {
  createBodyPickers();
  let skin = getCurrentBodySkin();
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
