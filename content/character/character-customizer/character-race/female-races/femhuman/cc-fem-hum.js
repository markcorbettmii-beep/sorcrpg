/**
 * Character Customizer Customization
 * Copyright © 2024 [Corbett, editor in chief of Ogre Adventurer, a publishing company of Slayers of Rings § (n, and &) Crowns. Time stamped via GitHub repository push]
 * Created: December 26, 2024
 * All rights reserved.
 */

const ASSET_BASE = "../../../../assets/";
const CHARACTER_BASE = `${ASSET_BASE}female/firstborn/human/`;
const BODY_BASE = `${CHARACTER_BASE}physiques/muscular/body/`;
const FACE_BASE = `${CHARACTER_BASE}faces/`;
const FACE_PAINT_BASE = `${CHARACTER_BASE}face-paint/`;
const HAIR_BASE = `${CHARACTER_BASE}hair/`;
const CANVAS_BASE = `${ASSET_BASE}shared/canvas/`;
const ARMAMENT_BASE = `${ASSET_BASE}shared/armaments/`;
const TECHAD_ARMOR_BASE = `${ARMAMENT_BASE}techad/armor-taba/rare/`;
const TECHAD_WEAPONS_BASE = `${ARMAMENT_BASE}techad/weapons-taw/rare/`;
const COMPANION_BASE = `${ASSET_BASE}shared/companions/layers/`;
const PROFILE_BASE = `${ASSET_BASE}shared/profile/`;
const PORTRAIT_EXAMPLE = `${PROFILE_BASE}sorc-blank-profile-page_20260519_113341_0000.png`;

// Image paths for special layers
const IMG_BG = `${CANVAS_BASE}high-res-canvas-background.png`;
const IMG_BOOTS = `${TECHAD_ARMOR_BASE}high-res-boots-leathtaba3.png_20260915_021749_0000.png`;
const IMG_ARMOR = `${TECHAD_ARMOR_BASE}high-res-core-leathtaba3.png`;
const IMG_GLOVES = `${TECHAD_ARMOR_BASE}high-res-gloves-leathtaba3.png_20260915_021700_0000.png`;
const IMG_HELM = `${TECHAD_ARMOR_BASE}high-res-helm-leathtaba3.png_20260915_021632_0000.png`;
const IMG_DUAL_WIELD = `${TECHAD_WEAPONS_BASE}high-res-dw-taw3.png_20260915_021606_0000.png`;
const IMG_DRAKE = `${COMPANION_BASE}high-res-drake.png`;
const IMG_ANGELIC = `${COMPANION_BASE}high-res-angelic.png`;
const IMG_ANIM_COMP = `${COMPANION_BASE}high-res-anim-comp.png`;
const IMG_WEAS = `${COMPANION_BASE}high-res-weas.png`;
const IMG_LETTERS = `${CANVAS_BASE}high-res-letters.png`;
const CANVAS_RENDER_WIDTH = 2304;
const CANVAS_RENDER_HEIGHT = 3312;

// ONLY MUSCULAR BODY TYPES
const bodyOptions = [
  { src: `${BODY_BASE}fbody-musc-drk.png`, thumb: `${BODY_BASE}fbody-musc-drk-tmb.png`, skin: "drk", type: "muscular", enabled: false, disabledNote: "Not available in Beta" },
  { src: `${BODY_BASE}fbody-musc-med.png`, thumb: `${BODY_BASE}fbody-musc-med-tmb.png`, skin: "med", type: "muscular", enabled: false, disabledNote: "Not available in Beta" },
  { src: `${BODY_BASE}fbody-musc-pale.png_20260916_001443_0000.png`, thumb: `${BODY_BASE}fbody-musc-pale-tmb.png`, skin: "pale", type: "muscular", enabled: true }
];

const faceOptions = [
  // Pale skin faces - all available once Pale body is selected
  { src: `${FACE_BASE}fem-face2-pale-green.png_20260916_103252_0000.png`, thumb: `${FACE_BASE}femface2-pale-grn-tmb.png_20260916_104451_0000.png`, clup: `${FACE_BASE}fface-pale-green_20260618_175154_0000.png`, skin: "pale", eyes: "grn", enabled: true, closeupExtraYShift: 6 },
  { src: `${FACE_BASE}femface4-pale-brn.png`, thumb: `${FACE_BASE}femface4-pale-brn-tmb.png`, clup: `${FACE_BASE}fface-pale-brown_20260618_175523_0000.png`, skin: "pale", eyes: "brn", enabled: true, closeupExtraYShift: 6 },
  { src: `${FACE_BASE}femface5-pale-blu-mkp.png`, thumb: `${FACE_BASE}femface5-pale-blu-mkp-tmb.png`, clup: `${FACE_BASE}fface-pale-violet_20260618_175420_0000.png`, skin: "pale", eyes: "vlt", enabled: true, closeupExtraYShift: 16 }
];

