/**
 * Character Creator Customization
 * Copyright © 2024 [Corbett, editor in chief of Ogre Adventurer, a publishing company of Slayers of Rings § (n, and &) Crowns. Time stamped via GitHub repository push]
 * Created: December 26, 2024
 * All rights reserved.
 */

const BASE = "../../../assets/";
const PORTRAIT_EXAMPLE = `${BASE}portrait-examp-bow-hr.png`;

// Image paths for special layers
const IMG_BG = `${BASE}highres-canvas-bg.png`;
const IMG_ARMOR = `${BASE}set-epic-fur-mantle.png`;
const IMG_HELMET = `${BASE}bear-skn-helmet.png`;
const IMG_WEAPON_BACK = `${BASE}kaida-great-bow-bck.png`;
const IMG_WEAPON_FRONT = `${BASE}kaida-btlax-frnt.png`;

// ONLY MUSCULAR BODY TYPES
const bodyOptions = [
  { src: `${BASE}fbody-musc-drk.png`, thumb: `${BASE}fbody-musc-drk-tmb.png`, skin: "drk", type: "muscular", enabled: true },
  { src: `${BASE}fbody-musc-med.png`, thumb: `${BASE}fbody-musc-med-tmb.png`, skin: "med", type: "muscular", enabled: true },
  { src: `${BASE}fbody-musc-pale.png`, thumb: `${BASE}fbody-musc-pale-tmb.png`, skin: "pale", type: "muscular", enabled: true }
];

const faceOptions = [
  // Dark skin faces
  { src: `${BASE}femface1-drk-hzl.png`, thumb: `${BASE}femface1-drk-hzl-tmb.png`, skin: "drk", eyes: "hzl", enabled: true },
  { src: `${BASE}femface1-drk-grn.png`, thumb: `${BASE}femface1-drk-grn-tmb.png`, skin: "drk", eyes: "grn", enabled: true }, // NO THUMBNAIL - using full image
  { src: `${BASE}femface2-drk-grn.png`, thumb: `${BASE}femface2-drk-grn-tmb.png`, skin: "drk", eyes: "grn", enabled: true }, // NO FULL IMAGE - using thumbnail
  
  // Medium skin faces
  { src: `${BASE}femface1-med-brn.png`, thumb: `${BASE}femface1-med-brn-tmb.png`, skin: "med", eyes: "brn", enabled: true },
  { src: `${BASE}femface1-med-hzl.png`, thumb: `${BASE}femface1-med-hzl-tmb.png`, skin: "med", eyes: "hzl", enabled: true },
  { src: `${BASE}femface1-med-grn.png`, thumb: `${BASE}femface1-med-grn-tmb.png`, skin: "med", eyes: "grn", enabled: true },
  { src: `${BASE}femface1-med-blk.png`, thumb: `${BASE}femface1-med-blk-tmb.png`, skin: "med", eyes: "blk", enabled: true },
  { src: `${BASE}femface2-med-brn.png`, thumb: `${BASE}femface2-med-brn-tmb.png`, skin: "med", eyes: "brn", enabled: true },
  { src: `${BASE}femface2-med-blu.png`, thumb: `${BASE}femface2-med-blu-tmb.png`, skin: "med", eyes: "blu", enabled: true }, // NO THUMBNAIL - using full image
  { src: `${BASE}femface2-med-grn.png`, thumb: `${BASE}femface2-med-grn-tmb.png`, skin: "med", eyes: "grn", enabled: true }, // NO THUMBNAIL - using full image
  { src: `${BASE}femface4-med.png`, thumb: `${BASE}femface4-med.png`, skin: "med", eyes: "brn", enabled: true }, // Corrected: full image instead of mismatched thumb
  { src: `${BASE}femface5-med-blu-mkp.png`, thumb: `${BASE}femface5-med-blu-mkp-tmb.png`, skin: "med", eyes: "blu", enabled: true }, // NO FULL IMAGE - using thumbnail
  
  // Pale skin faces
  { src: `${BASE}femface2-pale-grn.png`, thumb: `${BASE}femface2-pale-grn-tmb.png`, skin: "pale", eyes: "grn", enabled: true }, // NO FULL IMAGE - using thumbnail
  { src: `${BASE}femface4-pale.png`, thumb: `${BASE}femface4-pale-brn-tmb.png`, skin: "pale", eyes: "brn", enabled: true },
  { src: `${BASE}femface5-pale-blu-mkp.png`, thumb: `${BASE}femface5-pale-blu-mkp-tmb.png`, skin: "pale", eyes: "blu", enabled: true }
];

