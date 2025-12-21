const assetBase = "https://sorcrpg.com/character-creator/assets/";

const layers = {
  body: [
    {name:'lean', src:assetBase+'fbody-type-lean.png'},
    {name:'massive', src:assetBase+'fbody-type-massive.png'},
    {name:'muscular', src:assetBase+'fbody-type-muscular.png'},
    {name:'thin', src:assetBase+'fbody-type-thin.png'},
  ],
  face: [
    {name:'full', src:assetBase+'femface-full.png'},
    {name:'long', src:assetBase+'femface-long.png'},
    {name:'norm', src:assetBase+'femface-norm.png'},
  ],
  hair: [
    {name:'hair1-blck', src:assetBase+'hair1-blck.png'},
    {name:'hair1-red', src:assetBase+'hair1-red.png'},
    {name:'hair2-red', src:assetBase+'hair2-red.png'},
    {name:'hair3-blnd', src:assetBase+'hair3-blnd.png'},
  ],
  eyes: [
    {name:'eyes1-blu', src:assetBase+'eyes1-blu.png'},
    {name:'eyes1-brown', src:assetBase+'eyes1-brown.png'},
    {name:'eyes1-green', src:assetBase+'eyes1-green.png'},
    {name:'eyes2-redbrn', src:assetBase+'eyes2-redbrn.png'},
  ]
};

function physiqueToBody(score) {
  if (score <= 1) return 'thin';
  if (score <= 4) return 'lean';
  if (score <= 20) return 'muscular';
  return 'massive';
}

const state = {
  body: layers.body[0].name,
  face: layers.face[0].name,
  hair: layers.hair[0].name,
  eyes: layers.eyes[0].name,
};

const canvas = document.getElementById('charCanvas');
const ctx = canvas.getContext('2d');

function loadImg(src) {
  return new Promise(res => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => res(img);
    img.onerror = () => res(null);
  });
}

async function drawCharacter() {
  // Fill canvas background with #F6F6F4
  ctx.fillStyle = "#F6F6F4";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw body
  let body = layers.body.find(l => l.name === state.body);
  if (body) {
    let img = await loadImg(body.src);
    if (img) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }
  // Draw face
  let face = layers.face.find(l => l.name === state.face);
  if (face) {
    let img = await loadImg(face.src);
    if (img) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }
  // Draw hair
  let hair = layers.hair.find(l => l.name === state.hair);
  if (hair) {
    let img = await loadImg(hair.src);
    if (img) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }
  // Draw eyes LAST and FULL SIZE (so they always show)
  let eyes = layers.eyes.find(l => l.name === state.eyes);
  if (eyes) {
    let img = await loadImg(eyes.src);
    if (img) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }
}

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

document.getElementById('downloadBtn').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'character.png';
  link.href = canvas.toDataURL();
  link.click();
});

document.getElementById('randomBtn').addEventListener('click', () => {
  const score = parseInt(prompt('SorC says enter physique score number:'), 10) || 1;
  state.body = physiqueToBody(score);
  state.face = layers.face[Math.floor(Math.random()*layers.face.length)].name;
  state.hair = layers.hair[Math.floor(Math.random()*layers.hair.length)].name;
  state.eyes = layers.eyes[Math.floor(Math.random()*layers.eyes.length)].name;
  buildThumbnails();
  drawCharacter();
});

drawCharacter();
