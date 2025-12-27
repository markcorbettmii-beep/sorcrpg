const BASE = "assets/";

// Image paths for special layers
const IMG_BG = `${BASE}highres-canvas-bg.png`;
const IMG_FB_MUSC_HR = `${BASE}fbody-musc-hr.png`;
const IMG_ARMOR = `${BASE}set-epic-fur-mantle.png`;
const IMG_HELMET = `${BASE}bear-skn-helmet.png`;
const IMG_WEAPON = `${BASE}kaidas-great-bow.png`;

// --- Data ---
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
      // Only HR muscular is enabled, rest are placeholders
      { src: "", thumb: `${BASE}placeholder-pale.png`, skin: "pale", type: "muscular", enabled: false },
      { src: IMG_FB_MUSC_HR, thumb: `${BASE}fbody-musc-drk-tmb.png`, skin: "hr", type: "muscular_hr", enabled: true, isHighRes: true },
      { src: "", thumb: `${BASE}placeholder-drk.png`, skin: "drk", type: "muscular", enabled: false }
    ]
  },
  {
    label: "Body Type (thin)",
    bodies: [
      // Placeholders only
      { src: "", thumb: `${BASE}placeholder-pale.png`, skin: "pale", type: "thin", enabled: false },
      { src: "", thumb: `${BASE}placeholder-med.png`, skin: "med", type: "thin", enabled: false },
      { src: "", thumb: `${BASE}placeholder-drk.png`, skin: "drk", type: "thin", enabled: false }
    ]
  }
];
const bodyOptions = bodyTypeRows.flatMap(row => row.bodies);

