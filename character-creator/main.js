// Use "" for BASE if all images are in the same folder as HTML
const BASE = "";

const bodyBaseNames = [
  "fbody-mass-drk",
  "fbody-mass-med",
  "fbody-mass-pale",
  "fbody-musc-med",
  "fbody-musc-pale",
  "fbody-musc-drk",
  "fbody-thin-med",
  "fbody-thin-drk",
  "fbody-thin-pale"
];
const faceBaseNames = [
  "femface1-dark-blu", "femface2-dark-brn", "femface2-dark-blu", "femface1-dark-hzl",
  "femface1-med-brn", "femface1-med-hzl", "femface1-med-grn", "femface2-med-brn",
  "femface2-med-blu", "femface2-med-grn", "femface3-med-brn", "femface1-pale-hzl",
  "femface1-pale-brn", "femface1-pale-vio", "femface2-pale-grn", "femface2-pale-blu",
  "femface2-pale-brn", "femface4-pale-brn-mkup", "femface5-pale-blu-mkup"
];
const hairBaseNames = [
  "femhair1","femhair2","femhair3","femhair4","femhair5","femhair6",
  "femhair7","femhair8","femhair9","femhair10","femhair11","femhair12"
];
const armorBaseNames = [
  "set-fur-common", "set-epic-fur-mantle"
];
const helmetBaseNames = ["bear-skn-helmet"];
const weaponBaseNames = []; // Add any weapons if you have them

function skinToneFromBase(base) {
  if (base.includes("pale")) return "pale";
  if (base.includes("med")) return "med";
  if (base.includes("drk") || base.includes("dark")) return "drk";
  return null;
}

// --- State ---
let selectedBody = 8; // pale thin by default
let selectedFace = 0;
let selectedHair = 0;
let equippedArmor = null, equippedHelmet = null;
let showHelmet = false, showWeapons = false, physiqueScore = null;

// --- Picker creation ---
function createPicker(baseNames, pickerId, selectedIdx, onSelect, disabledIdx=[]) {
  const picker = document.getElementById(pickerId);
  picker.innerHTML = "";
  baseNames.forEach((base, idx) => {
    const img = document.createElement('img');
    img.src = BASE + base + "-tmb.png";
    img.alt = base;
    img.className = idx === selectedIdx ? "selected" : "";
    if (disabledIdx.includes(idx)) {
      img.style.opacity = "0.3";
      img.style.pointerEvents = "none";
    } else {
      img.style.opacity = "1";
      img.style.pointerEvents = "auto";
      img.addEventListener('click', () => { onSelect(idx); });
    }
    // Zoom on hold
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
    picker.appendChild(img);
  });
}

// --- Skin tone matching for faces ---
function getMatchingFaceIndexes(tone) {
  return faceBaseNames
    .map((base,i)=>({base,i}))
    .filter(obj=>skinToneFromBase(obj.base) === tone)
    .map(obj=>obj.i);
}

function updatePickers() {
  // Body: only enable picker after score (except pale thin)
  const bodyDisabledIdx = !physiqueScore ? bodyBaseNames.map((_,i)=>i).filter(i=>i!==8) : [];
  createPicker(bodyBaseNames, "body-pickers", selectedBody, (idx) => {
    if (!physiqueScore && idx!==8) return; // Only pale thin allowed
    selectedBody = idx;
    // When body changes, select first matching face
    let bodyTone = skinToneFromBase(bodyBaseNames[selectedBody]);
    let faces = getMatchingFaceIndexes(bodyTone);
    selectedFace = faces.length ? faces[0] : 0;
    updatePickers();
    renderCharacter();
  }, bodyDisabledIdx);

  // Face: only show faces matching body tone
  let bodyTone = skinToneFromBase(bodyBaseNames[selectedBody]);
  let matchingFaces = getMatchingFaceIndexes(bodyTone);
  createPicker(matchingFaces.map(i=>faceBaseNames[i]), "face-pickers", matchingFaces.indexOf(selectedFace), (relIdx) => {
    selectedFace = matchingFaces[relIdx];
    updatePickers();
    renderCharacter();
  });

  // Hair: all
  createPicker(hairBaseNames, "hair-pickers", selectedHair, (idx) => {
    selectedHair = idx;
    updatePickers();
    renderCharacter();
  });
}

function renderCharacter() {
  const canvas = document.getElementById("charCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // Layer order
  const layers = [
    BASE + bodyBaseNames[selectedBody]+".png",
    BASE + faceBaseNames[selectedFace]+".png",
    BASE + hairBaseNames[selectedHair]+".png"
  ];
  if (equippedArmor !== null) layers.push(BASE + armorBaseNames[equippedArmor]+".png");
  if (showHelmet && equippedHelmet !== null) layers.push(BASE + helmetBaseNames[equippedHelmet]+".png");
  if (showWeapons && selectedWeapon !== null) layers.push(BASE + weaponBaseNames[selectedWeapon]+".png");
  let loaded = 0, imgs = [];
  layers.forEach((src,i)=>{
    const im = new Image();
    imgs[i]=null;
    im.src = src;
    im.onload = ()=>{imgs[i]=im; if(++loaded===layers.length)draw();};
    im.onerror = ()=>{if(++loaded===layers.length)draw();};
  });
  function draw() {
    imgs.forEach(im=>{if(im)ctx.drawImage(im,0,0,canvas.width,canvas.height);});
  }
}

// Armor picker
function createArmorPicker() {
  const picker = document.getElementById("armor-pickers");
  picker.innerHTML = "";
  armorBaseNames.forEach((base, idx) => {
    const img = document.createElement("img");
    img.src = BASE + base + "-tmb.png";
    img.alt = base;
    img.className = equippedArmor === idx ? "selected" : "";
    img.addEventListener("click", () => {
      equippedArmor = idx;
      renderCharacter();
      createArmorPicker();
    });
    picker.appendChild(img);
  });
  document.getElementById("armor-row").style.display = "block";
}
// Helmet picker
function createHelmetPicker() {
  const picker = document.getElementById("armor-pickers");
  helmetBaseNames.forEach((base, idx) => {
    const img = document.createElement("img");
    img.src = BASE + base;
    img.alt = base;
    img.className = equippedHelmet === idx ? "selected" : "";
    img.addEventListener("click", () => {
      equippedHelmet = idx;
      renderCharacter();
      createHelmetPicker();
    });
    picker.appendChild(img);
  });
  document.getElementById("armor-row").style.display = "block";
}

document.addEventListener("DOMContentLoaded", () => {
  updatePickers();
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
  updatePickers();
  renderCharacter();
});
document.getElementById("randomBtn").addEventListener("click", function () {
  if (physiqueScore) selectedBody = Math.floor(Math.random() * bodyBaseNames.length);
  let bodyTone = skinToneFromBase(bodyBaseNames[selectedBody]);
  let faces = getMatchingFaceIndexes(bodyTone);
  selectedFace = faces.length ? faces[Math.floor(Math.random() * faces.length)] : 0;
  selectedHair = Math.floor(Math.random() * hairBaseNames.length);
  updatePickers();
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
