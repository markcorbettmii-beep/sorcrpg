// --- Asset Arrays, use your ACTUAL filenames here! ---
const bodyOptions = [
  { src: "body-thin.png", thumb: "body-thin-tmb.png" },
  { src: "body-lean.png", thumb: "body-lean-tmb.png" },
  { src: "body-muscular.png", thumb: "body-muscular-tmb.png" },
  { src: "body-massive.png", thumb: "body-massive-tmb.png" }
];
const hairOptions = [
  { src: "hair1-black.png", thumb: "hair1-black-tmb.png" },
  { src: "hair2-blonde.png", thumb: "hair2-blonde-tmb.png" },
  { src: "hair3-red.png", thumb: "hair3-red-tmb.png" },
  { src: "hair4-brown.png", thumb: "hair4-brown-tmb.png" },
  { src: "hair5-gray.png", thumb: "hair5-gray-tmb.png" },
  { src: "hair6-pink.png", thumb: "hair6-pink-tmb.png" }
];
const eyesOptions = [
  { src: "eyes1-green.png", thumb: "eyes1-green-tmb.png" },
  { src: "eyes2-blue.png", thumb: "eyes2-blue-tmb.png" },
  { src: "eyes3-brown.png", thumb: "eyes3-brown-tmb.png" },
  { src: "eyes4-gray.png", thumb: "eyes4-gray-tmb.png" },
  { src: "eyes5-hazel.png", thumb: "eyes5-hazel-tmb.png" },
  { src: "eyes6-violet.png", thumb: "eyes6-violet-tmb.png" }
];
const faceOptions = [
  { src: "face1-round.png", thumb: "face1-round-tmb.png" },
  { src: "face2-square.png", thumb: "face2-square-tmb.png" },
  { src: "face3-oval.png", thumb: "face3-oval-tmb.png" },
  { src: "face4-heart.png", thumb: "face4-heart-tmb.png" },
  { src: "face5-triangle.png", thumb: "face5-triangle-tmb.png" },
  { src: "face6-diamond.png", thumb: "face6-diamond-tmb.png" }
];

// --- TRACK SELECTED ---
let selected = {
  body: 0,
  hair: 0,
  eyes: 0,
  face: 0
};

// --- Picker Setup ---
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

// --- Select Feature ---
function selectFeature(pickerId, idx, featureKey) {
  const picker = document.getElementById(pickerId);
  Array.from(picker.children).forEach(img => img.classList.remove("selected"));
  picker.children[idx].classList.add("selected");
  selected[featureKey] = idx;
  renderCharacter();
}

// --- Render Character ---
function renderCharacter() {
  const canvas = document.getElementById("charCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Order: body, face, eyes, hair
  const features = [
    bodyOptions[selected.body],
    faceOptions[selected.face],
    eyesOptions[selected.eyes],
    hairOptions[selected.hair]
  ];

  let loaded = 0;
  let images = [];
  features.forEach((option, i) => {
    const img = new Image();
    img.src = option.src;
    img.onload = function () {
      images[i] = img;
      loaded++;
      if (loaded === features.length) {
        images.forEach(im => ctx.drawImage(im, 0, 0, canvas.width, canvas.height));
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

// --- Select Defaults on Load ---
document.addEventListener("DOMContentLoaded", () => {
  ["body-pickers", "hair-pickers", "eyes-pickers", "face-pickers"].forEach((pickerId, i) => {
    const picker = document.getElementById(pickerId);
    if (picker && picker.children.length > 0) {
      picker.children[0].classList.add("selected");
    }
  });
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
    picker.children[idx].classList.add("selected");
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