const facePaintOptions = [
  { src: "", thumb: "", clup: "", label: "None", enabled: true },
  { src: `${FACE_PAINT_BASE}facepnt1-blu.png`, thumb: `${FACE_PAINT_BASE}facepnt1-blu-tmb.png`, clup: `${FACE_PAINT_BASE}facepnt1-blu-clup.png`, color: "blu", enabled: true },
  { src: `${FACE_PAINT_BASE}facepnt2-blu.png`, thumb: `${FACE_PAINT_BASE}facepnt2-blu-tmb.png`, clup: `${FACE_PAINT_BASE}facepnt2-blu-clup.png`, color: "blu", enabled: true },
  { src: `${FACE_PAINT_BASE}facepnt3-red.png`, thumb: `${FACE_PAINT_BASE}facepnt3-red-tmb.png`, clup: `${FACE_PAINT_BASE}facepnt3-red-clup.png`, color: "red", enabled: true },
  { src: `${FACE_PAINT_BASE}facepnt4-blk.png`, thumb: `${FACE_PAINT_BASE}facepnt4-blk-tmb.png`, clup: `${FACE_PAINT_BASE}facepnt4-blk-clup.png`, color: "blk", enabled: true },
  { src: `${FACE_PAINT_BASE}facepnt5-blk.png`, thumb: `${FACE_PAINT_BASE}facepnt5-blk-tmb.png`, clup: `${FACE_PAINT_BASE}facepnt5-blk-clup.png`, color: "blk", enabled: true },
  { src: `${FACE_PAINT_BASE}facepnt5-red.png`, thumb: `${FACE_PAINT_BASE}facepnt5-red-tmb.png`, clup: `${FACE_PAINT_BASE}facepnt5-red-clup.png`, color: "red", enabled: true }
];

const hairOptions = [
  { src: `${HAIR_BASE}femhair1.png`, thumb: `${HAIR_BASE}femhair1-tmb.png`, clup: `${HAIR_BASE}femhair1-clup.png`, enabled: true },
  { src: `${HAIR_BASE}femhair2.png`, thumb: `${HAIR_BASE}femhair2-tmb.png`, clup: `${HAIR_BASE}femhair2-clup.png`, enabled: true },
  { src: `${HAIR_BASE}femhair3.png`, thumb: `${HAIR_BASE}femhair3-tmb.png`, clup: `${HAIR_BASE}femhair3-clup.png`, enabled: true },
  { src: `${HAIR_BASE}femhair4.png`, thumb: `${HAIR_BASE}femhair4-tmb.png`, clup: `${HAIR_BASE}femhair4-clup.png`, enabled: true },
  { src: `${HAIR_BASE}femhair5.png?v=2`, thumb: `${HAIR_BASE}femhair5-tmb.png`, clup: `${HAIR_BASE}femhair5-clup.png`, enabled: true },
  { src: `${HAIR_BASE}femhair6.png`, thumb: `${HAIR_BASE}femhair6-tmb.png`, clup: `${HAIR_BASE}femhair6-clup.png`, enabled: true },
  { src: `${HAIR_BASE}femhair7.png`, thumb: `${HAIR_BASE}femhair7-tmb.png`, clup: `${HAIR_BASE}femhair7-clup.png`, enabled: true, closeupExtraXShift: 4 },
  { src: `${HAIR_BASE}femhair8.png`, thumb: `${HAIR_BASE}femhair8-tmb.png`, clup: `${HAIR_BASE}femhair8-clup.png`, enabled: true },
  { src: `${HAIR_BASE}femhair9.png`, thumb: `${HAIR_BASE}femhair9-tmb.png`, clup: `${HAIR_BASE}femhair9-clup.png`, enabled: true },
  { src: `${HAIR_BASE}femhair10.png`, thumb: `${HAIR_BASE}femhair10-tmb.png`, clup: `${HAIR_BASE}femhair10-clup.png`, enabled: true },
  { src: `${HAIR_BASE}femhair11.png`, thumb: `${HAIR_BASE}femhair11-tmb.png`, clup: `${HAIR_BASE}femhair11-clup.png`, enabled: true },
  { src: `${HAIR_BASE}femhair12.png`, thumb: `${HAIR_BASE}femhair12-tmb.png`, clup: `${HAIR_BASE}femhair12-clup.png?v=7`, enabled: true, closeupExtraXShift: -4 }
];

