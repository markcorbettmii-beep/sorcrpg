const BASE = "https://sorcrpg.com/character-creator/assets/";

const bodyOptions = [
  { src: `${BASE}fbody-mass-drk.png`, thumb: `${BASE}fbody-mass-drk-tmb.png`, skinTone: "drk" },
  { src: `${BASE}fbody-mass-med.png`, thumb: `${BASE}fbody-mass-med-tmb.png`, skinTone: "med" },
  { src: `${BASE}fbody-mass-pale.png`, thumb: `${BASE}fbody-mass-pale-tmb.png`, skinTone: "pale" },
  { src: `${BASE}fbody-musc-med.png`, thumb: `${BASE}fbody-musc-med-tmb.png`, skinTone: "med" },
  { src: `${BASE}fbody-musc-pale.png`, thumb: `${BASE}fbody-musc-pale-tmb.png`, skinTone: "pale" },
  { src: `${BASE}fbody-musc-drk.png`, thumb: `${BASE}fbody-musc-drk-tmb.png`, skinTone: "drk" },
  { src: `${BASE}fbody-thin-med.png`, thumb: `${BASE}fbody-thin-med-tmb.png`, skinTone: "med" },
  { src: `${BASE}fbody-thin-drk.png`, thumb: `${BASE}fbody-thin-drk-tmb.png`, skinTone: "drk" },
  { src: `${BASE}fbody-thin-pale.png`, thumb: `${BASE}fbody-thin-pale-tmb.png`, skinTone: "pale" }
];
const faceOptions = [
  { src: BASE + "femface1-dark-hzl.png", thumb: BASE + "femface1-dark-hzl-tmb.png", skinTone: "drk" },
  { src: BASE + "femface1-med-grn.png", thumb: BASE + "femface1-med-grn-tmb.png", skinTone: "med" },
  { src: BASE + "femface1-med-hzl.png", thumb: BASE + "femface1-med-hzl-tmb.png", skinTone: "med" },
  { src: BASE + "femface1-med-brn.png", thumb: BASE + "femface1-med-brn-tmb.png", skinTone: "med" },
  { src: BASE + "femface1-pale-brn.png", thumb: BASE + "femface1-pale-brn-tmb.png", skinTone: "pale" },
  { src: BASE + "femface1-pale-hzl.png", thumb: BASE + "femface1-pale-hzl-tmb.png", skinTone: "pale" },
  { src: BASE + "femface1-pale-vio.png", thumb: BASE + "femface1-pale-violet-tmb.png", skinTone: "pale" },
  { src: BASE + "femface1-dark-blu.png", thumb: BASE + "femface1-dark-blu-tmb.png", skinTone: "drk" },
  { src: BASE + "femface3-med-brn.png", thumb: BASE + "femface3-med-brn-tmb.png", skinTone: "med" },
  { src: BASE + "femface2-med-grn.png", thumb: BASE + "femface2-med-grn-tmb.png", skinTone: "med" },
  { src: BASE + "femface5-pale-blu-mkup.png", thumb: BASE + "femface5-pale-blu-mkup-tmb.png", skinTone: "pale" },
  { src: BASE + "femface4-pale-brn-mkup.png", thumb: BASE + "femface4-pale-brn-mkup-tmb.png", skinTone: "pale" },
  { src: BASE + "femface4-pale-brn.png", thumb: BASE + "femface4-pale-brn-tmb.png", skinTone: "pale" },
  { src: BASE + "femface2-pale-brn.png", thumb: BASE + "femface2-pale-brn-tmb.png", skinTone: "pale" },
  { src: BASE + "femface2-pale-blu.png", thumb: BASE + "femface2-pale-blu-tmb.png", skinTone: "pale" },
  { src: BASE + "femface2-pale-grn.png", thumb: BASE + "femface2-pale-grn-tmb.png", skinTone: "pale" },
  { src: BASE + "femface2-med-brn.png", thumb: BASE + "femface2-med-brn-tmb.png", skinTone: "med" },
  { src: BASE + "femface2-med-blu.png", thumb: BASE + "femface2-med-blu-tmb.png", skinTone: "med" },
  { src: BASE + "femface2-dark-blu.png", thumb: BASE + "femface2-dark-blu-tmb.png", skinTone: "drk" },
  { src: BASE + "femface2-dark-brn.png", thumb: BASE + "femface2-dark-brn-tmb.png", skinTone: "drk" }
];
const hairOptions = [
  { src: BASE + "femhair1.png", thumb: BASE + "femhair1-tmb.png" },
  { src: BASE + "femhair2.png", thumb: BASE + "femhair2-tmb.png" },
  { src: BASE + "femhair3.png", thumb: BASE + "femhair3-tmb.png" },
  { src: BASE + "femhair4.png", thumb: BASE + "femhair4-tmb.png" },
  { src: BASE + "femhair5.png", thumb: BASE + "femhair5-tmb.png" },
  { src: BASE + "femhair6.png", thumb: BASE + "femhair6-tmb.png" },
  { src: BASE + "femhair7.png", thumb: BASE + "femhair7-tmb.png" },
  { src: BASE + "femhair8.png", thumb: BASE + "femhair8-tmb.png" },
  { src: BASE + "femhair9.png", thumb: BASE + "femhair9-tmb.png" },
  { src: BASE + "femhair10.png", thumb: BASE + "femhair10-tmb.png" },
  { src: BASE + "femhair11.png", thumb: BASE + "femhair11-tmb.png" },
  { src: BASE + "femhair12.png", thumb: BASE + "femhair12-tmb.png" }
];
const armorOptions = [
  { src: BASE + "set-fur-common.png", thumb: BASE + "set-fur-common-tmb.png", whale: false },
  { src: BASE + "set-kaida's-epic-whale-fur.png", thumb: BASE + "set-kaida's-epic-whale-fur-tmb.png", whale: true }
];
const weaponOptions = [
  { src: BASE + "kaida's-great-axe.png", thumb: BASE + "kaida's-great-axe-tmb.png" },
  { src: BASE + "kaida's-great-bow.png", thumb: BASE + "kaida's-great-bow-tmb.png" }
];

