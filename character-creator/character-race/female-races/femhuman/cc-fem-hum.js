<!DOCTYPE html>
<!--
  Female Human Character Creator
  Copyright © 2024 Corbett, editor in chief of Ogre Adventurer, a publishing company of Slayers of Rings § (and, and &) Crowns. Time stamped via GitHub repository push
  Created: December 26, 2024
  All rights reserved.
-->
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Female Human Character Creator</title>
  <meta name="viewport" content="width=520, initial-scale=1, user-scalable=yes, minimum-scale=0.5, maximum-scale=3" />
  <link rel="stylesheet" href="../../../../style.css" />
  <link rel="stylesheet" href="../../../ccstyle.css" />
  <style>
    /* ... (your CSS remains unchanged, omitted here for brevity) ... */
    /* Keep your existing styles exactly as you provided */
    /* ... (CSS code omitted for brevity, see above) ... */
  </style>
</head>
<body>
  <h1>SorC Female Human Character Creator</h1>
  <p class="coming-soon">Armaments and Gear coming soon…</p>
  
  <div class="main-layout">
    <div class="center-panel">
      <form id="physiqueForm">
        <label for="physiqueInput"><strong>Enter Physique for Body Type</strong></label>
        <input type="number" id="physiqueInput" min="1" max="99" required>
        <button type="submit">Submit Physique</button>
        <span id="physiqueError" style="color:red;display:none;">Please enter a valid score (1 or higher).</span>
      </form>
      
      <div id="physiqueApprovedMsg" style="display:none;margin-bottom:1em;color:#DED463;font-weight:bold;">
        Physique accepted! You can now create your character. Monitored by GM
      </div>
      
      <div id="characterCanvasContainer">
        <div id="canvasInstruction">
          Press n hold image to flip to portrait example
        </div>
        <canvas id="charCanvas" width="640" height="1280"></canvas>
      </div>

      <div id="character-actions">
        <button id="randomBtn">Random Character</button>
        <div style="margin-bottom: 0.5em; font-weight: bold; color: #e0cfc0;">(random character elements)</div>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px; justify-content: center;">
          <button id="showJpegBtn">Save as JPEG</button>
          <span style="font-size: 0.98em; color: #e0cfc0;">for character profile</span>
        </div>
      </div>

      <div id="equipment-controls">
        <label>
          <input type="checkbox" id="equipWeaponsChk"> Show Weapons
        </label>
        <button id="cardWeaponsBtn" type="button" style="margin-left:8px;">View Linked Card (coming soon)</button>
        <br>
        <label>
          <input type="checkbox" id="equipArmorChk"> Show Armor
        </label>
        <button id="cardArmorBtn" type="button" style="margin-left:8px;">View Linked Card (coming soon)</button>
        <br>
        <label>
          <input type="checkbox" id="equipHelmetChk"> Show Helmet
        </label>
        <br>
        <div style="margin:10px 0; font-weight:bold; color:#DED463; font-size:1.1em;">
          Fellowship displays coming soon
        </div>
      </div>
      
      <div id="fellowship-controls">
        <div style="display: flex; align-items: center; gap: 1.5em;">
          <label style="margin-bottom:0;">
            <input type="checkbox" id="equipFellowshipsChk" disabled> Fellowships
            <span style="margin-left:6px;">(toggle mount on/off <input type="checkbox" id="toggleMountChk" disabled style="vertical-align:middle;">)</span>
          </label>
        </div>
        <br>
        <label>
          <input type="checkbox" id="equipHearthChk" disabled> Selected Hearth
        </label>
        <br>
        <div style="margin:12px 0 4px 0; font-weight:bold; color:#DED463; font-size:1em;">
          Fellowships are Agothian, Pets, Rumanents, Mounts, Guardian, etc.
        </div>
        <div style="margin-bottom:7px; color:#fff; font-size:0.98em;">
          Hearth is any fire source you've found and chosen as your Wayfarer Compass's resting place.
        </div>
        <div style="margin-bottom:7px; color:#fff; font-size:0.98em;">
          Characters are displayed at ease and only the Armor and Weapons on your person are displayed, but in sheath.
        </div>
        <div style="margin-bottom:7px; color:#fff; font-size:0.98em;">
          Default elements are currently shown in Black and White until you own these elements (they're in color here for beta purposes).
        </div>
      </div>
      
      <div class="feature-rows">
        <div class="feature-row" id="body-row">
          <h2>Body Type <span style="font-size:0.9em;color:#888;">(muscular available)</span></h2>
          <div id="body-pickers"></div>
        </div>
        <div class="feature-row" id="face-row">
          <h2>Face <span style="font-size:0.9em;color:#888;">(hold for preview)</span></h2>
          <div id="face-pickers"></div>
        </div>
        <div class="feature-row" id="facepaint-row">
          <h2>Face Paint <span style="font-size:0.9em;color:#888;">(optional)</span></h2>
          <div id="facepaint-pickers"></div>
        </div>
        <div class="feature-row" id="hair-row">
          <h2>Hair <span style="font-size:0.9em;color:#888;">(hold for preview)</span></h2>
          <div id="hair-pickers"></div>
        </div>
      </div>
      
      <section class="body-type-explanation">
        <h2>Body Type Selection (Female Human - Beta)</h2>
        <ul>
          <li><strong>Currently available:</strong> Muscular body types (all skin tones)</li>
          <li><strong>Physique system:</strong> Not functional during beta - you can select any body type for testing</li>
          <li><strong>Coming soon:</strong> Thin, lean, and massive body types</li>
        </ul>
      </section>
      
      <div class="coming-soon">
        Armaments and Gear coming soon...
      </div>
    </div>
  </div>
  
  <script>
/** FULL REVISED JS STARTS HERE **/
// Your existing code, with a key fix in `renderFacePickers()` to ensure it uses `face.thumb`
// and that your data's `thumb` properties are correct (which you confirmed are present).
// I will include the entire script with the fix applied.

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

    // Use the thumbnail for thumb list
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

  const rowDiv = document.createElement("div");
  rowDiv.className = "thumb-list";

  filtered.forEach((face) => {
    const globalIdx = faceOptions.indexOf(face);
    const img = document.createElement("img");

    // Use face.thumb for thumbnail display
    if (face.thumb) {
      img.src = face.thumb;
    } else {
      img.src = createPlaceholder('Coming Soon');
    }

    // Class handling
    let className = "thumb";
    if (!face.thumb) className += " placeholder";
    if (!face.enabled) className += " disabled";
    if (selected.face === globalIdx) className += " selected";

    img.className = className;

    img.onclick = function() {
      if (face.enabled) {
        selected.face = globalIdx;
        renderFacePickers();
        renderCharacter();
      }
    };
    rowDiv.appendChild(img);
  });

  container.appendChild(rowDiv);
}

