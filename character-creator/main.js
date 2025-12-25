const BASE = "https://sorcrpg.com/character-creator/assets/";

// ----------- IMAGE ARRAYS ---------------
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

// ----------- STATE & SETUP ---------------
let selected = { body: 8, face: null, hair: 0 }; // default: pale thin body
let equippedArmor = null, selectedWeapon = null;
let showHelmet = false, showWeapons = false, physiqueScore = null;

// ----------- UTILS FOR SKIN TONE ----------
function getBodySkinTone(idx) {
  return bodyOptions[idx].skinTone;
}
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

  // Lock body picker before physique score
  let lockBody = (featureKey === "body" && !physiqueScore);

  filteredOptions.forEach((option, idx) => {
    const img = document.createElement('img');
    img.src = option.thumb;
    img.alt = `${featureKey} ${idx + 1}`;

    let isSelected =
      (featureKey === "body" && bodyOptions.indexOf(option) === selected.body) ||
      (featureKey === "face" && faceOptions.indexOf(option) === selected.face) ||
      (featureKey === "hair" && hairOptions.indexOf(option) === selected.hair);

    img.classList.toggle("selected", isSelected);

    // --- Hold-to-zoom logic ---
    let zoomTimer = null;
    const zoomIn = () => img.classList.add("thumb-zoomed");
    const zoomOut = () => {
      img.classList.remove("thumb-zoomed");
      if (zoomTimer) clearTimeout(zoomTimer);
      zoomTimer = null;
    };
    img.addEventListener('mousedown', (e) => { zoomTimer = setTimeout(zoomIn, 1200); });
    img.addEventListener('touchstart', (e) => { zoomTimer = setTimeout(zoomIn, 120
