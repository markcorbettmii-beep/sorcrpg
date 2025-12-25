const BASE = ""; // Use current folder

// --- Body, Face, Hair: only images you actually have ---
const bodyOptions = [
  { src: "fbody-mass-drk.png", thumb: "fbody-mass-drk-tmb.png", skinTone: "drk" },
  { src: "fbody-mass-med.png", thumb: "fbody-mass-med-tmb.png", skinTone: "med" },
  { src: "fbody-mass-pale.png", thumb: "fbody-mass-pale-tmb.png", skinTone: "pale" },
  { src: "fbody-musc-med.png", thumb: "fbody-musc-med-tmb.png", skinTone: "med" },
  { src: "fbody-musc-pale.png", thumb: "fbody-musc-pale-tmb.png", skinTone: "pale" },
  { src: "fbody-musc-drk.png", thumb: "fbody-musc-drk-tmb.png", skinTone: "drk" },
  { src: "fbody-thin-med.png", thumb: "fbody-thin-med-tmb.png", skinTone: "med" },
  { src: "fbody-thin-drk.png", thumb: "fbody-thin-dark-tmb.png", skinTone: "drk" },
  { src: "fbody-thin-pale.png", thumb: "fbody-thin-pale-tmb.png", skinTone: "pale" }
];
const faceOptions = [
  { src: "femface1-dark-blu.png", thumb: "femface1-dark-blu-tmb.png", skinTone: "drk" },
  { src: "femface2-dark-brn.png", thumb: "femface2-dark-brn-tmb.png", skinTone: "drk" },
  { src: "femface2-dark-blu.png", thumb: "femface2-dark-blu-tmb.png", skinTone: "drk" },
  { src: "femface1-dark-hzl.png", thumb: "femface1-dark-hzl-tmb.png", skinTone: "drk" },
  { src: "femface1-med-brn.png", thumb: "femface1-med-brn-tmb.png", skinTone: "med" },
  { src: "femface1-med-hzl.png", thumb: "femface1-med-hzl-tmb.png", skinTone: "med" },
  { src: "femface1-med-grn.png", thumb: "femface1-med-grn-tmb.png", skinTone: "med" },
  { src: "femface2-med-brn.png", thumb: "femface2-med-brn-tmb.png", skinTone: "med" },
  { src: "femface2-med-blu.png", thumb: "femface2-med-blu-tmb.png", skinTone: "med" },
  { src: "femface2-med-grn.png", thumb: "femface2-med-grn-tmb.png", skinTone: "med" },
  { src: "femface3-med-brn.png", thumb: "femface3-med-brn-tmb.png", skinTone: "med" },
  { src: "femface1-pale-hzl.png", thumb: "femface1-pale-hzl-tmb.png", skinTone: "pale" },
  { src: "femface1-pale-brn.png", thumb: "femface1-pale-brn-tmb.png", skinTone: "pale" },
  { src: "femface1-pale-vio.png", thumb: "femface1-pale-violet-tmb.png", skinTone: "pale" },
  { src: "femface2-pale-grn.png", thumb: "femface2-pale-grn-tmb.png", skinTone: "pale" },
  { src: "femface2-pale-blu.png", thumb: "femface2-pale-blu-tmb.png", skinTone: "pale" },
  { src: "femface2-pale-brn.png", thumb: "femface2-pale-brn-tmb.png", skinTone: "pale" },
  { src: "femface4-pale-brn-mkup.png", thumb: "femface4-pale-brn-mkup-tmb.png", skinTone: "pale" },
  { src: "femface5-pale-blu-mkup.png", thumb: "femface5-pale-blu-mkup-tmb.png", skinTone: "pale" }
];
const hairOptions = [
  { src: "femhair1.png", thumb: "femhair1-tmb.png" },
  { src: "femhair2.png", thumb: "femhair2-tmb.png" },
  { src: "femhair3.png", thumb: "femhair3-tmb.png" },
  { src: "femhair4.png", thumb: "femhair4-tmb.png" },
  { src: "femhair5.png", thumb: "femhair5-tmb.png" },
  { src: "femhair6.png", thumb: "femhair6-tmb.png" },
  { src: "femhair7.png", thumb: "femhair7-tmb.png" },
  { src: "femhair8.png", thumb: "femhair8-tmb.png" },
  { src: "femhair9.png", thumb: "femhair9-tmb.png" },
  { src: "femhair10.png", thumb: "femhair10-tmb.png" },
  { src: "femhair11.png", thumb: "femhair11-tmb.png" },
  { src: "femhair12.png", thumb: "femhair12-tmb.png" }
];
const armorOptions = [
  { src: "set-fur-common.png", thumb: "set-fur-common-tmb.png" },
  { src: "set-epic-fur-mantle.png", thumb: "set-epic-fur-mantle.png" }
];
const helmetOptions = [
  { src: "bear-skn-helmet.png", thumb: "bear-skn-helmet.png" }
];
const weaponOptions = []; // No weapons in your current list