function renderFacePaintPickers() {
  const container = document.getElementById("facepaint-pickers");
  container.innerHTML = "";

  const rowDiv = document.createElement("div");
  rowDiv.className = "thumb-list";

  facePaintOptions.forEach((paint, idx) => {
    const img = document.createElement("img");

    if (idx === 0) {
      // "None" option
      img.src = createPlaceholder('None');
    } else if (paint.thumb) {
      img.src = paint.thumb;
    } else {
      img.src = createPlaceholder('Coming Soon');
    }

    let className = "thumb";
    if (idx === 0) className += " placeholder";
    if (!paint.enabled) className += " disabled";
    if (selected.facePaint === idx) className += " selected";

    img.className = className;

    img.onclick = function() {
      if (paint.enabled) {
        selected.facePaint = idx;
        renderFacePaintPickers();
        renderCharacter();
      }
    };
    rowDiv.appendChild(img);
  });

  container.appendChild(rowDiv);
}

function renderHairPickers() {
  const container = document.getElementById("hair-pickers");
  container.innerHTML = "";
  const rowDiv = document.createElement("div");
  rowDiv.className = "thumb-list";

  hairOptions.forEach((hair, idx) => {
    const img = document.createElement("img");

    if (hair.thumb) {
      img.src = hair.thumb;
    } else {
      img.src = createPlaceholder('Coming Soon');
    }

    let className = "thumb";
    if (!hair.thumb) className += " placeholder";
    if (!hair.enabled) className += " disabled";
    if (selected.hair === idx) className += " selected";

    img.className = className;

    img.onclick = function() {
      if (hair.enabled) {
        selected.hair = idx;
        renderHairPickers();
        renderCharacter();
      }
    };
    rowDiv.appendChild(img);
  });

  container.appendChild(rowDiv);
}

function renderAllPickers() {
  renderBodyPickers();
  renderFacePickers();
  renderFacePaintPickers();
  renderHairPickers();
}

function getCanvasSize() {
  const maxWidth = 640, maxHeight = 1280;
  let container = document.getElementById("characterCanvasContainer");
  let vw = window.innerWidth;
  let vh = window.innerHeight;
  let width = Math.min(container ? container.offsetWidth : maxWidth, vw * 0.96, maxWidth);
  let height = Math.min(width * 2, vh * 0.92, maxHeight);
  if (height / 2 < width) width = height / 2;
  return { width: Math.round(width), height: Math.round(height) };
}

function resizeCanvasAndRender() {
  const canvas = document.getElementById("charCanvas");
  if (!canvas) return;
  const { width, height } = getCanvasSize();
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  renderCharacter();
}

