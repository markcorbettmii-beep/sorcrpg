/**
 * Character Creator Customization
 * Copyright © 2024 [Corbett, editor in chief of Ogre Adventurer, a publishing company of Slayers of Rings § (n, and &) Crowns. Time stamped via GitHub repository push]
 * Created: December 26, 2024
 * All rights reserved.
 */

const BASE = "assets/";
const PORTRAIT_EXAMPLE = `${BASE}portrait-examp-bow-hr.png`;

// Image paths for special layers
const IMG_BG = `${BASE}highres-canvas-bg.png`;
const IMG_FB_MUSC_HR = `${BASE}fbody-musc-hr.png`;
const IMG_ARMOR = `${BASE}set-epic-fur-mantle.png`;
const IMG_HELMET = `${BASE}bear-skn-helmet.png`;
const IMG_WEAPON = `${BASE}kaidas-great-bow.png`;

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
      { src: "", thumb: `${BASE}placeholder-pale.png`, skin: "pale", type: "muscular", enabled: false },
      { src: IMG_FB_MUSC_HR, thumb: `${BASE}fbody-musc-drk-tmb.png`, skin: "hr", type: "muscular_hr", enabled: true, isHighRes: true },
      { src: "", thumb: `${BASE}placeholder-drk.png`, skin: "drk", type: "muscular", enabled: false }
    ]
  },
  {
    label: "Body Type (thin)",
    bodies: [
      { src: "", thumb: `${BASE}placeholder-pale.png`, skin: "pale", type: "thin", enabled: false },
      { src: "", thumb: `${BASE}placeholder-med.png`, skin: "med", type: "thin", enabled: false },
      { src: "", thumb: `${BASE}placeholder-drk.png`, skin: "drk", type: "thin", enabled: false }
    ]
  }
];
const bodyOptions = bodyTypeRows.flatMap(row => row.bodies);

