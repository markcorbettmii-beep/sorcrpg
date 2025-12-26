const BASE    = "assets/";                               // existing assets
const HR_BASE = "sorcrpg/character-creator/assets/";     // new HR assets

/* --------------------------------------------------------------
   PERMANENT BACKGROUND (always bottom canvas layer)
-----------------------------------------------------------------*/
const PERMA_BG = { src: `${HR_BASE}highres-canvas-bg.png` };

/* --------------------------------------------------------------
   BODY OPTIONS  (three mass + new HR demo)
-----------------------------------------------------------------*/
const bodyOptions = [
  { src: `${BASE}fbody-mass-drk.png`,  thumb: `${BASE}fbody-mass-drk-tmb.png`,  skin:"drk",  type:"massive", enabled:true },
  { src: `${BASE}fbody-mass-med.png`,  thumb: `${BASE}fbody-mass-med-tmb.png`,  skin:"med",  type:"massive", enabled:true },
  { src: `${BASE}fbody-mass-pale.png`, thumb: `${BASE}fbody-mass-pale-tmb.png`, skin:"pale", type:"massive", enabled:true },

  // NEW high-res muscular demo body
  {
    src      : `${HR_BASE}fbody-musc-hr.png`,          // canvas image
    thumb    : `${HR_BASE}fbody-musc-drk-tmb.png`,     // picker thumbnail
    skin     : "hr",
    type     : "muscular_hr",
    enabled  : true,
    isHighRes: true
  }
];

/* --------------------------------------------------------------
   FACE OPTIONS  (same as before – full list)
-----------------------------------------------------------------*/
const faceOptions = [
  // Dark
  { src:`${BASE}femface1-dark-blu.png`, thumb:`${BASE}femface1-dark-blu-tmb.png`, skin:"drk", eyes:"blu", enabled:true },
  { src:`${BASE}femface1-dark-hzl.png`, thumb:`${BASE}femface1-dark-hzl-tmb.png`, skin:"drk", eyes:"hzl", enabled:true },
  { src:`${BASE}femface2-dark-brn.png`, thumb:`${BASE}femface2-dark-brn-tmb.png`, skin:"drk", eyes:"brn", enabled:true },
  { src:`${BASE}femface2-dark-blu.png`, thumb:`${BASE}femface2-dark-blu-tmb.png`, skin:"drk", eyes:"blu", enabled:true },
  // Medium
  { src:`${BASE}femface1-med-brn.png`, thumb:`${BASE}femface1-med-brn-tmb.png`, skin:"med", eyes:"brn", enabled:true },
  { src:`${BASE}femface1-med-hzl.png`, thumb:`${BASE}femface1-med-hzl-tmb.png`, skin:"med", eyes:"hzl", enabled:true },
  { src:`${BASE}femface1-med-grn.png`, thumb:`${BASE}femface1-med-grn-tmb.png`, skin:"med", eyes:"grn", enabled:true },
  { src:`${BASE}femface2-med-brn.png`, thumb:`${BASE}femface2-med-brn-tmb.png`, skin:"med", eyes:"brn", enabled:true },
  { src:`${BASE}femface2-med-blu.png`, thumb:`${BASE}femface2-med-blu-tmb.png`, skin:"med", eyes:"blu", enabled:true },
  { src:`${BASE}femface3-med-brn.png`, thumb:`${BASE}femface3-med-brn-tmb.png`, skin:"med", eyes:"brn", enabled:false }, // disabled
  // Pale
  { src:`${BASE}femface1-pale-hzl.png`, thumb:`${BASE}femface1-pale-hzl-tmb.png`, skin:"pale", eyes:"hzl", enabled:true },
  { src:`${BASE}femface1-pale-brn.png`, thumb:`${BASE}femface1-pale-brn-tmb.png`, skin:"pale", eyes:"brn", enabled:false },
  { src:`${BASE}femface1-pale-vio.png`, thumb:`${BASE}femface1-pale-vio-tmb.png`, skin:"pale", eyes:"vio", enabled:false },
  { src:`${BASE}femface2-pale-brn.png`, thumb:`${BASE}femface2-pale-brn-tmb.png`, skin:"pale", eyes:"brn", enabled:false },
  { src:`${BASE}femface2-pale-blu.png`, thumb:`${BASE}femface2-pale-blu-tmb.png`, skin:"pale", eyes:"blu", enabled:false }
];