let selected = {
  body: 2,
  face: 0,
  facePaint: 0,
  hair: 0,
  armor: false,
  boots: false,
  gloves: false,
  helm: false,
  dualWield: false,
};

let isPortraitView = false;
let charRenderGen = 0;
let finalRenderGen = 0;

function pickFirstEnabledFace(skin) {
  const index = faceOptions.findIndex(f => f.skin === skin && f.enabled);
  return index !== -1 ? index : 0;
}

const holdPreviewOverlay = document.getElementById("holdPreviewOverlay");
const HOLD_PREVIEW_DELAY = 450;

function showHoldPreview(src) {
  if (!holdPreviewOverlay || !src) return;
  holdPreviewOverlay.innerHTML = "";
  const previewImg = document.createElement("img");
  previewImg.src = src;
  holdPreviewOverlay.appendChild(previewImg);
  holdPreviewOverlay.classList.add("visible");
}

function hideHoldPreview() {
  if (holdPreviewOverlay) holdPreviewOverlay.classList.remove("visible");
}

let disabledNoteTimer = null;
function showDisabledNote(message) {
  if (!holdPreviewOverlay) return;
  clearTimeout(disabledNoteTimer);
  holdPreviewOverlay.innerHTML = "";
  const note = document.createElement("div");
  note.className = "disabled-note-text";
  note.textContent = message;
  holdPreviewOverlay.appendChild(note);
  holdPreviewOverlay.classList.add("visible");
  disabledNoteTimer = setTimeout(hideHoldPreview, 1600);
}

