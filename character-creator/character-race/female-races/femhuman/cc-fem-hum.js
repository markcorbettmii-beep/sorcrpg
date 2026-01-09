/**
 * Character Creator Customization
 * ... (your header comments) ...
 */

const BASE = "../../../assets/";
// ... (other constants unchanged) ...

const faceOptions = [
  // Dark skin faces
  { src: `${BASE}femface1-drk-hzl.png`, thumb: `${BASE}femface1-drk-hzl-tmb.png`, skin: "drk", eyes: "hzl", enabled: true },
  { src: `${BASE}femface1-drk-grn.png`, thumb: `${BASE}femface1-drk-grn-tmb.png`, skin: "drk", eyes: "grn", enabled: true }, // Ensure thumb exists
  { src: `${BASE}femface2-drk-grn.png`, thumb: `${BASE}femface2-drk-grn-tmb.png`, skin: "drk", eyes: "grn", enabled: true },

  // Medium skin faces
  { src: `${BASE}femface1-med-brn.png`, thumb: `${BASE}femface1-med-brn-tmb.png`, skin: "med", eyes: "brn", enabled: true },
  { src: `${BASE}femface1-med-hzl.png`, thumb: `${BASE}femface1-med-hzl-tmb.png`, skin: "med", eyes: "hzl", enabled: true },
  { src: `${BASE}femface1-med-grn.png`, thumb: `${BASE}femface1-med-grn-tmb.png`, skin: "med", eyes: "grn", enabled: true },
  { src: `${BASE}femface1-med-blk.png`, thumb: `${BASE}femface1-med-blk-tmb.png`, skin: "med", eyes: "blk", enabled: true },
  { src: `${BASE}femface2-med-brn.png`, thumb: `${BASE}femface2-med-brn-tmb.png`, skin: "med", eyes: "brn", enabled: true },
  { src: `${BASE}femface2-med-blu.png`, thumb: `${BASE}femface2-med-blu-tmb.png`, skin: "med", eyes: "blu", enabled: true },
  { src: `${BASE}femface2-med-grn.png`, thumb: `${BASE}femface2-med-grn-tmb.png`, skin: "med", eyes: "grn", enabled: true },
  { src: `${BASE}femface4-med.png`, thumb: `${BASE}femface4-med-tmb.png`, skin: "med", eyes: "brn", enabled: true },
  { src: `${BASE}femface5-med-blu-mkp.png`, thumb: `${BASE}femface5-med-blu-mkp-tmb.png`, skin: "med", eyes: "blu", enabled: true },

  // Pale skin faces
  { src: `${BASE}femface2-pale-grn.png`, thumb: `${BASE}femface2-pale-grn-tmb.png`, skin: "pale", eyes: "grn", enabled: true },
  { src: `${BASE}femface4-pale.png`, thumb: `${BASE}femface4-pale-brn-tmb.png`, skin: "pale", eyes: "brn", enabled: true },
  { src: `${BASE}femface5-pale-blu-mkp.png`, thumb: `${BASE}femface5-pale-blu-mkp-tmb.png`, skin: "pale", eyes: "blu", enabled: true }
];

// ... other options unchanged ...

function renderFacePickers() {
  const container = document.getElementById("face-pickers");
  container.innerHTML = "";

  let body = bodyOptions[selected.body];
  let skin = (body && body.skin) ? body.skin : "med";

  let filtered = faceOptions.filter(f => f.skin === skin);

  console.log("Rendering face pickers for skin:", skin);
  console.log("Filtered faces:", filtered.length);
  console.log("Currently selected face index:", selected.face);

  const rowDiv = document.createElement("div");
  rowDiv.className = "thumb-list";

  filtered.forEach((face) => {
    const globalIdx = faceOptions.indexOf(face);
    const img = document.createElement("img");
    
    // Always prefer face.thumb, fallback to placeholder if missing
    if (face.thumb && face.thumb.trim() !== "") {
      img.src = face.thumb;
    } else {
      // If no thumb, fallback to placeholder
      img.src = createPlaceholder('Coming Soon');
    }

    // Build className properly
    let className = "thumb";
    if (!face.thumb || face.thumb.trim() === "") className += " placeholder";
    if (!face.enabled) className += " disabled";
    if (selected.face === globalIdx) className += " selected";

    img.className = className;

    img.onclick = function() {
      if (face.enabled) {
        console.log("Face clicked! Index:", globalIdx, "Skin:", face.skin);
        selected.face = globalIdx;
        renderFacePickers();
        renderCharacter();
      }
    };
    rowDiv.appendChild(img);
  });

  container.appendChild(rowDiv);
}
