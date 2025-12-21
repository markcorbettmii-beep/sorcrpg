// --- CONFIGURE YOUR ASSET COUNTS HERE ---
const BODY_COUNT = 4;
const HAIR_COUNT = 6;
const EYES_COUNT = 6;
const FACE_COUNT = 6;

// --- HELPERS ---
function createPickerImages(feature, count, pickerId, basePath) {
  const picker = document.getElementById(pickerId);
  picker.innerHTML = ""; // Clear any existing
  for (let i = 1; i <= count; i++) {
    const img = document.createElement('img');
    img.src = `${basePath}-${i}-tmb.png`;             // Use thumbnail for picker
    img.alt = `${feature} ${i}`;
    img.dataset.fullsrc = `${basePath}-${i}.png`;      // Main image for canvas
    img.dataset.index = i;
    img.addEventListener('click', function () {
      selectFeature(pickerId, i, img.dataset.fullsrc);
    });
    picker.appendChild(img);
  }
}

// --- TRACK SELECTED FEATURES ---
let selected = {
  body: 1,
  hair: 1,
  eyes: 1,
  face: 1
};

// --- HIGHLIGHT PICKED IMAGE & RENDER ---
function selectFeature(pickerId, index, imgPath) {
  // Highlight selected
  const picker = document.getElementById(pickerId);
  Array.from(picker.children).forEach(img => img.classList.remove("selected"));
  picker.children[index - 1].classList.add("selected");

  // Save selection
  if (pickerId === "body-pickers") selected.body = index;
  if (pickerId === "hair-pickers") selected.hair = index;
  if (pickerId === "eyes-pickers") selected.eyes = index;
  if (pickerId === "face-pickers") selected.face = index;

  renderCharacter();
}

// --- DRAW CHARACTER TO CANVAS ---
function renderCharacter() {
  const canvas = document.getElementById("charCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Load and draw each feature in order
  const features = [
    { type: "body", index: selected.body },
    { type: "hair", index: selected.hair },
    { type: "eyes", index: selected.eyes },
    { type: "face", index: selected.face }
  ];

  let loaded = 0;
  let images = [];

  // Load all images
  features.forEach((f, i) => {
    const img = new Image();
    img.src = `${f.type}-${f.index}.png`;
    img.onload = function () {
      images[i] = img;
      loaded++;
      if (loaded === features.length) {
        // Draw all images in order
        images.forEach(im => ctx.drawImage(im, 0, 0, canvas.width, canvas.height));
      }
    };
  });
}

// --- INITIALIZE PICKERS ---
createPickerImages("body", BODY_COUNT, "body-pickers", "body");
createPickerImages("hair", HAIR_COUNT, "hair-pickers", "hair");
createPickerImages("eyes", EYES_COUNT, "eyes-pickers", "eyes");
createPickerImages("face", FACE_COUNT, "face-pickers", "face");

// --- SELECT DEFAULTS ---
document.addEventListener("DOMContentLoaded", () => {
  // Select first image in each picker
  ["body-pickers", "hair-pickers", "eyes-pickers", "face-pickers"].forEach((pickerId) => {
    const picker = document.getElementById(pickerId);
    if (picker && picker.children.length > 0) {
      picker.children[0].classList.add("selected");
    }
  });
  renderCharacter();
});

// --- You can add more code for buttons, random, saving, etc as needed ---