const faceOptions = [
  // DARK
  { src: `${BASE}femface1-dark-blu.png`, thumb: `${BASE}femface1-dark-blu-tmb.png`, skin: "drk", eyes: "blu", enabled: true },
  { src: `${BASE}femface1-dark-hzl.png`, thumb: `${BASE}femface1-dark-hzl-tmb.png`, skin: "drk", eyes: "hzl", enabled: true },
  { src: `${BASE}femface2-dark-brn.png`, thumb: `${BASE}femface2-dark-brn-tmb.png`, skin: "drk", eyes: "brn", enabled: true },
  { src: `${BASE}femface2-dark-blu.png`, thumb: `${BASE}femface2-dark-blu-tmb.png`, skin: "drk", eyes: "blu", enabled: true },
  // MEDIUM
  { src: `${BASE}femface1-med-brn.png`, thumb: `${BASE}femface1-med-brn-tmb.png`, skin: "med", eyes: "brn", enabled: true },
  { src: `${BASE}femface1-med-hzl.png`, thumb: `${BASE}femface1-med-hzl-tmb.png`, skin: "med", eyes: "hzl", enabled: true },
  { src: `${BASE}femface1-med-grn.png`, thumb: `${BASE}femface1-med-grn-tmb.png`, skin: "med", eyes: "grn", enabled: true },
  { src: `${BASE}femface2-med-brn.png`, thumb: `${BASE}femface2-med-brn-tmb.png`, skin: "med", eyes: "brn", enabled: true },
  { src: `${BASE}femface2-med-blu.png`, thumb: `${BASE}femface2-med-blu-tmb.png`, skin: "med", eyes: "blu", enabled: true },
  { src: `${BASE}femface3-med-brn.png`, thumb: `${BASE}femface3-med-brn-tmb.png`, skin: "med", eyes: "brn", enabled: false },
  // PALE
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

// --- Selection state ---
let selected = {
  body: 2,  // Default: 2nd massive body
  face: 0,   // index in filtered face array, not faceOptions!
  hair: 5,
  armor: false,
  helmet: false,
  weapon: false
};

// Helper: pick first enabled face for given skin
function pickFirstEnabledFace(skin) {
  const filtered = faceOptions.filter(f => f.skin === skin && f.enabled);
  return filtered.length ? 0 : -1;
}

// --- Render Pickers ---
function renderBodyPickers() {
  const container = document.getElementById("body-pickers");
  container.innerHTML = "";
  let idx = 0;
  bodyTypeRows.forEach(row => {
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
      img.onclick = function() {
        if (body.enabled) {
          selected.body = idx;
          // For HR muscular: face is NOT used.
          if (body.skin === "hr") {
            selected.face = -1;
            selected.hair = 5; // Only hair style 6 fits (index 5)
          } else {
            // pick first enabled face for this skin
            const skin = body.skin || "pale";
            selected.face = pickFirstEnabledFace(skin);
            // If current hair is not enabled, pick first enabled
            if (!hairOptions[selected.hair].enabled) {
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
  // For HR muscular: NO FACE
  if (skin === "hr") {
    container.innerHTML = "<div style='color:#888;font-style:italic;'>No face available for this body type.</div>";
    return;
  }
  let filtered = faceOptions.filter(f => f.skin === skin);

  filtered.forEach((face, idx) => {
    const img = document.createElement("img");
    img.src = face.thumb;
    img.className = "thumb" +
      (face.enabled ? "" : " disabled") +
      (selected.face === idx ? " selected" : "");
    img.onclick = function() {
      if (face.enabled) {
        selected.face = idx; // index in filtered
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
    // For HR muscular: only hair 6 fits (index 5)
    if (skin === "hr" && idx !== 5) {
      return;
    }
    const img = document.createElement("img");
    img.src = hair.thumb;
    img.className = "thumb" +
      (!hair.enabled ? " disabled" : "") +
      (selected.hair === idx ? " selected" : "");
    img.onclick = function() {
      if (hair.enabled) {
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

// --- Render Character ---
function renderCharacter(callback) {
  const canvas = document.getElementById("charCanvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 640;
  canvas.height = 1280;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Always start with BG
  const bgLayer = { src: IMG_BG };
  let body = bodyOptions[selected.body];
  let skin = (body && body.skin) ? body.skin : "pale";
  let layers = [bgLayer];

  // Weapon (back) layer if enabled
  if (selected.weapon) {
    layers.push({ src: IMG_WEAPON, layer: "weapon" });
  }

  // Body layer
  if (body && body.src) layers.push(body);

  // Armor (over body, under face/hair/helmet)
  if (selected.armor) {
    layers.push({ src: IMG_ARMOR, layer: "armor" });
  }

  // Face layer (if not HR muscular)
  if (skin !== "hr") {
    let filteredFaces = faceOptions.filter(f => f.skin === skin);
    let face = filteredFaces[selected.face];
    if (face && face.src && face.enabled !== false) layers.push(face);
  }

  // Hair layer
  let hair = hairOptions[selected.hair];
  if (hair && hair.src && hair.enabled !== false) layers.push(hair);

  // Helmet (top layer)
  if (selected.helmet) {
    layers.push({ src: IMG_HELMET, layer: "helmet" });
  }

  // Use Promise.all for race-free image loading
  Promise.all(
    layers.map(opt =>
      new Promise(resolve => {
        if (!opt || !opt.src) return resolve(null);
        const im = new window.Image();
        im.src = opt.src;
        im.onload = () => resolve(im);
        im.onerror = () => resolve(null);
      })
    )
  ).then(imgs => {
    imgs.forEach(im => {
      if (im) ctx.drawImage(im, 0, 0, canvas.width, canvas.height);
    });
    if (callback) callback(canvas);
  });
}

// --- Physique Form ---
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
  physiqueError.style.display = "none";
  physiqueApprovedMsg.style.display = "block";
});

// --- Equipment checkboxes ---
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

// --- Randomizer ---
document.getElementById("randomBtn").addEventListener("click", function() {
  // Pick a random enabled body
  let enabledBodiesIdx = bodyOptions.map((body, idx) => body.enabled ? idx : -1).filter(idx => idx !== -1);
  selected.body = enabledBodiesIdx[Math.floor(Math.random() * enabledBodiesIdx.length)];

  let body = bodyOptions[selected.body];
  let skin = (body && body.skin) ? body.skin : "pale";
  // For HR muscular: only hair style 6, no face
  if (skin === "hr") {
    selected.face = -1;
    selected.hair = 5;
  } else {
    // Pick random enabled face for this skin
    let filteredFaces = faceOptions.filter(f => f.skin === skin && f.enabled);
    selected.face = Math.floor(Math.random() * filteredFaces.length);
    // Pick random enabled hair
    let enabledHairIdx = hairOptions.map((h, idx) => h.enabled ? idx : -1).filter(idx => idx !== -1);
    selected.hair = enabledHairIdx[Math.floor(Math.random() * enabledHairIdx.length)];
  }
  // Randomize equipment
  selected.armor = Math.random() < 0.5;
  selected.helmet = Math.random() < 0.5;
  selected.weapon = Math.random() < 0.5;

  // Update checkboxes
  document.getElementById("equipArmorChk").checked = selected.armor;
  document.getElementById("equipHelmetChk").checked = selected.helmet;
  document.getElementById("equipWeaponsChk").checked = selected.weapon;

  renderAllPickers();
  renderCharacter();
});

// --- Saveable JPEG ---
const showJpegBtn = document.getElementById("showJpegBtn");
const jpegPreview = document.getElementById("jpegPreview");
const saveInstr = document.getElementById("saveInstr");
const jpegButtons = document.getElementById("jpegButtons");
const editingButtons = document.getElementById("editingButtons");
const backBtn = document.getElementById("backBtn");

showJpegBtn.addEventListener("click", function() {
  renderCharacter(function(canvas) {
    let dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    jpegPreview.src = dataUrl;
    jpegPreview.style.display = "block";
    saveInstr.style.display = "block";
    jpegButtons.style.display = "block";
    editingButtons.style.display = "none";
    document.getElementById("characterCanvasContainer").style.display = "none";
  });
});

backBtn.addEventListener("click", function() {
  jpegPreview.style.display = "none";
  saveInstr.style.display = "none";
  jpegButtons.style.display = "none";
  editingButtons.style.display = "block";
  document.getElementById("characterCanvasContainer").style.display = "flex";
});

// --- Initialization ---
renderAllPickers();
renderCharacter();
