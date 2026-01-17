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
  { src: `${BASE}IMG_2983.png`, thumb: `${BASE}femface2-drk-grn-tmb.png`, skin: "drk", eyes: "grn", enabled: true },
  { src: `${BASE}femface2-drk-grn.png`, thumb: `${BASE}femface2-drk-grn-tmb.png`, skin: "drk", eyes: "grn", enabled: true },
  
  // Medium skin faces
  { src: `${BASE}femface1-med-brn.png`, thumb: `${BASE}femface1-med-brn-tmb.png`, skin: "med", eyes: "brn", enabled: true },
  { src: `${BASE}femface1-med-hzl.png`, thumb: `${BASE}femface1-med-hzl-tmb.png`, skin: "med", eyes: "hzl", enabled: true },
  { src: `${BASE}femface1-med-grn.png`, thumb: `${BASE}femface1-med-grn-tmb.png`, skin: "med", eyes: "grn", enabled: true },
  { src: `${BASE}femface1-med-blk.png`, thumb: `${BASE}femface1-med-blk-tmb.png`, skin: "med", eyes: "blk", enabled: true },
  { src: `${BASE}femface2-med-brn.png`, thumb: `${BASE}femface2-med-brn-tmb.png`, skin: "med", eyes: "brn", enabled: true },
  { src: `${BASE}femface2-med-blu.png`, thumb: `${BASE}femface2-med-blu-tmb.png`, skin: "med", eyes: "blu", enabled: true },
  { src: `${BASE}femface2-med-grn.png`, thumb: `${BASE}femface2-med-grn-tmb.png`, skin: "med", eyes: "grn", enabled: true },
  { src: `${BASE}femface4-med-brn.png`, thumb: `${BASE}femface4-med-brn-tmb.png`, skin: "med", eyes: "brn", enabled: true },
  { src: `${BASE}femface5-med-blu.png`, thumb: `${BASE}femface5-med-blu-mkp-tmb.png`, skin: "med", eyes: "blu", enabled: true },
  
  // Pale skin faces
  { src: `${BASE}femface2-pale-grn.png`, thumb: `${BASE}femface2-pale-grn-tmb.png`, skin: "pale", eyes: "grn", enabled: true },
  { src: `${BASE}femface4-pale-brn.png`, thumb: `${BASE}femface4-pale-brn-tmb.png`, skin: "pale", eyes: "brn", enabled: true },
  { src: `${BASE}femface5-pale-blu-mkp.png`, thumb: `${BASE}femface5-pale-blu-mkp-tmb.png`, skin: "pale", eyes: "blu", enabled: true }
];

const facePaintOptions = [
  { src: "", thumb: "", label: "None", enabled: true },
  { src: `${BASE}facepnt1-blu.png`, thumb: `${BASE}facepnt1-blu-tmb.png`, color: "blu", enabled: true },
  { src: `${BASE}facepnt2-blu.png`, thumb: `${BASE}facepnt2-blu-tmb.png`, color: "blu", enabled: true },
  { src: `${BASE}facepnt3-red.png`, thumb: `${BASE}facepnt3-red-tmb.png`, color: "red", enabled: true },
  { src: `${BASE}facepnt4-blk.png`, thumb: `${BASE}facepnt4-blk-tmb.png`, color: "blk", enabled: true },
  { src: `${BASE}facepnt5-blk.png`, thumb: `${BASE}facepnt5-blk-tmb.png`, color: "blk", enabled: true },
  { src: `${BASE}facepnt5-red.png`, thumb: `${BASE}facepnt5-red-tmb.png`, color: "red", enabled: true }
];

