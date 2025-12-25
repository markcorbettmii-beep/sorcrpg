const BASE = "https://sorcrpg.com/character-creator/assets/";

// ----------- IMAGE ARRAYS ---------------
// Add skinTone field for body and face options
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
  // Add skinTone field for each face
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

// ----------- STATE & SETUP ---------------
let selected = { body: 8, face: null, hair: 0 }; // default: pale thin body
let equippedArmor = null, selectedWeapon = null;
let showHelmet = false, showWeapons = false, physiqueScore = null;

// ----------- UTILS FOR SKIN TONE ----------
function getBodySkinTone(idx) {
  return bodyOptions[idx].skinTone;
}

// Get only faces matching a skin tone
function getMatchingFaceOptions(skinTone) {
  return faceOptions.filter(f => f.skinTone === skinTone);
}

// ----------- PICKER CREATION -------------
function createPickerImages(options, pickerId, featureKey) {
  const picker = document.getElementById(pickerId);
  picker.innerHTML = "";

  // For faces: only show faces matching current body skin tone
  let filteredOptions = options;
  if (featureKey === "face" && selected.body !== null) {
    const tone = getBodySkinTone(selected.body);
    filteredOptions = options.filter(f => f.skinTone === tone);
  }

  // If no physique score, only pale thin body, matching faces and any hair is selectable
  let isLocked = physiqueScore == null;

  filteredOptions.forEach((option, idx) => {
    const img = document.createElement('img');
    img.src = option.thumb;
    img.alt = `${featureKey} ${idx + 1}`;
    img.style.pointerEvents = "auto";
    img.style.opacity = "1";

    // Disable all except first for non-GM login (no physique score)
    let disable = false;
    if (isLocked) {
      if (featureKey === "body") disable = option !== bodyOptions[8]; // only pale thin body
      else if (featureKey === "face") {
        // only faces matching pale tone; pick first matching
        const paleFaces = getMatchingFaceOptions("pale");
        disable = option !== paleFaces[0];
      }
      // hair: always allow first
      else if (featureKey === "hair") disable = idx !== 0;
    }

    if (disable) {
      img.style.opacity = "0.4";
      img.style.pointerEvents = "none";
    }

    img.classList.toggle("selected", (
      (featureKey === "body" && bodyOptions.indexOf(option) === selected.body) ||
      (featureKey === "face" && faceOptions.indexOf(option) === selected.face) ||
      (featureKey === "hair" && hairOptions.indexOf(option) === selected.hair)
    ));

    img.addEventListener('click', function () {
      if (!disable) {
        if (featureKey === "body") {
          selected.body = bodyOptions.indexOf(option);
          // After body changes, reset face to first matching tone
          const tone = getBodySkinTone(selected.body);
          const faces = getMatchingFaceOptions(tone);
          selected.face = faceOptions.indexOf(faces[0]);
          createPickerImages(faceOptions, "face-pickers", "face");
        }
        if (featureKey === "face") selected.face = faceOptions.indexOf(option);
        if (featureKey === "hair") selected.hair = hairOptions.indexOf(option);
        createPickerImages(bodyOptions, "body-pickers", "body");
        createPickerImages(faceOptions, "face-pickers", "face");
        createPickerImages(hairOptions, "hair-pickers", "hair");
        renderCharacter();
      }
    });

    picker.appendChild(img);
  });
}

// ----------- ARMOR & WEAPON PICKERS -------------
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

// ----------- ENABLE/DISABLE LOGIC -----------
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

// ----------- CHARACTER RENDERING -----------
function renderCharacter() {
  const canvas = document.getElementById("charCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Always use full-size images for canvas
  const layers = [
    bodyOptions[selected.body],
    faceOptions[selected.face],
    hairOptions[selected.hair]
  ];
  if (equippedArmor) layers.push(equippedArmor);
  if (showHelmet) { /* ... */ }
  if (showWeapons && selectedWeapon) {
    layers.push(selectedWeapon);
  }

  let loaded = 0, imgs = [];
  layers.forEach((opt, i) => {
    if (!opt) { loaded++; return; }
    const im = new Image();
    imgs[i] = null;
    im.crossOrigin = "anonymous";
    im.src = opt.src; // FULL SIZE IMAGE
    im.onload = () => { imgs[i] = im; if (++loaded === layers.length) draw(); };
    im.onerror = () => { if (++loaded === layers.length) draw(); };
  });

  function draw() {
    imgs.forEach(im => {
      if (im) ctx.drawImage(im, 0, 0, canvas.width, canvas.height);
    });
  }
}

// ----------- DEFAULTS & INIT -----------
function markDefaults() {
  createPickerImages(bodyOptions, "body-pickers", "body");
  createPickerImages(faceOptions, "face-pickers", "face");
  createPickerImages(hairOptions, "hair-pickers", "hair");
}

document.addEventListener("DOMContentLoaded", () => {
  // Set up defaults, only pale thin body and first matching face/hair
  selected.body = 8; // Body: Pale Thin
  const paleFaces = getMatchingFaceOptions("pale");
  selected.face = faceOptions.indexOf(paleFaces[0]);
  selected.hair = 0;
  markDefaults();
  setPickersEnabled(false);
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
  setPickersEnabled(true);
  markDefaults(); // Recreate pickers with all options now available
  renderCharacter();
});

// ----------- RANDOM BUTTON -----------
document.getElementById("randomBtn").addEventListener("click", function () {
  if (!physiqueScore) return;
  // Body random
  selected.body = Math.floor(Math.random() * bodyOptions.length);
  // Face: only pick matching skin tone
  const tone = getBodySkinTone(selected.body);
  const faces = getMatchingFaceOptions(tone);
  selected.face = faceOptions.indexOf(faces[Math.floor(Math.random() * faces.length)]);
  // Hair: any
  selected.hair = Math.floor(Math.random() * hairOptions.length);

  markDefaults();
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