const faceOptions = [
  { src: `${BASE}femface1-dark-blu.png`, thumb: `${BASE}femface1-dark-blu-tmb.png`, skin: "drk", eyes: "blu", enabled: true },
  { src: `${BASE}femface1-dark-hzl.png`, thumb: `${BASE}femface1-dark-hzl-tmb.png`, skin: "drk", eyes: "hzl", enabled: true },
  { src: `${BASE}femface2-dark-brn.png`, thumb: `${BASE}femface2-dark-brn-tmb.png`, skin: "drk", eyes: "brn", enabled: true },
  { src: `${BASE}femface2-dark-blu.png`, thumb: `${BASE}femface2-dark-blu-tmb.png`, skin: "drk", eyes: "blu", enabled: true },
  { src: `${BASE}femface1-med-brn.png`, thumb: `${BASE}femface1-med-brn-tmb.png`, skin: "med", eyes: "brn", enabled: true },
  { src: `${BASE}femface1-med-hzl.png`, thumb: `${BASE}femface1-med-hzl-tmb.png`, skin: "med", eyes: "hzl", enabled: true },
  { src: `${BASE}femface1-med-grn.png`, thumb: `${BASE}femface1-med-grn-tmb.png`, skin: "med", eyes: "grn", enabled: true },
  { src: `${BASE}femface2-med-brn.png`, thumb: `${BASE}femface2-med-brn-tmb.png`, skin: "med", eyes: "brn", enabled: true },
  { src: `${BASE}femface2-med-blu.png`, thumb: `${BASE}femface2-med-blu-tmb.png`, skin: "med", eyes: "blu", enabled: true },
  { src: `${BASE}femface3-med-brn.png`, thumb: `${BASE}femface3-med-brn-tmb.png`, skin: "med", eyes: "brn", enabled: false },
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

let selected = {
  body: 2,
  face: 10,
  hair: 5,
  armor: false,
  helmet: false,
  weapon: false
};

let isPortraitView = false; // Track portrait mode

function pickFirstEnabledFace(skin) {
  const index = faceOptions.findIndex(f => f.skin === skin && f.enabled);
  return index !== -1 ? index : -1;
}

function filterBodiesByPhysique(physique) {
  bodyTypeRows.forEach((row) => {
    row.bodies.forEach((body) => {
      if (physique < 5) {
        body.enabled = (body.type === "thin");
      } else if (physique >= 5 && physique <= 20) {
        body.enabled = (body.type === "muscular_hr");
      } else {
        body.enabled = (body.type === "massive");
      }
    });
  });
}

function renderBodyPickers() {
  const container = document.getElementById("body-pickers");
  container.innerHTML = "";
  let idx = 0;
  bodyTypeRows.forEach((row) => {
    const rowDiv = document.createElement("div");
    rowDiv.className = "thumb-list";
    row.bodies.forEach((body, i) => {
      const wrap = document.createElement("div");
      wrap.style.display = "flex";
      wrap.style.flexDirection = "column";
      wrap.style.alignItems = "center";
      if (body.isHighRes) {
        const label = document.createElement("div");
        label.textContent = "Muscular HR demo";
        label.className = "hr-label";
        wrap.appendChild(label);
      }
      const img = document.createElement("img");
      img.src = body.thumb;
      img.className = "thumb" +
        (selected.body === idx ? " selected" : "") +
        (!body.enabled ? " disabled" : "");
      if (body.type === "massive") {
        img.alt = "must input a physique score greater than 20 for this body type...";
        img.title = "must input a physique score greater than 20 for this body type...";
      }
      const currentIdx = idx;
      img.onclick = function() {
        if (body.enabled) {
          selected.body = currentIdx;
          if (body.skin === "hr") {
            selected.face = pickFirstEnabledFace("med");
            selected.hair = 5;
          } else {
            const skin = body.skin || "pale";
            selected.face = pickFirstEnabledFace(skin);
            if (selected.hair !== -1 && !hairOptions[selected.hair].enabled) {
              selected.hair = hairOptions.findIndex(h => h.enabled);
            }
          }
          renderAllPickers();
          renderCharacter();
        }
      };
      wrap.appendChild(img);
      rowDiv.appendChild(wrap);
      idx++;
    });
    container.appendChild(rowDiv);
  });
}

function renderFacePickers() {
  const container = document.getElementById("face-pickers");
  container.innerHTML = "";
  let body = bodyOptions[selected.body];
  let skin = (body && body.skin) ? body.skin : "pale";
  if (skin === "hr") skin = "med";
  let filtered = faceOptions.filter(f => f.skin === skin);
  filtered.forEach((face) => {
    const globalIdx = faceOptions.indexOf(face);
    const img = document.createElement("img");
    img.src = face.thumb;
    img.className = "thumb" +
      (face.enabled ? "" : " disabled") +
      (selected.face === globalIdx ? " selected" : "");
    img.onclick = function() {
      if (face.enabled) {
        selected.face = globalIdx;
        renderFacePickers();
        renderCharacter();
      }
    };
    container.appendChild(img);
  });
}

function renderHairPickers() {
  const container = document.getElementById("hair-pickers");
  container.innerHTML = "";
  let body = bodyOptions[selected.body];
  let skin = (body && body.skin) ? body.skin : "pale";
  hairOptions.forEach((hair, idx) => {
    let enabled = hair.enabled;
    const img = document.createElement("img");
    img.src = hair.thumb;
    img.className = "thumb" +
      (!enabled ? " disabled" : "") +
      (selected.hair === idx ? " selected" : "");
    img.onclick = function() {
      if (enabled) {
        selected.hair = idx;
        renderHairPickers();
        renderCharacter();
      }
    };
    container.appendChild(img);
  });
}

function renderAllPickers() {
  renderBodyPickers();
  renderFacePickers();
  renderHairPickers();
}

// --- RESPONSIVE CANVAS ---
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

  const bgLayer = { src: IMG_BG };
  let body = bodyOptions[selected.body];
  let skin = (body && body.skin) ? body.skin : "pale";
  let layers = [bgLayer];

  if (selected.weapon) { layers.push({ src: IMG_WEAPON, layer: "weapon" }); }
  if (body && body.src && body.src.length > 0) { layers.push(body); }
  if (selected.armor) { layers.push({ src: IMG_ARMOR, layer: "armor" }); }
  if (selected.face !== -1) {
    let face = faceOptions[selected.face];
    if (face && face.src && face.enabled !== false) layers.push(face);
  }
  if (selected.hair !== -1) {
    let hair = hairOptions[selected.hair];
    if (hair && hair.src && hair.enabled !== false) layers.push(hair);
  }
  if (selected.helmet) { layers.push({ src: IMG_HELMET, layer: "helmet" }); }

  Promise.all(
    layers.map(opt =>
      new Promise(resolve => {
        if (!opt || !opt.src) return resolve(null);
        const im = new window.Image();
        im.src = opt.src;
        im.onload = () => resolve(im);
        im.onerror = () => {
          console.warn(`Failed to load image: ${opt.src}`);
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

const physiqueForm = document.getElementById("physiqueForm");
const physiqueInput = document.getElementById("physiqueInput");
const physiqueError = document.getElementById("physiqueError");
const physiqueApprovedMsg = document.getElementById("physiqueApprovedMsg");

physiqueForm.addEventListener("submit", function(e) {
  e.preventDefault();
  const val = parseInt(physiqueInput.value);
  if (isNaN(val) || val < 1) {
    physiqueError.style.display = "inline";
    physiqueApprovedMsg.style.display = "none";
    return;
  }
  if (val < 5) {
    physiqueError.textContent = "Thin fbody type not available yet.  Choose a value above 5 for muscular or above 20 for massive (refresh pg. to start over).";
    physiqueError.style.display = "inline";
    physiqueApprovedMsg.style.display = "none";
    bodyTypeRows.forEach((row) => {
      row.bodies.forEach((body) => {
        body.enabled = false;
      });
    });
    renderAllPickers();
    return;
  }
  physiqueError.style.display = "none";
  physiqueApprovedMsg.style.display = "block";
  if (val >= 5 && val <= 20) {
    physiqueApprovedMsg.textContent = "Physique accepted! You've submitted a muscular body type. You can now create your character. Monitored by GM";
  } else if (val > 20) {
    physiqueApprovedMsg.textContent = "Physique accepted! You've submitted a massive body type. You can now create your character. Monitored by GM";
  }
  filterBodiesByPhysique(val);
  let firstEnabledIdx = bodyOptions.findIndex(b => b.enabled);
  if (firstEnabledIdx !== -1) {
    selected.body = firstEnabledIdx;
    let body = bodyOptions[selected.body];
    if (body.skin === "hr") {
      selected.face = pickFirstEnabledFace("med");
      selected.hair = 5;
    } else {
      selected.face = pickFirstEnabledFace(body.skin);
      if (selected.hair !== -1 && !hairOptions[selected.hair].enabled) {
        selected.hair = hairOptions.findIndex(h => h.enabled);
      }
    }
  }
  renderAllPickers();
  resizeCanvasAndRender();
});

document.getElementById("equipArmorChk").addEventListener("change", function(e) {
  selected.armor = e.target.checked;
  renderCharacter();
});
document.getElementById("equipHelmetChk").addEventListener("change", function(e) {
  selected.helmet = e.target.checked;
  renderCharacter();
});
document.getElementById("equipWeaponsChk").addEventListener("change", function(e) {
  selected.weapon = e.target.checked;
  renderCharacter();
});

document.getElementById("randomBtn").addEventListener("click", function() {
  let enabledBodiesIdx = bodyOptions.map((body, idx) => body.enabled ? idx : -1).filter(idx => idx !== -1);
  selected.body = enabledBodiesIdx[Math.floor(Math.random() * enabledBodiesIdx.length)];

  let body = bodyOptions[selected.body];
  let skin = (body && body.skin) ? body.skin : "pale";
  if (skin === "hr") {
    let filteredFaces = faceOptions.filter(f => f.skin === "med" && f.enabled);
    let randomFaceLocalIdx = Math.floor(Math.random() * filteredFaces.length);
    selected.face = faceOptions.indexOf(filteredFaces[randomFaceLocalIdx]);
    selected.hair = 5;
  } else {
    let filteredFaces = faceOptions.filter(f => f.skin === skin && f.enabled);
    let randomFaceLocalIdx = Math.floor(Math.random() * filteredFaces.length);
    selected.face = faceOptions.indexOf(filteredFaces[randomFaceLocalIdx]);
    
    let enabledHairIdx = hairOptions.map((h, idx) => h.enabled ? idx : -1).filter(idx => idx !== -1);
    selected.hair = enabledHairIdx[Math.floor(Math.random() * enabledHairIdx.length)];
  }

  renderAllPickers();
  resizeCanvasAndRender();
});

// --- SAVE AS JPEG BUTTON ---
const showJpegBtn = document.getElementById("showJpegBtn");
showJpegBtn.addEventListener("click", function() {
  const aiPortraitChk = document.getElementById("aiPortraitChk");
  const usePortrait = aiPortraitChk && aiPortraitChk.checked;
  
  // Open blank window immediately
  const win = window.open('', '_blank');
  
  renderCharacter(function(charCanvas) {
    // Create composite canvas
    const profileCanvas = document.createElement('canvas');
    const profileCtx = profileCanvas.getContext('2d');
    
    // Profile sheet dimensions (10" x 14.5" at 210 DPI)
    profileCanvas.width = 2100;
    profileCanvas.height = 3045;
    
    // Load the profile sheet template
    const profileSheet = new Image();
    profileSheet.src = `${BASE}profile-sheet-template.png`;
    
    profileSheet.onload = function() {
      // Fill with white background first
      profileCtx.fillStyle = 'white';
      profileCtx.fillRect(0, 0, profileCanvas.width, profileCanvas.height);
      
      // Draw the profile sheet background
      profileCtx.drawImage(profileSheet, 0, 0, profileCanvas.width, profileCanvas.height);
      
      // Portrait frame position and size (adjusted higher and bigger)
      const portraitX = 730;
      const portraitY = 650;
      const portraitWidth = 640;
      const portraitHeight = 1080;
      
      if (usePortrait) {
        // Load and draw portrait example
        const portraitImg = new Image();
        portraitImg.src = PORTRAIT_EXAMPLE;
        portraitImg.onload = function() {
          profileCtx.drawImage(portraitImg, portraitX, portraitY, portraitWidth, portraitHeight);
          const dataUrl = profileCanvas.toDataURL("image/jpeg", 0.92);
          win.document.write('<img src="' + dataUrl + '" style="max-width:100%;">');
        };
        portraitImg.onerror = function() {
          // Fallback to character canvas
          profileCtx.drawImage(charCanvas, portraitX, portraitY, portraitWidth, portraitHeight);
          const dataUrl = profileCanvas.toDataURL("image/jpeg", 0.92);
          win.document.write('<img src="' + dataUrl + '" style="max-width:100%;">');
        };
      } else {
        // Draw the character canvas in the portrait frame
        profileCtx.drawImage(charCanvas, portraitX, portraitY, portraitWidth, portraitHeight);
        const dataUrl = profileCanvas.toDataURL("image/jpeg", 0.92);
        win.document.write('<img src="' + dataUrl + '" style="max-width:100%;">');
      }
    };
    
    profileSheet.onerror = function() {
      console.error('Failed to load profile sheet template');
      win.document.write('<p>Error: Could not load profile sheet. Make sure profile-sheet-template.png is in the assets folder.</p>');
    };
  });
});

// --- Responsive canvas triggers ---
window.addEventListener("resize", resizeCanvasAndRender);
window.addEventListener("orientationchange", resizeCanvasAndRender);

// --- Portrait view toggle on canvas touch/click ---
const canvasEl = document.getElementById("charCanvas");
if (canvasEl) {
  canvasEl.addEventListener("click", function() {
    isPortraitView = !isPortraitView;
    renderCharacter();
  });
  canvasEl.addEventListener("touchstart", function(e) {
    isPortraitView = !isPortraitView;
    renderCharacter();
    e.preventDefault();
  });
}

// Initial setup
renderAllPickers();
resizeCanvasAndRender();