const hairOptions = [
  { src: `${BASE}femhair1.png`, thumb: `${BASE}femhair1-tmb.png`, clup: `${BASE}femhair1-clup.png`, enabled: true },
  { src: `${BASE}femhair2.png`, thumb: `${BASE}femhair2-tmb.png`, clup: `${BASE}femhair2-clup.png`, enabled: true },
  { src: `${BASE}femhair3.png`, thumb: `${BASE}femhair3-tmb.png`, clup: `${BASE}femhair3-clup.png`, enabled: true },
  { src: `${BASE}femhair4.png`, thumb: `${BASE}femhair4-tmb.png`, clup: `${BASE}femhair4-clup.png`, enabled: true },
  { src: `${BASE}femhair5.png`, thumb: `${BASE}femhair5-tmb.png`, clup: `${BASE}femhair5-clup.png`, enabled: true },
  { src: `${BASE}femhair6.png`, thumb: `${BASE}femhair6-tmb.png`, clup: `${BASE}femhair6-clup.png`, enabled: true },
  { src: `${BASE}femhair7.png`, thumb: `${BASE}femhair7-tmb.png`, clup: `${BASE}femhair7-clup.png`, enabled: true },
  { src: `${BASE}femhair8.png`, thumb: `${BASE}femhair8-tmb.png`, clup: `${BASE}femhair8-clup.png`, enabled: true },
  { src: `${BASE}femhair9.png`, thumb: `${BASE}femhair9-tmb.png`, clup: `${BASE}femhair9-clup.png`, enabled: true },
  { src: `${BASE}femhair10.png`, thumb: `${BASE}femhair10-tmb.png`, clup: `${BASE}femhair10-clup.png`, enabled: true },
  { src: `${BASE}femhair11.png`, thumb: `${BASE}femhair11-tmb.png`, clup: `${BASE}femhair11-clup.png`, enabled: true },
  { src: `${BASE}femhair12.png`, thumb: `${BASE}femhair12-tmb.png`, clup: `${BASE}femhair12-clup.png`, enabled: true }
];

