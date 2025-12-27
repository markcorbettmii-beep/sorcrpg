const BASE = "assets/";

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
  face: 0,
  hair: 5,
  armor: false,
  helmet: false,
  weapon: false
};

function pickFirstEnabledFace(skin) {
  const filtered = faceOptions.filter(f => f.skin === skin && f.enabled);
  return filtered.length ? 0 : -1;
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
      img.onclick = function() {
        if (body.enabled) {
          selected.body = idx;
          // For HR muscular: face is NOT used.
          if (body.skin === "hr") {
            selected.face = -1;
            selected.hair = 5;
          } else {
            const skin = body.skin || "pale";
            selected.face = pickFirstEnabledFace(skin);
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
        selected.face = idx;
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

function renderCharacter(callback) {
  const canvas = document.getElementById("charCanvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 640;
  canvas.height = 1280;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const bgLayer = { src: IMG_BG };
  let body = bodyOptions[selected.body];
  let skin = (body && body.skin) ? body.skin : "pale";
  let layers = [bgLayer];

  if (selected.weapon) {
    layers.push({ src: IMG_WEAPON, layer: "weapon" });
  }
  if (body && body.src) layers.push(body);
  if (selected.armor) {
    layers.push({ src: IMG_ARMOR, layer: "armor" });
  }
  if (skin !== "hr") {
    let filteredFaces = faceOptions.filter(f => f.skin === skin && f.enabled);
    let face = filteredFaces[selected.face];
    if (face && face.src && face.enabled !== false) layers.push(face);
  }
  let hair = hairOptions[selected.hair];
  if (hair && hair.src && hair.enabled !== false) layers.push(hair);
  if (selected.helmet) {
    layers.push({ src: IMG_HELMET, layer: "helmet" });
  }

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
    selected.face = -1;
    selected.hair = 5;
  } else {
    let filteredFaces = faceOptions.filter(f => f.skin === skin && f.enabled);
    selected.face = Math.floor(Math.random() * filteredFaces.length);
    let enabledHairIdx = hairOptions.map((h, idx) => h.enabled ? idx : -1).filter(idx => idx !== -1);
    selected.hair = enabledHairIdx[Math.floor(Math.random() * enabledHairIdx.length)];
  }
  selected.armor = document.getElementById("equipArmorChk").checked ? (Math.random() < 0.5) : false;
  selected.helmet = document.getElementById("equipHelmetChk").checked ? (Math.random() < 0.5) : false;
  selected.weapon = document.getElementById("equipWeaponsChk").checked ? (Math.random() < 0.5) : false;

  document.getElementById("equipArmorChk").checked = selected.armor;
  document.getElementById("equipHelmetChk").checked = selected.helmet;
  document.getElementById("equipWeaponsChk").checked = selected.weapon;

  renderAllPickers();
  renderCharacter();
});

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

renderAllPickers();
renderCharacter();