function renderCharacter(callback) {
  const canvas = document.getElementById("charCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (isPortraitView) {
    const img = new window.Image();
    img.src = PORTRAIT_EXAMPLE;
    img.onload = function() {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (callback) callback(canvas);
    };
    img.onerror = function() {
      if (callback) callback(canvas);
    };
    return;
  }

  // NEW LAYER ORDER: canvas bg, back weapon, body, armor, face, face paint, hair, helmet, front weapon
  let layers = [];

  // 1. Background
  layers.push({ src: IMG_BG, layer: "bg" });
  // 2. Back weapon
  if (selected.weapon) {
    layers.push({ src: IMG_WEAPON_BACK, layer: "weapon_back" });
  }
  // 3. Body
  let body = bodyOptions[selected.body];
  if (body && body.src) {
    layers.push({ src: body.src, layer: "body" });
  }
  // 4. Armor
  if (selected.armor) {
    layers.push({ src: IMG_ARMOR, layer: "armor" });
  }
  // 5. Face
  if (selected.face !== -1 && faceOptions[selected.face]) {
    let face = faceOptions[selected.face];
    if (face && face.src && face.enabled !== false) {
      layers.push({ src: face.src, layer: "face" });
    }
  }
  // 6. Face Paint
  if (selected.facePaint > 0 && facePaintOptions[selected.facePaint]) {
    let paint = facePaintOptions[selected.facePaint];
    if (paint && paint.src && paint.enabled !== false) {
      layers.push({ src: paint.src, layer: "facepaint" });
    }
  }
  // 7. Hair
  if (selected.hair !== -1 && hairOptions[selected.hair]) {
    let hair = hairOptions[selected.hair];
    if (hair && hair.src && hair.enabled !== false) {
      layers.push({ src: hair.src, layer: "hair" });
    }
  }
  // 8. Helmet
  if (selected.helmet) {
    layers.push({ src: IMG_HELMET, layer: "helmet" });
  }
  // 9. Front weapon
  if (selected.weapon) {
    layers.push({ src: IMG_WEAPON_FRONT, layer: "weapon_front" });
  }

  Promise.all(
    layers.map(opt => 
      new Promise(resolve => {
        if (!opt || !opt.src) return resolve(null);
        const im = new window.Image();
        im.src = opt.src;
        im.onload = () => resolve(im);
        im.onerror = () => {
          console.warn(`Failed to load: ${opt.src}`);
          resolve(null);
        };
      })
    )
  ).then(imgs => {
    imgs.forEach(im => {
      if (im) ctx.drawImage(im, 0, 0, canvas.width, canvas.height);
    });
    if (callback) callback(canvas);
  });
}

// Your existing event handlers, form handlers, and initial setup
// (unchanged, just included here for completeness)

const physiqueForm = document.getElementById("physiqueForm");
const physiqueInput = document.getElementById("physiqueInput");
const physiqueError = document.getElementById("physiqueError");
const physiqueApprovedMsg = document.getElementById("physiqueApprovedMsg");

// Physique form submit
physiqueForm.addEventListener("submit", function(e) {
  e.preventDefault();
  const val = parseInt(physiqueInput.value);
  if (isNaN(val) || val < 1) {
    physiqueError.style.display = "inline";
    physiqueApprovedMsg.style.display = "none";
    return;
  }
  if (val < 5 || val > 20) {
    physiqueError.textContent = "Only muscular body type (Physique 5-20) is available. Other body types coming soon!";
    physiqueError.style.display = "inline";
    physiqueApprovedMsg.style.display = "none";
    return;
  }
  physiqueError.style.display = "none";
  physiqueApprovedMsg.style.display = "block";
  physiqueApprovedMsg.textContent = "Physique accepted! You can now create your character. Monitored by GM";
  renderAllPickers();
  resizeCanvasAndRender();
});

// Equipment event listeners
document.getElementById("equipArmorChk").addEventListener("change", e => {
  selected.armor = e.target.checked;
  renderCharacter();
});
document.getElementById("equipHelmetChk").addEventListener("change", e => {
  selected.helmet = e.target.checked;
  renderCharacter();
});
document.getElementById("equipWeaponsChk").addEventListener("change", e => {
  selected.weapon = e.target.checked;
  renderCharacter();
});