let selected = { body: 8, face: 0, hair: 0 };
let equippedArmor = null, equippedHelmet = null, selectedWeapon = null;
let showHelmet = false, showWeapons = false, physiqueScore = null;

function getBodySkinTone(idx) {
  return bodyOptions[idx].skinTone;
}
function getMatchingFaceOptions(skinTone) {
  return faceOptions.map((f, i) => ({ ...f, __globalIdx: i })).filter(f => f.skinTone === skinTone);
}
function createPickerImages(options, pickerId, featureKey) {
  const picker = document.getElementById(pickerId);
  picker.innerHTML = "";
  let filteredOptions = options, globalIndexes = options.map((_,i)=>i);
  if (featureKey === "face") {
    const tone = getBodySkinTone(selected.body);
    filteredOptions = getMatchingFaceOptions(tone);
    globalIndexes = filteredOptions.map(f=>f.__globalIdx);
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
function createHelmetPicker() {
  const picker = document.getElementById("armor-pickers");
  helmetOptions.forEach((option, idx) => {
    const img = document.createElement("img");
    img.src = option.thumb || option.src;
    img.alt = "Helmet " + (idx + 1);
    img.classList.toggle("selected", equippedHelmet === option);
    img.style.cursor = "pointer";
    img.addEventListener("click", () => {
      equippedHelmet = option;
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
  if (showHelmet && equippedHelmet) layers.push(equippedHelmet);
  if (showWeapons && selectedWeapon) layers.push(selectedWeapon);
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
    imgs.forEach(im => {
      if (im) ctx.drawImage(im, 0, 0, canvas.width, canvas.height);
    });
  }
}
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
  equippedArmor = null;
  equippedHelmet = null;
  selectedWeapon = null;
  initAllPickers();
  renderCharacter();

  document.getElementById("equipArmorBtn").addEventListener("click", () => {
    createArmorPicker();
    if (document.getElementById("showHelmetChk").checked) createHelmetPicker();
  });
  document.getElementById("showHelmetChk").addEventListener("change", (e) => {
    showHelmet = e.target.checked;
    if (showHelmet) createHelmetPicker();
    renderCharacter();
  });
  document.getElementById("showWeaponsChk").addEventListener("change", (e) => {
    showWeapons = e.target.checked;
    createArmorPicker();
    createWeaponPicker();
    renderCharacter();
  });
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
  initAllPickers();
  renderCharacter();
});
document.getElementById("randomBtn").addEventListener("click", function () {
  if (physiqueScore) {
    selected.body = Math.floor(Math.random() * bodyOptions.length);
  }
  const faces = getMatchingFaceOptions(getBodySkinTone(selected.body));
  selected.face = faces.length ? faces[Math.floor(Math.random() * faces.length)].__globalIdx : 0;
  selected.hair = Math.floor(Math.random() * hairOptions.length);
  initAllPickers();
  renderCharacter();
});
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