let selected = { body: 8, face: 0, hair: 0 };
let equippedArmor = null, selectedWeapon = null;
let showHelmet = false, showWeapons = false, physiqueScore = null;

// ----------- PICKER CREATION AND FILTERING -------------
function getBodySkinTone(idx) {
  return bodyOptions[idx].skinTone;
}
function getMatchingFaceOptions(skinTone) {
  return faceOptions.map((f, i) => ({...f, __globalIdx: i})).filter(f => f.skinTone === skinTone);
}
function createPickerImages(options, pickerId, featureKey) {
  const picker = document.getElementById(pickerId);
  picker.innerHTML = "";

  let filteredOptions = options, globalIndexes = options.map((_,i)=>i);
  if (featureKey === "face") {
    const tone = getBodySkinTone(selected.body);
    filteredOptions = getMatchingFaceOptions(tone);
    globalIndexes = filteredOptions.map(f=>f.__globalIdx); // reference original faceOptions index
  }

  let isBodyPickerLocked = (featureKey === "body" && physiqueScore == null);

  filteredOptions.forEach((option, idx) => {
    const img = document.createElement('img');
    img.src = option.thumb;
    img.alt = `${featureKey} ${idx + 1}`;
    let selectedIdx = (
      featureKey === "body" ? selected.body :
      featureKey === "face" ? selected.face :
      featureKey === "hair" ? selected.hair : null
    );
    let realIdx = featureKey === "face" ? globalIndexes[idx] : idx;
    img.classList.toggle("selected", realIdx === selectedIdx);

    let zoomTimer = null;
    const zoomIn = () => img.classList.add("thumb-zoomed");
    const zoomOut = () => {
      img.classList.remove("thumb-zoomed");
      if (zoomTimer) clearTimeout(zoomTimer);
      zoomTimer = null;
    };
    img.addEventListener('mousedown', () => { zoomTimer = setTimeout(zoomIn, 1200); });
    img.addEventListener('touchstart', () => { zoomTimer = setTimeout(zoomIn, 1200); });
    ["mouseup", "mouseleave", "touchend", "touchcancel", "mousemove"].forEach(ev => {
      img.addEventListener(ev, zoomOut);
    });

    if (isBodyPickerLocked && realIdx !== 8) {
      img.style.opacity = "0.3";
      img.style.pointerEvents = "none";
    } else {
      img.style.opacity = "1";
      img.style.pointerEvents = "auto";
      img.addEventListener('click', function () {
        if (featureKey === "body") {
          selected.body = realIdx;
          // face picker must update to new skin tone
          // set face to first matching new tone, or 0 if none
          let faces = getMatchingFaceOptions(getBodySkinTone(selected.body));
          selected.face = faces.length ? faces[0].__globalIdx : 0;
          createPickerImages(bodyOptions, "body-pickers", "body");
          createPickerImages(faceOptions, "face-pickers", "face");
        } else if (featureKey === "face") {
          selected.face = realIdx;
          createPickerImages(faceOptions, "face-pickers", "face");
        } else if (featureKey === "hair") {
          selected.hair = realIdx;
          createPickerImages(hairOptions, "hair-pickers", "hair");
        }
        renderCharacter();
      });
    }
    picker.appendChild(img);
  });
}