let selected = {
  body: 2,
  face: 0,
  facePaint: 0,
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

    if (body.thumb) {
      img.src = body.thumb;
    } else {
      img.src = createPlaceholder('Coming Soon');
    }

    let className = "thumb";
    if (!body.thumb) className += " placeholder";
    if (!body.enabled) className += " disabled";
    if (selected.body === idx) className += " selected";

    img.className = className;

    img.onclick = function() {
      if (body.enabled) {
        selected.body = idx;
        selected.face = pickFirstEnabledFace(body.skin);
        renderAllPickers();
        renderCharacter();
        renderFacePreview();
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

    if (face.thumb) {
      img.src = face.thumb;
    } else {
      img.src = createPlaceholder('Coming Soon');
    }

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
        renderFacePreview();
        renderFinalCharacter();
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
        renderFacePreview();
        renderFinalCharacter();
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
        renderFacePreview();
        renderFinalCharacter();
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
  let vw = window.innerWidth;
  let vh = window.innerHeight;
  let width = Math.min(vw * 0.96, maxWidth);
  let height = Math.min(width * 2, vh * 0.92, maxHeight);
  if (height / 2 < width) width = height / 2;
  return { width: Math.round(width), height: Math.round(height) };
}

function resizeCanvasAndRender() {
  const canvas = document.getElementById("charCanvas");
  if (canvas) {
    const { width, height } = getCanvasSize();
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    renderCharacter();
  }
}

function renderCharacter(callback) {
  const canvas = document.getElementById("charCanvas");
  if (!canvas) return;
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

  let layers = [];
  
  layers.push({ src: IMG_BG, layer: "bg" });
  
  if (selected.weapon) {
    layers.push({ src: IMG_WEAPON_BACK, layer: "weapon_back" });
  }
  
  let body = bodyOptions[selected.body];
  if (body && body.src) {
    layers.push({ src: body.src, layer: "body" });
  }
  
  if (selected.armor) {
    layers.push({ src: IMG_ARMOR, layer: "armor" });
  }
  
  if (selected.face !== -1 && faceOptions[selected.face]) {
    let face = faceOptions[selected.face];
    if (face && face.src && face.enabled !== false) {
      layers.push({ src: face.src, layer: "face" });
    }
  }
  
  if (selected.facePaint > 0 && facePaintOptions[selected.facePaint]) {
    let paint = facePaintOptions[selected.facePaint];
    if (paint && paint.src && paint.enabled !== false) {
      layers.push({ src: paint.src, layer: "facepaint" });
    }
  }
  
  if (selected.hair !== -1 && hairOptions[selected.hair]) {
    let hair = hairOptions[selected.hair];
    if (hair && hair.src && hair.enabled !== false) {
      layers.push({ src: hair.src, layer: "hair" });
    }
  }
  
  if (selected.helmet) {
    layers.push({ src: IMG_HELMET, layer: "helmet" });
  }
  
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

function renderFacePreview() {
  const canvas = document.getElementById("faceCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let layers = [];
  
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // NO FACE IMAGE - clup hair already has face baked in
  
  // Use regular facepaint image (NO clup)
  if (selected.facePaint > 0 && facePaintOptions[selected.facePaint]) {
    let paint = facePaintOptions[selected.facePaint];
    if (paint && paint.src && paint.enabled !== false) {
      layers.push({ src: paint.src, layer: "facepaint" });
    }
  }
  
  // Use hair CLUP (keep clups for hair only)
  if (selected.hair !== -1 && hairOptions[selected.hair]) {
    let hair = hairOptions[selected.hair];
    if (hair && hair.enabled !== false) {
      let hairImg = hair.clup && hair.clup.length > 0 ? hair.clup : hair.src;
      if (hairImg) layers.push({ src: hairImg, layer: "hair" });
    }
  }

  Promise.all(
    layers.map(opt =>
      new Promise(resolve => {
        if (!opt || !opt.src) return resolve(null);
        const im = new window.Image();
        im.src = opt.src;
        im.onload = () => resolve(im);
        im.onerror = () => {
          console.warn(`Failed to load preview image: ${opt.src}`);
          resolve(null);
        };
      })
    )
  ).then(imgs => {
    imgs.forEach(im => {
      if (im) {
        const srcWidth = im.width;
        const srcHeight = im.height * 0.4;
        const srcX = 0;
        const srcY = im.height * 0.15;
        
        ctx.drawImage(im, srcX, srcY, srcWidth, srcHeight, 0, 0, canvas.width, canvas.height);
      }
    });
  });
}

function renderFinalCharacter() {
  const canvas = document.getElementById("finalCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let layers = [];
  
  layers.push({ src: IMG_BG, layer: "bg" });
  
  if (selected.weapon) {
    layers.push({ src: IMG_WEAPON_BACK, layer: "weapon_back" });
  }
  
  let body = bodyOptions[selected.body];
  if (body && body.src) {
    layers.push({ src: body.src, layer: "body" });
  }
  
  if (selected.armor) {
    layers.push({ src: IMG_ARMOR, layer: "armor" });
  }
  
  if (selected.face !== -1 && faceOptions[selected.face]) {
    let face = faceOptions[selected.face];
    if (face && face.src && face.enabled !== false) {
      layers.push({ src: face.src, layer: "face" });
    }
  }
  
  if (selected.facePaint > 0 && facePaintOptions[selected.facePaint]) {
    let paint = facePaintOptions[selected.facePaint];
    if (paint && paint.src && paint.enabled !== false) {
      layers.push({ src: paint.src, layer: "facepaint" });
    }
  }
  
  if (selected.hair !== -1 && hairOptions[selected.hair]) {
    let hair = hairOptions[selected.hair];
    if (hair && hair.src && hair.enabled !== false) {
      layers.push({ src: hair.src, layer: "hair" });
    }
  }
  
  if (selected.helmet) {
    layers.push({ src: IMG_HELMET, layer: "helmet" });
  }
  
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
          console.warn(`Failed to load image: ${opt.src}`);
          resolve(null);
        };
      })
    )
  ).then(imgs => {
    imgs.forEach(im => {
      if (im) ctx.drawImage(im, 0, 0, canvas.width, canvas.height);
    });
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
  
  let bodyType = "";
  if (val <= 1) {
    bodyType = "thin";
  } else if (val >= 2 && val <= 4) {
    bodyType = "lean";
  } else if (val >= 5 && val <= 20) {
    bodyType = "muscular";
  } else {
    bodyType = "massive";
  }
  
  physiqueApprovedMsg.textContent = `Physique accepted! Body type: ${bodyType} (Physique: ${val}). Note: Physique mechanics are not functional while in beta.`;
  
  renderAllPickers();
  resizeCanvasAndRender();
});

document.getElementById("equipArmorChk").addEventListener("change", function(e) {
  selected.armor = e.target.checked;
  renderCharacter();
  renderFinalCharacter();
});
document.getElementById("equipHelmetChk").addEventListener("change", function(e) {
  selected.helmet = e.target.checked;
  renderCharacter();
  renderFinalCharacter();
});
document.getElementById("equipWeaponsChk").addEventListener("change", function(e) {
  selected.weapon = e.target.checked;
  renderCharacter();
  renderFinalCharacter();
});

document.getElementById("randomBtn").addEventListener("click", function() {
  let enabledBodiesIdx = bodyOptions.map((body, idx) => body.enabled ? idx : -1).filter(idx => idx !== -1);
  if (enabledBodiesIdx.length === 0) return;
  
  selected.body = enabledBodiesIdx[Math.floor(Math.random() * enabledBodiesIdx.length)];

  let body = bodyOptions[selected.body];
  let skin = (body && body.skin) ? body.skin : "med";
  
  let filteredFaces = faceOptions.filter(f => f.skin === skin && f.enabled);
  if (filteredFaces.length > 0) {
    let randomFaceLocalIdx = Math.floor(Math.random() * filteredFaces.length);
    selected.face = faceOptions.indexOf(filteredFaces[randomFaceLocalIdx]);
  } else {
    selected.face = pickFirstEnabledFace(skin);
  }
  
  let enabledHairIdx = hairOptions.map((h, idx) => h.enabled ? idx : -1).filter(idx => idx !== -1);
  if (enabledHairIdx.length > 0) {
    selected.hair = enabledHairIdx[Math.floor(Math.random() * enabledHairIdx.length)];
  }

  renderAllPickers();
  resizeCanvasAndRender();
  renderFacePreview();
  renderFinalCharacter();
});

const showJpegBtn = document.getElementById("showJpegBtn");
showJpegBtn.addEventListener("click", function() {
  const win = window.open('', '_blank');
  
  setTimeout(() => {
    const charCanvas = document.getElementById("finalCanvas");
    const profileCanvas = document.createElement('canvas');
    const profileCtx = profileCanvas.getContext('2d');
    
    profileCanvas.width = 2100;
    profileCanvas.height = 3045;
    
    const profileSheet = new Image();
    profileSheet.src = `${BASE}sorc-blank-profile-page.png`;
    
    profileSheet.onload = function() {
      profileCtx.fillStyle = 'white';
      profileCtx.fillRect(0, 0, profileCanvas.width, profileCanvas.height);
      profileCtx.drawImage(profileSheet, 0, 0, profileCanvas.width, profileCanvas.height);
      
      const portraitX = 730;
      const portraitY = 640;
      const portraitWidth = 640;
      const portraitHeight = 1000;
      
      profileCtx.drawImage(charCanvas, portraitX, portraitY, portraitWidth, portraitHeight);
      const dataUrl = profileCanvas.toDataURL("image/jpeg", 0.92);
      win.document.write('<img src="' + dataUrl + '" style="max-width:100%;">');
    };
    
    profileSheet.onerror = function() {
      console.error('Failed to load profile sheet template');
      win.document.write('<p>Error: Could not load profile sheet. Make sure sorc-blank-profile-page.png is in the assets folder.</p>');
    };
  }, 100);
});

const showBlankJpegBtn = document.getElementById("showBlankJpegBtn");
showBlankJpegBtn.addEventListener("click", function() {
  const win = window.open('', '_blank');
  
  const blankImg = new Image();
  blankImg.src = `${BASE}sorc-blank-profile-page.png`;
  
  blankImg.onload = function() {
    const dataUrl = blankImg.src;
    win.document.write('<img src="' + dataUrl + '" style="max-width:100%;">');
  };
  
  blankImg.onerror = function() {
    console.error('Failed to load blank profile page');
    win.document.write('<p>Error: Could not load sorc-blank-profile-page.png. Make sure it is in the assets folder.</p>');
  };
});

document.getElementById("toPage2Btn").addEventListener("click", function() {
  document.getElementById("page1").classList.remove("active");
  document.getElementById("page2").classList.add("active");
  renderFacePreview();
  window.scrollTo(0, 0);
});

document.getElementById("toPage3Btn").addEventListener("click", function() {
  document.getElementById("page2").classList.remove("active");
  document.getElementById("page3").classList.add("active");
  window.scrollTo(0, 0);
  
  setTimeout(function() {
    const finalCanvas = document.getElementById("finalCanvas");
    if (finalCanvas) {
      const { width, height } = getCanvasSize();
      finalCanvas.width = width;
      finalCanvas.height = height;
      finalCanvas.style.width = width + "px";
      finalCanvas.style.height = height + "px";
      renderFinalCharacter();
    }
  }, 50);
});

window.addEventListener("resize", resizeCanvasAndRender);
window.addEventListener("orientationchange", resizeCanvasAndRender);

const canvasEl = document.getElementById("charCanvas");
let holdTimer = null;
let touchMoved = false;

if (canvasEl) {
  canvasEl.addEventListener("mousedown", function(e) {
    touchMoved = false;
    holdTimer = setTimeout(function() {
      if (!touchMoved) {
        isPortraitView = !isPortraitView;
        renderCharacter();
      }
    }, 1200);
  });
  
  canvasEl.addEventListener("mousemove", function