// Random character button
document.getElementById("randomBtn").addEventListener("click", () => {
  let enabledBodiesIdx = bodyOptions.map((b, i) => b.enabled ? i : -1).filter(i => i !== -1);
  if (enabledBodiesIdx.length === 0) return;
  selected.body = enabledBodysIdx[Math.floor(Math.random() * enabledBodiesIdx.length)];

  let body = bodyOptions[selected.body];
  let skin = body && body.skin ? body.skin : "med";

  let filteredFaces = faceOptions.filter(f => f.skin === skin && f.enabled);
  if (filteredFaces.length > 0) {
    let randIdx = Math.floor(Math.random() * filteredFaces.length);
    selected.face = faceOptions.indexOf(filteredFaces[randIdx]);
  } else {
    selected.face = pickFirstEnabledFace(skin);
  }

  let enabledHairIdx = hairOptions.map((h, i) => h.enabled ? i : -1).filter(i => i !== -1);
  if (enabledHairIdx.length > 0) {
    selected.hair = enabledHairIdx[Math.floor(Math.random() * enabledHairIdx.length)];
  }

  renderAllPickers();
  resizeCanvasAndRender();
});

// Save as JPEG button
document.getElementById("showJpegBtn").addEventListener("click", () => {
  const usePortrait = isPortraitView;
  const win = window.open('', '_blank');

  renderCharacter(c => {
    const profileCanvas = document.createElement('canvas');
    profileCanvas.width = 2100;
    profileCanvas.height = 3045;
    const ctx = profileCanvas.getContext('2d');
    const profileSheet = new Image();
    profileSheet.src = `${BASE}profile-sheet-template.png`;
    profileSheet.onload = () => {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, profileCanvas.width, profileCanvas.height);
      ctx.drawImage(profileSheet, 0, 0, profileCanvas.width, profileCanvas.height);

      const portraitX = 730;
      const portraitY = 640;
      const portraitW = 640;
      const portraitH = 1000;

      if (usePortrait) {
        const portraitImg = new Image();
        portraitImg.src = PORTRAIT_EXAMPLE;
        portraitImg.onload = () => {
          ctx.drawImage(portraitImg, portraitX, portraitY, portraitW, portraitH);
          const dataUrl = profileCanvas.toDataURL('image/jpeg', 0.92);
          win.document.write('<img src="' + dataUrl + '" style="max-width:100%;">');
        };
        portraitImg.onerror = () => {
          ctx.drawImage(c, portraitX, portraitY, portraitW, portraitH);
          const dataUrl = profileCanvas.toDataURL('image/jpeg', 0.92);
          win.document.write('<img src="' + dataUrl + '" style="max-width:100%;">');
        };
      } else {
        ctx.drawImage(c, portraitX, portraitY, portraitW, portraitH);
        const dataUrl = profileCanvas.toDataURL('image/jpeg', 0.92);
        win.document.write('<img src="' + dataUrl + '" style="max-width:100%;">');
      }
    };
    profileSheet.onerror = () => {
      console.error('Failed to load profile sheet template');
      win.document.write('<p>Error: Could not load profile sheet. Make sure profile-sheet-template.png is in the assets folder.</p>');
    };
  });
});

// Responsive resize
window.addEventListener('resize', resizeCanvasAndRender);
window.addEventListener('orientationchange', resizeCanvasAndRender);

// Canvas hold to toggle portrait
const canvasEl = document.getElementById("charCanvas");
let holdTimer = null;
let touchMoved = false;

if (canvasEl) {
  // Mouse events
  canvasEl.addEventListener("mousedown", e => {
    touchMoved = false;
    holdTimer = setTimeout(() => {
      if (!touchMoved) {
        isPortraitView = !isPortraitView;
        renderCharacter();
        console.log("Portrait toggled:", isPortraitView);
      }
    }, 1200);
  });
  // Mouse move
  canvasEl.addEventListener("mousemove", () => {
    touchMoved = true;
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  });
  // Mouse up
  canvasEl.addEventListener("mouseup", () => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  });
  // Mouse leave
  canvasEl.addEventListener("mouseleave", () => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  });
  // Touch events
  canvasEl.addEventListener("touchstart", e => {
    if (e.touches.length > 1) {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
      return;
    }
    touchMoved = false;
    holdTimer = setTimeout(() => {
      if (!touchMoved) {
        isPortraitView = !isPortraitView;
        renderCharacter();
        console.log("Portrait toggled:", isPortraitView);
      }
    }, 1200);
    e.preventDefault();
  });
  // touchmove
  canvasEl.addEventListener("touchmove", e => {
    if (e.touches.length > 1) {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
      return;
    }
    touchMoved = true;
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  });
  // touchend
  canvasEl.addEventListener("touchend", e => {
    if (e.touches.length > 0) return;
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    e.preventDefault();
  });
  // touchcancel
  canvasEl.addEventListener("touchcancel", e => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  });
}

// Initialize pickers and render
renderAllPickers();
resizeCanvasAndRender();
</script>
</body>
</html>
