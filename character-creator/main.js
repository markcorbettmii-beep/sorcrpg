/* ====================================================================
 *  FULL  main.js   (drop-in replacement)
 *  — all image paths now point to:
 *        sorcrpg/character-creator/assets/
 * ==================================================================== */

/* --------------------------------------------------------------------
   0.  BASE FOLDERS
   -------------------------------------------------------------------- */
const BASE   = "sorcrpg/character-creator/assets/";   // bodies, faces, hair, thumbs, etc.
const CCBASE = "sorcrpg/character-creator/assets/";   // identical here – used for clarity

/* --------------------------------------------------------------------
   1.  PERMANENT CANVAS BACKGROUND  (drawn first / bottom)
   -------------------------------------------------------------------- */
const BG_LAYER = { src: `${CCBASE}highres-canvas-bg.png` };

/* --------------------------------------------------------------------
   2.  BODY OPTIONS  (three MASS + one HR demo)
   -------------------------------------------------------------------- */
const bodyOptions = [
  { src: `${BASE}fbody-mass-drk.png`,  thumb: `${BASE}fbody-mass-drk-tmb.png`,  skin: "drk",  type: "massive",  enabled: true },
  { src: `${BASE}fbody-mass-med.png`,  thumb: `${BASE}fbody-mass-med-tmb.png`,  skin: "med",  type: "massive",  enabled: true },
  { src: `${BASE}fbody-mass-pale.png`, thumb: `${BASE}fbody-mass-pale-tmb.png`, skin: "pale", type: "massive",  enabled: true },

  /*  High-res demo body
      – on-canvas PNG  :  fbody-musc-hr.png
      – thumbnail      :  fbody-musc-drk-tmb.png                       */
  {
    src      : `${BASE}fbody-musc-hr.png`,         // **model image**
    thumb    : `${BASE}fbody-musc-drk-tmb.png`,    // **picker thumb**
    skin     : "hr",
    type     : "muscular_hr",
    enabled  : true,
    isHighRes: true
  }
];

/* --------------------------------------------------------------------
   3.  FACE OPTIONS  (original list, unchanged)
   -------------------------------------------------------------------- */
const faceOptions = [
  // Dark
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
  { src: `${BASE}femface3-med-brn.png`, thumb: `${BASE}femface3-med-brn-tmb.png`, skin: "med", eyes: "brn", enabled: false }, // NOT FUNCTIONAL
  // Pale
  { src: `${BASE}femface1-pale-hzl.png`, thumb: `${BASE}femface1-pale-hzl-tmb.png`, skin: "pale", eyes: "hzl", enabled: true },
  { src: `${BASE}femface1-pale-brn.png`, thumb: `${BASE}femface1-pale-brn-tmb.png`, skin: "pale", eyes: "brn", enabled: false },
  { src: `${BASE}femface1-pale-vio.png`, thumb: `${BASE}femface1-pale-vio-tmb.png`, skin: "pale", eyes: "vio", enabled: false },
  { src: `${BASE}femface2-pale-brn.png`, thumb: `${BASE}femface2-pale-brn-tmb.png`, skin: "pale", eyes: "brn", enabled: false },
  { src: `${BASE}femface2-pale-blu.png`, thumb: `${BASE}femface2-pale-blu-tmb.png`, skin: "pale", eyes: "blu", enabled: false }
];

/* --------------------------------------------------------------------
   4.  HAIR OPTIONS  (unchanged)
   -------------------------------------------------------------------- */
const hairOptions = [
  { src: `${BASE}femhair1.png`,  thumb: `${BASE}femhair1-tmb.png`,  enabled: true },
  { src: `${BASE}femhair2.png`,  thumb: `${BASE}femhair2-tmb.png`,  enabled: true },
  { src: `${BASE}femhair3.png`,  thumb: `${BASE}femhair3-tmb.png`,  enabled: true },
  { src: `${BASE}femhair4.png`,  thumb: `${BASE}femhair4-tmb.png`,  enabled: true },
  { src: `${BASE}femhair5.png`,  thumb: `${BASE}femhair5-tmb.png`,  enabled: true },
  { src: `${BASE}femhair6.png`,  thumb: `${BASE}femhair6-tmb.png`,  enabled: true }, // only one allowed for HR
  { src: `${BASE}femhair7.png`,  thumb: `${BASE}femhair7-tmb.png`,  enabled: true },
  { src: `${BASE}femhair8.png`,  thumb: `${BASE}femhair8-tmb.png`,  enabled: true },
  { src: `${BASE}femhair9.png`,  thumb: `${BASE}femhair9-tmb.png`,  enabled: true },
  { src: `${BASE}femhair10.png`, thumb: `${BASE}femhair10-tmb.png`, enabled: true },
  { src: `${BASE}femhair11.png`, thumb: `${BASE}femhair11-tmb.png`, enabled: true },
  { src: `${BASE}femhair12.png`, thumb: `${BASE}femhair12-tmb.png`, enabled: true }
];