const facePaintOptions = [
  { src: "", thumb: "", label: "None", enabled: true }, // No face paint option
  { src: `${BASE}facepnt1-blu.png`, thumb: `${BASE}facepnt1-blu-tmb.png`, color: "blu", enabled: true },
  { src: `${BASE}facepnt2-blu.png`, thumb: `${BASE}facepnt2-blu-tmb.png`, color: "blu", enabled: true },
  { src: `${BASE}facepnt3-red.png`, thumb: `${BASE}facepnt3-red-tmb.png`, color: "red", enabled: true },
  { src: `${BASE}facepnt4-blk.png`, thumb: `${BASE}facepnt4-blk-tmb.png`, color: "blk", enabled: true },
  { src: `${BASE}facepnt5-blk.png`, thumb: `${BASE}facepnt5-blk-tmb.png`, color: "blk", enabled: true },
  { src: `${BASE}facepnt5-red.png`, thumb: `${BASE}facepnt5-red-tmb.png`, color: "red", enabled: true }
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

let selected = {
  body: 0,
  face: 0,
  facePaint: 0, // 0 = None
  hair: 0,
  armor: false,
  helmet: false,
  weapon: false
};

let isPortraitView = false;

function pickFirstEnabledFace(skin) {
  const index = faceOptions.findIndex(f => f.skin === skin && f.enabled);
  return index !== -1 ? index : 0;
}

// Create placeholder thumbnail with text
function createPlaceholder(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#333';
  ctx.fillRect(0, 0, 100, 100);

  ctx.fillStyle = '#888';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const words = text.split(' ');
  const lineHeight = 14;
  const startY = 50 - ((words.length - 1) * lineHeight / 2);

  words.forEach((word, i) => {
    ctx.fillText(word, 50, startY + (i * lineHeight));
  });

  return canvas.toDataURL();
}

function renderBodyPickers() {
  const container = document.getElementById("body-pickers");
  container.innerHTML = "";
  const rowDiv = document.createElement("div");
  rowDiv.className = "thumb-list";

  bodyOptions.forEach((body, idx) => {
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.alignItems = "center";

    const img = document.createElement("img");

    // Check if thumbnail exists, otherwise create placeholder
    if (body.thumb) {
      img.src = body.thumb;
    } else {
      img.src = createPlaceholder('Coming Soon');
      img.className = "thumb placeholder";
    }

    img.className = "thumb" +
      (selected.body === idx ? " selected" : "") +
      (!body.enabled ? " disabled" : "");

    img.onclick = function() {
      if (body.enabled) {
        selected.body = idx;
        selected.face = pickFirstEnabledFace(body.skin);
        renderAllPickers();
        renderCharacter();
      }
    };

    wrap.appendChild(img);
    rowDiv.appendChild(wrap);
  });

  container.appendChild(rowDiv);
}

function renderFacePickers() {
  const container = document.getElementById("face-pickers");
  container.innerHTML = "";
  let body = bodyOptions[selected.body];
  let skin = (body && body.skin) ? body.skin : "med";
  let filtered = faceOptions.filter(f => f.skin === skin);

  console.log("Rendering face pickers for skin:", skin);
  console.log("Filtered faces:", filtered.length);
  console.log("Currently selected face index:", selected.face);

  const rowDiv = document.createElement("div");
  rowDiv.className = "thumb-list";

  filtered.forEach((face) => {
    const globalIdx = faceOptions.indexOf(face);
    const img = document.createElement("img");

    // Fix: always use face.thumb if available, else placeholder
    if (face.thumb && face.thumb.trim() !== "") {
      img.src = face.thumb;
    } else {
      img.src = createPlaceholder('Coming Soon');
    }

    // Build className properly
    let className = "thumb";
    if (!face.thumb || face.thumb.trim() === "") className += " placeholder";
    if (!face.enabled) className += " disabled";
    if (selected.face === globalIdx) className += " selected";

    img.className = className;

    img.onclick = function() {
      if (face.enabled) {
        console.log("Face clicked! Index:", globalIdx, "Skin:", face.skin);
        selected.face = globalIdx;
        renderFacePickers();
        renderCharacter();
      }
    };
    rowDiv.appendChild(img);
  });

  container.appendChild(rowDiv);
}

// ... rest of your code remains unchanged ...
// (No other changes needed, only the fix in renderFacePickers)