function attachHoldPreview(img, previewSrc) {
  if (!previewSrc) return;
  img.draggable = false;
  let timer = null;
  let moved = false;
  let shown = false;
  let startX = 0;
  let startY = 0;
  const MOVE_THRESHOLD = 12;

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function checkMoved(x, y) {
    if (Math.hypot(x - startX, y - startY) > MOVE_THRESHOLD) {
      moved = true;
      clearTimer();
      if (shown) {
        shown = false;
        hideHoldPreview();
      }
    }
  }

  function endHold() {
    clearTimer();
    if (shown) {
      shown = false;
      hideHoldPreview();
    }
  }

  img.addEventListener("contextmenu", function(e) {
    e.preventDefault();
  });

  img.addEventListener("mousedown", function(e) {
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    clearTimer();
    timer = setTimeout(function() {
      if (!moved) {
        shown = true;
        showHoldPreview(previewSrc);
      }
    }, HOLD_PREVIEW_DELAY);
  });
  img.addEventListener("mousemove", function(e) {
    checkMoved(e.clientX, e.clientY);
  });
  img.addEventListener("mouseup", endHold);
  img.addEventListener("mouseleave", endHold);

  img.addEventListener("touchstart", function(e) {
    if (e.touches.length > 1) {
      clearTimer();
      return;
    }
    moved = false;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    clearTimer();
    timer = setTimeout(function() {
      if (!moved) {
        shown = true;
        showHoldPreview(previewSrc);
      }
    }, HOLD_PREVIEW_DELAY);
  }, { passive: true });
  img.addEventListener("touchmove", function(e) {
    if (e.touches.length > 0) {
      checkMoved(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });
  img.addEventListener("touchend", endHold);
  img.addEventListener("touchcancel", endHold);
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

    if (!body.enabled && body.disabledNote) {
      img.alt = body.disabledNote;
      img.title = body.disabledNote;
    }

    img.onclick = function() {
      if (body.enabled) {
        selected.body = idx;
        selected.face = pickFirstEnabledFace(body.skin);
        renderAllPickers();
        renderCharacter();
        renderFacePreview();
      } else if (body.disabledNote) {
        showDisabledNote(body.disabledNote);
      }
    };

    if (body.enabled) {
      attachHoldPreview(img, body.src);
    }

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

    if (!face.enabled && face.disabledNote) {
      img.alt = face.disabledNote;
      img.title = face.disabledNote;
    }

    img.onclick = function() {
      if (face.enabled) {
        selected.face = globalIdx;
        renderFacePickers();
        renderCharacter();
        renderFacePreview();
        renderFinalCharacter();
      } else if (face.disabledNote) {
        showDisabledNote(face.disabledNote);
      }
    };

    if (face.enabled) {
      attachHoldPreview(img, face.clup && face.clup.length > 0 ? face.clup : face.src);
    }

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
      img.onerror = function() {
        img.onerror = null;
        img.src = paint.clup || paint.src || createPlaceholder('Coming Soon');
      };
    } else {
      img.src = createPlaceholder('Coming Soon');
    }

    let className = "thumb";
    if (idx === 0) className += " placeholder";
    if (!paint.enabled) className += " disabled";
    if (selected.facePaint === idx) className += " selected";

    img.className = className;

    if (!paint.enabled && paint.disabledNote) {
      img.alt = paint.disabledNote;
      img.title = paint.disabledNote;
    }

    img.onclick = function() {
      if (paint.enabled) {
        selected.facePaint = idx;
        renderFacePaintPickers();
        renderCharacter();
        renderFacePreview();
        renderFinalCharacter();
      } else if (paint.disabledNote) {
        showDisabledNote(paint.disabledNote);
      }
    };

    if (idx !== 0 && paint.enabled) {
      attachHoldPreview(img, paint.clup && paint.clup.length > 0 ? paint.clup : paint.src);
    }

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
    if (idx === 9) img.style.transform = "translateY(-6px)";

    img.onclick = function() {
      if (hair.enabled) {
        selected.hair = idx;
        renderHairPickers();
        renderCharacter();
        renderFacePreview();
        renderFinalCharacter();
      }
    };

    attachHoldPreview(img, hair.clup && hair.clup.length > 0 ? hair.clup : hair.src);

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
  const maxWidth = 768, maxHeight = 1104;
  const sheetAspect = 1104 / 768;
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const canvasContainer = document.getElementById("characterCanvasContainer");
  const containerWidth = canvasContainer ? canvasContainer.clientWidth : viewportWidth;
  let vw = Math.min(viewportWidth, containerWidth || viewportWidth);
  let vh = window.innerHeight;
  let width = Math.min(vw * 0.9, maxWidth);
  let height = Math.min(width * sheetAspect, vh * 0.92, maxHeight);
  if (height / sheetAspect < width) width = height / sheetAspect;
  return { width: Math.round(width), height: Math.round(height) };
}

function resizeCanvasAndRender() {
  const canvas = document.getElementById("charCanvas");
  if (canvas) {
    const { width, height } = getCanvasSize();
    canvas.width = CANVAS_RENDER_WIDTH;
    canvas.height = CANVAS_RENDER_HEIGHT;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    renderCharacter();
  }
}

function selectedArmamentLayers() {
  const layers = [];
  if (selected.boots) layers.push({ src: IMG_BOOTS, layer: "boots" });
  if (selected.armor) layers.push({ src: IMG_ARMOR, layer: "armor" });
  if (selected.gloves) layers.push({ src: IMG_GLOVES, layer: "gloves" });
  if (selected.dualWield) layers.push({ src: IMG_DUAL_WIELD, layer: "dual_wield" });
  if (selected.helm) layers.push({ src: IMG_HELM, layer: "helm" });
  return layers;
}

function selectedCharacterLayers() {
  const layers = [];
  const body = bodyOptions[selected.body];
  const face = faceOptions[selected.face];
  const facePaint = facePaintOptions[selected.facePaint];
  const hair = hairOptions[selected.hair];

  if (body && body.enabled !== false && body.src) {
    layers.push({ src: body.src, layer: "body" });
  }
  if (face && face.enabled !== false && face.src) {
    layers.push({ src: face.src, layer: "face" });
  }
  if (selected.facePaint > 0 && facePaint && facePaint.enabled !== false && facePaint.src) {
    layers.push({ src: facePaint.src, layer: "facepaint" });
  }
  if (hair && hair.enabled !== false && hair.src) {
    layers.push({ src: hair.src, layer: "hair" });
  }

  return layers;
}

function renderCharacter(callback) {
  const canvas = document.getElementById("charCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gen = ++charRenderGen;

  if (isPortraitView) {
    const img = new window.Image();
    img.src = PORTRAIT_EXAMPLE;
    img.onload = function() {
      if (gen !== charRenderGen) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (callback) callback(canvas);
    };
    img.onerror = function() {
      if (callback) callback(canvas);
    };
    return;
  }

  const layers = [
    { src: IMG_BG, layer: "bg" },
    ...selectedCharacterLayers(),
    { src: IMG_DRAKE, layer: "drake" },
    { src: IMG_ANGELIC, layer: "angelic" },
    ...selectedArmamentLayers(),
    { src: IMG_WEAS, layer: "weas" },
    { src: IMG_ANIM_COMP, layer: "anim_comp" },
    { src: IMG_LETTERS, layer: "letters" }
  ];

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
    if (gen !== charRenderGen) return;
    imgs.forEach(im => {
      if (im) ctx.drawImage(im, 0, 0, canvas.width, canvas.height);
    });
    if (callback) callback(canvas);
  });
}

