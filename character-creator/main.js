const BASE = "https://sorcrpg.com/character-creator/assets/";

// ----------- IMAGE ARRAYS ---------------
const bodyOptions = [
  { src: `${BASE}fbody-mass-drk.png`, thumb: `${BASE}fbody-mass-drk-tmb.png` },
  { src: `${BASE}fbody-mass-med.png`, thumb: `${BASE}fbody-mass-med-tmb.png` },
  { src: `${BASE}fbody-mass-pale.png`, thumb: `${BASE}fbody-mass-pale-tmb.png` },
  { src: `${BASE}fbody-musc-med.png`, thumb: `${BASE}fbody-musc-med-tmb.png` },
  { src: `${BASE}fbody-musc-pale.png`, thumb: `${BASE}fbody-musc-pale-tmb.png` },
  { src: `${BASE}fbody-musc-drk.png`, thumb: `${BASE}fbody-musc-drk-tmb.png` },
  { src: `${BASE}fbody-thin-med.png`, thumb: `${BASE}fbody-thin-med-tmb.png` },
  { src: `${BASE}fbody-thin-drk.png`, thumb: `${BASE}fbody-thin-dark-tmb.png` },
  { src: `${BASE}fbody-thin-pale.png`, thumb: `${BASE}fbody-thin-pale-tmb.png` }
];

const faceOptions = [
  { src: BASE + "femface1-dark-hzl.png", thumb: BASE + "femface1-dark-hzl-tmb.png" },
  { src: BASE + "femface1-med-grn.png", thumb: BASE + "femface1-med-grn-tmb.png" },
  { src: BASE + "femface1-med-hzl.png", thumb: BASE + "femface1-med-hzl-tmb.png" },
  { src: BASE + "femface1-med-brn.png", thumb: BASE + "femface1-med-brn-tmb.png" },
  { src: BASE + "femface1-pale-brn.png", thumb: BASE + "femface1-pale-brn-tmb.png" },
  { src: BASE + "femface1-pale-hzl.png", thumb: BASE + "femface1-pale-hzl-tmb.png" },
  { src: BASE + "femface1-pale-vio.png", thumb: BASE + "femface1-pale-violet-tmb.png" },
  { src: BASE + "femface1-dark-blu.png", thumb: BASE + "femface1-dark-blu-tmb.png" },
  { src: BASE + "femface3-med-brn.png", thumb: BASE + "femface3-med-brn-tmb.png" },
  { src: BASE + "femface2-med-grn.png", thumb: BASE + "femface2-med-grn-tmb.png" },
  { src: BASE + "femface5-pale-blu-mkup.png", thumb: BASE + "femface5-pale-blu-mkup-tmb.png" },
  { src: BASE + "femface4-pale-brn-mkup.png", thumb: BASE + "femface4-pale-brn-mkup-tmb.png" },
  { src: BASE + "femface4-pale-brn.png", thumb: BASE + "femface4-pale-brn-tmb.png" },
  { src: BASE + "femface2-pale-brn.png", thumb: BASE + "femface2-pale-brn-tmb.png" },
  { src: BASE + "femface2-pale-blu.png", thumb: BASE + "femface2-pale-blu-tmb.png" },
  { src: BASE + "femface2-pale-grn.png", thumb: BASE + "femface2-pale-grn-tmb.png" },
  { src: BASE + "femface2-med-brn.png", thumb: BASE + "femface2-med-brn-tmb.png" },
  { src: BASE + "femface2-med-blu.png", thumb: BASE + "femface2-med-blu-tmb.png" },
  { src: BASE + "femface2-dark-blu.png", thumb: BASE + "femface2-dark-blu-tmb.png" },
  { src: BASE + "femface2-dark-brn.png", thumb: BASE + "femface2-dark-brn-tmb.png" }
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

// Only show whale armor if showWeapons is true
const armorOptions = [
  { src: BASE + "set-fur-common.png", thumb: BASE + "set-fur-common-tmb.png", whale: false },
  { src: BASE + "set-kaida's-epic-whale-fur.png", thumb: BASE + "set-kaida's-epic-whale-fur-tmb.png", whale: true }
];

// Example weapon images (add more as needed)
const weaponOptions = [
  { src: BASE + "kaida's-great-axe.png", thumb: BASE + "kaida's-great-axe-tmb.png" },
  { src: BASE + "kaida's-great-bow.png", thumb: BASE + "kaida's-great-bow-tmb.png" }
];

// ----------- STATE & SETUP ---------------
let selected = { body: 0, face: 0, hair: 0 };
let equippedArmor = null, selectedWeapon = null;
let showHelmet = false, showWeapons = false, physiqueScore = null;

// ----------- PICKER CREATION -------------
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
    const zoomIn = () => img.classList.add("thumb-zoomed");
    const zoomOut = () => {
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

// ----------- SELECTION ----------- 
function selectFeature(pickerId, idx, featureKey) {
  const picker = document.getElementById(pickerId);
  Array.from(picker.children).forEach(img => img.classList.remove("selected"));
  if (picker.children[idx]) {
    picker.children[idx].classList.add("selected");
    selected[featureKey] = idx;
    renderCharacter();
  }
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
    im.src = opt.src;
    im.onload = () => { imgs[i] = im; if (++loaded === layers.length) draw(); };
    im.onerror = () => { if (++loaded === layers.length) draw(); };
  });
  function draw() {
    imgs.forEach(im => { if (im) ctx.drawImage(im, 0, 0, canvas.width, canvas.height); });
  }
}

// ----------- DEFAULTS & RANDOMIZER -----------
function markDefaults() {
  ["body-pickers", "face-pickers", "hair-pickers"].forEach(id => {
    const picker = document.getElementById(id);
    if (picker.children.length) {
      picker.children[0].classList.add("selected");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  createPickerImages(bodyOptions, "body-pickers", "body");
  createPickerImages(faceOptions, "face-pickers", "face");
  createPickerImages(hairOptions, "hair-pickers", "hair");
  setPickersEnabled(false);
  markDefaults();
  renderCharacter();
  // Set up equipment controls
  document.getElementById("equipArmorBtn").addEventListener("click", () => {
    createArmorPicker();
  });
  document.getElementById("showHelmetChk").addEventListener("change", (e) => {
    showHelmet = e.target.checked;
    renderCharacter();
  });
  document.getElementById("showWeaponsChk").addEventListener("change", (e) => {
    showWeapons = e.target.checked;
    createArmorPicker(); // Refresh to show whale armor if needed
    createWeaponPicker(); // Show/hide weapon picker
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
});

// ----------- RANDOM BUTTON -----------
document.getElementById("randomBtn").addEventListener("click", function () {
  if (!physiqueScore) return;
  selected.body = Math.floor(Math.random() * bodyOptions.length);
  selected.face = Math.floor(Math.random() * faceOptions.length);
  selected.hair = Math.floor(Math.random() * hairOptions.length);

  [
    { pickerId: "body-pickers", idx: selected.body },
    { pickerId: "face-pickers", idx: selected.face },
    { pickerId: "hair-pickers", idx: selected.hair },
  ].forEach(({ pickerId, idx }) => {
    const picker = document.getElementById(pickerId);
    Array.from(picker.children).forEach(img => img.classList.remove("selected"));
    if (picker.children[idx]) picker.children[idx].classList.add("selected");
  });

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
