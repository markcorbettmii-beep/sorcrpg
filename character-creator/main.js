// ... (your existing code above unchanged)

// ---------- JPEG Export ----------
document.getElementById("showJpegBtn").addEventListener("click",()=>{
  const canvas = document.getElementById("charCanvas");
  const jpg = document.getElementById("jpegPreview");

  // Create an offscreen canvas for exporting JPEG
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;
  const ctx = exportCanvas.getContext("2d");

  // White background
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

  // Draw body first as usual (full size)
  const bodyImg = new Image();
  bodyImg.src = bodyOptions[selected.body].src;

  // Draw face thumbnail resized and positioned like full face PNG
  const faceThumbImg = new Image();
  faceThumbImg.src = faceOptions[selected.face].thumb;

  // Draw hair on top
  const hairImg = new Image();
  hairImg.src = hairOptions[selected.hair].src;

  // Draw eyes as usual
  const eyesImg = new Image();
  eyesImg.src = eyesOptions[selected.eyes].src;

  // Assume face layer covers 0,0 to canvas.width, canvas.height (like the PNG)
  // If you need a different placement, adjust the drawImage params below.

  let loaded = 0;
  function checkDraw() {
    loaded++;
    if (loaded === 4) {
      ctx.drawImage(bodyImg, 0, 0, exportCanvas.width, exportCanvas.height);
      // Face thumbnail: cover same area as face PNG
      ctx.drawImage(faceThumbImg, 0, 0, exportCanvas.width, exportCanvas.height);
      ctx.drawImage(eyesImg, 0, 0, exportCanvas.width, exportCanvas.height);
      ctx.drawImage(hairImg, 0, 0, exportCanvas.width, exportCanvas.height);

      // Export as JPEG
      jpg.src = exportCanvas.toDataURL("image/jpeg");
      jpg.style.display = "block";
      document.getElementById("saveInstr").style.display = "block";
      canvas.style.display = "none";
      document.getElementById("editingButtons").style.display = "none";
      document.getElementById("jpegButtons").style.display = "block";
    }
  }

  bodyImg.onload = checkDraw;
  faceThumbImg.onload = checkDraw;
  eyesImg.onload = checkDraw;
  hairImg.onload = checkDraw;
  // If any fail to load, still proceed
  bodyImg.onerror = checkDraw;
  faceThumbImg.onerror = checkDraw;
  eyesImg.onerror = checkDraw;
  hairImg.onerror = checkDraw;
});

document.getElementById("backBtn").addEventListener("click",()=>{
  document.getElementById("jpegPreview").style.display = "none";
  document.getElementById("saveInstr").style.display   = "none";
  document.getElementById("charCanvas").style.display  = "block";
  document.getElementById("editingButtons").style.display = "block";
  document.getElementById("jpegButtons").style.display = "none";
});

// ... (rest of your code unchanged)