/* --------------------------------------------------------------
   HAIR OPTIONS (unchanged list)
-----------------------------------------------------------------*/
const hairOptions = [
  { src:`${BASE}femhair1.png`,  thumb:`${BASE}femhair1-tmb.png`,  enabled:true },
  { src:`${BASE}femhair2.png`,  thumb:`${BASE}femhair2-tmb.png`,  enabled:true },
  { src:`${BASE}femhair3.png`,  thumb:`${BASE}femhair3-tmb.png`,  enabled:true },
  { src:`${BASE}femhair4.png`,  thumb:`${BASE}femhair4-tmb.png`,  enabled:true },
  { src:`${BASE}femhair5.png`,  thumb:`${BASE}femhair5-tmb.png`,  enabled:true },
  { src:`${BASE}femhair6.png`,  thumb:`${BASE}femhair6-tmb.png`,  enabled:true }, // only allowed for HR
  { src:`${BASE}femhair7.png`,  thumb:`${BASE}femhair7-tmb.png`,  enabled:true },
  { src:`${BASE}femhair8.png`,  thumb:`${BASE}femhair8-tmb.png`,  enabled:true },
  { src:`${BASE}femhair9.png`,  thumb:`${BASE}femhair9-tmb.png`,  enabled:true },
  { src:`${BASE}femhair10.png`, thumb:`${BASE}femhair10-tmb.png`, enabled:true },
  { src:`${BASE}femhair11.png`, thumb:`${BASE}femhair11-tmb.png`, enabled:true },
  { src:`${BASE}femhair12.png`, thumb:`${BASE}femhair12-tmb.png`, enabled:true }
];

/* -- EQUIPMENT (unchanged paths) ----------------------------------- */
const WEAPONS_IMG = BASE + "kaidas-great-bow.png";
const ARMOR_IMG   = BASE + "set-epic-fur-mantle.png";
const HELMET_IMG  = BASE + "bear-skn-helmet.png";

/* ===================================================================
 *  DEFAULT SELECTION (HR body to show new assets at startup)
 * =================================================================== */
let selected = {
  body : bodyOptions.findIndex(b => b.isHighRes),
  face : 0,
  hair : 5
};
let showWeapons=false, showArmor=false, showHelmet=false;

/* ===================================================================
 *  PICKER BUILDING
 * =================================================================== */
function buildPicker(arr, pid, feat){
  const box = document.getElementById(pid); box.innerHTML="";
  let list=arr;
  if(feat==="face") list=arr.filter(f=>f.skin===currentSkin());

  const HR=bodyOptions[selected.body].isHighRes;
  if(HR){
    if(feat==="hair") list=hairOptions.map((h,i)=>({...h,enabled:i===5}));
    if(feat==="face"){ box.style.display="none"; return; }
  }else if(feat==="face"){ box.style.display="block"; }

  list.forEach((o,i)=>{
    const wrap=document.createElement("div");
    wrap.style="display:inline-block;text-align:center;margin:0 4px;";

    if(feat==="body"&&o.isHighRes){
      const t=document.createElement("div");
      t.textContent="high res demo";
      t.style="font:bold 1em sans-serif;color:#447;margin-bottom:4px;";
      wrap.appendChild(t);
    }

    const im=document.createElement("img");
    im.src=o.thumb;
    const sel=i===selected[feat], ok=o.enabled!==false;
    im.style=`width:${feat==="body"&&sel?140:90}px;height:${feat==="body"&&sel?140:90}px;`+
             `border:${sel?4:3}px solid ${sel?"#ffb700":"#ddd"};border-radius:12px;`+
             `box-shadow:${sel?"0 0 24px #ffbf5eaa":"0 2px 12px #ccc8"};`+
             `background:${sel?"#fffbe8":"#fafafa"};opacity:${ok?1:0.25};`+
             `cursor:${ok?"pointer":"default"};`;
    if(ok) im.addEventListener("click",()=>choose(i,feat));
    wrap.appendChild(im);
    box.appendChild(wrap);
  });
}

/* ------------------ choose() ------------------- */
function choose(idx, feat){
  selected[feat]=idx;
  if(feat==="body"){
    if(bodyOptions[idx].isHighRes) selected.hair=5;
    else{
      const faces=faceOptions.filter(f=>f.skin===currentSkin()&&f.enabled);
      selected.face=faceOptions.indexOf(faces[0]||faceOptions[0]);
    }
  }
  drawAll();
}