function drawCompanionSizeLabels(ctx, canvas) {
  ctx.save();
  ctx.textAlign = "center";
  const headerFont = `bold ${Math.round(canvas.width * 0.02)}px sans-serif`;
  const labelFont = `bold ${Math.round(canvas.width * 0.024)}px sans-serif`;
  const headerGap = canvas.height * 0.03;

  const labelColor = "#FFEE00";
  const outlineColor = "rgba(0,0,0,0.85)";
  const outlineWidth = Math.max(2, canvas.width * 0.003);

  function drawSlot(label, x, y, header) {
    ctx.globalAlpha = 1;
    ctx.font = headerFont;
    ctx.lineWidth = outlineWidth;
    ctx.strokeStyle = outlineColor;
    ctx.strokeText(header || "Companion Slot", x, y - headerGap);
    ctx.fillStyle = labelColor;
    ctx.fillText(header || "Companion Slot", x, y - headerGap);

    ctx.font = labelFont;
    ctx.strokeText(label, x, y);
    ctx.fillText(label, x, y);
  }

  drawSlot("Angelic (small/tiny)", canvas.width * 0.78, canvas.height * 0.18);
  drawSlot("Goliath/Behemoth (empty)", canvas.width * 0.30, canvas.height * 0.18);
  drawSlot("Pet (small/tiny)", canvas.width * 0.72, canvas.height * 0.49);
  drawSlot("Standard (empty)", canvas.width * 0.22, canvas.height * 0.47);
  drawSlot("Safe Haven", canvas.width * 0.22, canvas.height * 0.60, "Animated Compass Location");

  const bootLines = [
    "Character default in street clothes and TABA Boots.",
    "Selections; Armaments, Companions and Physique must be earned",
    "and approved by GM before submitting custom portraits (see rules)."
  ];
  const bootFontSize = Math.round(canvas.width * 0.02);
  const bootFont = `bold ${bootFontSize}px sans-serif`;
  const bootLineHeight = bootFontSize * 1.5;
  const bootX = canvas.width * 0.5;
  const bootStartY = canvas.height * 0.94;
  ctx.font = bootFont;
  ctx.lineWidth = outlineWidth;
  ctx.strokeStyle = outlineColor;
  ctx.fillStyle = labelColor;
  bootLines.forEach((line, i) => {
    const y = bootStartY + i * bootLineHeight;
    ctx.strokeText(line, bootX, y);
    ctx.fillText(line, bootX, y);
  });

  ctx.restore();
}

