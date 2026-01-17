function renderFacePreview() {
  const canvas = document.getElementById("faceCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Solid bg for preview
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let layers = [];

  // *** DO NOT SHOW FACE in CLUP preview (only hair + facepaint) ***
  // You can still select faces in the picker, and hold on main canvas to preview, but face is NOT drawn here.

  // Face paint only (if chosen)
  if (selected.facePaint > 0 && facePaintOptions[selected.facePaint]) {
    let paint = facePaintOptions[selected.facePaint];
    if (paint && paint.src && paint.enabled !== false) {
      layers.push({ src: paint.src, layer: "facepaint" });
    }
  }

  // Hair CLUP (always use hair.clup if available)
  if (selected.hair !== -1 && hairOptions[selected.hair]) {
    let hair = hairOptions[selected.hair];
    if (hair && hair.enabled !== false) {
      let hairImg = hair.clup && hair.clup.length > 0 ? hair.clup : hair.src;
      if (hairImg) layers.push({ src: hairImg, layer: "hair" });
    }
  }

  Promise.all(
    layers.map(opt =>
      new Promise(resolve => {
        if (!opt || !opt.src) return resolve(null);
        const im = new window.Image();
        im.src = opt.src;
        im.onload = () => resolve(im);
        im.onerror = () => {
          console.warn(`Failed to load preview image: ${opt.src}`);
          resolve(null);
        };
      })
    )
  ).then(imgs => {
    imgs.forEach(im => {
      if (im) {
        // Draw hair CLUP image centered and fit inside canvas (no cropping/stretching)
        // (If facepaint, it'll be on top)
        const aspectImg = im.width / im.height;
        const aspectCanvas = canvas.width / canvas.height;
        let drawW, drawH, drawX, drawY;
        if (aspectImg > aspectCanvas) {
          // Image is wider than canvas, fit by height
          drawH = canvas.height;
          drawW = im.width * (canvas.height / im.height);
          drawX = (canvas.width - drawW) / 2;
          drawY = 0;
        } else {
          // Image is taller than canvas, fit by width
          drawW = canvas.width;
          drawH = im.height * (canvas.width / im.width);
          drawX = 0;
          drawY = (canvas.height - drawH) / 2;
        }
        ctx.drawImage(im, drawX, drawY, drawW, drawH);
      }
    });
  });
}