/* --------------------------------------------------------------------
   5.  EQUIPMENT ART
   -------------------------------------------------------------------- */
const WEAPONS_IMG = BASE + "kaidas-great-bow.png";
const ARMOR_IMG   = BASE + "set-epic-fur-mantle.png";
const HELMET_IMG  = BASE + "bear-skn-helmet.png";

/* --------------------------------------------------------------------
   6.  DEFAULT SELECTIONS — HR body visible on load
   -------------------------------------------------------------------- */
let selected = {
  body : bodyOptions.findIndex(b => b.isHighRes), // HR body index
  face : 0,              // ignored when HR body selected
  hair : 5               // hair #6 (index 5)
};
let showWeapons = false;
let showArmor   = false;
let showHelmet  = false;

/* ==========================================================
   PICKER RENDERING
   ========================================================== */
function createPickerImages(opts, pickerId, feat, skinMatch=null) {
  const picker = document.getElementById(pickerId);
  picker.innerHTML = "";

  // filter faces by skin if needed
  let list = opts;
  if (feat === "face" && skinMatch) list = opts.filter(o => o.skin === skinMatch);

  // HR restrictions
  const HR = bodyOptions[selected.body]?.isHighRes;
  if (HR) {
    if (feat === "hair") list = hairOptions.map((o,i)=>({...o, enabled:i===5}));
    if (feat === "face") { picker.style.display="none"; return; }
  } else if (feat === "face") {
    picker.style.display="block";
  }

  list.forEach((o,i) => {
    const box = document.createElement("div");
    box.style.display="inline-block";
    box.style.textAlign="center";
    box.style.margin="0 4px";

    // label above HR thumb
    if (feat==="body" && o.isHighRes) {
      const lbl = document.createElement("div");
      lbl.textContent="high res demo";
      lbl.style.font="bold 1em sans-serif";
      lbl.style.color="#447";
      lbl.style.marginBottom="4px";
      box.appendChild(lbl);
    }

    const img = document.createElement("img");
    img.src = o.thumb;
    const sel = (i === selected[feat]);
    const okay = o.enabled !== false;

    img.style.pointerEvents = okay ? "auto":"none";
    img.style.opacity       = okay ? "1":"0.25";
    img.style.border        = sel ? "4px solid #ffb700" : "3px solid #ddd";
    img.style.boxShadow     = sel ? "0 0 24px #ffbd6caa" : "0 2px 12px #ccc8";
    img.style.background    = sel ? "#fffbe8" : "#fafafa";
    img.style.width         = (feat==="body" && sel) ? "140px":"90px";
    img.style.height        = img.style.width;
    img.style.borderRadius  = "12px";
    img.style.cursor        = okay ? "pointer":"default";

    // click to select
    if (okay) img.addEventListener("click", () => selectFeat(i, feat));

    // preview (hold) for non-body
    if (feat !== "body") {
      img.addEventListener("mousedown", e => { if(e.button===0) showPreview(o); });
      img.addEventListener("touchstart", () => showPreview(o));
      img.addEventListener("mouseup", hidePreview);
      img.addEventListener("mouseleave", hidePreview);
      img.addEventListener("touchend", hidePreview);
    }

    box.appendChild(img);
    picker.appendChild(box);
  });
}

/* ----------------- QUICK PREVIEW ----------------- */
let pvTimer;
function showPreview(o){
  clearTimeout(pvTimer);
  pvTimer=setTimeout(()=>{
    const ov=document.getElementById("previewOverlay");
    ov.innerHTML="";
    const big=document.createElement("img");
    big.src=o.src||o.thumb;
    big.style.maxWidth ="90vw";
    big.style.maxHeight="90vh";
    big.style.border   ="6px solid #ffb700";
    big.style.background="#fffbe8";
    big.style.boxShadow="0 0 40px #ffbd6caa";
    ov.appendChild(big);
    ov.style.display="block";
  },400);
}
function hidePreview(){ clearTimeout(pvTimer); document.getElementById("previewOverlay").style.display="none"; }

