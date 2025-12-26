const BASE = "assets/";
const CHARACTER_CREATOR_BASE = "character-creator/assets/";

const bodyOptions = [
  { src: `${BASE}fbody-mass-drk.png`, thumb: `${BASE}fbody-mass-drk-tmb.png`, skin: "drk", type: "massive", enabled: true },
  { src: `${BASE}fbody-mass-med.png`, thumb: `${BASE}fbody-mass-med-tmb.png`, skin: "med", type: "massive", enabled: true },
  { src: `${BASE}fbody-mass-pale.png`, thumb: `${BASE}fbody-mass-pale-tmb.png`, skin: "pale", type: "massive", enabled: true },
  {
    src: `${BASE}hr-fbody-muscular.png`,
    thumb: `${CHARACTER_CREATOR_BASE}fbody-musc-drk-tmb.png`,
    skin: "hr",
    type: "muscular_hr",
    enabled: true,
    isHighRes: true
  }
];

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

const WEAPONS_IMG = BASE + "kaidas-great-bow.png";
const ARMOR_IMG   = BASE + "set-epic-fur-mantle.png";
const HELMET_IMG  = BASE + "bear-skn-helmet.png";

// --- Set HR body as default ---
let selected = {
  body: 3, // Index of HR body in bodyOptions
  face: 0, // Will be ignored for HR
  hair: 5  // Sixth hair (first on bottom row)
};
let physiqueScore = null;
let showWeapons = false;
let showArmor = false;
let showHelmet = false;

// --- Picker rendering ---
function createPickerImages(options, pickerId, featureKey, skinMatch = null) {
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

    // "high res demo" label above HR body thumb
    if (featureKey === "body" && option.isHighRes) {
      let label = document.createElement('div');
      label.textContent = "high res demo";
      label.style.fontSize = "1em";
      label.style.fontWeight = "bold";
      label.style.color = "#447";
      label.style.marginBottom = "4px";
      wrapper.appendChild(label);
    }

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
    const skin = getCurrentBodySkin();
    createPickerImages(faceOptions, "face-pickers", "face", skin);
    let faceOpts = faceOptions.filter(f => f.skin === skin);
    let firstEnabledFace = faceOpts.findIndex(f => f.enabled);
    selected.face = firstEnabledFace >= 0 ? firstEnabledFace : 0;
    createPickerImages(bodyOptions, "body-pickers", "body");
  }
  createPickerImages(bodyOptions, "body-pickers", "body");
  createPickerImages(faceOptions.filter(f => f.skin === getCurrentBodySkin()), "face-pickers", "face", getCurrentBodySkin());
  createPickerImages(hairOptions, "hair-pickers", "hair");
  document.getElementById("body-pickers").children[selected.body].classList.add("selected");

  if (bodyOptions[selected.body]?.isHighRes) {
    selected.hair = 5;
    document.getElementById("hair-pickers").children[0].classList.add("selected");
    document.getElementById("face-row").style.display = "none";
  } else {
    document.getElementById("face-row").style.display = "block";
    document.getElementById("face-pickers").children[selected.face].classList.add("selected");
    document.getElementById("hair-pickers").children[selected.hair].classList.add("selected");
  }

  renderCharacter();
}

function getCurrentBodySkin() {
  return bodyOptions[selected.body]?.skin || "pale";
}

// --- Character rendering (canvas bg behind everything except models/model elements) ---
function renderCharacter() {
  const canvas = document.getElementById("charCanvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 640;
  canvas.height = 1280;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Always draw background first, then all model layers (body, face, hair, etc)
  let bgImg = new window.Image();
  bgImg.src = CHARACTER_CREATOR_BASE + "highres-canvas-bg.png";
  bgImg.onload = function() {
    ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
    drawModelLayers();
  };
  bgImg.onerror = function() {
    drawModelLayers();
  };

  function drawModelLayers() {
    let body = bodyOptions[selected.body];
    let skin = body?.skin || "pale";
    let faceOpts = faceOptions.filter(f => f.skin === skin);
    let face = faceOpts[selected.face];
    let hair = hairOptions[selected.hair];

    const layers = [];
    // Body always first model layer
    if (body && body.src) layers.push(body);
    if (!body.isHighRes && face && face.src && face.enabled !== false) layers.push(face);
    if (body.isHighRes) {
      if (hair && hair.src && selected.hair === 5) layers.push(hair);
    } else if (hair && hair.src && hair.enabled !== false) {
      layers.push(hair);
    }
    if (showWeapons) layers.push({src: WEAPONS_IMG});
    if (showArmor) layers.push({src: ARMOR_IMG});
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

// Equipment checkbox logic
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
  createPickerImages(bodyOptions, "body-pickers", "body");
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
  createPickerImages(bodyOptions, "body-pickers", "body");
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
  createPickerImages(bodyOptions, "body-pickers", "body");
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
