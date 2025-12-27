showJpegBtn.addEventListener("click", function() {
  // Always uses the currently visible canvas contents
  renderCharacter(function(canvas) {
    let dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    jpegPreview.src = dataUrl;
    jpegPreview.style.display = "block";
    saveInstr.style.display = "block";
    jpegButtons.style.display = "block";
    editingButtons.style.display = "none";
    document.getElementById("characterCanvasContainer").style.display = "none";
  });
});
