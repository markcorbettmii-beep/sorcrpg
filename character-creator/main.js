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
        img.title =