function renderFacePreview() {
  const canvas = document.getElementById("faceCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Dark background
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let layers = [];

  // Use face CLUP for closeup window
  if (selected.face !== -1 && faceOptions[selected.face]) {
    let face = faceOptions[selected.face];
    if (face && face.enabled !== false) {
      let faceImg = face.clup && face.clup.length > 0 ? face.clup : face.src;
      if (faceImg) {
        layers.push({ src: faceImg, layer: "face", useCloseupFit: face.clup && face.clup.length > 0, extraYShift: face.closeupExtraYShift || 0 });
      }
    }
  }

  // Use facepaint CLUP for closeup window
  if (selected.facePaint > 0 && facePaintOptions[selected.facePaint]) {
    let paint = facePaintOptions[selected.facePaint];
    if (paint && paint.enabled !== false) {
      let paintImg = paint.clup && paint.clup.length > 0 ? paint.clup : paint.src;
      if (paintImg) {
        layers.push({ src: paintImg, layer: "facepaint", useCloseupFit: paint.clup && paint.clup.length > 0 });
      }
    }
  }
  
  // Use hair CLUP for closeup window
  if (selected.hair !== -1 && hairOptions[selected.hair]) {
    let hair = hairOptions[selected.hair];
    if (hair && hair.enabled !== false) {
      let hairImg = hair.clup && hair.clup.length > 0 ? hair.clup : hair.src;
      if (hairImg) {
        layers.push({ src: hairImg, layer: "hair", useCloseupFit: hair.clup && hair.clup.length > 0, extraXShift: hair.closeupExtraXShift || 0, extraYShift: hair.closeupExtraYShift || 0 });
      }
    }
  }

  Promise.all(
    layers.map(opt =>
      new Promise(resolve => {
        if (!opt || !opt.src) return resolve(null);
        const im = new window.Image();
        im.src = opt.src;
        im.onload = () => resolve({ img: im, useCloseupFit: opt.useCloseupFit, layer: opt.layer, extraYShift: opt.extraYShift || 0, extraXShift: opt.extraXShift || 0 });
        im.onerror = () => {
          console.warn(`Failed to load preview image: ${opt.src}`);
          resolve(null);
        };
      })
    )
  ).then(results => {
    results.forEach(result => {
      if (result && result.img) {
        const im = result.img;
        
        if (result.useCloseupFit) {
          // CLUP images: fit without stretching (contain behavior)
          const imgAspect = im.width / im.height;
          const canvasAspect = canvas.width / canvas.height;
          
          let drawWidth, drawHeight, drawX, drawY;
          
          if (imgAspect > canvasAspect) {
            // Image is wider than canvas - fit to width
            drawWidth = canvas.width;
            drawHeight = canvas.width / imgAspect;
            drawX = 0;
            drawY = (canvas.height - drawHeight) / 2;
          } else {
            // Image is taller than canvas - fit to height
            drawHeight = canvas.height;
            drawWidth = canvas.height * imgAspect;
            drawX = (canvas.width - drawWidth) / 2;
            drawY = 0;
          }

          if (result.layer === "face") {
            // Face art sits small/low within its clup frame, so scale it
            // up and shift it upward to better fill the hair's face window.
            // Individual face images differ slightly in content placement,
            // so extraYShift lets specific faces get an additional nudge.
            const FACE_SCALE_BOOST = 1.8;
            const FACE_Y_SHIFT = canvas.height * -0.01;
            const FACE_X_SHIFT = canvas.width * 0.005;
            const boostedWidth = drawWidth * FACE_SCALE_BOOST;
            const boostedHeight = drawHeight * FACE_SCALE_BOOST;
            drawX -= (boostedWidth - drawWidth) / 2;
            drawY -= (boostedHeight - drawHeight) / 2;
            drawY -= FACE_Y_SHIFT;
            drawY -= result.extraYShift || 0;
            drawX += FACE_X_SHIFT;
            drawWidth = boostedWidth;
            drawHeight = boostedHeight;
          }

          drawX += result.extraXShift || 0;
          if (result.layer === "facepaint") {
            const FACEPAINT_Y_SHIFT = canvas.height * -0.02;
            const FACEPAINT_X_SHIFT = canvas.width * -0.01;
            const FACEPAINT_EXTRA_Y_SHIFT = canvas.height * 0.02;
            drawX += FACEPAINT_X_SHIFT;
            drawY += FACEPAINT_Y_SHIFT;
            drawY += FACEPAINT_EXTRA_Y_SHIFT;
            drawY += result.extraYShift || 0;
          } else if (result.layer !== "face") {
            const HAIR_Y_SHIFT = canvas.height * -0.015;
            drawY += HAIR_Y_SHIFT;
            drawY += result.extraYShift || 0;
          }

          ctx.drawImage(im, drawX, drawY, drawWidth, drawHeight);
        } else {
          // Fallback if no clup available: stretch to fill
          ctx.drawImage(im, 0, 0, canvas.width, canvas.height);
        }
      }
    });
  });
}

function renderFinalCharacter() {
  const canvas = document.getElementById("finalCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gen = ++finalRenderGen;

  const layers = [
    { src: IMG_BG, layer: "bg" },
    ...selectedCharacterLayers(),
    { src: IMG_DRAKE, layer: "drake" },
    { src: IMG_ANGELIC, layer: "angelic" },
    ...selectedArmamentLayers(),
    { src: IMG_WEAS, layer: "weas" },
    { src: IMG_ANIM_COMP, layer: "anim_comp" },
    { src: IMG_LETTERS, layer: "letters" }
  ];

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
    if (gen !== finalRenderGen) return;
    imgs.forEach(im => {
      if (im) ctx.drawImage(im, 0, 0, canvas.width, canvas.height);
    });
  });
}

