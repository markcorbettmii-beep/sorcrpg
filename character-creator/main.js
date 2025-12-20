// CONFIG: Asset mapping
const layers = {
  body: ['thin','lean','muscular','massive'],
  face: ['round','square','long'],
  hair: ['short','medium','long'],
  eyes: ['type1','type2','type3']
};

function physiqueToBody(score) {
  if (score <= 1) return 'thin';
  if (score <= 4) return 'lean';
  if (score <= 20) return 'muscular';
  return 'massive';
}

// STATE: Current selection
const state = {
  body: 'lean',
  face: 'round',
  hair: 'short',
  eyes: 'type1',
  armor: false,
  helmet: false,
  hairColor: '#8a4b08',
  eyeColor: '#666666'
};

const canvas = document.getElementById('charCanvas');
const ctx = canvas.getContext('2d');

// Helper to load an image
function loadImg(src) {
  return new Promise(res => {
    const img = new Image();
    img.src = src;
    img.onload = () => res(img);
    img.onerror = () => res(null);
  });
}

// Draw character (composite layers)
async function drawCharacter() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // Draw body
  let imgBody = await loadImg(`assets/body_${state.body}.png`);
  if (imgBody) ctx.drawImage(imgBody, 0, 0);

  // Draw face
  let imgFace = await loadImg(`assets/face_${state.face}.png`);
  if (imgFace) ctx.drawImage(imgFace, 0, 0);

  // Draw hair
  let imgHair = await loadImg(`assets/hair_${state.hair}.png`);
  if (imgHair) {
    ctx.drawImage(imgHair, 0, 0);
    tintLastDraw(state.hairColor);
  }

  // Draw eyes
  let imgEyes = await loadImg(`assets/eyes_${state.eyes}.png`);
  if (imgEyes) {
    ctx.drawImage(imgEyes, 0, 0);
    tintLastDraw(state.eyeColor);
  }

  // Armor
  if (state.armor) {
    let armorImg = await loadImg('assets/armor_chest.png');
    if (armorImg) ctx.drawImage(armorImg, 0, 0);
  }
  // Helmet
  if (state.helmet) {
    let helmetImg = await loadImg('assets/armor_helmet.png');
    if (helmetImg) ctx.drawImage(helmetImg, 0, 0);
  }

  // Add other gear/weapons here, same pattern
}

// Tint just-drawn layer with color
function tintLastDraw(hex) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

// Build picker thumbnails with preview images
function buildThumbnails() {
  document.querySelectorAll('.thumbs').forEach(div => {
    const layer = div.dataset.layer;
    div.innerHTML = ''; // Clear old
    layers[layer].forEach(name => {
      const img = document.createElement('img');
      img.src = `assets/${layer}_${name}_preview.png`; // Use preview image
      img.alt = name;
      img.addEventListener('click', () => {
        state[layer] = name;
        div.querySelectorAll('img').forEach(i => i.classList.remove('selected'));
        img.classList.add('selected');
        drawCharacter();
      });
      if (name === state[layer]) img.classList.add('selected');
      div.appendChild(img);
    });
  });
}
buildThumbnails();

// Color pickers
document.getElementById('hairColor').addEventListener('input', e => {
  state.hairColor = e.target.value;
  drawCharacter();
});
document.getElementById('eyeColor').addEventListener('input', e => {
  state.eyeColor = e.target.value;
  drawCharacter();
});

// Gear toggles
document.getElementById('armorToggle').addEventListener('change', e => {
  state.armor = e.target.checked;
  drawCharacter();
});
document.getElementById('helmetToggle').addEventListener('change', e => {
  state.helmet = e.target.checked;
  drawCharacter();
});

// Download PNG
document.getElementById('downloadBtn').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'character.png';
  link.href = canvas.toDataURL();
  link.click();
});

// Randomizer with physique score
document.getElementById('randomBtn').addEventListener('click', () => {
  const score = parseInt(prompt('Enter Physique score (number):'), 10) || 1;
  state.body = physiqueToBody(score);
  ['face','hair','eyes'].forEach(layer => {
    state[layer] = layers[layer][Math.floor(Math.random() * layers[layer].length)];
  });
  state.armor = Math.random() > 0.5;
  state.helmet = Math.random() > 0.5;
  drawCharacter();
});

// Initial draw
drawCharacter();