/* ----------------- SELECT HANDLER ---------------- */
function selectFeat(idx, feat){
  selected[feat]=idx;
  if (feat==="body") {
    const HR = bodyOptions[idx].isHighRes;
    if (HR) selected.hair = 5;
    else {
      const skin=getSkin();
      const faces=faceOptions.filter(f=>f.skin===skin && f.enabled);
      selected.face = faceOptions.indexOf(faces[0]||faceOptions[0]);
    }
  }
  renderAll();
}
function getSkin(){return bodyOptions[selected.body].skin;}

/* ==========================================================
   RENDER EVERYTHING
   ========================================================== */
function renderAll(){
  createPickerImages(bodyOptions,"body-pickers","body");
  createPickerImages(faceOptions.filter(f=>f.skin===getSkin()),"face-pickers","face",getSkin());
  createPickerImages(hairOptions,"hair-pickers","hair");

  // highlight
  document.getElementById("body-pickers").children[selected.body].classList.add("selected");
  if(!bodyOptions[selected.body].isHighRes){
    document.getElementById("face-row").style.display="block";
    const faceIdx=faceOptions.filter(f=>f.skin===getSkin()).indexOf(faceOptions[selected.face]);
    document.getElementById("face-pickers").children[faceIdx].classList.add("selected");
  }else{
    document.getElementById("face-row").style.display="none";
  }
  document.getElementById("hair-pickers").children[
    bodyOptions[selected.body].isHighRes ? 0 : selected.hair
  ].classList.add("selected");

  renderCanvas();
}

/* ----------------- CANVAS RENDER ----------------- */
function renderCanvas(){
  const cvs=document.getElementById("charCanvas");
  const ctx=cvs.getContext("2d");
  cvs.width=640; cvs.height=1280;
  ctx.clearRect(0,0,cvs.width,cvs.height);

  const body = bodyOptions[selected.body];
  const face = faceOptions[selected.face];
  const hair = hairOptions[selected.hair];

  const layers=[ BG_LAYER, body ];
  if(!body.isHighRes && face?.enabled) layers.push(face);
  if(body.isHighRes ? selected.hair===5 : hair?.enabled) layers.push(hair);
  if(showWeapons) layers.push({src:WEAPONS_IMG});
  if(showArmor)   layers.push({src:ARMOR_IMG  });
  if(showHelmet)  layers.push({src:HELMET_IMG });

  let n=layers.length, done=0, imgs=new Array(n);
  layers.forEach((l,i)=>{
    const im=new Image();
    im.onload=()=>{imgs[i]=im;if(++done===n) draw();};
    im.onerror=()=>{done++;if(done===n) draw();};
    im.src=l.src;
  });
  function draw(){ imgs.forEach(im=>{if(im)ctx.drawImage(im,0,0,cvs.width,cvs.height);}); }
}

/* ==========================================================
   CONTROLS  (equipment, random, form)
   ========================================================== */
document.getElementById("equipWeaponsChk").addEventListener("change",e=>{showWeapons=e.target.checked;renderCanvas();});
document.getElementById("equipArmorChk").addEventListener("change",e=>{showArmor=e.target.checked;renderCanvas();});
document.getElementById("equipHelmetChk").addEventListener("change",e=>{showHelmet=e.target.checked;renderCanvas();});

document.getElementById("randomBtn").addEventListener("click",()=>{
  const bodies=bodyOptions.map((b,i)=>(b.enabled?i:null)).filter(i=>i!==null);
  selected.body=bodies[Math.floor(Math.random()*bodies.length)];
  if(bodyOptions[selected.body].isHighRes){selected.hair=5;}
  else{
    const faces=faceOptions.filter(f=>f.skin===getSkin()&&f.enabled);
    selected.face=faceOptions.indexOf(faces[Math.floor(Math.random()*faces.length)]);
    const hairs=hairOptions.map((h,i)=>(h.enabled?i:null)).filter(i=>i!==null);
    selected.hair=hairs[Math.floor(Math.random()*hairs.length)];
  }
  renderAll();
});

document.getElementById("physiqueForm").addEventListener("submit",e=>{
  e.preventDefault();
  const v=parseInt(document.getElementById("physiqueInput").value,10);
  if(isNaN(v)||v<1){document.getElementById("physiqueError").style.display="inline";return;}
  document.getElementById("physiqueError").style.display="none";
  document.getElementById("physiqueForm").style.display="none";
  document.getElementById("physiqueApprovedMsg").style.display="block";
  renderAll();
});

/* ==========================================================
   PREVIEW HIDE (global)
   ========================================================== */
document.addEventListener("mouseup", hidePreview);
document.addEventListener("touchend", hidePreview);

/* ==========================================================
   INIT
   ========================================================== */
document.addEventListener("DOMContentLoaded", renderAll);