const emptyFavoriteRow = () => [null, null, null, null];
const FAVORITE_PICKERS = {
  sentimental: {
    title: "Sentimental",
    note: "Choose one Armament or Accessory. Each Character gets one Sentimental item.",
    rows: [
      { label: "Sentimental Item", items: [null] }
    ]
  },
  armor: {
    title: "Armor Favorites",
    note: "Your Property will supply four Core favorites.",
    rows: [
      { label: "Core", items: emptyFavoriteRow() }
    ]
  },
  companions: {
    title: "Companions Favorites",
    note: "Your Property will supply four favorites per row. A Behemoth occupies both the Goliath and Behemoth slots.",
    rows: [
      { label: "Tiny", items: emptyFavoriteRow() },
      { label: "Small", items: emptyFavoriteRow() },
      { label: "Standard", items: emptyFavoriteRow() },
      { label: "Goliath", items: emptyFavoriteRow() },
      { label: "Behemoth", items: emptyFavoriteRow() }
    ]
  }
};

let activeFavoritePicker = null;

function renderFavoriteStatus() {
  const status = document.getElementById("favoriteStatus");
  const sentimentalStatus = document.getElementById("sentimentalStatus");
  const armorLauncher = document.getElementById("armorFavoritesButton");
  const sentimentalLauncher = document.getElementById("sentimentalButton");
  if (armorLauncher) armorLauncher.classList.remove("selected");
  if (sentimentalLauncher) sentimentalLauncher.classList.remove("selected");
  if (status) status.textContent = "No Favorites selected. Favorites come from Your Property.";
  if (sentimentalStatus) sentimentalStatus.textContent = "No Sentimental item selected.";
}

function renderFavoriteRows(kind) {
  const config = FAVORITE_PICKERS[kind];
  const rowsContainer = document.getElementById("favoritesPickerRows");
  if (!config || !rowsContainer) return;

  rowsContainer.replaceChildren();
  config.rows.forEach(row => {
    const rowSection = document.createElement("section");
    rowSection.className = "favorite-row";

    const rowTitle = document.createElement("h4");
    rowTitle.className = "favorite-row-title";
    rowTitle.textContent = row.label;
    rowSection.appendChild(rowTitle);

    const rowGrid = document.createElement("div");
    rowGrid.className = "favorite-row-grid";
    row.items.forEach(item => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "favorite-card";

      const art = document.createElement("div");
      art.className = "favorite-card-art";
      art.textContent = item ? item.art : "EMPTY";
      card.appendChild(art);

      const meta = document.createElement("div");
      meta.className = "favorite-card-meta";

      const name = document.createElement("div");
      name.className = "favorite-card-name";
      name.textContent = item ? item.name : "Empty Favorite";
      meta.appendChild(name);

      const ref = document.createElement("div");
      ref.className = "favorite-card-ref";
      ref.textContent = item ? item.ref : "—";
      meta.appendChild(ref);
      card.appendChild(meta);

      if (!item) {
        card.disabled = true;
        card.classList.add("empty");
      }
      rowGrid.appendChild(card);
    });

    rowSection.appendChild(rowGrid);
    rowsContainer.appendChild(rowSection);
  });
}

function openFavoritesPicker(kind) {
  const config = FAVORITE_PICKERS[kind];
  const overlay = document.getElementById("favoritesPickerOverlay");
  const title = document.getElementById("favoritesPickerTitle");
  const note = document.getElementById("favoritesPickerNote");
  if (!config || !overlay || !title || !note) return;

  activeFavoritePicker = kind;
  title.textContent = config.title;
  note.textContent = config.note;
  renderFavoriteRows(kind);
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
}

