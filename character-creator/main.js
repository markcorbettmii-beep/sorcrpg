const BASE = "assets/";

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
      { src: "", thumb: `${BASE}placeholder-pale.png`, skin: "pale", type: "muscular", enabled: false },
      { src: `${BASE}hr-fbody-muscular.png`, thumb: `${BASE}fbody-musc-drk-tmb.png`, skin: "hr", type: "muscular_hr", enabled: true },
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
  // Medium
  { src: `${BASE}femface1-med-brn.png`, thumb: `${BASE}femface1-med-brn-tmb.png`, skin: "med", eyes: "brn", enabled: true },
  { src: `${BASE}femface1-med-hzl.png`, thumb: `${BASE}femface1-med-hzl-tmb.png`, skin: "med", eyes: "hzl", enabled: true },
  { src: `${BASE}femface1-med-grn.png`, thumb: `${BASE}femface1-med-grn-tmb.png`, skin: "med", eyes: "grn", enabled: true },
  { src: `${BASE}femface2-med-brn.png`, thumb: `${BASE}femface2-med-brn-tmb.png`, skin: "med", eyes: "brn", enabled: true },
  { src: `${BASE}femface2-med-blu.png`, thumb: `${BASE}femface2-med-blu-tmb.png`, skin: "med", eyes: "blu", enabled: true },
  { src: `${BASE}femface3-med-brn.png`, thumb: `${BASE}femface3-med-brn-tmb.png`, skin: "med", eyes: "brn", enabled: false },
  // Pale
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
  body: 2,
  face: 0,   // index in filtered face array, not faceOptions!
  hair: 5
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
          // pick first enabled face for this skin
          const skin = body.skin || "pale";
          selected.face = pickFirstEnabledFace(skin);
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
  hairOptions.forEach((hair, idx) => {
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
function renderCharacter() {
  const canvas = document.getElementById("charCanvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 640;
  canvas.height = 1280;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let body = bodyOptions[selected.body];
  let skin = (body && body.skin) ? body.skin : "pale";
  let filteredFaces = faceOptions.filter(f => f.skin === skin);
  let face = filteredFaces[selected.face];
  let hair = hairOptions[selected.hair];

  const layers = [];
  if (body && body.src) layers.push(body);
  if (face && face.src && face.enabled !== false) layers.push(face);
  if (hair && hair.src && hair.enabled !== false) layers.push(hair);

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
    imgs.forEach(im => { if (im) ctx.drawImage(im, 0, 0, canvas.width, canvas.height); });
  });
}

// --- Initialization ---
renderAllPickers();
renderCharacter();
