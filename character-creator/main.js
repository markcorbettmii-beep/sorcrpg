// CONFIG: Asset mapping for your images
const layers = {
  body: [
    {name:'lean', src:'character-creator/assets/fbody-type-lean.png'},
    {name:'massive', src:'character-creator/assets/fbody-type-massive.png'},
    {name:'muscular', src:'character-creator/assets/fbody-type-muscular.png'},
    {name:'thin', src:'character-creator/assets/fbody-type-thin.png'},
  ],
  face: [
    {name:'full', src:'character-creator/assets/femface-full.png'},
    {name:'long', src:'character-creator/assets/femface-long.png'},
  ],
  hair: [
    {name:'hair1-blck', src:'character-creator/assets/hair1-blck.png'},
    {name:'hair1-red', src:'character-creator/assets/hair1-red.png'},
    {name:'hair2-red', src:'character-creator/assets/hair2-red.png'},
    {name:'hair3-blnd', src:'character-creator/assets/hair3-blnd.png'},
  ],
  eyes: [
    {name:'eyes1-blu', src:'character-creator/assets/eyes1-blu.png'},
    {name:'eyes1-green', src:'character-creator/assets/eyes1-green.png'},
    {name:'eyes2-redbrn', src:'character-creator/assets/eyes2-redbrn.png'},
  ]
};

function physiqueToBody(score) {
  if (score <= 1) return 'thin';
  if (score <= 4) return 'lean';
  if (score <= 20) return 'muscular';
  return 'massive';
}

// Default STATE: picks first option in each layer
const state = {
  body: layers.body[0].name,
  face: layers.face[0].name,
  hair: layers.hair[0].name,
  eyes: layers.eyes[0].name,
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

  // Draw in order: body, face, hair, eyes
  for (let layerName of ['body','face','hair','eyes']) {
    let layer = layers[layerName].find(l => l.name === state[layerName]);
    if (layer && layer.src) {
      let img = await loadImg(layer.src);
      if (img) {
        // For eyes, resize and reposition to fit face (example values, adjust as needed):
        if (layerName === 'eyes') {
          // You may want to fine-tune these numbers:
          ctx.drawImage(img, canvas.width/2 - 40, canvas.height/2 - 40, 80, 40);
        } else {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }
      }
    }
  }
}

// Build picker thumbnails
function buildThumbnails() {
  document.querySelectorAll('.thumbs').forEach(div => {
    const layerName = div.dataset.layer;
    div.innerHTML = '';
    layers[layerName].forEach(layerObj => {
      const img = document.createElement('img');
      img.src = layerObj.src;
      img.alt = layerObj.name;
      img.addEventListener('click', () => {
        state[layerName] = layerObj.name;
        div.querySelectorAll('img').forEach(i => i.classList.remove('selected'));
        img.classList.add('selected');
        drawCharacter();
      });
      if (state[layerName] === layerObj.name) img.classList.add('selected');
      div.appendChild(img);
    });
  });
}
buildThumbnails();

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
  // Pick random face/hair/eyes
  state.face = layers.face[Math.floor(Math.random()*layers.face.length)].name;
  state.hair = layers.hair[Math.floor(Math.random()*layers.hair.length)].name;
  state.eyes = layers.eyes[Math.floor(Math.random()*layers.eyes.length)].name;
  buildThumbnails(); // To update the selected highlight
  drawCharacter();
});

// Initial draw
drawCharacter();
