// All image paths are prefixed with this:
const BASE = "https://sorcrpg.com/character-creator/assets/";

// --- Asset Arrays ---
const bodyOptions = [
  { src: BASE + "fbody-type-massive.png", thumb: BASE + "fbody-type-massive.png" },
  { src: BASE + "fbody-type-muscular.png", thumb: BASE + "fbody-type-muscular.png" },
  { src: BASE + "fbody-type-lean.png", thumb: BASE + "fbody-type-lean.png" },
  { src: BASE + "fbody-type-thin.png", thumb: BASE + "fbody-type-thin.png" }
];

const hairOptions = [
  { src: BASE + "hair1-blck.png", thumb: BASE + "hair1-blck-tmb.png" },
  { src: BASE + "hair1-red.png", thumb: BASE + "hair1-red-tmb.png" },
  { src: BASE + "hair2-red.png", thumb: BASE + "hair2-red-tmb.png" },
  { src: BASE + "hair3-blnd.png", thumb: BASE + "hair3-bond-tmb.png" }, // thumb typo assumed: bond/blnd
  { src: BASE + "hair4-blnd.png", thumb: BASE + "hair4-bond-tmb.png" }  // thumb typo assumed: bond/blnd
];

const eyesOptions = [
  { src: BASE + "eyes1-blu.png", thumb: BASE + "eyes1-blu-tmb.png" },
  { src: BASE + "eyes1-brown.png", thumb: BASE + "eyes1-brn-tmb.png" },
  { src: BASE + "eyes1-green.png", thumb: BASE + "eyes1-green-tmb.png" },
  { src: BASE + "eyes2-redbrn.png", thumb: BASE + "eyes2-redbrn-tmb.png" }
];

const faceOptions = [
  { src: BASE + "femface-full.png", thumb: BASE + "femface-full-tmb.png" },
  { src: BASE + "femface-norm.png", thumb: BASE + "femface-norm-tmb.png" },
  { src: BASE + "placeholder-face1.png", thumb: BASE + "placeholder-face1.png" }, // No thumb, reuse main
  { src: BASE + "placeholder-face2.png", thumb: BASE + "placeholder-face2.png" }  // No thumb, reuse main
];

// --- TRACK SELECTED ---
let selected = {
  body: 0,
  hair: 0,
  eyes: 0,
  face: 0
};

function createPickerImages(options, pickerId, featureKey) {
  const picker = document.getElementById(pickerId);
  picker.innerHTML = "";
  options.forEach((option, idx) => {
    const img = document.createElement('img');
    img.src = option.thumb;
    img.alt = `${featureKey} ${idx + 1}`;
    img.addEventListener('click', function () {
      selectFeature(pickerId, idx, featureKey);
    });
    picker.appendChild(img);
  });
}

function selectFeature(pickerId, idx, featureKey) {
  const picker = document.getElementById(pickerId);
  Array.from(picker.children).forEach(img => img.classList.remove("selected"));
  if (picker.children[idx]) {
    picker.children[idx].classList.add("selected");
    selected[featureKey] = idx;
    renderCharacter();
  }
}

function renderCharacter() {
  const canvas = document.getElementById("charCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Order: body, face, eyes, hair
  const features = [
    bodyOptions[selected.body] || bodyOptions[0],
    faceOptions[selected.face] || faceOptions[0],
    eyesOptions[selected.eyes] || eyesOptions[0],
    hairOptions[selected.hair] || hairOptions[0]
  ];

  let loaded = 0;
  let images = [];
  features.forEach((option, i) => {
    if (!option) return;
    const img = new Image();
    img.src = option.src;
    img.onload = function () {
      images[i] = img;
      loaded++;
      if (loaded === features.length) {
        images.forEach(im => {
          if (im) ctx.drawImage(im, 0, 0, canvas.width, canvas.height);
        });
      }
    };
    img.onerror = function () {
      loaded++;
      if (loaded === features.length) {
        images.forEach(im => {
          if (im) ctx.drawImage(im, 0, 0, canvas.width, canvas.height);
        });
      }
    };
  });
}

// --- Initialize Pickers ---
createPickerImages(bodyOptions, "body-pickers", "body");
createPickerImages(hairOptions, "hair-pickers", "hair");
createPickerImages(eyesOptions, "eyes-pickers", "eyes");
createPickerImages(faceOptions, "face-pickers", "face");

// --- Select Defaults ---
document.addEventListener("DOMContentLoaded", () => {
  ["body-pickers", "hair-pickers", "eyes-pickers", "face-pickers"].forEach((pickerId, i) => {
    const picker = document.getElementById(pickerId);
    if (picker && picker.children.length > 0) {
      picker.children[0].classList.add("selected");
    }
  });
  selected.body = 0;
  selected.hair = 0;
  selected.eyes = 0;
  selected.face = 0;
  renderCharacter();
});

// --- RANDOM BUTTON ---
document.getElementById("randomBtn").addEventListener("click", function () {
  selected.body = Math.floor(Math.random() * bodyOptions.length);
  selected.hair = Math.floor(Math.random() * hairOptions.length);
  selected.eyes = Math.floor(Math.random() * eyesOptions.length);
  selected.face = Math.floor(Math.random() * faceOptions.length);

  [
    { pickerId: "body-pickers", idx: selected.body },
    { pickerId: "hair-pickers", idx: selected.hair },
    { pickerId: "eyes-pickers", idx: selected.eyes },
    { pickerId: "face-pickers", idx: selected.face }
  ].forEach(({ pickerId, idx }) => {
    const picker = document.getElementById(pickerId);
    Array.from(picker.children).forEach(img => img.classList.remove("selected"));
    if (picker.children[idx]) picker.children[idx].classList.add("selected");
  });

  renderCharacter();
});

// --- JPEG BUTTONS ---
document.getElementById("showJpegBtn").addEventListener("click", function () {
  const canvas = document.getElementById("charCanvas");
  const jpegPreview = document.getElementById("jpegPreview");
  const saveInstr = document.getElementById("saveInstr");
  const editingButtons = document.getElementById("editingButtons");
  const jpegButtons = document.getElementById("jpegButtons");

  jpegPreview.src = canvas.toDataURL("image/jpeg");
  jpegPreview.style.display = "block";
  saveInstr.style.display = "block";
  canvas.style.display = "none";
  editingButtons.style.display = "none";
  jpegButtons.style.display = "block";
});

document.getElementById("backBtn").addEventListener("click", function () {
  const canvas = document.getElementById("charCanvas");
  const jpegPreview = document.getElementById("jpegPreview");
  const saveInstr = document.getElementById("saveInstr");
  const editingButtons = document.getElementById("editingButtons");
  const jpegButtons = document.getElementById("jpegButtons");

  jpegPreview.style.display = "none";
  saveInstr.style.display = "none";
  canvas.style.display = "block";
  editingButtons.style.display = "block";
  jpegButtons.style.display = "none";
});