/* ================================================================
 *  RENDER CANVAS with all layers
 * ================================================================ */
function renderCanvas(){
  const cv=document.getElementById("charCanvas");
  const ctx=cv.getContext("2d");
  cv.width=640; cv.height=1280; ctx.clearRect(0,0,cv.width,cv.height);

  const body=bodyOptions[selected.body];
  const face=faceOptions[selected.face];
  const hair=hairOptions[selected.hair];

  const layers=[ PERMA_BG, body ];
  if(!body.isHighRes && face?.enabled) layers.push(face);
  if(body.isHighRes ? selected.hair===5 : hair?.enabled) layers.push(hair);
  if(showWeapons) layers.push({src:WEAPONS_IMG});
  if(showArmor)   layers.push({src:ARMOR_IMG});
  if(showHelmet)  layers.push({src:HELMET_IMG});

  let loaded=0,total=layers.length, imgs=new Array(total);
  layers.forEach((l,i)=>{
    const img=new Image();
    img.onload=()=>{imgs[i]=img; if(++loaded===total) imgs.forEach(p=>p&&ctx.drawImage(p,0,0,cv.width,cv.height));};
    img.onerror=()=>{loaded++; if(loaded===total) imgs.forEach(p=>p&&ctx.drawImage(p,0,0,cv.width,cv.height));};
    img.src=l.src;
  });
}

/* ================================================================
 *  DRAW ALL (pickers + canvas)
 * ================================================================ */
function drawAll(){
  buildPicker(bodyOptions,"body-pickers","body");
  buildPicker(faceOptions,"face-pickers","face");
  buildPicker(hairOptions,"hair-pickers","hair");

  // highlight selections
  document.getElementById("body-pickers").children[selected.body].classList.add("selected");

  const HR=bodyOptions[selected.body].isHighRes;
  if(!HR){
    document.getElementById("face-row").style.display="block";
    const faceIdx=faceOptions.filter(f=>f.skin===currentSkin()).indexOf(faceOptions[selected.face]);
    if(faceIdx>-1) document.getElementById("face-pickers").children[faceIdx].classList.add("selected");
  }else{
    document.getElementById("face-row").style.display="none";
  }
  document.getElementById("hair-pickers").children[HR?0:selected.hair].classList.add("selected");

  renderCanvas();
}

/* ================================================================
 *  EQUIPMENT CHECKBOXES
 * ================================================================ */
document.getElementById("equipWeaponsChk").addEventListener("change",e=>{showWeapons=e.target.checked;renderCanvas();});
document.getElementById("equipArmorChk")  .addEventListener("change",e=>{showArmor  =e.target.checked;renderCanvas();});
document.getElementById("equipHelmetChk") .addEventListener("change",e=>{showHelmet =e.target.checked;renderCanvas();});

/* ================================================================
 *  RANDOM BUTTON
 * ================================================================ */
document.getElementById("randomBtn").addEventListener("click",()=>{
  const bodies=bodyOptions.map((b,i)=>(b.enabled?i:null)).filter(i=>i!==null);
  selected.body=bodies[Math.floor(Math.random()*bodies.length)];
  if(bodyOptions[selected.body].isHighRes){
    selected.hair=5;
  }else{
    const faces=faceOptions.filter(f=>f.skin===currentSkin()&&f.enabled);
    selected.face=faceOptions.indexOf(faces[Math.floor(Math.random()*faces.length)]);
    const hairs=hairOptions.map((h,i)=>(h.enabled?i:null)).filter(i=>i!==null);
    selected.hair=hairs[Math.floor(Math.random()*hairs.length)];
  }
  drawAll();
});

/* ================================================================
 *  PHYSIQUE FORM
 * ================================================================ */
document.getElementById("physiqueForm").addEventListener("submit",e=>{
  e.preventDefault();
  const v=parseInt(document.getElementById("physiqueInput").value,10);
  if(isNaN(v)||v<1){document.getElementById("physiqueError").style.display="inline";return;}
  document.getElementById("physiqueError").style.display="none";
  document.getElementById("physiqueForm").style.display="none";
  document.getElementById("physiqueApprovedMsg").style.display="block";
  drawAll();
});

/* ================================================================
 *  INIT
 * ================================================================ */
document.addEventListener("DOMContentLoaded",drawAll);