function createArmorPicker() {
  const picker = document.getElementById("armor-pickers");
  picker.innerHTML = "";
  armorOptions.forEach((option, idx) => {
    if (option.whale && !showWeapons) return;
    const img = document.createElement("img");
    img.src = option.thumb || option.src;
    img.alt = "Armor " + (idx + 1);
    img.classList.toggle("selected", equippedArmor === option);
    img.style.cursor = "pointer";
    img.addEventListener("click", () => {
      equippedArmor = option;
      Array.from(picker.children).forEach(child => child.classList.remove("selected"));
      img.classList.add("selected");
      renderCharacter();
    });
    picker.appendChild(img);
  });
  document.getElementById("armor-row").style.display = "block";
}
function createWeaponPicker() {
  const picker = document.getElementById("weapon-pickers");
  picker.innerHTML = "";
  if (!showWeapons) {
    document.getElementById("weapon-row").style.display = "none";
    selectedWeapon = null;
    return;
  }
  weaponOptions.forEach((option, idx) => {
    const img = document.createElement("img");
    img.src = option.thumb || option.src;
    img.alt = "Weapon " + (idx + 1);
    img.classList.toggle("selected", selectedWeapon === option);
    img.style.cursor = "pointer";
    img.addEventListener("click", () => {
      selectedWeapon = option;
      Array.from(picker.children).forEach(child => child.classList.remove("selected"));
      img.classList.add("selected");
      renderCharacter();
    });
    picker.appendChild(img);
  });
  document.getElementById("weapon-row").style.display = "block";
}

// ----------- CHARACTER RENDERING -----------
function renderCharacter() {
  const canvas = document.getElementById("charCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const layers = [
    bodyOptions[selected.body],
    faceOptions[selected.face],
    hairOptions[selected.hair]
  ];
  if (equippedArmor) layers.push(equippedArmor);
  if (showHelmet) {
    // Add helmet layer here if you have images
  }
  if (showWeapons && selectedWeapon) {
    layers.push(selectedWeapon);
  }

  let loaded = 0, imgs = [];
  layers.forEach((opt, i) => {
    if (!opt) { loaded++; return; }
    const im = new Image();
    imgs[i] = null;
    im.crossOrigin = "anonymous";
    im.src = opt.src;
    im.onload = () => { imgs[i] = im; if (++loaded === layers.length) draw(); };
    im.onerror = () => { if (++loaded === layers.length) draw(); };
  });

  function draw() {
    imgs.forEach(im => {
      if (im) ctx.drawImage(im, 0, 0, canvas.width, canvas.height);
    });
  }
}

// ----------- INITIALIZATION -----------
function initAllPickers() {
  createPickerImages(bodyOptions, "body-pickers", "body");
  createPickerImages(faceOptions, "face-pickers", "face");
  createPickerImages(hairOptions, "hair-pickers", "hair");
}
document.addEventListener("DOMContentLoaded", () => {
  selected.body = 8; // pale thin
  const faces = getMatchingFaceOptions(getBodySkinTone(selected.body));
  selected.face = faces.length ? faces[0].__globalIdx : 0;
  selected.hair = 0;
  initAllPickers();
  renderCharacter();

  document.getElementById("equipArmorBtn").addEventListener("click", () => {
    createArmorPicker();
  });
  document.getElementById("showHelmetChk").addEventListener("change", (e) => {
    showHelmet = e.target.checked;
    renderCharacter();
  });
  document.getElementById("showWeaponsChk").addEventListener("change", (e) => {
    showWeapons = e.target.checked;
    createArmorPicker();
    createWeaponPicker();
    renderCharacter();
  });
});

// ----------- PHYSIQUE FORM -----------
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
  initAllPickers();
  renderCharacter();
});

// ----------- RANDOM BUTTON -----------
document.getElementById("randomBtn").addEventListener("click", function () {
  // Body random
  if (physiqueScore) {
    selected.body = Math.floor(Math.random() * bodyOptions.length);
  }
  // Face: only picks matching skin tone
  const faces = getMatchingFaceOptions(getBodySkinTone(selected.body));
  selected.face = faces.length ? faces[Math.floor(Math.random() * faces.length)].__globalIdx : 0;
  selected.hair = Math.floor(Math.random() * hairOptions.length);
  initAllPickers();
  renderCharacter();
});

// ----------- JPEG EXPORT -----------
document.getElementById("showJpegBtn").addEventListener("click", function () {
  const canvas = document.getElementById("charCanvas");
  const jpegPreview = document.getElementById("jpegPreview");
  const saveInstr = document.getElementById("saveInstr");
  const editingButtons = document.getElementById("editingButtons");
  const jpegButtons = document.getElementById("jpegButtons");

  jpegPreview.src = canvas.toDataURL("image/jpeg");
  jpegPreview.style.display = "block";
  saveInstr.style.display = "block";
  canvas.style.display = "none";
  editingButtons.style.display = "none";
  jpegButtons.style.display = "block";
});
document.getElementById("backBtn").addEventListener("click", function () {
  document.getElementById("jpegPreview").style.display = "none";
  document.getElementById("saveInstr").style.display = "none";
  document.getElementById("charCanvas").style.display = "block";
  document.getElementById("editingButtons").style.display = "block";
  document.getElementById("jpegButtons").style.display = "none";
});