function closeFavoritesPicker() {
  const overlay = document.getElementById("favoritesPickerOverlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
  activeFavoritePicker = null;
}

const sentimentalButton = document.getElementById("sentimentalButton");
const armorFavoritesButton = document.getElementById("armorFavoritesButton");
const companionsFavoritesButton = document.getElementById("companionsFavoritesButton");
const favoritesPickerClose = document.getElementById("favoritesPickerClose");
const favoritesPickerOverlay = document.getElementById("favoritesPickerOverlay");

if (sentimentalButton) sentimentalButton.addEventListener("click", () => openFavoritesPicker("sentimental"));
if (armorFavoritesButton) armorFavoritesButton.addEventListener("click", () => openFavoritesPicker("armor"));
if (companionsFavoritesButton) companionsFavoritesButton.addEventListener("click", () => openFavoritesPicker("companions"));
if (favoritesPickerClose) favoritesPickerClose.addEventListener("click", closeFavoritesPicker);
if (favoritesPickerOverlay) {
  favoritesPickerOverlay.addEventListener("click", function(e) {
    if (e.target === favoritesPickerOverlay) closeFavoritesPicker();
  });
}
document.addEventListener("keydown", function(e) {
  if (e.key === "Escape" && activeFavoritePicker) closeFavoritesPicker();
});

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
if (showJpegBtn) {
  showJpegBtn.addEventListener("click", function() {
    const charCanvas = document.getElementById("finalCanvas");
    const portraitDataUrl = charCanvas.toDataURL("image/jpeg", 0.92);
    localStorage.setItem("sorc_portrait", portraitDataUrl);
    window.open("/content/character/character-sheet-fem-musc.html", "_blank");
  });
}

const showBlankJpegBtn = document.getElementById("showBlankJpegBtn");
if (showBlankJpegBtn) {
  showBlankJpegBtn.addEventListener("click", function() {
    localStorage.removeItem("sorc_portrait");
    window.open("/content/character/character-sheet-fem-musc.html", "_blank");
  });
}

function showPage(n) {
  document.getElementById("page1").classList.toggle("active", n === 1);
  document.getElementById("page2").classList.toggle("active", n === 2);
  document.getElementById("page3").classList.toggle("active", n === 3);
  window.scrollTo(0, 0);

  if (n === 2) {
    renderFacePreview();
  }

  if (n === 3) {
    setTimeout(function() {
      const finalCanvas = document.getElementById("finalCanvas");
      if (finalCanvas) {
        const { width, height } = getCanvasSize();
        finalCanvas.width = CANVAS_RENDER_WIDTH;
        finalCanvas.height = CANVAS_RENDER_HEIGHT;
        finalCanvas.style.width = width + "px";
        finalCanvas.style.height = height + "px";
        renderFinalCharacter();
      }
    }, 50);
  }
}

// Give each customizer step its own history entry so the browser's back
// button steps back through the customizer pages instead of leaving it.
history.replaceState({ page: 1 }, "");

document.getElementById("toPage2Btn").addEventListener("click", function() {
  document.getElementById("gmCodeOverlay").classList.add("visible");
});

document.getElementById("gmCodeSubmitBtn").addEventListener("click", function() {
  document.getElementById("gmCodeOverlay").classList.remove("visible");
  showPage(2);
  history.pushState({ page: 2 }, "");
});

document.getElementById("toPage3Btn").addEventListener("click", function() {
  showPage(3);
  history.pushState({ page: 3 }, "");
});

window.addEventListener("popstate", function(e) {
  showPage((e.state && e.state.page) || 1);
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
  
  canvasEl.addEventListener("mousemove", function() {
    touchMoved = true;
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  });
  
  canvasEl.addEventListener("mouseup", function() {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  });
  
  canvasEl.addEventListener("mouseleave", function() {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  });
  
  canvasEl.addEventListener("touchstart", function(e) {
    if (e.touches.length > 1) {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
      return;
    }
    
    touchMoved = false;
    holdTimer = setTimeout(function() {
      if (!touchMoved) {
        isPortraitView = !isPortraitView;
        renderCharacter();
      }
    }, 1200);
  });
  
  canvasEl.addEventListener("touchmove", function(e) {
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
  
  canvasEl.addEventListener("touchend", function(e) {
    if (e.touches.length > 0) {
      return;
    }
    
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  });

  canvasEl.addEventListener("touchcancel", function(e) {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  });
}

selected.face = pickFirstEnabledFace(bodyOptions[selected.body].skin);
renderAllPickers();
renderFavoriteStatus();
resizeCanvasAndRender();

// Ensure character renders properly on initial load with retry for slow image loading
setTimeout(() => {
  renderCharacter();
}, 100);
